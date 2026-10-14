// The Job Map refresh scripts as they run in production: tools/job-map/build-db.mjs and upload.mjs are started as
// child processes in a throwaway copy of the tool (fake job boards, a fake Firestore), and what they print, which
// exit code they end with and what they write or do not write is checked. The pure guards are in job-map-guards.unit.mjs;
// this file pins their wiring: the order of the checks, the exit codes, that a refused run writes nothing.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { dataToDocs } from '../../tools/job-map/docs.mjs';

const TOOLS = fileURLToPath(new URL('../../tools/job-map/', import.meta.url));
const dirs = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** A throwaway copy of the tool (every .mjs, none of the big json). */
function mkTool() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'jobmap-'));
  dirs.push(dir);
  for (const f of readdirSync(TOOLS)) if (f.endsWith('.mjs')) copyFileSync(path.join(TOOLS, f), path.join(dir, f));
  return dir;
}
const put = (dir, f, v) => { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v)); };
function run(dir, script, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(dir, script), ...args], { cwd: dir, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', timeout: 30000, maxBuffer: 1 << 26 });
}

// ---------------------------------------------------------------- build-db.mjs

// the real module's exports, with boards that need no network: 'fail*' slugs throw like a blocked host, 'gone*' slugs are boards that do not exist
const FAKE_ATS = [
  "export const net = { retries: 2 };",
  "export const get = async () => null;",
  "export const post = async () => null;",
  "export const ATS = { greenhouse: { async list(slug) {",
  "  if (slug.startsWith('fail')) throw new Error('429 https://x.example/' + slug);",
  "  if (slug.startsWith('gone')) return null;",
  "  return [{ title: 'Software Engineer', location: 'London, United Kingdom', url: 'https://x.example/' + slug, team: '' }];",
  "} } };",
].join('\n');

const board = (name, slug) => ({ name, tier: 1, category: 'tech', hq: 'London', ats: 'greenhouse', slug });
/** n greenhouse boards: `fail` of them throw, `gone` of them do not exist, the rest list one role each. */
function boards(n, { fail = 0, gone = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => (i < fail ? board(`Fail ${i}`, `fail${i}`) : i < fail + gone ? board(`Gone ${i}`, `gone${i}`) : board(`Ok ${i}`, `ok${i}`)));
}
/** n companies the crawl does not read: no board, a board kind nobody knows, or an aggregator entry. */
const idle = (n, kind) => Array.from({ length: n }, (_, i) => ({ name: `Idle ${kind} ${i}`, tier: 0, category: 'other', hq: '', src: 'discovered', ats: kind === 'none' ? null : kind, slug: kind === 'none' ? null : `s${i}` }));

function buildDir({ companies, discovered = [], careers = [], agg = [] }) {
  const dir = mkTool();
  put(dir, 'ats.mjs', FAKE_ATS);
  put(dir, 'companies.json', companies);
  put(dir, 'discovered.json', discovered);
  put(dir, 'careers-results.json', careers);
  put(dir, 'jobs-agg.json', agg);
  return dir;
}

test('build-db: every board read => exit 0, db.json written, the summary line counts companies, roles, failed and gone boards', () => {
  const dir = buildDir({ companies: boards(5) });
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.split('\n')[0].startsWith('5 companies, 5 roles, 0 boards failed, 0 boards gone'), r.stdout);
  const db = JSON.parse(readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.equal(db.companies.length, 5);
  assert.equal(db.jobs.length, 5);
  assert.ok(db.companies.every((c) => c.open === 1));
  assert.deepEqual([...new Set(db.jobs.map((j) => j.country))], ['GB']);
  assert.equal(db.jobs[0].fn, 'engineering');
  assert.match(db.crawled, /^\d{4}-\d{2}-\d{2}$/);
});

test('build-db: a board the host says does not exist is gone, not a failure, however many there are', () => {
  const dir = buildDir({ companies: boards(100, { gone: 30 }) });
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith('100 companies, 70 roles, 0 boards failed, 30 boards gone'), r.stdout);
  assert.ok(existsSync(path.join(dir, 'db.json')));
});

test('build-db: a few unreadable boards are skipped and listed, the rest is written (10 of 100)', () => {
  const dir = buildDir({ companies: boards(100, { fail: 10 }) });
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith('100 companies, 90 roles, 10 boards failed, 0 boards gone'), r.stdout);
  assert.match(r.stderr, /Fail 0: 429 https:\/\/x\.example\/fail0/);
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'db.json'), 'utf8')).jobs.length, 90);
});

test('build-db: 11 of 100 boards unreadable => exit 1, the problem is named, db.json is not written', () => {
  const dir = buildDir({ companies: boards(100, { fail: 11 }) });
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes('11 of 100 boards failed'), r.stderr);
  assert.ok(!existsSync(path.join(dir, 'db.json')), 'a refused crawl must leave no db.json for the upload to find');
});

test('build-db: the failed-board limit is the larger of 10 and 2% of the boards tried (1000 boards: 20 pass, 21 stop)', () => {
  const ok = buildDir({ companies: boards(1000, { fail: 20 }) });
  const a = run(ok, 'build-db.mjs');
  assert.equal(a.status, 0, a.stderr);
  assert.ok(existsSync(path.join(ok, 'db.json')));
  const bad = buildDir({ companies: boards(1000, { fail: 21 }) });
  const b = run(bad, 'build-db.mjs');
  assert.equal(b.status, 1);
  assert.ok(b.stderr.includes('21 of 1000 boards failed'), b.stderr);
  assert.ok(!existsSync(path.join(bad, 'db.json')));
});

test('build-db: a refused crawl leaves an older db.json alone (it is neither replaced nor emptied)', () => {
  const dir = buildDir({ companies: boards(100, { fail: 11 }) });
  put(dir, 'db.json', '{"old":true}');
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 1);
  assert.equal(readFileSync(path.join(dir, 'db.json'), 'utf8'), '{"old":true}');
});

for (const kind of ['none', 'nosuchats', 'aggregator']) {
  test(`build-db: companies with ${kind === 'none' ? 'no board' : kind === 'aggregator' ? 'an aggregator entry' : 'a board kind nobody reads'} are not boards tried: 11 of 100 still stops the crawl`, () => {
    // counted over all 1600 companies the limit would be 2% = 32 and these 11 would pass
    const dir = buildDir({ companies: boards(100, { fail: 11 }), discovered: idle(1500, kind) });
    const r = run(dir, 'build-db.mjs');
    assert.equal(r.status, 1, r.stdout);
    assert.ok(r.stderr.includes('11 of 100 boards failed'), r.stderr);
    assert.ok(!existsSync(path.join(dir, 'db.json')));
  });
}

test('build-db: aggregator entries and companies without a board are kept with 0 open roles and cost no failure', () => {
  const dir = buildDir({ companies: boards(3), discovered: [...idle(4, 'aggregator'), ...idle(2, 'none'), ...idle(2, 'nosuchats')] });
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith('11 companies, 3 roles, 0 boards failed, 0 boards gone'), r.stdout);
  const db = JSON.parse(readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.deepEqual(db.companies.filter((c) => c.name.startsWith('Idle')).map((c) => c.open), Array(8).fill(0));
});

test('build-db: job-API rows are added after the boards and their companies counted', () => {
  const agg = [{ company: 'Feedco', fn: 'engineering', track: 'other-eng', level: 'unspecified', title: 'Dev', location: 'Remote', url: 'https://f.example/1', country: 'REMOTE', src: 'remotive' }];
  const dir = buildDir({ companies: boards(2), agg });
  const r = run(dir, 'build-db.mjs');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.startsWith('3 companies, 3 roles, 0 boards failed, 0 boards gone'), r.stdout);
  const db = JSON.parse(readFileSync(path.join(dir, 'db.json'), 'utf8'));
  assert.equal(db.companies.find((c) => c.name === 'Feedco').open, 1);
});

// ---------------------------------------------------------------- upload.mjs

// firebase-admin stand-in: collection('jobmap') -> doc(id).get/set/delete and listDocuments over a store read from FAKE_STORE
// (a json file {id: body}); every write is appended to FAKE_LOG as a json line; the first FAKE_SET_FAILS set() calls throw.
const FAKE_FIREBASE_PKG = { name: 'firebase-admin', version: '0.0.0', type: 'module', exports: { './app': './app.mjs', './firestore': './firestore.mjs' } };
const FAKE_APP = [
  "export function initializeApp() {}",
  "export function cert(x) { if (!x || x.project_id !== 'x') throw new Error('bad credential'); return x; }",
].join('\n');
const FAKE_FIRESTORE = [
  "import fs from 'node:fs';",
  "const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } };",
  "const store = process.env.FAKE_STORE ? read(process.env.FAKE_STORE) : {};",
  "const log = (o) => fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(o) + '\\n');",
  "let fails = Number(process.env.FAKE_SET_FAILS || 0);",
  "export function getFirestore() {",
  "  return { collection(name) {",
  "    if (name !== 'jobmap') throw new Error('unexpected collection ' + name);",
  "    return {",
  "      doc(id) { return {",
  "        async get() { const has = Object.hasOwn(store, id); return { exists: has, data: () => store[id] }; },",
  "        async set(body) { if (fails > 0) { fails--; log({ op: 'set-fail', id }); throw new Error('boom'); } log({ op: 'set', id, body }); store[id] = body; },",
  "        async delete() { log({ op: 'delete', id }); delete store[id]; },",
  "      }; },",
  "      async listDocuments() { return Object.keys(store).map((id) => ({ id })); },",
  "    };",
  "  } };",
  "}",
].join('\n');

const row = (n) => [0, 'engineering', 'java', 'senior', `Engineer ${n}`, 'London, United Kingdom', `https://x.example/${n}`, 'backend', 0];
const crow = (name, ats = 'greenhouse', open = 1) => [name, 'tech', 1, 'London', ats, open, 'curated', ''];
const dataset = ({ counts = { US: 2, GB: 1 }, companies = [crow('A'), crow('B'), crow('C')], chunks = { 'US-0': [row(1), row(2)], 'GB-0': [row(3)] } } = {}) => ({ meta: { crawled: '2026-10-14', counts, companies }, chunks });
/** The store a previous upload of `data` leaves behind. */
const storeOf = (data) => Object.fromEntries(dataToDocs(data).map(({ id, data: body }) => [id, body]));

const SA = '{"project_id":"x"}';
function uploadDir(data, store) {
  const dir = mkTool();
  put(dir, 'jobmap-data.json', data);
  put(dir, 'node_modules/firebase-admin/package.json', FAKE_FIREBASE_PKG);
  put(dir, 'node_modules/firebase-admin/app.mjs', FAKE_APP);
  put(dir, 'node_modules/firebase-admin/firestore.mjs', FAKE_FIRESTORE);
  if (store) put(dir, 'store.json', store);
  return {
    dir,
    go: (args = [], { sa = SA, fails = 0 } = {}) => run(dir, 'upload.mjs', args, {
      FAKE_LOG: path.join(dir, 'log.ndjson'), ...(store ? { FAKE_STORE: path.join(dir, 'store.json') } : {}),
      ...(sa ? { FIREBASE_SERVICE_ACCOUNT: sa } : {}), ...(fails ? { FAKE_SET_FAILS: String(fails) } : {}),
    }),
    log: () => (existsSync(path.join(dir, 'log.ndjson')) ? readFileSync(path.join(dir, 'log.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
  };
}
const ids = (log, op) => log.filter((o) => o.op === op).map((o) => o.id);

test('upload: a normal upload writes every document, the meta last, and removes stale ones only after all writes', () => {
  const data = dataset();
  const docs = dataToDocs(data);
  const u = uploadDir(data, { ...storeOf(data), 'FR-0': { json: '[]' }, 'companies-5': { json: '[]' } });
  const r = u.go();
  assert.equal(r.status, 0, r.stderr);
  const log = u.log();
  const sets = log.filter((o) => o.op === 'set');
  assert.deepEqual(sets.map((o) => o.id).sort(), docs.map((d) => d.id).sort());
  assert.equal(sets.at(-1).id, 'meta');
  assert.equal(sets.filter((o) => o.id === 'meta').length, 1);
  for (const { id, data: body } of docs) assert.deepEqual(sets.find((o) => o.id === id).body, body);
  assert.deepEqual(ids(log, 'delete').sort(), ['FR-0', 'companies-5']);
  const lastSet = log.map((o) => o.op).lastIndexOf('set');
  const firstDelete = log.map((o) => o.op).indexOf('delete');
  assert.ok(firstDelete > lastSet, 'stale documents go only after the meta is written');
});

test('upload: a first upload (nothing stored) writes everything and deletes nothing', () => {
  const data = dataset();
  const u = uploadDir(data);
  const r = u.go();
  assert.equal(r.status, 0, r.stderr);
  const log = u.log();
  assert.deepEqual(ids(log, 'set').sort(), dataToDocs(data).map((d) => d.id).sort());
  assert.equal(ids(log, 'delete').length, 0);
});

test('upload: --dry writes and deletes nothing, even with a stale document stored, and exits 0', () => {
  const data = dataset();
  const u = uploadDir(data, { ...storeOf(data), 'FR-0': { json: '[]' } });
  const r = u.go(['--dry']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(u.log(), []);
});

test('upload: --dry still refuses a crawl that shrank (exit 1, no writes)', () => {
  const u = uploadDir(dataset({ counts: { US: 100 } }), { meta: { crawled: '2026-01-01', counts: { US: 10000 } } });
  const r = u.go(['--dry']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to upload/);
  assert.deepEqual(u.log(), []);
});

test('upload: a crawl with far fewer roles than stored is refused: exit 1, the reason on stderr, not one write', () => {
  const u = uploadDir(dataset({ counts: { US: 100 } }), { meta: { crawled: '2026-01-01', counts: { US: 10000 } }, 'US-0': { json: '[]' } });
  const r = u.go();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to upload/);
  assert.deepEqual(u.log(), []);
});

test('upload: --force uploads that same smaller crawl', () => {
  const data = dataset({ counts: { US: 100 } });
  const u = uploadDir(data, { meta: { crawled: '2026-01-01', counts: { US: 10000 } } });
  const r = u.go(['--force']);
  assert.equal(r.status, 0, r.stderr);
  const log = u.log();
  assert.deepEqual(ids(log, 'set').sort(), dataToDocs(data).map((d) => d.id).sort());
  assert.equal(ids(log, 'set').at(-1), 'meta');
});

test('upload: one big country losing most of its roles is refused even when the total is within its limit', () => {
  // US 4000 -> 1000 (75% fewer), GB the same; total 12000 -> 9000 (25% fewer)
  const u = uploadDir(dataset({ counts: { US: 1000, GB: 8000 } }), { meta: { crawled: '2026-01-01', counts: { US: 4000, GB: 8000 } } });
  const r = u.go();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to upload:.*\bUS\b/);
  assert.deepEqual(u.log(), []);
});

test('upload: OTHER and REMOTE shrinking alone are not a refusal', () => {
  // OTHER and REMOTE 3000 -> 300 each, US the same; total 18000 -> 12600 (30% fewer)
  const data = dataset({ counts: { US: 12000, OTHER: 300, REMOTE: 300 } });
  const u = uploadDir(data, { meta: { crawled: '2026-01-01', counts: { US: 12000, OTHER: 3000, REMOTE: 3000 } } });
  const r = u.go();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(ids(u.log(), 'set').at(-1), 'meta');
});

function perAts(next) {
  const stored = [crow('A', 'greenhouse', 100), crow('W1', 'workday', 10000), crow('W2', 'workday', 10000), crow('D', 'lever', 50)];
  const data = dataset({ counts: { US: 900 }, companies: next });
  const store = { meta: { crawled: '2026-01-01', counts: { US: 1000 }, companyChunks: 1 }, 'companies-0': { json: JSON.stringify(stored) } };
  return uploadDir(data, store);
}

test('upload: one board family collapsing (workday 20000 -> 2000 open) is refused although totals and countries are within limits', () => {
  const u = perAts([crow('A', 'greenhouse', 100), crow('W1', 'workday', 1000), crow('W2', 'workday', 1000), crow('D', 'lever', 50)]);
  const r = u.go();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to upload:.*workday/);
  assert.deepEqual(u.log(), []);
});

test('upload: the same companies with workday only a little lower (20000 -> 18000) are uploaded', () => {
  const u = perAts([crow('A', 'greenhouse', 100), crow('W1', 'workday', 9000), crow('W2', 'workday', 9000), crow('D', 'lever', 50)]);
  const r = u.go();
  assert.equal(r.status, 0, r.stderr);
  assert.equal(ids(u.log(), 'set').at(-1), 'meta');
});

test('upload: far fewer companies than stored (40 -> 4) is refused', () => {
  const stored = Array.from({ length: 40 }, (_, i) => crow(`S${i}`));
  const data = dataset({ counts: { US: 900 }, companies: stored.slice(0, 4) });
  const u = uploadDir(data, { meta: { crawled: '2026-01-01', counts: { US: 1000 }, companyChunks: 1 }, 'companies-0': { json: JSON.stringify(stored) } });
  const r = u.go();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to upload:.*compan/);
  assert.deepEqual(u.log(), []);
});

test('upload: stored companies that cannot be read (a chunk missing) skip the company and per-ATS checks with a note, and a healthy upload goes on', () => {
  // companies-1 is missing; the readable companies-0 alone (1500 workday rows) would make the new 3 companies look like a collapse
  const bigStored = Array.from({ length: 1500 }, (_, i) => crow(`S${i}`, 'workday', 20));
  const data = dataset({ counts: { US: 1000 } });
  const u = uploadDir(data, { meta: { crawled: '2026-01-01', counts: { US: 1000 }, companyChunks: 2 }, 'companies-0': { json: JSON.stringify(bigStored) } });
  const r = u.go();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /not readable/i);
  assert.doesNotMatch(r.stderr, /Refusing/);
  assert.equal(ids(u.log(), 'set').at(-1), 'meta');
});

test('upload: an unreadable stored companies list does not hide a collapse of the roles themselves', () => {
  const data = dataset({ counts: { US: 100 } });
  const u = uploadDir(data, { meta: { crawled: '2026-01-01', counts: { US: 10000 }, companyChunks: 2 } });
  const r = u.go();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to upload/);
  assert.deepEqual(u.log(), []);
});

// a chunk whose json is about 950 kB: over the 900000 bytes a document may have
const huge = () => dataset({ counts: { US: 1 }, chunks: { 'US-0': [['x'.repeat(950000)]] } });

for (const args of [[], ['--force'], ['--dry'], ['--dry', '--force']]) {
  test(`upload: a document over the size limit stops the run with exit 1 and no write (${args.join(' ') || 'no flags'})`, () => {
    const u = uploadDir(huge(), { meta: { crawled: '2026-01-01', counts: { US: 1 } } });
    const r = u.go(args);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /US-0/);
    assert.deepEqual(u.log(), []);
  });
}

for (const args of [[], ['--dry']]) {
  test(`upload: the size check comes before the credential check (${args.join(' ') || 'no flags'}, FIREBASE_SERVICE_ACCOUNT unset)`, () => {
    const u = uploadDir(huge());
    const r = u.go(args, { sa: '' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /US-0/);
    assert.doesNotMatch(r.stderr, /FIREBASE_SERVICE_ACCOUNT/);
    assert.deepEqual(u.log(), []);
  });
}

test('upload: no FIREBASE_SERVICE_ACCOUNT => exit 1 with the instruction, nothing written', () => {
  const u = uploadDir(dataset());
  const r = u.go([], { sa: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FIREBASE_SERVICE_ACCOUNT/);
  assert.deepEqual(u.log(), []);
});

test('upload: no FIREBASE_SERVICE_ACCOUNT with --dry => exit 0, nothing written', () => {
  const u = uploadDir(dataset());
  const r = u.go(['--dry'], { sa: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(u.log(), []);
});

test('upload: a write that fails twice is tried again and the upload completes (exit 0)', () => {
  const data = dataset();
  const u = uploadDir(data);
  const r = u.go([], { fails: 2 });
  assert.equal(r.status, 0, r.stderr);
  const log = u.log();
  const docs = dataToDocs(data);
  assert.deepEqual(ids(log, 'set-fail'), [docs[0].id, docs[0].id]);
  assert.deepEqual(ids(log, 'set').sort(), docs.map((d) => d.id).sort());
  assert.equal(ids(log, 'set').at(-1), 'meta');
});

test('upload: a write that fails three times ends the upload: non-zero exit, the meta never written', () => {
  const u = uploadDir(dataset());
  const r = u.go([], { fails: 3 });
  assert.notEqual(r.status, 0);
  const log = u.log();
  assert.equal(ids(log, 'set-fail').length, 3);
  assert.ok(!ids(log, 'set').includes('meta'));
  assert.equal(ids(log, 'delete').length, 0);
});
