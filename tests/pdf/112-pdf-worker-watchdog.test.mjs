// A PDF build that never comes back must not hold every later one behind it (R2-142). The typing-freeze
// hunt's watchdog cases (7dbf69e9, f34a9d0a), on the one watchdog the app keeps: PERF-6's in pdfBuild.js,
// whose budgets, cold worker sent to the main thread, ignored late replies and sleeping page are pinned by
// tests/pdf/126-r2-142-pdf-worker-watchdog. Here: a worker that has built before and goes silent fails
// that build (retryable) and is stopped; the builds behind it go to a fresh worker, in order, each with a
// whole budget of its own; the clock runs on the job the worker is on, not on one waiting its turn; a
// second stall in a row does the same on yet another worker. And the main thread, where there is no worker
// to stop, has the same (cold) budget: a build there that never settled held the preview's one queued build
// (PdfPreview.jsx) and Export waiting for good. A clock ringing long past its time there was held up by the
// page itself (asleep, or laying the build out) and starts again.
// A stand-in worker that answers only when told, and a fake clock the test fires (pdfBuild._setPdfWorkerForTest).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience } from './harness.mjs';

after(teardown);

let build;
before(async () => {
  await setup();
  build = await loadModule('/src/utils/pdfBuild.js');
});
afterEach(() => build._setPdfWorkerForTest(null));

const tick = () => new Promise((r) => { setImmediate(r); });
/** Wait for `ready()` — bounded, so a step that never comes fails this test rather than hanging the run. */
async function until(ready, what, ms = 5000) {
  const stop = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > stop) assert.fail(`timed out waiting: ${what}`);
    await tick();
  }
}
/** `promise`'s outcome, or a failure if it has not settled in `ms`. */
function within(promise, ms = 60_000) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('a build never settled')), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
/** The error a build failed with, or null if it resolved. */
const outcome = (p) => p.then(() => null, (e) => e);
const timedOut = (e) => e instanceof Error && e.code === 'PDF_BUILD_TIMEOUT' && /took too long to build/.test(e.message);

const sample = () => resume({ template: 'modern', sections: [experience([{ role: 'Lead' }])] });
const budget = (cold) => build.pdfBuildTimeoutMs({ kind: 'resume', resume: sample() }, cold);

/** A worker that answers only when told: `answer(reply)` for a job it holds. */
function scriptedWorker() {
  const w = { sent: [], onmessage: null, onerror: null, onmessageerror: null, terminated: false, terminate() { this.terminated = true; } };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  w.answer = (reply) => w.onmessage({ data: reply });
  return w;
}
/** What a worker sends for a finished build. */
const done = (id) => ({ id, bytes: new Uint8Array([37, 80, 68, 70]), fallback: null, borrowed: false });

/** The clock, run by the test: `armed` lists the timers running, `sets` every timer ever set; `at` is now (ms). */
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

/** Start the stand-in: every worker the code starts is kept, in order, in `made`; the first has built once. */
async function provenWorkers() {
  const made = [];
  const clock = fakeClock();
  build._setPdfWorkerForTest(() => { const w = scriptedWorker(); made.push(w); return w; }, { timers: clock });
  const proof = build.buildResumePdf(sample());
  await until(() => made[0]?.sent.length, 'the first build reaches the worker');
  made[0].answer(done(made[0].sent[0].id));
  await within(proof);
  return { made, clock };
}

describe('a worker that has built goes silent: that build fails and the builds behind it go on (R2-142)', () => {
  it('the build fails with a retryable error once its budget passes, and the worker is stopped', async () => {
    const { made, clock } = await provenWorkers();
    const failed = outcome(build.buildResumePdf(sample()));
    await until(() => made[0].sent.length === 2, 'the build reaches the worker');
    assert.deepEqual(clock.armed, [budget(false)]);
    assert.equal(made[0].terminated, false, 'not before its budget');
    clock.fire();
    assert.ok(timedOut(await within(failed)), 'it fails, with the message the preview shows with Retry (was: it waited for good)');
    assert.equal(made.length, 1);
    assert.deepEqual([made[0].sent.length, made[0].terminated], [2, true], 'the one worker had it, and is stopped');
  });

  it('the next build runs on a fresh worker', async () => {
    const { made, clock } = await provenWorkers();
    const failed = outcome(build.buildResumePdf(sample()));
    await until(() => made[0].sent.length === 2, 'the build reaches the worker');
    clock.fire();
    assert.ok(timedOut(await within(failed)));
    const next = build.buildResumePdf(sample());
    await until(() => made[1]?.sent.length === 1, 'a new worker holds the new build');
    made[1].answer(done(made[1].sent[0].id));
    assert.equal((await within(next)).type, 'application/pdf');
    assert.equal(made[1].terminated, false);
  });

  it('builds that waited behind it go to the fresh worker, in order, and finish', async () => {
    const { made, clock } = await provenWorkers();
    const [a, b, c] = [build.buildResumePdf(sample()), build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    const aFails = outcome(a);
    await until(() => made[0].sent.length === 4, 'all three reach the first worker');
    const ids = made[0].sent.slice(1).map((j) => j.id);
    clock.fire();
    assert.ok(timedOut(await within(aFails)));
    await until(() => made[1]?.sent.length === 2, 'the two behind it reach a fresh worker');
    assert.deepEqual(made[1].sent.map((j) => j.id), [ids[1], ids[2]], 'the two that never ran, in order');
    made[1].answer(done(ids[1]));
    made[1].answer(done(ids[2]));
    assert.deepEqual((await within(Promise.all([b, c]))).map((blob) => blob.type), ['application/pdf', 'application/pdf']);
  });

  it('the clock runs on the job the worker is on: one that waited behind a slow job is timed from when it began', async () => {
    const { made, clock } = await provenWorkers();
    const [a, b] = [build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    await until(() => made[0].sent.length === 3, 'both reach the worker');
    const [, ja, jb] = made[0].sent;
    assert.deepEqual(clock.armed, [budget(false)], 'one clock, on a');
    const sets = clock.sets.length;
    clock.at += budget(false) - 1; // a takes nearly its whole budget; b has been sent as long
    made[0].answer(done(ja.id));
    await within(a);
    assert.equal(clock.sets.length, sets + 1, 'a answered: a new clock, on b');
    assert.deepEqual(clock.armed, [budget(false)], 'b gets its whole budget from now, not what is left of the time since it was sent');
    assert.equal(made[0].terminated, false);
    made[0].answer(done(jb.id));
    assert.equal((await within(b)).type, 'application/pdf');
    assert.equal(made.length, 1);
  });

  it('a second stall in a row fails the next build too, on yet another fresh worker', async () => {
    const { made, clock } = await provenWorkers();
    const first = outcome(build.buildResumePdf(sample()));
    await until(() => made[0].sent.length === 2, 'the first reaches the worker');
    clock.fire();
    assert.ok(timedOut(await within(first)));
    const second = outcome(build.buildResumePdf(sample()));
    await until(() => made[1]?.sent.length === 1, 'the second reaches a fresh worker');
    clock.fire();
    assert.ok(timedOut(await within(second)), 'it fails as the first did (not sent to the main thread)');
    assert.deepEqual(made.map((w) => w.terminated), [true, true], 'each stalled worker was stopped, one build each');
    const third = build.buildResumePdf(sample());
    await until(() => made[2]?.sent.length === 1, 'the third reaches yet another worker');
    made[2].answer(done(made[2].sent[0].id));
    assert.equal((await within(third)).type, 'application/pdf');
  });

  it('a late word from the stopped worker about the build it failed changes nothing', async () => {
    const { made, clock } = await provenWorkers();
    const failed = outcome(build.buildResumePdf(sample()));
    await until(() => made[0].sent.length === 2, 'the build reaches the worker');
    const idA = made[0].sent[1].id;
    clock.fire();
    assert.ok(timedOut(await within(failed)));
    made[0].answer(done(idA)); // a message already on its way when the worker was stopped
    const b = build.buildResumePdf(sample());
    await until(() => made[1]?.sent.length === 1, 'the next build reaches a fresh worker');
    made[1].answer(done(made[1].sent[0].id));
    assert.equal((await within(b)).type, 'application/pdf');
  });

  it('a build moved to the fresh worker gets a whole budget of its own', async () => {
    const { made, clock } = await provenWorkers();
    const [a, b] = [build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    const aFails = outcome(a);
    await until(() => made[0].sent.length === 3, 'both reach the first worker');
    const idB = made[0].sent[2].id;
    clock.at += budget(false); // b was sent a whole budget ago
    const sets = clock.sets.length;
    clock.fire();
    assert.ok(timedOut(await within(aFails)));
    await until(() => made[1]?.sent.length === 1, 'b reaches a fresh worker');
    assert.equal(clock.sets.length, sets + 1, 'a new clock, on b');
    assert.deepEqual(clock.armed, [budget(false)], 'the whole budget, from now');
    assert.equal(made[1].terminated, false);
    made[1].answer(done(idB));
    assert.equal((await within(b)).type, 'application/pdf');
  });
});

describe('the main thread, where there is no worker to stop, has the same budget (R2-142)', () => {
  it('a build past it fails, retryable, and the next is not held behind it for good', async () => {
    const clock = fakeClock();
    build._setPdfWorkerForTest(null, { timers: clock }); // no Worker in Node: every build is the main thread's
    const failed = outcome(build.buildResumePdf(sample()));
    await until(() => clock.armed.length === 1, 'the main thread\'s build has a clock (was: none)');
    assert.deepEqual(clock.armed, [budget(true)], 'the cold budget: it may be the first to load the engine and fonts');
    clock.fire();
    assert.ok(timedOut(await within(failed)), 'it fails (the build runs on unheard: there is nothing to stop)');
    const next = await within(build.buildResumePdf(sample()));
    assert.equal(next.type, 'application/pdf', 'the next build goes on');
    assert.deepEqual(clock.armed, [], 'and leaves no clock running');
  });

  it('a clock that rings long past its time (the page asleep, or busy laying the build out) starts again; the build finishes', async () => {
    const clock = fakeClock();
    build._setPdfWorkerForTest(null, { timers: clock });
    const held = build.buildResumePdf(sample());
    await until(() => clock.armed.length === 1, 'the main thread\'s build has a clock');
    clock.at += budget(true) + 60_000;
    clock.fire();
    assert.deepEqual(clock.armed, [budget(true)], 'its clock starts again, with the whole budget');
    assert.equal((await within(held)).type, 'application/pdf', 'not failed: the file');
    assert.deepEqual(clock.armed, []);
  });

  it('the builds a silent worker held, moved to the main thread, get that budget there', async () => {
    const made = [];
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => { const w = scriptedWorker(); made.push(w); return w; }, { timers: clock });
    const held = build.buildResumePdf(sample());
    await until(() => made[0]?.sent.length === 1, 'the build reaches the worker');
    clock.fire(); // it never answered anything: let go, its build moves to the main thread
    assert.ok(made[0].terminated);
    assert.deepEqual(clock.armed, [budget(true)], 'the moved build is timed on the main thread too');
    assert.equal((await within(held)).type, 'application/pdf');
    assert.deepEqual(clock.armed, []);
  });
});
