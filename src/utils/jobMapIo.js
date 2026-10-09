import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { chunkIds } from '@/utils/jobMapData';

// Loaded on demand, never with the start-up code (the account menu and the Job Map page import it
// when they need it). The documents live in `jobmap/*`; firestore.rules lets an account read and write
// them only when the owner made it an access document (`jobmap_access/<email>`, in the console).

/**
 * The answer for a read of `jobmap/meta` that threw: false when the rules refused it (permission-denied: the
 * account has no access document, a clean "no access"), else 'failed' (offline, unavailable, a timeout:
 * the read did not say, so an allowed account must not be treated as refused).
 */
export function accessFromError(e) {
  return e?.code === 'permission-denied' ? false : 'failed';
}

/**
 * True when this account may use the Job Map: the server answers the `jobmap/meta` read instead of refusing it.
 * False when it is refused (or there is no cloud); 'failed' when the read itself failed and nothing is known.
 */
export async function hasJobMapAccess() {
  if (!db) return false;
  try { await getDoc(doc(db, 'jobmap', 'meta')); return true; } catch (e) { return accessFromError(e); }
}

// Firestore takes no nested arrays, so a chunk is one JSON string in a field (under the 1 MiB document limit).
const COMPANY_CHUNK = 1500;

/** {crawled, counts, companies} or null when no data was loaded yet. */
export async function loadMeta() {
  const s = await getDoc(doc(db, 'jobmap', 'meta'));
  if (!s.exists()) return null;
  const { crawled, counts, companyChunks } = s.data();
  const parts = await Promise.all(Array.from({ length: companyChunks }, (_, i) => getDoc(doc(db, 'jobmap', `companies-${i}`))));
  return { crawled, counts, companies: parts.flatMap((p) => (p.exists() ? JSON.parse(p.data().json) : [])) };
}

/** All roles of one country: its chunk documents in order. */
export async function loadCountry(country, count) {
  const parts = await Promise.all(chunkIds(country, count).map((id) => getDoc(doc(db, 'jobmap', id))));
  return parts.flatMap((s) => (s.exists() ? JSON.parse(s.data().json) : []));
}

/** Writes a built data file (tools/job-map/build-data.mjs): the chunks one by one, the meta last. */
export async function saveData({ meta, chunks }, onProgress = () => {}) {
  const ids = Object.keys(chunks);
  const companyChunks = Math.ceil(meta.companies.length / COMPANY_CHUNK);
  const total = ids.length + companyChunks;
  let done = 0;
  for (const id of ids) {
    await setDoc(doc(db, 'jobmap', id), { json: JSON.stringify(chunks[id]) });
    onProgress(++done, total);
  }
  for (let i = 0; i < companyChunks; i++) {
    await setDoc(doc(db, 'jobmap', `companies-${i}`), { json: JSON.stringify(meta.companies.slice(i * COMPANY_CHUNK, (i + 1) * COMPANY_CHUNK)) });
    onProgress(++done, total);
  }
  await setDoc(doc(db, 'jobmap', 'meta'), { crawled: meta.crawled, counts: meta.counts, companyChunks });
}
