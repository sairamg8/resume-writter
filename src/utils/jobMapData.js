// The Job Map's data, as the owner's accounts hold it (docs `jobmap/meta` and `jobmap/<COUNTRY>-<n>`,
// firestore.rules). Pure functions, relative imports only: Node's test runner loads this file as it is
// (tests/unit/job-map.unit.mjs). The rows are written by tools/job-map/build-data.mjs.

import { safeHref } from './richText.js';

/** A row's fields, by position (build-data.mjs). */
export const ROW = { company: 0, fn: 1, track: 2, level: 3, title: 4, location: 5, url: 6, position: 7, careers: 8 };

export const FUNCTION_LABELS = {
  compliance: 'Compliance / AML / KYC', legal: 'Legal', data: 'Data & analytics', engineering: 'Engineering', design: 'Design',
  product: 'Product & projects', risk: 'Risk, audit & insurance', finance: 'Finance & banking', hr: 'HR & recruiting',
  sales: 'Sales & business development', marketing: 'Marketing & comms', support: 'Customer support', ops: 'Operations & admin', other: 'Other',
};

/**
 * Where a role's link goes: its posting's http(s) address ("company.com/jobs/1" gets https://), else null and the
 * row is not a link. The rows come from crawled job boards and are shared by every allowed account, so a posting
 * address of javascript:, data:, vbscript: or file: must not reach an href.
 */
export function roleHref(url) {
  const href = safeHref(url);
  return href && /^https?:\/\//i.test(href) ? href : null;
}

/**
 * The country the page opens on: India when the data has roles there (the owner's first market), else the
 * country with the most roles. A fixed 'IN' left the Country select with no matching option and an empty
 * list, until a country was picked, when the data had none. `counts` is meta.counts ({ CODE: rows }).
 */
export function startCountry(counts) {
  if (counts?.IN > 0) return 'IN';
  const [best] = Object.entries(counts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return best ? best[0] : 'IN';
}

/** The document ids of one country's chunks: `US-0` … `US-<n-1>` for `count` rows of CHUNK each. */
export function chunkIds(country, count, chunk = 1200) {
  return Array.from({ length: Math.ceil(count / chunk) }, (_, i) => `${country}-${i}`);
}

/** What a file must hold to be loaded: meta with counts and companies, and chunks of rows. Returns an error text, or '' when fine. */
export function checkData(data) {
  if (!data || typeof data !== 'object') return 'This is not a Job Map data file.';
  const { meta, chunks } = data;
  if (!meta || typeof meta !== 'object' || !meta.counts || !Array.isArray(meta.companies)) return 'The file has no meta (counts and companies).';
  if (!chunks || typeof chunks !== 'object') return 'The file has no chunks of roles.';
  for (const [id, rows] of Object.entries(chunks)) {
    if (!/^[A-Z]+-\d+$/.test(id)) return `"${id}" is not a chunk id like US-0.`;
    if (!Array.isArray(rows) || rows.some((r) => !Array.isArray(r) || r.length < 9)) return `Chunk ${id} holds a row that is not a role.`;
  }
  return '';
}

/**
 * `f` as it applies to `rows`: a function, level or stack that none of the rows has is dropped. The
 * selects list only the values of the rows shown, so one chosen in another country matched nothing, drew
 * as "Any …" (a select with no matching option shows its first), and the page said "0 roles" under it.
 */
export function filtersFor(rows, f) {
  const out = { ...f };
  for (const [key, field] of [['fn', ROW.fn], ['level', ROW.level], ['track', ROW.track]]) {
    if (f[key] && !rows.some((r) => r[field] === f[key])) out[key] = '';
  }
  return out;
}

/** Rows that pass the filters. `q` matches the title, company and location, every word of it. */
export function filterRows(rows, companies, { fn = '', level = '', track = '', q = '' } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (fn && r[ROW.fn] !== fn) return false;
    if (level && r[ROW.level] !== level) return false;
    if (track && r[ROW.track] !== track) return false;
    if (!words.length) return true;
    const hay = `${r[ROW.title]} ${companies[r[ROW.company]]?.[0] ?? ''} ${r[ROW.location]}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** The distinct values of one row field, most common first. */
export function distinct(rows, field) {
  const n = new Map();
  for (const r of rows) n.set(r[field], (n.get(r[field]) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([v]) => v).filter(Boolean);
}
