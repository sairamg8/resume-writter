// The Job Map refresh guards: board requests that ride out a busy host (ats.mjs), the Wikidata fetch that
// retries per country and reports what it got (wikidata.mjs), the upload guards (docs.mjs: a partial outage
// per country / per ATS, a document over Firestore's size limit, too many failed boards), and a job URL with a
// stray "%" that must not stop the build (lib.mjs). All with fake fetches and a recording sleep: no network, no timers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, post } from '../../tools/job-map/ats.mjs';
import { fetchWikidata } from '../../tools/job-map/wikidata.mjs';
import { shrinkProblems, oversizedDocs, failedTooMany, dataToDocs, shrunkTooFar, total } from '../../tools/job-map/docs.mjs';
import { safeDecode, classify, position } from '../../tools/job-map/lib.mjs';

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

// ---- wikidata.mjs -------------------------------------------------------------------------------------

const QID = { IN: 'Q668', US: 'Q30', NL: 'Q55' };
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
    const ep = endpoint(plan), rec = recorder(), report = {};
    const out = await fetchWikidata(perCountry, () => {}, report, { fetchImpl: ep.fetchImpl, sleep: rec.sleep });
    return { out, report, calls: ep.calls, tries: ep.tries, sleeps: rec.sleeps };
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

test('shrinkProblems: an ATS is watched from 500 open roles and half is the limit', () => {
  const same = { US: 1000 };
  const mk = (n, open) => snap(same, rows('ashby', n, open));
  assert.deepEqual(shrinkProblems({ previous: mk(10, 100), next: mk(10, 50) }), []);
  assert.equal(shrinkProblems({ previous: mk(10, 100), next: mk(10, 49) }).length, 1);
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

test('shrinkProblems: companies down more than 20% is a problem, exactly 20% is not', () => {
  const counts = { US: 1000 };
  const bad = shrinkProblems({ previous: snap(counts, rows('lever', 1000)), next: snap(counts, rows('lever', 799)) });
  assert.equal(bad.length, 1, bad.join('|'));
  assert.ok(bad[0].includes('1000') && bad[0].includes('799'));
  assert.deepEqual(shrinkProblems({ previous: snap(counts, rows('lever', 1000)), next: snap(counts, rows('lever', 800)) }), []);
  assert.deepEqual(shrinkProblems({ previous: snap(counts, rows('lever', 1000)), next: snap(counts, rows('lever', 1500)) }), []);
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

test('failedTooMany: more than the larger of 10 boards and 3% of the boards tried', () => {
  assert.equal(failedTooMany(10, 100), false);
  assert.equal(failedTooMany(11, 100), true);
  assert.equal(failedTooMany(30, 1000), false);
  assert.equal(failedTooMany(31, 1000), true);
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
