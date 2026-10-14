// The pure rules of the monthly discovery (no file, no network): discovery only ever ADDS and UPDATES.
//   checkSources         a run where 3 or more of the 5 sources are far below their normal size is fatal (nothing is written)
//   mergeDiscovered      the committed board companies stay (a found one updates them, field by field), new ones are appended;
//                        aggregator companies are rebuilt from this run, except for sources whose rows were carried forward
//   mergeAggregatorRows  a source that returned less than half of its previous rows (it was down) keeps its previous rows
//   assembleDiscovery    the three files find-companies.mjs writes, from what is committed and what this run found
export const SOURCE_FLOORS = { ycHiring: 700, wikipediaRows: 200, wikidataTotal: 2000, wikidataCountries: 20, aggregatorRows: 1200 };

const arr = (x) => (Array.isArray(x) ? x : []);
const keyOf = (e) => (typeof e?.name === 'string' ? e.name.trim().toLowerCase() : '');
const isAgg = (e) => e?.ats === 'aggregator';
const real = (v) => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v));

export function checkSources(stats, floors = SOURCE_FLOORS) {
  const low = Object.keys(floors).filter((k) => !((Number(stats?.[k]) || 0) >= floors[k]));
  return { low, fatal: low.length >= 3 };
}

export function mergeAggregatorRows(previousRows, foundRows, { minShare = 0.5, minPrevious = 50 } = {}) {
  const by = (rows) => { const m = new Map(); for (const r of arr(rows)) { const s = String(r?.src ?? ''); if (!m.has(s)) m.set(s, []); m.get(s).push(r); } return m; };
  const prev = by(previousRows), found = by(foundRows), carried = {}, rows = [];
  for (const s of new Set([...found.keys(), ...prev.keys()])) {
    const p = prev.get(s) ?? [], f = found.get(s) ?? [];
    if (p.length >= minPrevious && f.length < minShare * p.length) { carried[s] = { previous: p.length, found: f.length }; rows.push(...p); }
    else rows.push(...f);
  }
  return { rows, carried };
}

export function mergeDiscovered(previous, found, carriedSrcs = []) {
  const prev = arr(previous).filter((e) => !isAgg(e));
  const boards = new Map();
  for (const e of arr(found?.boards)) { const k = keyOf(e); if (k && !isAgg(e) && !boards.has(k)) boards.set(k, e); }
  const used = new Set(), companies = [];
  let kept = 0, updated = 0;
  for (const e of prev) {
    const k = keyOf(e), f = k && !used.has(k) ? boards.get(k) : undefined;
    if (!f) { companies.push(e); kept++; continue; }
    used.add(k); updated++;
    const next = { ...e };
    for (const [field, v] of Object.entries(f)) if (real(v)) next[field] = v;
    companies.push(next);
  }
  const have = new Set(prev.map(keyOf));
  let added = 0;
  for (const [k, f] of boards) if (!have.has(k)) { companies.push(f); added++; }
  const board = new Set(companies.map(keyOf)), carried = new Set(carriedSrcs), agg = [], seen = new Set();
  for (const e of arr(found?.aggregators)) if (isAgg(e) && !carried.has(e.src) && !board.has(keyOf(e))) { agg.push(e); seen.add(keyOf(e)); }
  for (const e of arr(previous)) if (isAgg(e) && carried.has(e.src) && !board.has(keyOf(e)) && !seen.has(keyOf(e))) agg.push(e);
  return { companies: [...companies, ...agg], kept, updated, added };
}

export function assembleDiscovery({ previous, found, stats }) {
  const { low, fatal } = checkSources(stats);
  if (fatal) return { fatal: true, report: { low, stats: { ...stats } } };
  const { rows, carried } = mergeAggregatorRows(previous?.aggJobs, found?.aggJobs);
  const merged = mergeDiscovered(previous?.discovered, { boards: found?.boards, aggregators: found?.aggregators }, Object.keys(carried));
  const board = new Set(merged.companies.filter((e) => !isAgg(e)).map(keyOf));
  const aggJobs = rows.filter((r) => !board.has(keyOf({ name: r?.company })));
  const un = new Map(), loose = [];
  for (const e of [...arr(previous?.unresolved), ...arr(found?.unresolved)]) { const k = keyOf(e); if (k) un.set(k, e); else loose.push(e); }
  const unresolved = [...un].filter(([k]) => !board.has(k)).map(([, e]) => e).concat(loose);
  const { kept, updated, added } = merged;
  const report = { kept, updated, added, aggregatorCompanies: merged.companies.filter(isAgg).length, aggregatorRows: aggJobs.length, carried: Object.entries(carried).map(([src, c]) => ({ src, ...c })), low, unresolved: unresolved.length };
  return { fatal: false, discovered: merged.companies, unresolved, aggJobs, report };
}
