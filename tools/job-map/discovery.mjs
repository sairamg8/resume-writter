// The pure rules of the monthly discovery (no file, no network): discovery only ever ADDS and UPDATES.
//   parsePrevious        the text of a committed file as a list: a missing file is [], an unreadable one throws (never an overwrite)
//   checkSources         a run where 3 or more of the 4 sources (yc, wikipedia, wikidata, aggregators) are far below their normal
//                        size is fatal (nothing is written); a source is low when any of its stats is below its floor
//   mergeDiscovered      the committed board companies stay (a found one updates them, field by field, matched by name or by its
//                        (ats, slug) board), new ones are appended; aggregator companies are rebuilt from this run, except for
//                        sources whose rows were carried forward
//   mergeAggregatorRows  a source that returned less than half of its previous rows (it was down) keeps its previous rows;
//                        one that returned less than 90% of them is replaced but reported as shrunk
//   assembleDiscovery    the three files find-companies.mjs writes, from what is committed and what this run found
export const SOURCE_FLOORS = { ycHiring: 700, wikipediaRows: 200, wikidataTotal: 2000, wikidataCountries: 20, aggregatorRows: 1200 };
export const SOURCE_GROUPS = { yc: ['ycHiring'], wikipedia: ['wikipediaRows'], wikidata: ['wikidataTotal', 'wikidataCountries'], aggregators: ['aggregatorRows'] };

const arr = (x) => (Array.isArray(x) ? x : []);
const keyOf = (e) => (typeof e?.name === 'string' ? e.name.trim().toLowerCase() : '');
const isAgg = (e) => e?.ats === 'aggregator';
const real = (v) => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v));

// A board is one (ats, slug); an entry without both has no board identity and is matched by name only.
const boardOf = (e) => { const a = typeof e?.ats === 'string' ? e.ats : '', s = typeof e?.slug === 'string' ? e.slug.trim().toLowerCase() : ''; return a && s ? `${a}\0${s}` : ''; };

export function parsePrevious(text, name) {
  if (text === null || text === undefined) return [];
  let x;
  try { x = JSON.parse(text); } catch (e) { throw new Error(`${name} is not valid JSON (${e.message}); refusing to rewrite it from scratch`); }
  if (!Array.isArray(x)) throw new Error(`${name} is not a JSON array; refusing to rewrite it from scratch`);
  return x;
}

export function checkSources(stats, floors = SOURCE_FLOORS, groups = SOURCE_GROUPS) {
  const low = Object.keys(floors).filter((k) => !((Number(stats?.[k]) || 0) >= floors[k]));
  const sources = Object.keys(groups).filter((g) => groups[g].some((k) => low.includes(k)));
  return { low, sources, fatal: sources.length >= 3 };
}

export function mergeAggregatorRows(previousRows, foundRows, { minShare = 0.5, minPrevious = 50, warnShare = 0.9 } = {}) {
  const by = (rows) => { const m = new Map(); for (const r of arr(rows)) { const s = String(r?.src ?? ''); if (!m.has(s)) m.set(s, []); m.get(s).push(r); } return m; };
  const prev = by(previousRows), found = by(foundRows), carried = {}, shrunk = {}, rows = [];
  for (const s of new Set([...found.keys(), ...prev.keys()])) {
    const p = prev.get(s) ?? [], f = found.get(s) ?? [];
    if (p.length >= minPrevious && f.length < minShare * p.length) { carried[s] = { previous: p.length, found: f.length }; rows.push(...p); }
    else { rows.push(...f); if (p.length >= minPrevious && f.length < warnShare * p.length) shrunk[s] = { previous: p.length, found: f.length }; }
  }
  return { rows, carried, shrunk };
}

export function mergeDiscovered(previous, found, carriedSrcs = []) {
  const prev = arr(previous).filter((e) => !isAgg(e));
  const boards = [], seenName = new Set(), seenBoard = new Set();
  for (const e of arr(found?.boards)) {
    const k = keyOf(e), b = boardOf(e);
    if (!k || isAgg(e) || seenName.has(k) || (b && seenBoard.has(b))) continue;
    seenName.add(k); if (b) seenBoard.add(b); boards.push(e);
  }
  // a found board takes the first unused stored entry of its name; those left take the first unused one on the same board
  const byName = new Map(), byBoard = new Map(), hit = new Map(), matched = new Set(), rest = [];
  prev.forEach((e, i) => { const k = keyOf(e), b = boardOf(e); if (k && !byName.has(k)) byName.set(k, i); if (b) { if (!byBoard.has(b)) byBoard.set(b, []); byBoard.get(b).push(i); } });
  for (const f of boards) { const i = byName.get(keyOf(f)); if (i === undefined) rest.push(f); else { hit.set(i, f); matched.add(f); } }
  for (const f of rest) { const i = (byBoard.get(boardOf(f)) ?? []).find((x) => !hit.has(x)); if (i !== undefined) { hit.set(i, f); matched.add(f); } }
  const companies = [];
  let kept = 0, updated = 0, added = 0;
  prev.forEach((e, i) => {
    const f = hit.get(i);
    if (!f) { companies.push(e); kept++; return; }
    updated++;
    const next = { ...e };
    for (const [field, v] of Object.entries(f)) if (real(v)) next[field] = v;
    companies.push(next);
  });
  for (const f of boards) if (!matched.has(f)) { companies.push(f); added++; }
  const board = new Set(companies.map(keyOf)), carried = new Set(carriedSrcs), agg = [], seen = new Set();
  for (const e of arr(found?.aggregators)) if (isAgg(e) && !carried.has(e.src) && !board.has(keyOf(e))) { agg.push(e); seen.add(keyOf(e)); }
  for (const e of arr(previous)) if (isAgg(e) && carried.has(e.src) && !board.has(keyOf(e)) && !seen.has(keyOf(e))) agg.push(e);
  return { companies: [...companies, ...agg], kept, updated, added };
}

export function assembleDiscovery({ previous, found, stats }) {
  const { low, sources, fatal } = checkSources(stats);
  if (fatal) return { fatal: true, report: { low, sources, stats: { ...stats } } };
  const { rows, carried, shrunk } = mergeAggregatorRows(previous?.aggJobs, found?.aggJobs);
  const merged = mergeDiscovered(previous?.discovered, { boards: found?.boards, aggregators: found?.aggregators }, Object.keys(carried));
  const board = new Set(merged.companies.filter((e) => !isAgg(e)).map(keyOf));
  // A company whose board is read (ats set) gets its roles from the board; one kept with only a careers link has no roles but these.
  const read = new Set(merged.companies.filter((e) => !isAgg(e) && e.ats).map(keyOf));
  const aggJobs = rows.filter((r) => !read.has(keyOf({ name: r?.company })));
  const un = new Map(), loose = [];
  for (const e of [...arr(previous?.unresolved), ...arr(found?.unresolved)]) { const k = keyOf(e); if (k) un.set(k, e); else loose.push(e); }
  const unresolved = [...un].filter(([k]) => !board.has(k)).map(([, e]) => e).concat(loose);
  const { kept, updated, added } = merged;
  const report = { kept, updated, added, aggregatorCompanies: merged.companies.filter(isAgg).length, aggregatorRows: aggJobs.length, carried: Object.entries(carried).map(([src, c]) => ({ src, ...c })), shrunk: Object.entries(shrunk).map(([src, c]) => ({ src, ...c })), low, sources, unresolved: unresolved.length };
  return { fatal: false, discovered: merged.companies, unresolved, aggJobs, report };
}
