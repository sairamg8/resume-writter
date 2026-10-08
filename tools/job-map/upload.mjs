// jobmap-data.json -> the owner's Firestore (`jobmap/*`), the documents the Job Map page reads.
// Usage: node upload.mjs [--dry] [--force]
//   FIREBASE_SERVICE_ACCOUNT  the service-account JSON (one secret in the workflow); it bypasses firestore.rules.
//   --dry    check the file and the shrink guard, write nothing.   --force  skip the shrink guard.
// The meta document is written last, so a reader never sees new counts without their chunks.
import { readFileSync } from 'node:fs';
import { dataToDocs, staleIds, shrunkTooFar, total } from './docs.mjs';

const args = new Set(process.argv.slice(2));
const data = JSON.parse(readFileSync(new URL('./jobmap-data.json', import.meta.url), 'utf8'));
const docs = dataToDocs(data);
console.log(`${docs.length} documents, ${total(data.meta.counts)} roles, ${data.meta.companies.length} companies, crawled ${data.meta.crawled}`);

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
if (prev.exists && !args.has('--force') && shrunkTooFar(prev.data().counts, data.meta.counts)) {
  console.error(`Refusing to upload: ${total(data.meta.counts)} roles against ${total(prev.data().counts)} stored (more than 40% fewer). Check the crawl, or pass --force.`);
  process.exit(1);
}
if (args.has('--dry')) process.exit(0);

for (const { id, data: body } of docs) await col.doc(id).set(body);
const stale = staleIds((await col.listDocuments()).map((d) => d.id), docs);
for (const id of stale) await col.doc(id).delete();
console.log(`Uploaded ${docs.length} documents, removed ${stale.length} stale.`);
