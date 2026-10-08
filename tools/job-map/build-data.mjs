// db.json -> jobmap-data.json (git-ignored): the file the Job Map page loads into the owner's own account.
//   { meta: {crawled, counts: {US: 1234, ...}, companies: [[name, category, tier, hq, ats, open, src, careers], ...]},
//     chunks: {"US-0": [[company, fn, track, level, title, location, url, position, careers], ...], ...} }
// A chunk is at most CHUNK rows so each stays well under Firestore's 1 MiB document limit.
import { readFileSync, writeFileSync } from 'node:fs';
import { position } from './lib.mjs';

const CHUNK = 1200;
const db = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'));
const idx = new Map(db.companies.map((c, i) => [c.name, i]));
const byCountry = {};
for (const j of db.jobs) (byCountry[j.country] ??= []).push([idx.get(j.company), j.fn, j.track, j.level, j.title, j.location, j.url, j.fn === 'engineering' ? position(j) : '', j.careers ? 1 : 0]);
const chunks = {}, counts = {};
for (const [cc, rows] of Object.entries(byCountry)) {
  counts[cc] = rows.length;
  for (let i = 0; i * CHUNK < rows.length; i++) chunks[`${cc}-${i}`] = rows.slice(i * CHUNK, (i + 1) * CHUNK);
}
const meta = { crawled: db.crawled, counts, companies: db.companies.map((c) => [c.name, c.category, c.tier, c.hq, c.ats ?? '', c.open ?? 0, c.src ?? 'curated', c.careers ?? '']) };
writeFileSync(new URL('./jobmap-data.json', import.meta.url), JSON.stringify({ meta, chunks }));
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(' '));
