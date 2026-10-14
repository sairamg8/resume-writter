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

// ---- upload guards: a crawl that is only partly there must not replace good data ----

const pct = (x) => `${Math.round(x * 100)}%`;
// More than `limit` of `before` is gone. Dividing keeps an exact 40% / 50% / 20% drop on the safe side of the line.
const dropped = (before, after, limit) => before > 0 && (before - after) / before > limit;
const openByAts = (companies) => {
  const sums = {};
  for (const row of companies) { const ats = row[4]; if (ats && ats !== 'aggregator') sums[ats] = (sums[ats] ?? 0) + (Number(row[5]) || 0); }
  return sums;
};

/**
 * What is wrong with `next` against what is stored (`previous`)? Each side is { counts: {US: n, ...}, companies: rows | null }, a row being
 * [name, category, tier, hq, ats, open, src, careers]; stored companies of null skip the ATS and company checks. [] means fine.
 * Looks at the total, each big country, each big ATS (the total alone misses one board family collapsing), and the number of companies.
 */
export function shrinkProblems({ previous, next }, { maxDrop = 0.4, countryDrop = 0.5, countryMin = 500, atsDrop = 0.5, atsMin = 500, companyDrop = 0.2 } = {}) {
  const out = [];
  const before = total(previous?.counts), after = total(next?.counts);
  if (!(before > 0)) return out;
  if (dropped(before, after, maxDrop)) out.push(`${after} roles against ${before} stored (more than ${pct(maxDrop)} fewer)`);
  for (const [cc, was] of Object.entries(previous.counts)) {
    const now = next?.counts?.[cc] ?? 0;
    if (was >= countryMin && dropped(was, now, countryDrop)) out.push(`${cc} has ${now} roles against ${was} stored (more than ${pct(countryDrop)} fewer)`);
  }
  if (Array.isArray(previous.companies) && Array.isArray(next?.companies)) {
    const was = openByAts(previous.companies), now = openByAts(next.companies);
    for (const [ats, n] of Object.entries(was)) if (n >= atsMin && dropped(n, now[ats] ?? 0, atsDrop)) out.push(`${ats} has ${now[ats] ?? 0} open roles against ${n} stored (more than ${pct(atsDrop)} fewer)`);
    if (dropped(previous.companies.length, next.companies.length, companyDrop)) out.push(`${next.companies.length} companies against ${previous.companies.length} stored (more than ${pct(companyDrop)} fewer)`);
  }
  return out;
}

/** The documents over Firestore's 1 MiB limit (with room to spare): [{id, bytes}]. Such a document cannot be written at all. */
export function oversizedDocs(docs, maxBytes = 900000) {
  return docs.map(({ id, data }) => ({ id, bytes: Buffer.byteLength(JSON.stringify(data)) })).filter((d) => d.bytes > maxBytes);
}

/** Too many job boards failed to be read (more than the larger of `floor` and `share` of those tried): the crawl is not to be trusted. */
export function failedTooMany(failed, attempted, share = 0.03, floor = 10) {
  return failed > Math.max(floor, attempted * share);
}
