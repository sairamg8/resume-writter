// A main-thread PDF build past its budget is not overlapped by the next one (R2-142, review of 38e7b70e).
// Where there is no working PDF worker the builds run on the main thread, with the cold budget
// (pdfBuild.js); one past it fails, retryable, and runs on unheard — nothing can stop it. The preview then
// started its next build at once: two builds laid out side by side on the one thread, each slowing the
// other, so the next could run past its budget too. Now the next main-thread build waits for the one still
// running: the same résumé (Retry) takes that build's file when it is done; another starts then. One still
// running a worker budget (20 s) on is taken to be hung — waiting on something that never comes — and the
// next starts beside it, as before, and no later build waits for it. The failed build's file never
// reaches the caller it failed.
// The slow build waits for a font face the test releases (a stand-in fetch); the budgets run on a fake
// clock the test fires (pdfBuild._setPdfWorkerForTest).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule, resume, experience } from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = readFileSync(path.join(ROOT, 'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
const realFetch = globalThis.fetch;

let build;
let loader;
before(async () => {
  await setup();
  build = await loadModule('/src/utils/pdfBuild.js');
  loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
});
afterEach(() => {
  build._setPdfWorkerForTest(null);
  loader._setFontLoadWaitForTest();
  globalThis.fetch = realFetch;
});
after(teardown);

/** The CDN: a "Testface" package's faces answer once its gate (in `gates`) opens; metadata at once. */
function network(gates) {
  const fetched = new Set();
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const pkg = u.match(/@fontsource\/([^@/]+)@/)?.[1];
    if (!pkg?.startsWith('testface')) throw new TypeError('fetch failed');
    if (u.endsWith('/metadata.json')) {
      const family = pkg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return new Response(JSON.stringify({ family, weights: [400], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    if (u.endsWith('.woff')) {
      fetched.add(pkg);
      await gates[pkg];
      return new Response(NOTO, { status: 200 });
    }
    throw new TypeError('fetch failed');
  };
  return { fetching: (pkg) => fetched.has(pkg) };
}

/** A gate: `promise`, and `open()` it. */
function gate() {
  let open;
  const promise = new Promise((resolve) => { open = resolve; });
  return { promise, open };
}

const tick = () => new Promise((r) => { setImmediate(r); });
async function until(ready, what, ms = 20_000) {
  const stop = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > stop) assert.fail(`timed out waiting: ${what}`);
    await tick();
  }
}
function within(promise, ms = 60_000) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('a build never settled')), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
const outcome = (p) => p.then(() => null, (e) => e);
const timedOut = (e) => e instanceof Error && e.code === 'PDF_BUILD_TIMEOUT';

/** The clock, run by the test (as tests/pdf/112's): `armed` the timers running, `sets` every one set. */
function fakeClock() {
  const live = new Map();
  let n = 0;
  const clock = {
    sets: [],
    at: 1_000,
    now: () => clock.at,
    set(fn, ms) { n += 1; live.set(n, { fn, ms }); clock.sets.push(ms); return n; },
    clear(id) { live.delete(id); },
    get armed() { return [...live.values()].map((t) => t.ms); },
    fire() {
      const first = live.entries().next().value;
      assert.ok(first, 'a timer is running to fire');
      live.delete(first[0]);
      first[1].fn();
    },
  };
  return clock;
}

/** A résumé in a CDN font: its build waits for that font's faces. */
const inFont = (customFont) => resume({ template: 'classic', settings: { customFont }, sections: [experience([{ role: 'Lead' }])] });
/** A résumé in the bundled Noto Sans: its build needs no network. */
const plain = () => resume({ template: 'classic', sections: [experience([{ role: 'Designer' }])] });
const budget = (r) => build.pdfBuildTimeoutMs({ kind: 'resume', resume: r }, true);
const WAIT = () => build.PDF_WORKER_TIMEOUT_MS; // how long the next build waits for one past its budget

/** Start a main-thread build of `r` that waits for its font, and run it past its budget. */
async function overrunning(r, pkg, net, clock) {
  const failed = outcome(build.buildResumePdf(r));
  await until(() => clock.armed.length === 1, 'the main thread\'s build has its clock');
  await until(() => net.fetching(pkg), 'the build waits for its font');
  clock.fire();
  assert.ok(timedOut(await within(failed)), 'past its budget it fails, retryable');
}

describe('a main-thread build past its budget is not overlapped by the next (R2-142)', () => {
  it('Retry (the same résumé) waits for the build still running and takes its file: no second build', { timeout: 90_000 }, async () => {
    loader._setFontLoadWaitForTest(60_000);
    const g = gate();
    const net = network({ 'testface-hold-one': g.promise });
    const clock = fakeClock();
    build._setPdfWorkerForTest(null, { timers: clock }); // no Worker in Node: every build is the main thread's
    const cv = inFont('Testface Hold One');
    await overrunning(cv, 'testface-hold-one', net, clock);

    const sets = clock.sets.length;
    const retry = build.buildResumePdf(cv);
    await until(() => clock.sets.length > sets, 'the retry is under way');
    assert.deepEqual(clock.armed, [WAIT()],
      `it waits for the build still running rather than lay out beside it (was: a build of its own at once, on ${budget(cv)} ms)`);
    g.open(); // the first build's font arrives: it finishes
    const blob = await within(retry);
    assert.equal(blob.type, 'application/pdf', 'the retry has the file');
    assert.deepEqual(clock.sets.slice(sets), [WAIT()], 'and built nothing itself: the first build\'s file, which was the same');
    assert.deepEqual(clock.armed, [], 'no clock left running');
  });

  it('another résumé waits for it too, then builds its own', { timeout: 90_000 }, async () => {
    loader._setFontLoadWaitForTest(60_000);
    const g = gate();
    const net = network({ 'testface-hold-two': g.promise });
    const clock = fakeClock();
    build._setPdfWorkerForTest(null, { timers: clock });
    await overrunning(inFont('Testface Hold Two'), 'testface-hold-two', net, clock);

    const sets = clock.sets.length;
    const other = plain();
    const next = build.buildResumePdf(other);
    await until(() => clock.sets.length > sets, 'the next build is under way');
    assert.deepEqual(clock.armed, [WAIT()], 'it waits for the build still running (was: laid out beside it at once)');
    g.open();
    assert.equal((await within(next)).type, 'application/pdf');
    assert.deepEqual(clock.sets.slice(sets), [WAIT(), budget(other)], 'it built its own, on a whole budget, once the first was done');
    assert.deepEqual(clock.armed, []);
  });

  it('one still running a worker budget on is taken to be hung: the next starts beside it, and no later build waits', { timeout: 90_000 }, async () => {
    loader._setFontLoadWaitForTest(60_000);
    const g = gate();
    const net = network({ 'testface-hold-three': g.promise });
    const clock = fakeClock();
    build._setPdfWorkerForTest(null, { timers: clock });
    try {
      await overrunning(inFont('Testface Hold Three'), 'testface-hold-three', net, clock);

      let sets = clock.sets.length;
      const second = plain();
      const next = build.buildResumePdf(second);
      await until(() => clock.sets.length > sets, 'the next build is under way');
      assert.deepEqual(clock.armed, [WAIT()], 'it waits for the build still running');
      clock.fire(); // the wait runs out: the first build is taken to be hung
      assert.equal((await within(next)).type, 'application/pdf', 'the next one builds anyway, beside it');
      assert.deepEqual(clock.sets.slice(sets), [WAIT(), budget(second)]);

      sets = clock.sets.length;
      const third = plain();
      assert.equal((await within(build.buildResumePdf(third))).type, 'application/pdf');
      assert.deepEqual(clock.sets.slice(sets), [budget(third)], 'a later build does not wait for the hung one again');
    } finally { g.open(); }
  });
});
