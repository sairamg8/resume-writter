// Pure helpers for the refresh: how a built data file (build-data.mjs) becomes the `jobmap/*` documents
// src/utils/jobMapIo.js reads, and when a new crawl is too small to be trusted. No Firebase import, so a
// node test loads it as it is (tests/unit/job-map-refresh.unit.mjs).

// Must equal COMPANY_CHUNK in src/utils/jobMapIo.js (the test pins both).
export const COMPANY_CHUNK = 1500;

/** The documents saveData() writes, in its order: the role chunks, the company chunks, the meta last. */
export function dataToDocs({ meta, chunks }) {
  const docs = Object.entries(chunks).map(([id, rows]) => ({ id, data: { json: JSON.stringify(rows) } }));
  const companyChunks = Math.ceil(meta.companies.length / COMPANY_CHUNK);
  for (let i = 0; i < companyChunks; i++) docs.push({ id: `companies-${i}`, data: { json: JSON.stringify(meta.companies.slice(i * COMPANY_CHUNK, (i + 1) * COMPANY_CHUNK)) } });
  docs.push({ id: 'meta', data: { crawled: meta.crawled, counts: meta.counts, companyChunks } });
  return docs;
}

/** Ids in `existing` that the new data no longer writes (a country that shrank, fewer company chunks). */
export function staleIds(existing, docs) {
  const keep = new Set(docs.map((d) => d.id));
  return existing.filter((id) => !keep.has(id));
}

export const total = (counts = {}) => Object.values(counts).reduce((a, n) => a + n, 0);

/** A crawl that lost more than `maxDrop` of the stored roles is a failed crawl (a blocked board, an outage), not news. */
export function shrunkTooFar(previousCounts, nextCounts, maxDrop = 0.4) {
  const before = total(previousCounts);
  return before > 0 && total(nextCounts) < before * (1 - maxDrop);
}
