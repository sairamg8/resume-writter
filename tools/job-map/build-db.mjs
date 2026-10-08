// Reads every company's job board and classifies each role -> db.json (git-ignored).
//   companies.json + discovered.json (a board found) + careers-results.json (a board found by the browser crawl) + jobs-agg.json (job APIs)
// Usage: node build-db.mjs   (about 15 minutes; a board that fails is skipped and listed, never fatal)
import { readFileSync, writeFileSync } from 'node:fs';
import { ATS } from './ats.mjs';
import { classify, countryOf } from './lib.mjs';

const read = (f) => JSON.parse(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'));
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { for (let x; (x = q.shift()); ) await fn(x); })); };

const companies = new Map();
for (const c of read('companies.json')) companies.set(c.name.toLowerCase(), { ...c, src: c.src ?? 'curated' });
for (const c of read('discovered.json')) if (!companies.has(c.name.toLowerCase())) companies.set(c.name.toLowerCase(), c);
for (const c of read('careers-results.json')) {
  const k = c.name.toLowerCase();
  if (companies.has(k)) { const h = companies.get(k); h.careers ??= c.careersUrl; continue; }
  companies.set(k, { name: c.name, tier: 0, category: 'other', hq: '', src: 'careers', ats: c.ats ?? null, slug: c.slug ?? null, careers: c.careersUrl });
}

const jobs = [], failed = [];
const list = [...companies.values()];
await pool(list, 12, async (c) => {
  c.open = 0;
  if (!c.ats || !ATS[c.ats]) return;
  try {
    const raw = (await ATS[c.ats].list(c.slug)) ?? [];
    for (const r of raw) {
      const j = classify(r, 'any');
      if (j) jobs.push({ company: c.name, ...j, country: countryOf(j.location) });
    }
    c.open = raw.length;
  } catch (e) { failed.push(`${c.name}: ${e.message}`); }
  if (jobs.length % 500 < 20) process.stderr.write(`${jobs.length} roles\r`);
});
for (const a of read('jobs-agg.json')) {
  if (!companies.has(a.company.toLowerCase())) companies.set(a.company.toLowerCase(), { name: a.company, tier: 0, category: 'other', hq: '', src: a.src, open: 0 });
  companies.get(a.company.toLowerCase()).open += 1;
  jobs.push(a);
}
writeFileSync(new URL('./db.json', import.meta.url), JSON.stringify({ crawled: new Date().toISOString().slice(0, 10), companies: [...companies.values()], jobs }));
console.log(`${companies.size} companies, ${jobs.length} roles, ${failed.length} boards failed`);
if (failed.length) console.error(failed.slice(0, 30).join('\n'));
