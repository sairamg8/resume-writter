// The Job Map (owner-allowed accounts only): its data helpers, and the promise that no address and no
// crawled data is in the app or in the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROW, chunkIds, checkData, filterRows, distinct } from '../../src/utils/jobMapData.js';

const row = (company, fn, level, title, location, track = 'other-eng') => [company, fn, track, level, title, location, `https://x/${title}`, '', 0];
const companies = [['Acme'], ['Globex']];
const rows = [row(0, 'engineering', 'senior', 'Frontend Engineer', 'Berlin, Germany'), row(1, 'legal', 'mid', 'Counsel', 'Berlin, Germany'), row(1, 'engineering', 'mid', 'Backend Engineer', 'Pune, India')];

test('chunkIds names one document per 1200 rows', () => {
  assert.deepEqual(chunkIds('US', 0), []);
  assert.deepEqual(chunkIds('US', 1200), ['US-0']);
  assert.deepEqual(chunkIds('US', 1201), ['US-0', 'US-1']);
});

test('filterRows: each filter narrows, the search needs every word, in title, company or place', () => {
  assert.equal(filterRows(rows, companies, {}).length, 3);
  assert.equal(filterRows(rows, companies, { fn: 'engineering' }).length, 2);
  assert.equal(filterRows(rows, companies, { fn: 'engineering', level: 'mid' }).length, 1);
  assert.equal(filterRows(rows, companies, { q: 'globex berlin' }).length, 1);
  assert.equal(filterRows(rows, companies, { q: 'engineer pune' })[0][ROW.title], 'Backend Engineer');
  assert.equal(filterRows(rows, companies, { q: 'nothing' }).length, 0);
});

test('distinct lists the values most common first, without blanks', () => {
  assert.deepEqual(distinct(rows, ROW.fn), ['engineering', 'legal']);
  assert.deepEqual(distinct([row(0, '', 'a', 't', 'l')], ROW.fn), []);
});

test('checkData refuses what is not a built data file and takes one', () => {
  const ok = { meta: { counts: { DE: 2 }, companies: [] }, chunks: { 'DE-0': rows } };
  assert.equal(checkData(ok), '');
  assert.match(checkData(null), /not a Job Map/);
  assert.match(checkData({ chunks: {} }), /no meta/);
  assert.match(checkData({ meta: ok.meta }), /no chunks/);
  assert.match(checkData({ meta: ok.meta, chunks: { bad: [] } }), /not a chunk id/);
  assert.match(checkData({ meta: ok.meta, chunks: { 'DE-0': [[1, 2]] } }), /not a role/);
});

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

test('no e-mail address of an allowed account is in the app or the rules; the app imports nothing of the crawl', () => {
  const root = new URL('../../', import.meta.url).pathname;
  const sources = [...files(join(root, 'src')), join(root, 'firestore.rules')];
  for (const f of sources) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /gudiputi/i, `${f} names an account`);
    // Comments may name the tool; code (an import, a fetch, a path string) may not reach the crawl.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /tools\/job-map|jobs-agg|careers-results|discovered\.json/, `${f} reaches the crawl data`);
  }
});

test('the menu item and the page wait for the server: no access means no button and a redirect', () => {
  const root = new URL('../../', import.meta.url).pathname;
  const hook = readFileSync(join(root, 'src/hooks/useJobMapAccess.js'), 'utf8');
  assert.match(hook, /useState\(null\)/, 'unknown until the server answers');
  assert.match(hook, /catch|, \(\) => \{ if \(live\) setOk\(false\)/, 'a refusal is false');
  const bar = readFileSync(join(root, 'src/components/AuthBar.jsx'), 'utf8');
  assert.match(bar, /lazy\(\(\) => import\('@\/pages\/JobMap'\)/, 'the item and its check share the page's lazy chunk, off the start-up path');
  assert.doesNotMatch(bar, /useJobMapAccess|lucide-react'.*Map/, 'the entry holds neither the hook nor the icon');
  const item = readFileSync(join(root, 'src/pages/JobMap.jsx'), 'utf8');
  assert.match(item, /allowed !== true\) return null/, 'the item shows only when access is true');
  const page = readFileSync(join(root, 'src/pages/JobMap.jsx'), 'utf8');
  assert.match(page, /!auth\.user \|\| allowed === false\) return <Navigate to="\/" replace \/>/);
});
