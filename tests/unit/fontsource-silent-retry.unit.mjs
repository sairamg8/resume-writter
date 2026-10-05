// A Fontsource metadata lookup that got no answer in time is not asked again for a minute (R2-142, review
// of 38e7b70e). A lookup waits 8 s at most (src/utils/fontsource.js), and a failure that says nothing about
// the font was never kept, so on a CDN that takes the connection and says nothing every PDF build paid the
// whole wait again for each font. Now a timed-out lookup is remembered for a minute, or until the browser
// is back online, and lookups meanwhile get it at once; the Typography panel's font check asks again (it is
// no build) and still says it could not check. A quick failure (offline, a 429 or 5xx) is asked again next
// time, as before (tests/unit/r4pdf-fontsource-retry). Fontsource's CDN is a stub fetch.
// Run: yarn test:unit
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Before fontsource.js loads: it listens for 'online' on globalThis, which Node lacks.
const onlineListeners = [];
globalThis.addEventListener = (type, fn) => { if (type === 'online') onlineListeners.push(fn); };
const backOnline = () => onlineListeners.forEach((fn) => fn());
const { fetchMetadata, checkFont } = await import('../../src/utils/fontsource.js');

const META = { family: 'Fictional Sans', weights: [400, 700], styles: ['normal'] };
const realNow = Date.now;
let saved;
let answers; // pkg → what to answer with, in turn (the last one repeats): 'timeout', 'offline' or a status
const asked = [];

before(() => {
  saved = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const pkg = String(url).match(/@fontsource\/([^@]+)@5\/metadata\.json$/)?.[1];
    asked.push(pkg);
    const list = answers[pkg] || [404];
    const answer = list.length > 1 ? list.shift() : list[0];
    // The lookup's own limit (AbortSignal.timeout) reached: what fetch rejects with then.
    if (answer === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    if (answer === 'offline') throw new TypeError('fetch failed');
    return { ok: answer === 200, status: answer, json: async () => (answer === 200 ? { ...META } : null) };
  };
});
afterEach(() => { Date.now = realNow; });
after(() => {
  if (saved === undefined) delete globalThis.fetch;
  else globalThis.fetch = saved;
  delete globalThis.addEventListener;
});

const times = (pkg) => asked.filter((p) => p === pkg).length;

test('a lookup that timed out is not asked again for a minute; then it is', async () => {
  const pkg = 'silent-sans';
  answers = { [pkg]: ['timeout', 200] };
  assert.equal(await fetchMetadata(pkg), null, 'no metadata: the font prints in Noto Sans');
  assert.equal(await fetchMetadata(pkg), null, 'the next build has the failure at once');
  assert.equal(times(pkg), 1, 'not asked again within the minute (was: every build waited the whole 8 s again)');
  const later = realNow() + 61_000;
  Date.now = () => later;
  assert.equal((await fetchMetadata(pkg))?.family, 'Fictional Sans', 'a minute on it is asked again');
  assert.equal(times(pkg), 2);
});

test('back online, a lookup that timed out is asked again at once', async () => {
  const pkg = 'silent-serif';
  answers = { [pkg]: ['timeout', 200] };
  assert.equal(await fetchMetadata(pkg), null);
  backOnline();
  assert.equal((await fetchMetadata(pkg))?.family, 'Fictional Sans');
  assert.equal(times(pkg), 2);
});

test('the font check asks again now, and says it could not check rather than that there is no such font', async () => {
  const pkg = 'silent-grotesk';
  answers = { [pkg]: ['timeout', 'timeout', 200] };
  assert.equal(await fetchMetadata(pkg), null);
  assert.deepEqual(await checkFont('Silent Grotesk'), { ok: false, family: null, pkg, offline: true });
  assert.equal(times(pkg), 2, 'the check asked the CDN itself');
  assert.deepEqual(await checkFont('Silent Grotesk'), { ok: true, family: 'Fictional Sans', pkg });
});

test('a quick failure (offline) is asked again next time, as before', async () => {
  const pkg = 'offline-sans';
  answers = { [pkg]: ['offline', 200] };
  assert.equal(await fetchMetadata(pkg), null);
  assert.equal((await fetchMetadata(pkg))?.family, 'Fictional Sans');
  assert.equal(times(pkg), 2);
});
