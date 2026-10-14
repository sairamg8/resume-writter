// jobmap-data.json -> the owner's Firestore (`jobmap/*`), the documents the Job Map page reads.
// Usage: node upload.mjs [--dry] [--force]
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON (one secret in the workflow); it bypasses firestore.rules.
//   --dry    check the file and the shrink guards, write nothing.   --force  skip the shrink guards (never the document size check).
// The meta document is written last, so a reader never sees new counts without their chunks.
import { readFileSync } from 'node:fs';
import { dataToDocs, staleIds, shrinkProblems, oversizedDocs, total } from './docs.mjs';

const args = new Set(process.argv.slice(2));
const data = JSON.parse(readFileSync(new URL('./jobmap-data.json', import.meta.url), 'utf8'));
const docs = dataToDocs(data);
console.log(`${docs.length} documents, ${total(data.meta.counts)} roles, ${data.meta.companies.length} companies, crawled ${data.meta.crawled}`);

// A document over Firestore's size limit cannot be written, not even with --force.
const big = oversizedDocs(docs);
if (big.length) {
  for (const { id, bytes } of big) console.error(`Document ${id} is ${bytes} bytes, over the Firestore limit; it cannot be written.`);
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  if (args.has('--dry')) process.exit(0);
  console.error('Set FIREBASE_SERVICE_ACCOUNT to the service-account JSON (or pass --dry).');
  process.exit(1);
}
const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const col = db.collection('jobmap');

const prev = await col.doc('meta').get();
if (prev.exists && !args.has('--force')) {
  // the stored companies (null when a chunk is missing or unreadable) let the guard also look per ATS
  let stored = null;
  try {
    const n = prev.data().companyChunks;
    if (Number.isInteger(n)) {
      stored = [];
      for (let i = 0; i < n; i++) {
        const d = await col.doc(`companies-${i}`).get();
        if (!d.exists) throw new Error(`companies-${i} is missing`);
        stored.push(...JSON.parse(d.data().json));
      }
    }
  } catch (e) { stored = null; console.error(`Stored companies not readable (${e.message}); the per-ATS check is skipped.`); }
  const problems = shrinkProblems({ previous: { counts: prev.data().counts, companies: stored }, next: { counts: data.meta.counts, companies: data.meta.companies } });
  for (const p of problems) console.error(`Refusing to upload: ${p}`);
  if (problems.length) { console.error('Check the crawl, or pass --force.'); process.exit(1); }
}
if (args.has('--dry')) process.exit(0);

// a write that fails is tried again (3 attempts, 500 ms x attempt apart) before the upload gives up
const write = async (id, body) => {
  for (let attempt = 1; ; attempt++) {
    try { return await col.doc(id).set(body); } catch (e) {
      if (attempt >= 3) throw e;
      console.error(`Writing ${id} failed (${e.message}), trying again.`);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
};
for (const { id, data: body } of docs) await write(id, body);
const stale = staleIds((await col.listDocuments()).map((d) => d.id), docs);
for (const id of stale) await col.doc(id).delete();
console.log(`Uploaded ${docs.length} documents, removed ${stale.length} stale.`);
