// R4-PDF-02: a transient HTTP error from jsDelivr (429, 502, 503) no longer marks a font as missing
// for the whole session. fetchMetadata (src/utils/fontsource.js) used to cache any non-OK answer as
// null, so the PDF printed the fallback and the custom-font check refused a real font until a reload.
// Pinned: a 429 or 5xx is asked again on the next call and succeeds once the CDN recovers; a 404 (no
// such package) is still remembered and not asked again. Fontsource's CDN is a stub fetch.
// Run: yarn test:unit
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMetadata, checkFont } from '../../src/utils/fontsource.js';

const META = { family: 'Fictional Sans', weights: [400, 700], styles: ['normal'] };
let saved;
let answers; // pkg → list of statuses to answer with, in turn (the last one repeats)
const asked = [];

before(() => {
  saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const pkg = String(url).match(/@fontsource\/([^@]+)@5\/metadata\.json$/)?.[1];
    asked.push(pkg);
    const list = answers[pkg] || [404];
    const status = list.length > 1 ? list.shift() : list[0];
    return { ok: status === 200, status, json: async () => (status === 200 ? { ...META } : null) };
  };
});
after(() => {
  if (saved === undefined) delete globalThis.fetch;
  else globalThis.fetch = saved;
});

const times = (pkg) => asked.filter((p) => p === pkg).length;

for (const status of [429, 502, 503]) {
  test(`a ${status} is not remembered: the next call asks again and gets the font`, async () => {
    const pkg = `transient-${status}`;
    answers = { [pkg]: [status, 200] };
    assert.equal(await fetchMetadata(pkg), null, `the ${status} build has no metadata`);
    const meta = await fetchMetadata(pkg);
    assert.equal(times(pkg), 2, `asked again after the ${status}`);
    assert.equal(meta?.family, 'Fictional Sans', 'the recovered CDN\'s metadata is used');
    assert.equal(await fetchMetadata(pkg), meta, 'and that success is kept');
    assert.equal(times(pkg), 2);
  });
}

test('checkFont after a 503 finds the font once the CDN recovers', async () => {
  const pkg = 'fictional-sans';
  answers = { [pkg]: [503, 200] };
  assert.equal((await checkFont('Fictional Sans')).ok, false);
  assert.deepEqual(await checkFont('Fictional Sans'), { ok: true, family: 'Fictional Sans', pkg });
});

test('a 404 (no such package) is remembered: not asked again', async () => {
  const pkg = 'nowhere-face';
  answers = { [pkg]: [404, 200] };
  assert.equal(await fetchMetadata(pkg), null);
  assert.equal(await fetchMetadata(pkg), null);
  assert.equal(times(pkg), 1, 'asked once');
});
