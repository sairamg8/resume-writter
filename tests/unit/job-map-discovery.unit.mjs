// Defect: the monthly discovery (tools/job-map/find-companies.mjs) rewrote discovered.json, unresolved.json and jobs-agg.json from
// scratch from what the sources returned that day. About 625 committed companies cannot be found again by it (Workday, the careers
// crawl, careers-link-only rows) and lost their data or vanished, and a flaky source (Wikidata 504, Wikipedia 429, an aggregator down)
// silently gave a smaller list that was then committed. The rules now live in tools/job-map/discovery.mjs (pure): discovery only ever
// adds and updates, a source that collapsed keeps its previous rows, and a run where 3 of the 4 sources (YC, Wikipedia, Wikidata, the
// aggregators) are dead is refused. A renamed board is matched by its (ats, slug), and an unreadable previous file stops the run.
// The last tests run the rules over the REAL committed files. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCE_FLOORS, SOURCE_GROUPS, checkSources, mergeDiscovered, mergeAggregatorRows, assembleDiscovery, parsePrevious } from '../../tools/job-map/discovery.mjs';

const board = (name, extra = {}) => ({ name, tier: 0, ats: 'greenhouse', slug: name.toLowerCase(), category: 'startup', hq: 'us', src: 'yc', ...extra });
const agg = (name, src, extra = {}) => ({ name, category: 'startup', tier: 0, hq: 'de', src, ats: 'aggregator', ...extra });
const rows = (src, n, prefix = src) => Array.from({ length: n }, (_, i) => ({ company: `${prefix} co ${i}`, title: 'Engineer', url: `https://x/${src}/${i}`, src }));
const names = (list) => list.map((e) => e.name);
const nonAgg = (list) => list.filter((e) => e.ats !== 'aggregator');
const isAgg = (list) => list.filter((e) => e.ats === 'aggregator');
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const HEALTHY = { ycHiring: 1495, wikipediaRows: 439, wikidataTotal: 4678, wikidataCountries: 27, aggregatorRows: 2614 };
const none = { boards: [], aggregators: [], unresolved: [], aggJobs: [] };

// ---------------------------------------------------------------- checkSources
test('checkSources: the floors are pinned to the numbers the sources normally beat by a wide margin', () => {
  assert.deepEqual(SOURCE_FLOORS, { ycHiring: 700, wikipediaRows: 200, wikidataTotal: 2000, wikidataCountries: 20, aggregatorRows: 1200 });
  assert.deepEqual(SOURCE_GROUPS, { yc: ['ycHiring'], wikipedia: ['wikipediaRows'], wikidata: ['wikidataTotal', 'wikidataCountries'], aggregators: ['aggregatorRows'] });
});

test('checkSources: numbers at the floor are healthy, one below the floor is low but not fatal', () => {
  assert.deepEqual(checkSources({ ...SOURCE_FLOORS }), { low: [], sources: [], fatal: false });
  assert.deepEqual(checkSources({ ...SOURCE_FLOORS, ycHiring: SOURCE_FLOORS.ycHiring - 1 }), { low: ['ycHiring'], sources: ['yc'], fatal: false });
  assert.deepEqual(checkSources(HEALTHY), { low: [], sources: [], fatal: false });
});

test('checkSources: Wikidata is one source, so its two stats low together are one outage and a warning', () => {
  assert.deepEqual(checkSources({ ...HEALTHY, wikidataTotal: 100, wikidataCountries: 3 }), { low: ['wikidataTotal', 'wikidataCountries'], sources: ['wikidata'], fatal: false });
  assert.deepEqual(checkSources({ ...HEALTHY, wikidataTotal: 100 }), { low: ['wikidataTotal'], sources: ['wikidata'], fatal: false });
  assert.deepEqual(checkSources({ ...HEALTHY, wikidataCountries: 3 }), { low: ['wikidataCountries'], sources: ['wikidata'], fatal: false });
});

test('checkSources: Wikipedia and Wikidata both down with YC and the feeds healthy is not fatal', () => {
  const r = checkSources({ ...HEALTHY, wikipediaRows: 0, wikidataTotal: 0, wikidataCountries: 0 });
  assert.deepEqual(r, { low: ['wikipediaRows', 'wikidataTotal', 'wikidataCountries'], sources: ['wikipedia', 'wikidata'], fatal: false });
});

test('checkSources: three of the four sources low is fatal and the sources are named', () => {
  const r = checkSources({ ...HEALTHY, ycHiring: 0, wikipediaRows: 0, aggregatorRows: 0 });
  assert.equal(r.fatal, true);
  assert.deepEqual(r.sources, ['yc', 'wikipedia', 'aggregators']);
  assert.deepEqual([...r.low].sort(), ['aggregatorRows', 'wikipediaRows', 'ycHiring']);
  const w = checkSources({ ...HEALTHY, ycHiring: 0, wikidataTotal: 0, wikidataCountries: 0, aggregatorRows: 0 });
  assert.equal(w.fatal, true, 'a source with both of its stats low still counts once, the other two make three');
  assert.deepEqual(w.sources, ['yc', 'wikidata', 'aggregators']);
  assert.equal(checkSources({ ...HEALTHY, ycHiring: 0, wikipediaRows: 0, wikidataTotal: 0 }).fatal, true);
  assert.equal(checkSources({ ...HEALTHY, wikipediaRows: 0, wikidataTotal: 0, aggregatorRows: 0 }).fatal, true);
  assert.equal(checkSources({ ...HEALTHY, ycHiring: 0, aggregatorRows: 0 }).fatal, false, 'two sources are a warning');
});

test('checkSources: a missing stat counts as zero, and a missing stats object is every source low', () => {
  const r = checkSources({ ...HEALTHY, wikipediaRows: undefined });
  assert.deepEqual(r, { low: ['wikipediaRows'], sources: ['wikipedia'], fatal: false });
  const two = checkSources({ ycHiring: 1495, aggregatorRows: 2000 });
  assert.deepEqual(two.low, ['wikipediaRows', 'wikidataTotal', 'wikidataCountries']);
  assert.deepEqual([two.sources, two.fatal], [['wikipedia', 'wikidata'], false]);
  assert.equal(checkSources({}).fatal, true);
  assert.deepEqual(checkSources({}).sources, ['yc', 'wikipedia', 'wikidata', 'aggregators']);
  assert.equal(checkSources(undefined).fatal, true);
});

test('checkSources: the floors and the groups can be passed in', () => {
  const groups = { x: ['a'], y: ['b'], z: ['c'] };
  assert.deepEqual(checkSources({ a: 5, b: 5, c: 5 }, { a: 5, b: 6, c: 7 }, groups), { low: ['b', 'c'], sources: ['y', 'z'], fatal: false });
  assert.equal(checkSources({ a: 0, b: 0, c: 0 }, { a: 1, b: 1, c: 1 }, groups).fatal, true);
  assert.equal(checkSources({ a: 0, b: 0, c: 0 }, { a: 1, b: 1, c: 1 }, { x: ['a', 'b'], z: ['c'] }).fatal, false, 'two sources only');
});

// ---------------------------------------------------------------- mergeAggregatorRows
test('mergeAggregatorRows: a source that returned under half of its previous rows keeps the previous rows', () => {
  const prev = [...rows('arbeitnow', 100), ...rows('himalayas', 80)];
  const found = [...rows('arbeitnow', 10, 'new'), ...rows('himalayas', 90, 'newh')];
  const r = mergeAggregatorRows(prev, found);
  assert.deepEqual(r.carried, { arbeitnow: { previous: 100, found: 10 } });
  assert.deepEqual(r.rows.filter((x) => x.src === 'arbeitnow'), prev.filter((x) => x.src === 'arbeitnow'));
  assert.deepEqual(r.rows.filter((x) => x.src === 'himalayas'), found.filter((x) => x.src === 'himalayas'));
  assert.equal(r.rows.length, 190);
});

test('mergeAggregatorRows: a source that is down (no rows at all) is carried', () => {
  const prev = rows('remoteok', 96);
  const r = mergeAggregatorRows(prev, []);
  assert.deepEqual(r.carried, { remoteok: { previous: 96, found: 0 } });
  assert.deepEqual(r.rows, prev);
});

test('mergeAggregatorRows: a healthy source is replaced by what this run found, rows that are gone stay gone', () => {
  const prev = rows('themuse', 100, 'old');
  const found = rows('themuse', 60, 'new');
  const r = mergeAggregatorRows(prev, found);
  assert.deepEqual(r.carried, {});
  assert.deepEqual(r.rows, found);
});

test('mergeAggregatorRows: exactly half is not a collapse, one row less is', () => {
  const prev = rows('arbeitnow', 100, 'old');
  assert.deepEqual(mergeAggregatorRows(prev, rows('arbeitnow', 50, 'new')).carried, {});
  assert.deepEqual(mergeAggregatorRows(prev, rows('arbeitnow', 50, 'new')).rows, rows('arbeitnow', 50, 'new'));
  assert.deepEqual(mergeAggregatorRows(prev, rows('arbeitnow', 49, 'new')).carried, { arbeitnow: { previous: 100, found: 49 } });
});

test('mergeAggregatorRows: a small previous source (under 50 rows) is simply replaced, even by nothing', () => {
  const prev = rows('remotive', 49);
  const r = mergeAggregatorRows(prev, []);
  assert.deepEqual(r.carried, {});
  assert.deepEqual(r.rows, []);
  const r2 = mergeAggregatorRows(rows('remotive', 50), []);
  assert.deepEqual(Object.keys(r2.carried), ['remotive']);
});

test('mergeAggregatorRows: the thresholds can be passed in', () => {
  const prev = rows('a', 10, 'o');
  assert.deepEqual(mergeAggregatorRows(prev, rows('a', 8, 'n'), { minShare: 0.9, minPrevious: 10 }).carried, { a: { previous: 10, found: 8 } });
  assert.deepEqual(mergeAggregatorRows(prev, rows('a', 8, 'n'), { minShare: 0.9, minPrevious: 11 }).carried, {});
});

test('mergeAggregatorRows: rows come out grouped by source, sources in order of first appearance (found first, then carried-only ones)', () => {
  const prev = [...rows('c', 60, 'oc'), ...rows('a', 60, 'oa')];
  const found = [...rows('b', 2, 'nb').slice(0, 1), ...rows('a', 60, 'na').slice(0, 30), ...rows('b', 2, 'nb').slice(1), ...rows('a', 60, 'na').slice(30)];
  const r = mergeAggregatorRows(prev, found);
  assert.deepEqual([...new Set(r.rows.map((x) => x.src))], ['b', 'a', 'c']);
  const srcs = r.rows.map((x) => x.src), firstA = srcs.indexOf('a'), lastA = srcs.lastIndexOf('a');
  assert.equal(srcs.slice(firstA, lastA + 1).every((s) => s === 'a'), true);
  assert.deepEqual(r.rows.filter((x) => x.src === 'c'), prev.filter((x) => x.src === 'c'));
  assert.deepEqual(r.rows.filter((x) => x.src === 'a'), found.filter((x) => x.src === 'a'));
});

test('mergeAggregatorRows: missing arrays are empty arrays', () => {
  assert.deepEqual(mergeAggregatorRows(undefined, undefined), { rows: [], carried: {}, shrunk: {} });
  assert.deepEqual(mergeAggregatorRows(null, rows('a', 3)).rows, rows('a', 3));
});

test('mergeAggregatorRows: a source that fell under 90% but is not a collapse is replaced and reported as shrunk', () => {
  const prev = [...rows('arbeitnow', 100, 'old'), ...rows('himalayas', 100, 'oldh'), ...rows('themuse', 100, 'oldm')];
  const found = [...rows('arbeitnow', 60, 'new'), ...rows('himalayas', 90, 'newh'), ...rows('themuse', 89, 'newm')];
  const r = mergeAggregatorRows(prev, found);
  assert.deepEqual(r.shrunk, { arbeitnow: { previous: 100, found: 60 }, themuse: { previous: 100, found: 89 } });
  assert.deepEqual(r.carried, {});
  assert.deepEqual(r.rows.filter((x) => x.src === 'arbeitnow'), found.filter((x) => x.src === 'arbeitnow'), 'a shrunk source is still replaced by what was found');
  assert.equal(r.rows.length, 60 + 90 + 89);
});

test('mergeAggregatorRows: exactly half is shrunk (not carried), one row less is carried and not shrunk', () => {
  const prev = rows('arbeitnow', 100, 'old');
  const half = mergeAggregatorRows(prev, rows('arbeitnow', 50, 'new'));
  assert.deepEqual([half.shrunk, half.carried], [{ arbeitnow: { previous: 100, found: 50 } }, {}]);
  const under = mergeAggregatorRows(prev, rows('arbeitnow', 49, 'new'));
  assert.deepEqual([under.shrunk, under.carried], [{}, { arbeitnow: { previous: 100, found: 49 } }]);
});

test('mergeAggregatorRows: a source that holds its size or grows, or that was small before, is not shrunk', () => {
  assert.deepEqual(mergeAggregatorRows(rows('a', 100, 'o'), rows('a', 100, 'n')).shrunk, {});
  assert.deepEqual(mergeAggregatorRows(rows('a', 100, 'o'), rows('a', 150, 'n')).shrunk, {});
  assert.deepEqual(mergeAggregatorRows(rows('a', 49, 'o'), rows('a', 10, 'n')).shrunk, {}, 'under minPrevious rows nothing is watched');
  assert.deepEqual(mergeAggregatorRows([], rows('a', 10, 'n')).shrunk, {});
  assert.deepEqual(mergeAggregatorRows(undefined, undefined).shrunk, {});
});

// ---------------------------------------------------------------- mergeDiscovered
test('mergeDiscovered: previous board companies stay in their order, new ones are appended in found order', () => {
  const prev = [board('Zeta'), board('Alpha'), board('Mid')];
  const r = mergeDiscovered(prev, { boards: [board('New2'), board('Alpha'), board('New1')], aggregators: [] });
  assert.deepEqual(names(r.companies), ['Zeta', 'Alpha', 'Mid', 'New2', 'New1']);
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 2, updated: 1, added: 2 });
});

test('mergeDiscovered: a company missing from this run is kept untouched (a flaky source never shrinks the data)', () => {
  const prev = Array.from({ length: 200 }, (_, i) => board(`Co${i}`, { category: 'saas', tier: 2, hq: 'de', website: `https://co${i}.example`, blurb: 'b', size: 900 }));
  const r = mergeDiscovered(prev, { boards: prev.slice(0, 3), aggregators: [] });
  assert.equal(r.companies.length, 200);
  same(r.companies.slice(3), prev.slice(3));
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 197, updated: 3, added: 0 });
});

test('mergeDiscovered: names match whatever the case or the spaces around them', () => {
  const r = mergeDiscovered([board('Acme Corp')], { boards: [board('  ACME corp ', { slug: 'acme-new' })], aggregators: [] });
  assert.equal(r.companies.length, 1);
  assert.equal(r.companies[0].slug, 'acme-new');
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 0, updated: 1, added: 0 });
});

test('mergeDiscovered: an update keeps every stored field the found entry does not have a real value for', () => {
  const stored = { name: 'Acme', tier: 2, ats: 'greenhouse', slug: 'old', category: 'saas', hq: 'de', src: 'wikidata', website: 'https://acme.example', size: 500, blurb: 'We build', open: 12, engineering: 5, careers: 'https://acme.example/jobs' };
  const found = { name: 'Acme', tier: 0, ats: 'lever', slug: 'acme', category: 'startup', hq: '', src: 'yc', website: undefined, size: null, blurb: Number.NaN, open: undefined, careers: null, engineering: '' };
  const [e] = mergeDiscovered([stored], { boards: [found], aggregators: [] }).companies;
  assert.deepEqual(e, { name: 'Acme', tier: 0, ats: 'lever', slug: 'acme', category: 'startup', hq: 'de', src: 'yc', website: 'https://acme.example', size: 500, blurb: 'We build', open: 12, engineering: 5, careers: 'https://acme.example/jobs' });
});

test('mergeDiscovered: a found 0 is a real number and overrides, a found size of null never erases a stored size', () => {
  const [a] = mergeDiscovered([board('A', { size: 800, tier: 3 })], { boards: [board('A', { size: 0, tier: 0 })], aggregators: [] }).companies;
  assert.equal(a.size, 0);
  assert.equal(a.tier, 0);
  const [b] = mergeDiscovered([board('B', { size: 800 })], { boards: [board('B', { size: null })], aggregators: [] }).companies;
  assert.equal(b.size, 800);
});

test('mergeDiscovered: a found field the stored entry never had is added', () => {
  const [e] = mergeDiscovered([{ name: 'Old', tier: 0 }], { boards: [board('Old', { website: 'https://old.example' })], aggregators: [] }).companies;
  assert.equal(e.website, 'https://old.example');
  assert.equal(e.ats, 'greenhouse');
});

test('mergeDiscovered: a company found twice counts once, the first one wins', () => {
  const r = mergeDiscovered([board('Known', { slug: 'k0' })], { boards: [board('Known', { slug: 'k1' }), board('known', { slug: 'k2' }), board('Fresh', { slug: 'f1' }), board('FRESH', { slug: 'f2' })], aggregators: [] });
  assert.deepEqual(r.companies.map((e) => [e.name, e.slug]), [['Known', 'k1'], ['Fresh', 'f1']]);
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 0, updated: 1, added: 1 });
});

test('mergeDiscovered: entries without a name are kept as they are and never matched; a found one without a name is ignored', () => {
  const nameless = { tier: 1, ats: 'workday', slug: 'x' };
  const r = mergeDiscovered([nameless, board('A')], { boards: [{ ats: 'lever', slug: 'y' }, { name: '', ats: 'lever' }, { name: null }, board('A', { slug: 'a2' })], aggregators: [] });
  assert.deepEqual(r.companies[0], nameless);
  assert.equal(r.companies.length, 2);
  assert.equal(r.companies[1].slug, 'a2');
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 1, updated: 1, added: 0 });
});

test('mergeDiscovered: two stored entries with the same name stay both, only the first is updated', () => {
  const r = mergeDiscovered([board('Dup', { slug: 'one' }), board('dup', { slug: 'two' })], { boards: [board('Dup', { slug: 'new' })], aggregators: [] });
  assert.deepEqual(r.companies.map((e) => e.slug), ['new', 'two']);
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 1, updated: 1, added: 0 });
});

test('mergeDiscovered: the inputs are not changed', () => {
  const prev = [board('A', { size: 5 }), agg('Ag', 'remoteok')], found = { boards: [board('A', { size: 7 }), board('B')], aggregators: [agg('Ag2', 'himalayas')] };
  const before = JSON.stringify([prev, found]);
  mergeDiscovered(prev, found, ['remoteok']);
  assert.equal(JSON.stringify([prev, found]), before);
});

test('mergeDiscovered: empty or missing inputs give an empty result and do not throw', () => {
  assert.deepEqual(mergeDiscovered(undefined, undefined), { companies: [], kept: 0, updated: 0, added: 0 });
  assert.deepEqual(mergeDiscovered([], {}), { companies: [], kept: 0, updated: 0, added: 0 });
  assert.deepEqual(names(mergeDiscovered(null, { boards: [board('A')] }).companies), ['A']);
});

test('mergeDiscovered: aggregator companies are exactly this run\'s, in found order; previous ones that were not found are dropped', () => {
  const prev = [board('B1'), agg('OldAgg', 'arbeitnow'), agg('StillAgg', 'arbeitnow')];
  const r = mergeDiscovered(prev, { boards: [], aggregators: [agg('NewAgg', 'himalayas'), agg('StillAgg', 'arbeitnow', { open: 9 })] });
  assert.deepEqual(names(r.companies), ['B1', 'NewAgg', 'StillAgg']);
  assert.equal(isAgg(r.companies)[1].open, 9);
  assert.deepEqual({ kept: r.kept, updated: r.updated, added: r.added }, { kept: 1, updated: 0, added: 0 });
});

test('mergeDiscovered: a board company is never also an aggregator company (kept, updated or added, whatever the case)', () => {
  const prev = [board('Kept'), board('Updated')];
  const r = mergeDiscovered(prev, { boards: [board('Updated'), board('Added')], aggregators: [agg('kept', 'arbeitnow'), agg('UPDATED ', 'remoteok'), agg('added', 'himalayas'), agg('Only Agg', 'himalayas')] });
  assert.deepEqual(names(isAgg(r.companies)), ['Only Agg']);
  assert.deepEqual(names(nonAgg(r.companies)), ['Kept', 'Updated', 'Added']);
});

test('mergeDiscovered: the aggregator companies of a carried source are the previous ones, found ones of that source are dropped', () => {
  const prev = [board('B'), agg('PrevA1', 'arbeitnow'), agg('PrevA2', 'arbeitnow'), agg('PrevR', 'remoteok')];
  const r = mergeDiscovered(prev, { boards: [], aggregators: [agg('FoundA', 'arbeitnow'), agg('FoundR', 'remoteok')] }, ['arbeitnow']);
  assert.deepEqual(names(isAgg(r.companies)), ['FoundR', 'PrevA1', 'PrevA2']);
  same(isAgg(r.companies).slice(1), prev.filter((e) => e.src === 'arbeitnow'));
});

test('mergeDiscovered: a carried previous aggregator company that is now a board company, or already listed from another source, is not repeated', () => {
  const prev = [agg('Became Board', 'arbeitnow'), agg('Twice', 'arbeitnow'), agg('Plain', 'arbeitnow')];
  const r = mergeDiscovered(prev, { boards: [board('became board')], aggregators: [agg('Twice', 'remoteok')] }, ['arbeitnow']);
  assert.deepEqual(names(isAgg(r.companies)).sort(), ['Plain', 'Twice']);
  assert.equal(isAgg(r.companies).find((e) => e.name === 'Twice').src, 'remoteok');
});

test('mergeDiscovered: an aggregator row among the found boards is not taken for a board company', () => {
  const r = mergeDiscovered([], { boards: [agg('Odd', 'arbeitnow')], aggregators: [] });
  assert.deepEqual(r, { companies: [], kept: 0, updated: 0, added: 0 });
});

test('mergeDiscovered: a stored name is replaced by the found spelling, and name keys ignore case and the spaces around them', () => {
  const a = mergeDiscovered([board('acme')], { boards: [board(' Acme ', { slug: 'acme' })], aggregators: [] });
  assert.deepEqual([a.companies.length, a.updated, a.added], [1, 1, 0], '" Acme " is the company "acme"');
  assert.equal(a.companies[0].name, ' Acme ');
  const b = mergeDiscovered([board('Acme Corp')], { boards: [board('ACME CORP')], aggregators: [] });
  assert.deepEqual(names(b.companies), ['ACME CORP']);
  const c = mergeDiscovered([board('  spaced  ')], { boards: [board('SPACED')], aggregators: [] });
  assert.deepEqual([c.companies.length, c.updated], [1, 1]);
});

test('mergeDiscovered: a previous aggregator company with the same trimmed key as a board company is dropped, carried or not', () => {
  const prev = [agg(' Trim Co ', 'arbeitnow'), agg('Other Co', 'arbeitnow')];
  const carried = mergeDiscovered(prev, { boards: [board('trim co')], aggregators: [] }, ['arbeitnow']);
  assert.deepEqual(names(isAgg(carried.companies)), ['Other Co']);
  const fresh = mergeDiscovered([board('Trim Co')], { boards: [], aggregators: [agg('  TRIM CO', 'himalayas'), agg('Other Co', 'himalayas')] });
  assert.deepEqual(names(isAgg(fresh.companies)), ['Other Co']);
});

// A found board is the same company as a stored one when the name keys match OR the board (ats, slug) is the same.
const at = (name, ats, slug, extra = {}) => ({ name, tier: 0, ats, slug, category: 'startup', hq: 'us', src: 'yc', ...extra });
const counts = (r) => ({ kept: r.kept, updated: r.updated, added: r.added });

test('mergeDiscovered: a renamed company is matched by its board, takes the new name and does not appear twice', () => {
  const prev = [at('Acme', 'greenhouse', 'acme', { website: 'https://acme.example', size: 40 }), at('Other', 'lever', 'other')];
  const r = mergeDiscovered(prev, { boards: [at('Acme Inc', 'greenhouse', 'acme')], aggregators: [] });
  assert.deepEqual(r.companies.map((e) => [e.name, e.slug]), [['Acme Inc', 'acme'], ['Other', 'other']]);
  assert.equal(r.companies[0].website, 'https://acme.example', 'the stored fields the found entry lacks stay');
  assert.deepEqual(counts(r), { kept: 1, updated: 1, added: 0 });
  const again = mergeDiscovered(r.companies, { boards: [at('Acme Inc', 'greenhouse', 'acme')], aggregators: [] });
  assert.deepEqual(counts(again), { kept: 1, updated: 1, added: 0 });
  assert.deepEqual(names(again.companies), ['Acme Inc', 'Other']);
});

test('mergeDiscovered: the slug is compared lower-cased and trimmed, the ats exactly', () => {
  const same = mergeDiscovered([at('Old Name', 'ashby', 'Acme-Co')], { boards: [at('New Name', 'ashby', ' acme-co ')], aggregators: [] });
  assert.deepEqual([same.companies.length, same.updated, same.added], [1, 1, 0]);
  const other = mergeDiscovered([at('Old Name', 'greenhouse', 'acme')], { boards: [at('New Name', 'Greenhouse', 'acme')], aggregators: [] });
  assert.deepEqual([other.companies.length, other.updated, other.added], [2, 0, 1], 'ats is not folded');
});

test('mergeDiscovered: the same slug on a different ats is a different company', () => {
  const r = mergeDiscovered([at('Acme', 'greenhouse', 'acme')], { boards: [at('Acme Labs', 'lever', 'acme')], aggregators: [] });
  assert.deepEqual(names(r.companies), ['Acme', 'Acme Labs']);
  assert.deepEqual(counts(r), { kept: 1, updated: 0, added: 1 });
});

test('mergeDiscovered: an empty or missing slug or ats never matches by board', () => {
  const prev = [at('P1', 'greenhouse', ''), at('P2', 'greenhouse', undefined), at('P3', '', 'x'), at('P4', undefined, 'y'), { name: 'P5', tier: 0 }];
  const found = [at('F1', 'greenhouse', ''), at('F2', 'greenhouse', undefined), at('F3', '', 'x'), at('F4', undefined, 'y'), at('F5', null, null)];
  const r = mergeDiscovered(prev, { boards: found, aggregators: [] });
  assert.deepEqual(names(r.companies), ['P1', 'P2', 'P3', 'P4', 'P5', 'F1', 'F2', 'F3', 'F4', 'F5']);
  assert.deepEqual(counts(r), { kept: 5, updated: 0, added: 5 });
});

test('mergeDiscovered: a name match wins over a slug match', () => {
  const prev = [at('X', 'greenhouse', 'x'), at('Y', 'greenhouse', 'y')];
  const r = mergeDiscovered(prev, { boards: [at('X', 'greenhouse', 'y')], aggregators: [] });
  assert.deepEqual(r.companies.map((e) => [e.name, e.slug]), [['X', 'y'], ['Y', 'y']], 'X is updated by name, Y is left alone');
  assert.deepEqual(counts(r), { kept: 1, updated: 1, added: 0 });
});

test('mergeDiscovered: a name match wins over a slug match even when the slug match was found first', () => {
  const prev = [at('A', 'greenhouse', 'a'), at('B', 'greenhouse', 'b')];
  const r = mergeDiscovered(prev, { boards: [at('Zed', 'greenhouse', 'a'), at('A', 'greenhouse', 'q')], aggregators: [] });
  assert.deepEqual(r.companies.map((e) => [e.name, e.slug]), [['A', 'q'], ['B', 'b'], ['Zed', 'a']]);
  assert.deepEqual(counts(r), { kept: 1, updated: 1, added: 1 });
});

test('mergeDiscovered: a stored company is updated at most once, the second claim is a new company', () => {
  const prev = [at('A', 'greenhouse', 'a')];
  const r = mergeDiscovered(prev, { boards: [at('A', 'greenhouse', 'a2'), at('Second Spelling', 'greenhouse', 'a')], aggregators: [] });
  assert.deepEqual(r.companies.map((e) => [e.name, e.slug]), [['A', 'a2'], ['Second Spelling', 'a']]);
  assert.deepEqual(counts(r), { kept: 0, updated: 1, added: 1 });
});

test('mergeDiscovered: of two stored companies on the same board only the first is updated', () => {
  const prev = [at('P1', 'lever', 's'), at('P2', 'lever', 's')];
  const r = mergeDiscovered(prev, { boards: [at('Renamed', 'lever', 's')], aggregators: [] });
  assert.deepEqual(names(r.companies), ['Renamed', 'P2']);
  assert.deepEqual(counts(r), { kept: 1, updated: 1, added: 0 });
});

test('mergeDiscovered: a found board that matches nothing is appended in found order', () => {
  const r = mergeDiscovered([at('A', 'greenhouse', 'a')], { boards: [at('N2', 'lever', 'n2'), at('A2', 'greenhouse', 'a'), at('N1', 'ashby', 'n1')], aggregators: [] });
  assert.deepEqual(names(r.companies), ['A2', 'N2', 'N1']);
  assert.deepEqual(counts(r), { kept: 0, updated: 1, added: 2 });
});

test('mergeDiscovered: two found boards on the same (ats, slug) count once, the first wins', () => {
  const r = mergeDiscovered([], { boards: [at('First', 'ashby', 'acme'), at('Second Spelling', 'ashby', ' ACME'), at('Lever Acme', 'lever', 'acme')], aggregators: [] });
  assert.deepEqual(names(r.companies), ['First', 'Lever Acme']);
  assert.deepEqual(counts(r), { kept: 0, updated: 0, added: 2 });
  const upd = mergeDiscovered([at('Old', 'ashby', 'acme')], { boards: [at('First', 'ashby', 'acme'), at('Second Spelling', 'ashby', 'acme')], aggregators: [] });
  assert.deepEqual(names(upd.companies), ['First']);
  assert.deepEqual(counts(upd), { kept: 0, updated: 1, added: 0 });
});

test('mergeDiscovered: found boards with no slug are not folded together, they stay separate by name', () => {
  const r = mergeDiscovered([], { boards: [at('One', 'greenhouse', ''), at('Two', 'greenhouse', ''), at('Three', 'greenhouse', undefined)], aggregators: [] });
  assert.deepEqual(names(r.companies), ['One', 'Two', 'Three']);
});

// ---------------------------------------------------------------- assembleDiscovery
test('assembleDiscovery: three or more dead sources are fatal and hand back no data to write', () => {
  const previous = { discovered: [board('A')], unresolved: [], aggJobs: [] };
  const found = { boards: [board('B')], aggregators: [], unresolved: [], aggJobs: [] };
  const r = assembleDiscovery({ previous, found, stats: { ...HEALTHY, ycHiring: 0, wikipediaRows: 0, aggregatorRows: 0 } });
  assert.equal(r.fatal, true);
  assert.deepEqual([...r.report.low].sort(), ['aggregatorRows', 'wikipediaRows', 'ycHiring']);
  assert.deepEqual(r.report.sources, ['yc', 'wikipedia', 'aggregators']);
  for (const k of ['discovered', 'unresolved', 'aggJobs']) assert.equal(r[k], undefined, `${k} is not returned`);
  const w = assembleDiscovery({ previous, found, stats: { ...HEALTHY, ycHiring: 0, wikidataTotal: 0, wikidataCountries: 0, aggregatorRows: 0 } });
  assert.equal(w.fatal, true, 'yc + wikidata + aggregators');
  assert.equal(w.discovered, undefined);
});

test('assembleDiscovery: Wikipedia and Wikidata down with everything else healthy still merges', () => {
  const r = assembleDiscovery({ previous: { discovered: [board('A')], unresolved: [], aggJobs: [] }, found: { ...none, boards: [board('B')] }, stats: { ...HEALTHY, wikipediaRows: 0, wikidataTotal: 0, wikidataCountries: 0 } });
  assert.equal(r.fatal, false);
  assert.deepEqual(names(r.discovered), ['A', 'B']);
  assert.deepEqual(r.report.low, ['wikipediaRows', 'wikidataTotal', 'wikidataCountries']);
  assert.deepEqual(r.report.sources, ['wikipedia', 'wikidata']);
});

test('assembleDiscovery: one or two low sources still merge, and are named in the report', () => {
  const r = assembleDiscovery({ previous: { discovered: [board('A')], unresolved: [], aggJobs: [] }, found: { ...none, boards: [board('B')] }, stats: { ...HEALTHY, wikidataTotal: 10, wikidataCountries: 1 } });
  assert.equal(r.fatal, false);
  assert.deepEqual(names(r.discovered), ['A', 'B']);
  assert.deepEqual(r.report.low, ['wikidataTotal', 'wikidataCountries']);
  assert.deepEqual(r.report.sources, ['wikidata']);
  assert.deepEqual(assembleDiscovery({ previous: undefined, found: undefined, stats: HEALTHY }).report.sources, []);
});

test('assembleDiscovery: a source that shrank without collapsing is replaced and listed in the report', () => {
  const previous = { discovered: [], unresolved: [], aggJobs: [...rows('himalayas', 100, 'HI'), ...rows('arbeitnow', 100, 'AN'), ...rows('themuse', 100, 'MU')] };
  // 60 of 100 is under 90% (reported) and over 50% (not a collapse: replaced, not carried); 95 of 100 is not reported
  const found = { ...none, aggJobs: [...rows('themuse', 80, 'MUN'), ...rows('arbeitnow', 95, 'ANN'), ...rows('himalayas', 60, 'HIN')] };
  const r = assembleDiscovery({ previous, found, stats: HEALTHY });
  assert.deepEqual(r.report.shrunk, [{ src: 'themuse', previous: 100, found: 80 }, { src: 'himalayas', previous: 100, found: 60 }]);
  assert.deepEqual(r.report.carried, []);
  assert.equal(r.aggJobs.filter((x) => x.src === 'themuse').length, 80);
  assert.deepEqual(assembleDiscovery({ previous, found: { ...none, aggJobs: previous.aggJobs }, stats: HEALTHY }).report.shrunk, []);
  const gone = assembleDiscovery({ previous, found: none, stats: HEALTHY });
  assert.deepEqual(gone.report.shrunk, [], 'a carried source is reported as carried, not shrunk');
  assert.equal(gone.report.carried.length, 3);
});

test('assembleDiscovery: empty or missing previous and found pieces never throw', () => {
  const a = assembleDiscovery({ previous: undefined, found: undefined, stats: HEALTHY });
  assert.deepEqual([a.fatal, a.discovered, a.unresolved, a.aggJobs], [false, [], [], []]);
  const b = assembleDiscovery({ previous: {}, found: { boards: [board('X')] }, stats: HEALTHY });
  assert.deepEqual(names(b.discovered), ['X']);
  assert.equal(b.report.added, 1);
  assert.equal(assembleDiscovery({ previous: { discovered: [board('Y')] }, found: {}, stats: HEALTHY }).report.kept, 1);
});

test('assembleDiscovery: a run where the sources returned almost nothing loses nothing', () => {
  const discovered = [...Array.from({ length: 300 }, (_, i) => board(`B${i}`, { hq: 'de', category: 'saas', website: `https://b${i}.example` })), ...rows('arbeitnow', 100, 'AN').map((r) => agg(r.company, 'arbeitnow'))];
  const previous = { discovered, unresolved: [{ name: 'U1', tier: 0 }], aggJobs: rows('arbeitnow', 100, 'AN') };
  const r = assembleDiscovery({ previous, found: { boards: [board('B1', { hq: 'de' })], aggregators: [], unresolved: [], aggJobs: [] }, stats: { ...HEALTHY, ycHiring: 800 } });
  assert.equal(nonAgg(r.discovered).length, 300);
  assert.equal(isAgg(r.discovered).length, 100);
  same(r.aggJobs, previous.aggJobs);
  same(r.unresolved, previous.unresolved);
  assert.deepEqual(r.report.carried, [{ src: 'arbeitnow', previous: 100, found: 0 }]);
});

test('assembleDiscovery: the unresolved list is the union by name (found wins) without any company that now has a board', () => {
  const previous = { discovered: [board('HasBoard')], unresolved: [{ name: 'U1', hq: 'us' }, { name: 'u2', hq: 'us' }, { name: 'U3', hq: 'us' }, { name: 'hasboard', hq: 'us' }], aggJobs: [] };
  const found = { ...none, boards: [board('U3')], unresolved: [{ name: 'U2', hq: 'de' }, { name: 'U4', hq: 'in' }] };
  const r = assembleDiscovery({ previous, found, stats: HEALTHY });
  assert.deepEqual(r.unresolved, [{ name: 'U1', hq: 'us' }, { name: 'U2', hq: 'de' }, { name: 'U4', hq: 'in' }]);
  assert.equal(r.report.unresolved, 3);
});

test('assembleDiscovery: aggregator rows follow the per-source rule, and the companies follow the rows', () => {
  const previous = {
    discovered: [agg('AN old', 'arbeitnow'), agg('HI old', 'himalayas')],
    unresolved: [],
    aggJobs: [...rows('arbeitnow', 100, 'AN'), ...rows('himalayas', 100, 'HI')],
  };
  const found = { ...none, aggregators: [agg('AN new', 'arbeitnow'), agg('HI new', 'himalayas')], aggJobs: [...rows('arbeitnow', 10, 'ANN'), ...rows('himalayas', 80, 'HIN')] };
  const r = assembleDiscovery({ previous, found, stats: HEALTHY });
  assert.deepEqual(names(r.discovered), ['HI new', 'AN old']);
  assert.equal(r.aggJobs.filter((x) => x.src === 'arbeitnow').length, 100);
  assert.equal(r.aggJobs.filter((x) => x.src === 'himalayas').length, 80);
  assert.equal(r.aggJobs.some((x) => x.company.startsWith('ANN')), false);
  assert.deepEqual(r.report.carried, [{ src: 'arbeitnow', previous: 100, found: 10 }]);
  assert.equal(r.report.aggregatorRows, 180);
  assert.equal(r.report.aggregatorCompanies, 2);
});

test('assembleDiscovery: a board company is not duplicated as an aggregator company, and its aggregator roles are dropped', () => {
  const previous = { discovered: [board('Stripe')], unresolved: [], aggJobs: [] };
  const found = {
    boards: [board('Acme')],
    aggregators: [agg('acme', 'arbeitnow'), agg('STRIPE', 'arbeitnow'), agg('Elsewhere', 'arbeitnow')],
    unresolved: [],
    aggJobs: [{ company: 'acme', title: 'T', url: 'u1', src: 'arbeitnow' }, { company: 'Stripe', title: 'T', url: 'u2', src: 'arbeitnow' }, { company: 'Elsewhere', title: 'T', url: 'u3', src: 'arbeitnow' }],
  };
  const r = assembleDiscovery({ previous, found, stats: HEALTHY });
  assert.deepEqual(names(r.discovered), ['Stripe', 'Acme', 'Elsewhere']);
  assert.deepEqual(r.aggJobs.map((x) => x.company), ['Elsewhere']);
  assert.deepEqual([r.report.kept, r.report.added, r.report.aggregatorCompanies, r.report.aggregatorRows], [1, 1, 1, 1]);
});

test('assembleDiscovery: a company kept without a readable board (a careers link only) keeps its aggregator roles, and is not listed twice', () => {
  // build-db reads no roles for it (no ats), so the aggregator feed is the only place its roles can come from
  const careersOnly = { name: 'Careers Only', tier: 0, category: 'other', hq: 'in', src: 'careers', careers: 'https://careers.example/jobs' };
  const previous = { discovered: [board('Stripe'), careersOnly], unresolved: [], aggJobs: [] };
  const found = {
    ...none,
    aggregators: [agg('careers only', 'arbeitnow'), agg('Stripe', 'arbeitnow')],
    aggJobs: [{ company: 'careers only', title: 'T', url: 'u1', src: 'arbeitnow' }, { company: 'Stripe', title: 'T', url: 'u2', src: 'arbeitnow' }],
  };
  const r = assembleDiscovery({ previous, found, stats: HEALTHY });
  assert.deepEqual(r.aggJobs.map((x) => x.company), ['careers only'], 'only the company with a readable board loses its aggregator roles');
  assert.deepEqual(names(r.discovered), ['Stripe', 'Careers Only'], 'neither is also listed as an aggregator company');
});

test('assembleDiscovery: carried rows of a company that has a board by now are dropped too', () => {
  const previous = { discovered: [agg('Late Board', 'arbeitnow')], unresolved: [], aggJobs: [...rows('arbeitnow', 60, 'AN'), { company: 'Late Board', title: 'T', url: 'u', src: 'arbeitnow' }] };
  const r = assembleDiscovery({ previous, found: { ...none, boards: [board('Late Board')] }, stats: HEALTHY });
  assert.equal(r.aggJobs.some((x) => x.company === 'Late Board'), false);
  assert.equal(r.aggJobs.length, 60);
  assert.deepEqual(names(isAgg(r.discovered)), []);
});

test('assembleDiscovery: running the same discovery twice changes nothing the second time', () => {
  const previous = { discovered: [board('A', { size: 3 }), agg('G', 'arbeitnow')], unresolved: [{ name: 'U' }], aggJobs: rows('arbeitnow', 60, 'AN') };
  const found = { boards: [board('A', { size: null }), board('B')], aggregators: [agg('G', 'arbeitnow'), agg('H', 'arbeitnow')], unresolved: [{ name: 'U' }, { name: 'V' }], aggJobs: rows('arbeitnow', 60, 'AN') };
  const one = assembleDiscovery({ previous, found, stats: HEALTHY });
  const two = assembleDiscovery({ previous: { discovered: one.discovered, unresolved: one.unresolved, aggJobs: one.aggJobs }, found, stats: HEALTHY });
  same(two.discovered, one.discovered);
  same(two.unresolved, one.unresolved);
  same(two.aggJobs, one.aggJobs);
  assert.equal(two.report.added, 0);
});

// ---------------------------------------------------------------- parsePrevious
test('parsePrevious: a file that does not exist (null or undefined text) is an empty list', () => {
  assert.deepEqual(parsePrevious(null, 'discovered.json'), []);
  assert.deepEqual(parsePrevious(undefined, 'discovered.json'), []);
});

test('parsePrevious: a JSON array is returned as it is', () => {
  assert.deepEqual(parsePrevious('[]', 'unresolved.json'), []);
  assert.deepEqual(parsePrevious('[{"name":"A","tier":0},{"name":"B"}]', 'discovered.json'), [{ name: 'A', tier: 0 }, { name: 'B' }]);
  assert.deepEqual(parsePrevious(' \n[1,2]\n', 'jobs-agg.json'), [1, 2]);
});

test('parsePrevious: text that is not valid JSON throws an Error that names the file', () => {
  for (const bad of ['{', '[{"name":"A"', '<<<<<<< HEAD\n[]\n=======\n[]\n>>>>>>> main', 'not json']) {
    assert.throws(() => parsePrevious(bad, 'discovered.json'), (e) => e instanceof Error && e.message.includes('discovered.json'), bad);
  }
  assert.throws(() => parsePrevious('{', 'jobs-agg.json'), /jobs-agg\.json/);
});

test('parsePrevious: valid JSON that is not an array throws, naming the file', () => {
  for (const bad of ['{"a":1}', 'null', '"text"', '42', 'true']) {
    assert.throws(() => parsePrevious(bad, 'unresolved.json'), (e) => e instanceof Error && e.message.includes('unresolved.json'), bad);
  }
});

test('parsePrevious: an empty file is an error, not an empty list (a truncated write must not become an overwrite)', () => {
  assert.throws(() => parsePrevious('', 'discovered.json'), /discovered\.json/);
  assert.throws(() => parsePrevious('  \n', 'discovered.json'), /discovered\.json/);
});

// ---------------------------------------------------------------- the real committed data
const read = (f) => JSON.parse(readFileSync(new URL(`../../tools/job-map/${f}`, import.meta.url), 'utf8'));
const real = { discovered: read('discovered.json'), unresolved: read('unresolved.json'), aggJobs: read('jobs-agg.json') };
const key = (n) => String(n).trim().toLowerCase();

test('real data: a run that found nothing keeps every board company byte for byte and in order', () => {
  const r = assembleDiscovery({ previous: real, found: none, stats: HEALTHY });
  assert.equal(r.fatal, false);
  assert.ok(nonAgg(real.discovered).length > 1000, 'the committed file has its board companies');
  same(nonAgg(r.discovered), nonAgg(real.discovered));
  assert.deepEqual([r.report.kept, r.report.updated, r.report.added], [nonAgg(real.discovered).length, 0, 0]);
});

test('real data: an empty found list is a collapse for every source that had 50 rows or more, which is carried; the small ones go', () => {
  const per = {};
  for (const x of real.aggJobs) per[x.src] = (per[x.src] ?? 0) + 1;
  const carried = new Set(Object.keys(per).filter((s) => per[s] >= 50));
  const small = Object.keys(per).filter((s) => per[s] < 50);
  const r = assembleDiscovery({ previous: real, found: none, stats: HEALTHY });
  assert.deepEqual(r.report.carried.map((c) => c.src).sort(), [...carried].sort(), 'exactly the sources with 50 rows or more are carried');
  assert.ok(r.report.carried.every((c) => c.previous === per[c.src] && c.found === 0));
  for (const s of small) {
    assert.equal(r.report.carried.some((c) => c.src === s), false, `${s} is too small to be carried`);
    assert.equal(r.aggJobs.some((x) => x.src === s), false, `${s} rows go with the source`);
    assert.equal(isAgg(r.discovered).some((e) => e.src === s), false, `${s} companies go with the source`);
  }
  const board = new Set(nonAgg(real.discovered).map((e) => key(e.name)));
  const read = new Set(nonAgg(real.discovered).filter((e) => e.ats).map((e) => key(e.name)));
  same(isAgg(r.discovered), isAgg(real.discovered).filter((e) => carried.has(e.src) && !board.has(key(e.name))));
  same(r.aggJobs, real.aggJobs.filter((x) => carried.has(x.src) && !read.has(key(x.company))));
  assert.ok(r.aggJobs.length > 1000);
});

test('real data: renaming every 10th board on the committed data moves the entries by their board, none is added or duplicated', () => {
  const idOf = (e) => (e.ats && e.slug ? `${e.ats}\0${String(e.slug).trim().toLowerCase()}` : '');
  const stored = nonAgg(real.discovered);
  let n = 0;
  const found = stored.map((e) => (idOf(e) && n++ % 10 === 0 ? { ...e, name: `${e.name} Inc` } : e));
  const renamed = found.filter((e, i) => e !== stored[i]);
  assert.ok(renamed.length > 50, 'a tenth of the boards were renamed');
  const first = new Set(), unique = found.filter((e) => { const k = idOf(e); if (!k) return true; if (first.has(k)) return false; first.add(k); return true; });
  const survivors = renamed.filter((e) => unique.includes(e));
  const dupsBefore = stored.length - unique.length;
  const r = mergeDiscovered(real.discovered, { boards: found, aggregators: [] });
  assert.deepEqual(counts(r), { kept: dupsBefore, updated: unique.length, added: 0 });
  assert.equal(nonAgg(r.companies).length, stored.length, 'the board entries did not grow');
  const newNames = new Set(survivors.map((e) => e.name));
  assert.equal(nonAgg(r.companies).filter((e) => newNames.has(e.name)).length, survivors.length, 'every rename took effect, once');
  assert.equal(stored.filter((e) => idOf(e) && newNames.has(`${e.name} Inc`)).length, survivors.length);
  assert.equal(nonAgg(r.companies).some((e) => idOf(e) && newNames.has(`${e.name} Inc`)), false, 'the old spellings are gone');
  assert.equal(stored.filter((e) => idOf(e)).length - new Set(nonAgg(r.companies).map(idOf).filter(Boolean)).size, dupsBefore, 'no board is read twice more than before');
  const again = mergeDiscovered(r.companies, { boards: found, aggregators: [] });
  assert.deepEqual(counts(again), { kept: dupsBefore, updated: unique.length, added: 0 });
  same(again.companies, r.companies);
});

test('real data: the unresolved list keeps everything except companies that have a board', () => {
  const r = assembleDiscovery({ previous: real, found: none, stats: HEALTHY });
  const board = new Set(nonAgg(real.discovered).map((e) => key(e.name)));
  same(r.unresolved, real.unresolved.filter((e) => !board.has(key(e.name))));
  assert.ok(r.unresolved.length > 1000);
});

test('real data: merging the committed data with itself changes nothing', () => {
  const found = { boards: nonAgg(real.discovered), aggregators: isAgg(real.discovered), unresolved: real.unresolved, aggJobs: real.aggJobs };
  const r = assembleDiscovery({ previous: real, found, stats: HEALTHY });
  // a board listed twice in the committed file (same ats and slug) is one found board, so its second entry is only kept
  const seen = new Set(), twice = nonAgg(real.discovered).filter((e) => { const b = e.ats && e.slug ? `${e.ats}\0${String(e.slug).trim().toLowerCase()}` : ''; if (!b) return false; if (seen.has(b)) return true; seen.add(b); return false; }).length;
  assert.deepEqual([r.report.kept, r.report.updated, r.report.added], [twice, nonAgg(real.discovered).length - twice, 0]);
  assert.deepEqual(r.report.carried, []);
  assert.deepEqual(r.report.shrunk, []);
  same(nonAgg(r.discovered), nonAgg(real.discovered));
  same(isAgg(r.discovered), isAgg(real.discovered));
  same(r.aggJobs, real.aggJobs);
  const board = new Set(nonAgg(real.discovered).map((e) => key(e.name)));
  same(r.unresolved, real.unresolved.filter((e) => !board.has(key(e.name))));
});
