// The Job Map refresh guards: board requests that ride out a busy host (ats.mjs), the Wikidata fetch that
// retries per country and reports what it got (wikidata.mjs), the upload guards (docs.mjs: a partial outage
// per country / per ATS, a document over Firestore's size limit, too many failed boards), and a job URL with a
// stray "%" that must not stop the build (lib.mjs). All with fake fetches and a recording sleep: no network, no timers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ats from '../../tools/job-map/ats.mjs';
import { fetchWikidata } from '../../tools/job-map/wikidata.mjs';
import { shrinkProblems, oversizedDocs, failedTooMany, dataToDocs, shrunkTooFar, total } from '../../tools/job-map/docs.mjs';
import { safeDecode, classify, position } from '../../tools/job-map/lib.mjs';

const { get, post } = ats;
const recorder = () => { const sleeps = []; return { sleeps, sleep: async (ms) => { sleeps.push(ms); } }; };
const json = (status, body) => new Response(JSON.stringify(body), { status });
function scripted(...answers) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); const a = answers[Math.min(calls.length - 1, answers.length - 1)]; if (a instanceof Error) throw a; return a; };
  return { fetchImpl, calls };
}

// ---- ats.mjs: get / post ride out a busy host, keep their other answers --------------------------------

test('get: a 429 then data returns the data after one pause', async () => {
  const { fetchImpl, calls } = scripted(json(429, {}), json(200, { jobs: [1] }));
  const { sleeps, sleep } = recorder();
  assert.deepEqual(await get('https://b.test/jobs', { fetchImpl, sleep }), { jobs: [1] });
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [1500]);
});

test('get: a 404 is "no such board" (null), at once', async () => {
  const { fetchImpl, calls } = scripted(json(404, {}), json(200, {}));
  const { sleeps, sleep } = recorder();
  assert.equal(await get('https://b.test/jobs', { fetchImpl, sleep }), null);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test('get: a 429 that lasts still throws "status url" (that is how a failed board is counted)', async () => {
  const { fetchImpl, calls } = scripted(json(429, {}));
  const { sleeps, sleep } = recorder();
  await assert.rejects(get('https://b.test/jobs', { fetchImpl, sleep }), (e) => e.message === '429 https://b.test/jobs');
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1500, 3000]);
});

test('get: a 500 throws at once, with no retry', async () => {
  const { fetchImpl, calls } = scripted(json(500, {}), json(200, {}));
  const { sleep } = recorder();
  await assert.rejects(get('https://b.test/jobs', { fetchImpl, sleep }), (e) => e.message === '500 https://b.test/jobs');
  assert.equal(calls.length, 1);
});

test('get: asks with the tool\'s user agent and a 20 s timeout signal of its own for each attempt', async () => {
  const { fetchImpl, calls } = scripted(json(503, {}), json(200, {}));
  const { sleep } = recorder();
  await get('https://b.test/jobs', { fetchImpl, sleep });
  assert.equal(calls[0].init.headers['user-agent'], 'resume-writter-jobmap/1.0');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.notEqual(calls[0].init.signal, calls[1].init.signal);
});

test('post: sends the JSON body with its headers, and 404 and 422 are "no such board" (null)', async () => {
  for (const status of [404, 422]) {
    const { fetchImpl, calls } = scripted(json(status, {}));
    const { sleeps, sleep } = recorder();
    assert.equal(await post('https://w.test/jobs', { limit: 20, offset: 0 }, { fetchImpl, sleep }), null, String(status));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.body, JSON.stringify({ limit: 20, offset: 0 }));
    assert.equal(calls[0].init.headers['content-type'], 'application/json');
    assert.equal(calls[0].init.headers['user-agent'], 'resume-writter-jobmap/1.0');
    assert.deepEqual(sleeps, []);
  }
});

test('post: a Workday 429 is asked again, a lasting one throws, a 400 throws at once', async () => {
  let c = scripted(json(429, {}), json(200, { total: 0, jobPostings: [] }));
  let s = recorder();
  assert.deepEqual(await post('https://w.test/jobs', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep }), { total: 0, jobPostings: [] });
  assert.deepEqual(s.sleeps, [1500]);
  c = scripted(json(429, {})); s = recorder();
  await assert.rejects(post('https://w.test/jobs', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep }), /^Error: 429 https:\/\/w\.test\/jobs$/);
  assert.equal(c.calls.length, 3);
  c = scripted(json(400, {})); s = recorder();
  await assert.rejects(post('https://w.test/jobs', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep }), /400/);
  assert.equal(c.calls.length, 1);
});

// ats.net.retries is read at call time: the discovery probes set it to 0 so a busy host costs one fast miss.
async function withRetries(n, fn) {
  const prev = ats.net.retries;
  ats.net.retries = n;
  try { return await fn(); } finally { ats.net.retries = prev; }
}

test('net.retries defaults to 2', () => {
  assert.equal(ats.net.retries, 2);
});

test('get: with net.retries = 0 a 429 is asked once and throws, with no pause', async () => {
  const { fetchImpl, calls } = scripted(json(429, {}), json(200, { jobs: [1] }));
  const { sleeps, sleep } = recorder();
  await withRetries(0, () => assert.rejects(get('https://b.test/jobs', { fetchImpl, sleep }), (e) => e.message === '429 https://b.test/jobs'));
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
});

test('get: with net.retries = 2 the same 429 is asked 3 times, and the setting is restored afterwards', async () => {
  const { fetchImpl, calls } = scripted(json(429, {}));
  const { sleeps, sleep } = recorder();
  await withRetries(2, () => assert.rejects(get('https://b.test/jobs', { fetchImpl, sleep }), (e) => e.message === '429 https://b.test/jobs'));
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1500, 3000]);
  await withRetries(0, async () => {});
  assert.equal(ats.net.retries, 2);
});

test('post: net.retries = 0 asks a 503 once; net.retries = 1 asks it twice', async () => {
  let c = scripted(json(503, {})), s = recorder();
  await withRetries(0, () => assert.rejects(post('https://w.test/jobs', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep }), /^Error: 503 https:\/\/w\.test\/jobs$/));
  assert.equal(c.calls.length, 1);
  assert.deepEqual(s.sleeps, []);
  c = scripted(json(503, {})); s = recorder();
  await withRetries(1, () => assert.rejects(post('https://w.test/jobs', {}, { fetchImpl: c.fetchImpl, sleep: s.sleep }), /503/));
  assert.equal(c.calls.length, 2);
});

test('get: the caller\'s own retries still win over net.retries', async () => {
  const { fetchImpl, calls } = scripted(json(429, {}));
  const { sleep } = recorder();
  await withRetries(0, () => assert.rejects(get('https://b.test/jobs', { fetchImpl, sleep, retries: 1 }), /429/));
  assert.equal(calls.length, 2);
});

// ---- wikidata.mjs -------------------------------------------------------------------------------------

// every country wikidata.mjs asks for, so a fake request is always logged under its own code
const QID = { IN: 'Q668', US: 'Q30', CA: 'Q16', DE: 'Q183', GB: 'Q145', FR: 'Q142', NL: 'Q55', CH: 'Q39', IE: 'Q27', ES: 'Q29', IT: 'Q38', SE: 'Q34', PL: 'Q36', DK: 'Q35', NO: 'Q20', FI: 'Q33', BE: 'Q31', AT: 'Q40', LU: 'Q32', PT: 'Q45', SG: 'Q334', AE: 'Q878', AU: 'Q408', JP: 'Q17', BR: 'Q155', MX: 'Q96', ZA: 'Q258', IL: 'Q801' };
const ALL28 = ['IN', 'US', 'CA', 'DE', 'GB', 'FR', 'NL', 'CH', 'IE', 'ES', 'IT', 'SE', 'PL', 'DK', 'NO', 'FI', 'BE', 'AT', 'LU', 'PT', 'SG', 'AE', 'AU', 'JP', 'BR', 'MX', 'ZA', 'IL'];
const binding = (i, over = {}) => ({ c: { value: `http://www.wikidata.org/entity/Q${1000 + i}` }, cLabel: { value: `Company ${i}` }, site: { value: `https://c${i}.example` }, emp: { value: String(60000 - i) }, indLabel: { value: 'software company' }, ...over });
const answer = (bindings) => ({ ok: true, status: 200, json: async () => ({ results: { bindings } }) });
const httpFail = (status) => ({ ok: false, status, json: async () => { throw new Error('no body'); } });
// A fake SPARQL endpoint: `plan(cc, attemptNo)` gives the response (or throws) for a country; every call is logged.
function endpoint(plan) {
  const calls = [], tries = {};
  const fetchImpl = async (url, init) => {
    const q = new URLSearchParams(String(init.body)).get('query');
    const qid = /wdt:P17 wd:(Q\d+)/.exec(q)[1];
    const cc = Object.keys(QID).find((k) => QID[k] === qid) ?? qid;
    tries[cc] = (tries[cc] ?? 0) + 1;
    calls.push(cc);
    return plan(cc, tries[cc]);
  };
  return { fetchImpl, calls, tries };
}
// The tests never reach the real endpoint: a fetch that never answers makes an unwired fetchWikidata stall at once.
async function run(plan, perCountry = 250) {
  const real = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});
  try {
    const ep = endpoint(plan), rec = recorder(), report = {}, logs = [];
    const out = await fetchWikidata(perCountry, (m) => logs.push(m), report, { fetchImpl: ep.fetchImpl, sleep: rec.sleep });
    return { out, report, calls: ep.calls, tries: ep.tries, sleeps: rec.sleeps, logs };
  } finally { globalThis.fetch = real; }
}
const between = (sleeps) => sleeps.filter((ms) => ms === 1500);
const pauses = (sleeps) => sleeps.filter((ms) => ms !== 1500);

test('wikidata: every country answers once; the report counts them, the rows keep their mapping', async () => {
  const { out, report, calls, sleeps } = await run(() => answer([binding(0), binding(1, { emp: undefined, indLabel: { value: 'bank' } }), binding(2)]));
  const n = Object.keys(report.countries).length;
  assert.ok(n >= 20);
  assert.equal(calls.length, n);
  assert.equal(out.length, 3 * n);
  assert.deepEqual(report.failed, []);
  assert.ok(Object.values(report.countries).every((v) => v === 3));
  assert.deepEqual(out[0], { name: 'Company 0', hq: 'in', website: 'https://c0.example', size: 60000, category: 'saas', tier: 1, src: 'wikidata' });
  assert.deepEqual(out[1], { name: 'Company 1', hq: 'in', website: 'https://c1.example', size: null, category: 'bank', tier: 0, src: 'wikidata' });
  assert.equal(between(sleeps).length, n - 1);
  assert.equal(pauses(sleeps).length, 0);
});

test('wikidata: a country that 504s twice then answers is paused 15 s then 30 s, and is in the report', async () => {
  const { out, report, tries, sleeps } = await run((cc, k) => (cc === 'NL' && k <= 2 ? httpFail(504) : answer([binding(0), binding(1)])));
  assert.equal(tries.NL, 3);
  assert.equal(report.countries.NL, 2);
  assert.deepEqual(report.failed, []);
  assert.deepEqual(pauses(sleeps), [15000, 30000]);
  assert.equal(out.filter((c) => c.hq === 'nl').length, 2);
});

test('wikidata: 429 and 503 also wait the long pause, a 500 the short one', async () => {
  for (const [status, first] of [[429, 15000], [503, 15000], [500, 5000]]) {
    const { sleeps, report } = await run((cc, k) => (cc === 'IN' && k === 1 ? httpFail(status) : answer([binding(0)])));
    assert.deepEqual(pauses(sleeps), [first], String(status));
    assert.equal(report.countries.IN, 1);
  }
});

test('wikidata: a country that fails 4 times with a network error is paused 5, 10, 15 s (none after the last) and reported failed', async () => {
  const { out, report, tries, sleeps } = await run((cc) => { if (cc === 'NL') throw new TypeError('fetch failed'); return answer([binding(0), binding(1)]); });
  assert.equal(tries.NL, 4);
  assert.deepEqual(pauses(sleeps), [5000, 10000, 15000]);
  assert.deepEqual(report.failed, ['NL']);
  assert.equal('NL' in report.countries, false);
  assert.equal(out.filter((c) => c.hq === 'nl').length, 0);
  const n = Object.keys(report.countries).length + 1;
  assert.equal(between(sleeps).length, n - 1);
});

test('wikidata: a country that 504s four times waits 15, 30, 45 s and is reported failed; the others are not hurt', async () => {
  const { out, report, tries, sleeps } = await run((cc) => (cc === 'NL' ? httpFail(504) : answer([binding(0)])));
  assert.equal(tries.NL, 4);
  assert.deepEqual(pauses(sleeps), [15000, 30000, 45000]);
  assert.deepEqual(report.failed, ['NL']);
  assert.ok(out.length >= 20);
});

test('wikidata: an answer that is not SPARQL JSON counts as a failed attempt', async () => {
  const { report, tries } = await run((cc) => (cc === 'US' ? { ok: true, status: 200, json: async () => ({ nothing: 1 }) } : answer([binding(0)])));
  assert.equal(tries.US, 4);
  assert.deepEqual(report.failed, ['US']);
});

test('wikidata: perCountry caps each country and a repeated company counts once', async () => {
  const { out, report } = await run(() => answer([binding(0), binding(0), binding(1), binding(2), binding(3), binding(4)]), 3);
  assert.ok(Object.values(report.countries).every((v) => v === 3));
  assert.equal(out.length, 3 * Object.keys(report.countries).length);
  assert.deepEqual(out.slice(0, 3).map((c) => c.name), ['Company 0', 'Company 1', 'Company 2']);
});

test('wikidata: a company whose label is a bare Q number is skipped', async () => {
  const { out, report } = await run(() => answer([binding(0), binding(1, { cLabel: { value: 'Q123456' } }), binding(2)]));
  assert.ok(Object.values(report.countries).every((v) => v === 2));
  assert.ok(out.every((c) => !/^Q\d+$/.test(c.name)));
  assert.equal(out.length, 2 * Object.keys(report.countries).length);
});

test('wikidata: the report is filled in the object the caller gives, a country with no rows still counts as answered', async () => {
  const { report } = await run((cc) => answer(cc === 'US' ? [] : [binding(0)]));
  assert.equal(report.countries.US, 0);
  assert.deepEqual(report.failed, []);
});

const STOP_LINE = 'wikidata: stopping, 3 countries in a row never answered';

test('wikidata: Wikidata answering 504 to everything stops after 3 countries, 12 requests, and reports all 28 failed in order', async () => {
  const { out, report, calls, sleeps, logs } = await run(() => httpFail(504));
  assert.equal(calls.length, 3 * 4);
  assert.deepEqual([...new Set(calls)], ['IN', 'US', 'CA']);
  assert.deepEqual(report.failed, ALL28);
  assert.deepEqual(report.countries, {});
  assert.deepEqual(out, []);
  assert.equal(pauses(sleeps).length, 9);
  assert.deepEqual(pauses(sleeps), [15000, 30000, 45000, 15000, 30000, 45000, 15000, 30000, 45000]);
  assert.equal(between(sleeps).length, 2);
  assert.equal(logs.filter((l) => l === STOP_LINE).length, 1);
});

test('wikidata: two failed countries, one that answers, then failures again: no early stop (the count starts over)', async () => {
  const bad = new Set(['IN', 'US', 'DE', 'GB']);
  const { report, calls, tries, logs } = await run((cc) => (bad.has(cc) ? httpFail(504) : answer([binding(0)])));
  assert.deepEqual(report.failed, ['IN', 'US', 'DE', 'GB']);
  assert.equal(Object.keys(report.countries).length, 24);
  assert.equal(calls.length, 4 * 4 + 24);
  assert.equal(tries.IL, 1);
  assert.equal(logs.includes(STOP_LINE), false);
});

test('wikidata: 3 failures in a row in the middle stop there; the rest is reported failed without a request or a pause', async () => {
  const bad = new Set(['CA', 'DE', 'GB']);
  const { out, report, calls, tries, sleeps, logs } = await run((cc) => (bad.has(cc) ? httpFail(504) : answer([binding(0), binding(1)])));
  assert.deepEqual(Object.keys(report.countries), ['IN', 'US']);
  assert.deepEqual(report.failed, ALL28.slice(2));
  assert.equal(calls.length, 2 + 3 * 4);
  assert.equal(tries.FR, undefined);
  assert.equal(tries.IL, undefined);
  assert.equal(out.length, 4);
  assert.equal(between(sleeps).length, 4);
  assert.equal(logs.filter((l) => l === STOP_LINE).length, 1);
});

test('wikidata: a country that answers on its last attempt counts as answered for the breaker', async () => {
  const slow = new Set(['IN', 'US', 'CA', 'DE', 'GB']);
  const { report, logs } = await run((cc, k) => (slow.has(cc) && k < 4 ? httpFail(504) : answer([binding(0)])));
  assert.deepEqual(report.failed, []);
  assert.equal(Object.keys(report.countries).length, 28);
  assert.equal(logs.includes(STOP_LINE), false);
});

// ---- docs.mjs: shrinkProblems ---------------------------------------------------------------------------

// A company row as the page reads it: [name, category, tier, hq, ats, open, src, careers].
const rows = (ats, n, open = 0) => Array.from({ length: n }, (_, i) => [`${ats}-${i}`, 'saas', 1, 'us', ats, open, 'x', '']);
const snap = (counts, companies = null) => ({ counts, companies });

test('shrinkProblems: the first upload (nothing stored) is fine', () => {
  assert.deepEqual(shrinkProblems({ previous: snap({}, null), next: snap({ US: 5 }, rows('lever', 3)) }), []);
  assert.deepEqual(shrinkProblems({ previous: snap({ US: 0 }, []), next: snap({ US: 5 }, rows('lever', 3)) }), []);
});

test('shrinkProblems: growth and no change are fine', () => {
  const p = snap({ US: 1000, GB: 800 }, rows('lever', 100, 10));
  assert.deepEqual(shrinkProblems({ previous: p, next: p }), []);
  assert.deepEqual(shrinkProblems({ previous: p, next: snap({ US: 2000, GB: 900, IN: 300 }, rows('lever', 150, 10)) }), []);
});

test('shrinkProblems: total roles down more than 40% is a problem naming both totals, exactly 40% is not', () => {
  const bad = shrinkProblems({ previous: snap({ US: 100000 }), next: snap({ US: 59999 }) });
  assert.ok(bad.some((m) => m.includes('100000') && m.includes('59999')), bad.join('|'));
  assert.deepEqual(shrinkProblems({ previous: snap({ US: 100000 }), next: snap({ US: 60000 }) }), []);
  assert.deepEqual(shrinkProblems({ previous: snap({ US: 75000 }), next: snap({ US: 45000 }) }), []);
});

test('shrinkProblems: the total rule agrees with shrunkTooFar away from the boundary', () => {
  for (const [a, b] of [[1000, 500], [1000, 700], [1000, 1200], [37, 3]]) {
    const old = shrunkTooFar({ US: a }, { US: b });
    const some = shrinkProblems({ previous: snap({ US: a }), next: snap({ US: b }) }).some((m) => m.includes(String(a)) && m.includes(String(b)));
    assert.equal(some, old, `${a}->${b}`);
  }
  assert.equal(total({ US: 3 }), 3);
});

test('shrinkProblems: one country down more than half is a problem naming it, exactly half is not', () => {
  const prev = snap({ US: 20000, GB: 600, IN: 500 });
  const bad = shrinkProblems({ previous: prev, next: snap({ US: 20000, GB: 299, IN: 250 }) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('GB') && bad[0].includes('600') && bad[0].includes('299'));
  assert.deepEqual(shrinkProblems({ previous: prev, next: snap({ US: 20000, GB: 300, IN: 250 }) }), []);
});

test('shrinkProblems: a country that vanished counts as 0', () => {
  const bad = shrinkProblems({ previous: snap({ US: 20000, DE: 800 }), next: snap({ US: 20000 }) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('DE') && bad[0].includes('800'));
});

test('shrinkProblems: a small country (under 500 before) may swing; at 500 it is watched', () => {
  assert.deepEqual(shrinkProblems({ previous: snap({ US: 20000, FR: 499 }), next: snap({ US: 20000 }) }), []);
  const bad = shrinkProblems({ previous: snap({ US: 20000, FR: 500 }), next: snap({ US: 20000 }) });
  assert.equal(bad.length, 1);
  assert.ok(bad[0].includes('FR'));
});

test('shrinkProblems: the case the total alone misses, Workday 20k -> 2k while the total falls only 20%', () => {
  const previous = snap({ US: 50000, GB: 25000 }, [...rows('workday', 40, 500), ...rows('greenhouse', 100, 300)]);
  const next = snap({ US: 40000, GB: 20000 }, [...rows('workday', 40, 50), ...rows('greenhouse', 100, 300)]);
  assert.equal(shrunkTooFar(previous.counts, next.counts), false);
  const bad = shrinkProblems({ previous, next });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('workday') && bad[0].includes('20000') && bad[0].includes('2000'), bad[0]);
});

test('shrinkProblems: an ATS is watched from 500 open roles and 30% is the limit', () => {
  const same = { US: 1000 };
  const mk = (n, open) => snap(same, rows('ashby', n, open));
  assert.deepEqual(shrinkProblems({ previous: mk(10, 100), next: mk(10, 70) }), []);
  const bad = shrinkProblems({ previous: mk(10, 100), next: mk(10, 69) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('ashby') && bad[0].includes('690') && bad[0].includes('1000'));
  assert.deepEqual(shrinkProblems({ previous: mk(10, 100), next: mk(10, 50) }).length, 1);
  assert.equal(shrinkProblems({ previous: mk(5, 100), next: mk(5, 0) }).length, 1);
  assert.deepEqual(shrinkProblems({ previous: mk(499, 1), next: mk(499, 0) }), []);
  assert.deepEqual(shrinkProblems({ previous: mk(1, 499), next: mk(1, 0) }), []);
  assert.equal(shrinkProblems({ previous: mk(1, 500), next: mk(1, 0) }).length, 1);
});

test('shrinkProblems: rows without an ATS and the aggregator are not an ATS', () => {
  const prev = snap({ US: 9000 }, [...rows('aggregator', 100, 50), ...rows('', 100, 50), ...rows('lever', 10, 10)]);
  const next = snap({ US: 9000 }, [...rows('aggregator', 100, 0), ...rows('', 100, 0), ...rows('lever', 10, 10)]);
  assert.deepEqual(shrinkProblems({ previous: prev, next }), []);
});

test('shrinkProblems: stored companies unknown (null) skips the ATS and company checks only', () => {
  const next = snap({ US: 20000 }, rows('lever', 1));
  assert.deepEqual(shrinkProblems({ previous: snap({ US: 20000 }, null), next }), []);
  assert.equal(shrinkProblems({ previous: snap({ US: 20000, DE: 800 }, null), next }).length, 1);
  assert.equal(shrinkProblems({ previous: snap({ US: 100000 }, null), next: snap({ US: 1000 }, rows('lever', 1)) }).length >= 1, true);
});

test('shrinkProblems: companies down more than 15% is a problem, exactly 15% is not', () => {
  const counts = { US: 1000 };
  const bad = shrinkProblems({ previous: snap(counts, rows('lever', 1000)), next: snap(counts, rows('lever', 849)) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('1000') && bad[0].includes('849'));
  assert.deepEqual(shrinkProblems({ previous: snap(counts, rows('lever', 1000)), next: snap(counts, rows('lever', 850)) }), []);
  assert.deepEqual(shrinkProblems({ previous: snap(counts, rows('lever', 1000)), next: snap(counts, rows('lever', 1500)) }), []);
});

test('shrinkProblems: the aggregator churn seen (-3.6% companies) is not a problem', () => {
  const counts = { US: 1000 };
  assert.deepEqual(shrinkProblems({ previous: snap(counts, rows('aggregator', 3177)), next: snap(counts, rows('aggregator', 3063)) }), []);
});

test('shrinkProblems: OTHER or REMOTE collapsing alone is not a problem (a regex change can move them), a real country is', () => {
  const previous = snap({ US: 20000, OTHER: 15000, REMOTE: 1400 });
  assert.deepEqual(shrinkProblems({ previous, next: snap({ US: 20000, OTHER: 3000, REMOTE: 1400 }) }), []);
  assert.deepEqual(shrinkProblems({ previous, next: snap({ US: 20000, OTHER: 15000, REMOTE: 100 }) }), []);
  const bad = shrinkProblems({ previous: snap({ US: 30000, OTHER: 15000 }), next: snap({ US: 12000, OTHER: 15000 }) });
  assert.ok(bad.some((m) => m.startsWith('US ') && m.includes('12000') && m.includes('30000')), bad.join('|'));
});

test('shrinkProblems: OTHER still counts in the total, and skipCountries can be changed', () => {
  const previous = snap({ US: 10000, OTHER: 20000 });
  const bad = shrinkProblems({ previous, next: snap({ US: 10000, OTHER: 1000 }) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('11000') && bad[0].includes('30000') && !bad[0].startsWith('OTHER'));
  const prev2 = snap({ US: 20000, OTHER: 15000 }), next2 = snap({ US: 20000, OTHER: 3000 });
  assert.deepEqual(shrinkProblems({ previous: prev2, next: next2 }), []);
  const flagged = shrinkProblems({ previous: prev2, next: next2 }, { skipCountries: [] });
  assert.ok(flagged.some((m) => m.startsWith('OTHER ')), flagged.join('|'));
  const us = shrinkProblems({ previous: snap({ US: 20000, OTHER: 15000 }), next: snap({ US: 8000, OTHER: 15000 }) }, { skipCountries: ['US'] });
  assert.equal(us.some((m) => m.startsWith('US ')), false, us.join('|'));
});

test('shrinkProblems: the healthy 13 Oct run against the stored 12 Oct data has no problem', () => {
  const previous = { counts: { US: 27763, OTHER: 15463, GB: 4249, IN: 3776, DE: 3554, CA: 2581, REMOTE: 1351, SG: 1319, FR: 1263, BR: 1111, ES: 930 }, companies: [] };
  const next = { counts: { US: 26623, OTHER: 14404, GB: 4162, IN: 3638, DE: 3348, CA: 2514, REMOTE: 1322, SG: 1162, FR: 1054, BR: 1090, ES: 852, IE: 746 }, companies: [] };
  const fill = (n, wd, gh) => {
    const out = [...rows('workday', 40, wd), ...rows('greenhouse', 250, gh)];
    while (out.length < n) out.push([`agg-${out.length}`, 'saas', 1, 'us', 'aggregator', 0, 'x', '']);
    return out;
  };
  previous.companies = fill(3177, 100, 20);
  next.companies = fill(3028, 89, 19);
  assert.equal(previous.companies.length, 3177);
  assert.equal(next.companies.length, 3028);
  assert.ok(previous.companies.every((r) => r.length === 8));
  assert.deepEqual(shrinkProblems({ previous, next }), []);
});

test('shrinkProblems: the same healthy run with a Workday board family down 35% is caught', () => {
  const mk = (wd) => [...rows('workday', 40, wd), ...rows('greenhouse', 250, 20)];
  const bad = shrinkProblems({ previous: snap({ US: 27763 }, mk(100)), next: snap({ US: 27000 }, mk(64)) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].startsWith('workday '));
});

test('shrinkProblems: the limits can be changed', () => {
  const previous = snap({ US: 1000 }), next = snap({ US: 850 });
  assert.deepEqual(shrinkProblems({ previous, next }), []);
  assert.equal(shrinkProblems({ previous, next }, { maxDrop: 0.1 }).length >= 1, true);
});

test('shrinkProblems: several faults are all listed, one line each', () => {
  const previous = snap({ US: 30000, DE: 800 }, rows('lever', 100, 50));
  const next = snap({ US: 10000 }, rows('lever', 10, 5));
  const bad = shrinkProblems({ previous, next });
  assert.ok(bad.length >= 4, bad.join('|'));
  assert.ok(bad.every((m) => typeof m === 'string' && !m.includes('\n')));
});

// ---- docs.mjs: oversizedDocs, failedTooMany ----------------------------------------------------------------

test('oversizedDocs: only documents strictly over the limit, sized in bytes', () => {
  const doc = (id, n) => ({ id, data: { json: 'x'.repeat(n) } });
  const base = Buffer.byteLength(JSON.stringify(doc('a', 0).data));
  const docs = [doc('under', 10), doc('at', 100 - base), doc('over', 101 - base)];
  assert.deepEqual(oversizedDocs(docs, 100), [{ id: 'over', bytes: 101 }]);
  assert.deepEqual(oversizedDocs([doc('a', 10)], 100), []);
});

test('oversizedDocs: multi-byte text is counted in bytes, not characters', () => {
  const docs = [{ id: 'e', data: { json: 'é'.repeat(5) } }];
  assert.deepEqual(oversizedDocs(docs, 20), [{ id: 'e', bytes: 21 }]);
  assert.deepEqual(oversizedDocs(docs, 21), []);
});

test('oversizedDocs: the default limit is 900000 bytes, and real documents from dataToDocs are measured', () => {
  const small = { id: 's', data: { json: 'x'.repeat(1000) } };
  const edge = (n) => ({ id: 'e', data: { json: 'x'.repeat(n - Buffer.byteLength('{"json":""}')) } });
  assert.deepEqual(oversizedDocs([small, edge(900000)]), []);
  assert.deepEqual(oversizedDocs([small, edge(900001)]), [{ id: 'e', bytes: 900001 }]);
  const docs = dataToDocs({ meta: { crawled: '2026-10-08', counts: { US: 1 }, companies: [['A']] }, chunks: { 'US-0': [[1]] } });
  assert.deepEqual(oversizedDocs(docs), []);
});

test('failedTooMany: more than the larger of 10 boards and 2% of the boards tried', () => {
  assert.equal(failedTooMany(10, 100), false);
  assert.equal(failedTooMany(11, 100), true);
  assert.equal(failedTooMany(20, 1000), false);
  assert.equal(failedTooMany(21, 1000), true);
  assert.equal(failedTooMany(6, 1054), false);
  assert.equal(failedTooMany(21, 1054), false);
  assert.equal(failedTooMany(22, 1054), true);
  assert.equal(failedTooMany(6, 1800), false);
  assert.equal(failedTooMany(0, 0), false);
  assert.equal(failedTooMany(11, 0), true);
  assert.equal(failedTooMany(60, 1800, 0.01, 5), true);
  assert.equal(failedTooMany(18, 1800, 0.01, 5), false);
});

// ---- lib.mjs: safeDecode --------------------------------------------------------------------------------------

test('safeDecode: decodes what is valid, leaves a stray "%" alone', () => {
  assert.equal(safeDecode('a%20b'), 'a b');
  assert.equal(safeDecode('100%'), '100%');
  assert.equal(safeDecode('50%-off%zz'), '50%-off%zz');
  assert.equal(safeDecode('plain'), 'plain');
  assert.equal(safeDecode(''), '');
});

test('a job URL with a stray "%" no longer stops classify or position', () => {
  const job = { title: 'Analyst', location: 'London', url: 'https://x.test/jobs/100%-kyc-analyst' };
  assert.doesNotThrow(() => classify(job, 'any'));
  assert.equal(classify(job, 'any').fn, 'compliance');
  assert.doesNotThrow(() => position({ title: 'Engineer', url: 'https://x.test/jobs/50%' }));
  assert.equal(position({ title: 'Engineer', url: 'https://x.test/jobs/senior%20front%20end' }), 'frontend');
});
