// The Job Map fetch retry (tools/job-map/retry.mjs): a busy host (429/502/503/504) is asked again after a
// pause, anything else is answered at once, a thrown error is never retried. No network, no timers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETRY_STATUSES, retryDelayMs, fetchRetry } from '../../tools/job-map/retry.mjs';

const resp = (status, headers = {}) => new Response(status === 200 ? '{"ok":1}' : null, { status, headers });
// A fetch that answers the scripted responses in turn (the last one repeats) and records every call.
function scripted(...answers) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); const a = answers[Math.min(calls.length - 1, answers.length - 1)]; if (a instanceof Error) throw a; return a; };
  return { fetchImpl, calls };
}
const recorder = () => { const sleeps = []; return { sleeps, sleep: async (ms) => { sleeps.push(ms); } }; };

test('only a busy host is retried', () => {
  assert.deepEqual([...RETRY_STATUSES].sort(), [429, 502, 503, 504]);
});

test('retryDelayMs: Retry-After seconds win, else exponential from the base, both capped', () => {
  assert.equal(retryDelayMs(0, null), 1500);
  assert.equal(retryDelayMs(1, null), 3000);
  assert.equal(retryDelayMs(2, null), 6000);
  assert.equal(retryDelayMs(10, null), 30000);
  assert.equal(retryDelayMs(0, '2'), 2000);
  assert.equal(retryDelayMs(3, '2'), 2000);
  assert.equal(retryDelayMs(0, '120'), 30000);
  assert.equal(retryDelayMs(0, '120', { cap: 5000 }), 5000);
  assert.equal(retryDelayMs(1, null, { base: 100 }), 200);
  assert.equal(retryDelayMs(0, 'Wed, 21 Oct 2026 07:28:00 GMT'), 1500);
  assert.equal(retryDelayMs(1, ''), 3000);
});

test('a first answer that is fine costs no pause and one call', async () => {
  const { fetchImpl, calls } = scripted(resp(200));
  const { sleeps, sleep } = recorder();
  const r = await fetchRetry('https://x.test/a', {}, { fetchImpl, sleep });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test('429 then 200: one pause, the 200 comes back', async () => {
  const { fetchImpl, calls } = scripted(resp(429), resp(200));
  const { sleeps, sleep } = recorder();
  const r = await fetchRetry('https://x.test/a', {}, { fetchImpl, sleep });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: 1 });
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [1500]);
});

test('each status of a busy host is retried', async () => {
  for (const status of [429, 502, 503, 504]) {
    const { fetchImpl, calls } = scripted(resp(status), resp(200));
    const { sleeps, sleep } = recorder();
    assert.equal((await fetchRetry('https://x.test/a', {}, { fetchImpl, sleep })).status, 200, String(status));
    assert.equal(calls.length, 2, String(status));
    assert.equal(sleeps.length, 1, String(status));
  }
});

test('Retry-After seconds set the pause, and a huge one is capped', async () => {
  let s = recorder();
  await fetchRetry('https://x.test/a', {}, { fetchImpl: scripted(resp(429, { 'retry-after': '2' }), resp(200)).fetchImpl, sleep: s.sleep });
  assert.deepEqual(s.sleeps, [2000]);
  s = recorder();
  await fetchRetry('https://x.test/a', {}, { fetchImpl: scripted(resp(503, { 'retry-after': '600' }), resp(200)).fetchImpl, sleep: s.sleep });
  assert.deepEqual(s.sleeps, [30000]);
  s = recorder();
  await fetchRetry('https://x.test/a', {}, { fetchImpl: scripted(resp(503, { 'retry-after': '600' }), resp(200)).fetchImpl, sleep: s.sleep, cap: 4000 });
  assert.deepEqual(s.sleeps, [4000]);
});

test('without Retry-After the pause doubles from the base', async () => {
  const { sleeps, sleep } = recorder();
  await fetchRetry('https://x.test/a', {}, { fetchImpl: scripted(resp(429), resp(429), resp(200)).fetchImpl, sleep });
  assert.deepEqual(sleeps, [1500, 3000]);
  const b = recorder();
  await fetchRetry('https://x.test/a', {}, { fetchImpl: scripted(resp(429), resp(429), resp(200)).fetchImpl, sleep: b.sleep, base: 10 });
  assert.deepEqual(b.sleeps, [10, 20]);
});

test('429 for ever: the last 429 comes back after retries + 1 calls and retries pauses', async () => {
  const last = resp(429);
  const { fetchImpl, calls } = scripted(resp(429), resp(429), last);
  const { sleeps, sleep } = recorder();
  const r = await fetchRetry('https://x.test/a', {}, { fetchImpl, sleep });
  assert.equal(r, last);
  assert.equal(r.status, 429);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1500, 3000]);
});

test('the number of retries is the caller\'s', async () => {
  let s = recorder(), c = scripted(resp(504));
  assert.equal((await fetchRetry('https://x.test/a', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep, retries: 0 })).status, 504);
  assert.equal(c.calls.length, 1);
  assert.deepEqual(s.sleeps, []);
  s = recorder(); c = scripted(resp(504));
  await fetchRetry('https://x.test/a', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep, retries: 5 });
  assert.equal(c.calls.length, 6);
  assert.deepEqual(s.sleeps, [1500, 3000, 6000, 12000, 24000]);
});

test('404, 500, 400, 401, 403 are answered at once, never retried', async () => {
  for (const status of [404, 500, 400, 401, 403]) {
    const { fetchImpl, calls } = scripted(resp(status), resp(200));
    const { sleeps, sleep } = recorder();
    const r = await fetchRetry('https://x.test/a', {}, { fetchImpl, sleep });
    assert.equal(r.status, status);
    assert.equal(calls.length, 1, String(status));
    assert.deepEqual(sleeps, [], String(status));
  }
});

test('a thrown error (dead host, timeout) goes up after ONE attempt', async () => {
  const { fetchImpl, calls } = scripted(new TypeError('fetch failed'));
  const { sleeps, sleep } = recorder();
  await assert.rejects(fetchRetry('https://x.test/a', {}, { fetchImpl, sleep }), /fetch failed/);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test('an error on a later attempt also goes straight up', async () => {
  const { fetchImpl, calls } = scripted(resp(429), new Error('timed out'), resp(200));
  const { sleeps, sleep } = recorder();
  await assert.rejects(fetchRetry('https://x.test/a', {}, { fetchImpl, sleep }), /timed out/);
  assert.equal(calls.length, 2);
  assert.equal(sleeps.length, 1);
});

test('with timeoutMs every attempt gets its own fresh signal, not the caller\'s', async () => {
  const mine = new AbortController().signal;
  const { fetchImpl, calls } = scripted(resp(429), resp(429), resp(200));
  const { sleep } = recorder();
  await fetchRetry('https://x.test/a', { signal: mine }, { fetchImpl, sleep, timeoutMs: 5000 });
  const signals = calls.map((c) => c.init.signal);
  assert.equal(signals.length, 3);
  for (const s of signals) { assert.ok(s instanceof AbortSignal); assert.notEqual(s, mine); }
  assert.equal(new Set(signals).size, 3);
});

test('without timeoutMs the caller\'s init is passed as it is', async () => {
  const mine = new AbortController().signal;
  const { fetchImpl, calls } = scripted(resp(200));
  await fetchRetry('https://x.test/a', { signal: mine }, { fetchImpl });
  assert.equal(calls[0].init.signal, mine);
});

test('method, body and headers reach every attempt unchanged, and the caller\'s init is not touched', async () => {
  const init = { method: 'POST', body: '{"q":1}', headers: { 'content-type': 'application/json', 'user-agent': 'ua' } };
  const copy = structuredClone(init);
  const { fetchImpl, calls } = scripted(resp(503), resp(200));
  const { sleep } = recorder();
  await fetchRetry('https://x.test/a', init, { fetchImpl, sleep, timeoutMs: 1000 });
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.url, 'https://x.test/a');
    assert.equal(c.init.method, 'POST');
    assert.equal(c.init.body, '{"q":1}');
    assert.deepEqual(c.init.headers, copy.headers);
  }
  assert.deepEqual(init, copy);
});
