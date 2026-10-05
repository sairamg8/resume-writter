// A PDF worker that never replies must not leave the preview on "Rendering preview…" for good
// (R2-142, PERF-6). pdfBuild.js hands every build to a Web Worker, and only a worker that failed to
// start or that fires an error event fell back: one the browser froze or killed without an event
// (a tab in the background under memory pressure, a blocked script, a hung layout) never replied, so
// the preview, Export PDF and 1-Page Fit waited for good. Now the job the worker is working on has a
// budget (pdfBuildTimeoutMs); one unanswered is given up on: the worker is terminated and its late
// reply ignored. A worker that never replied builds on the main thread (it may never have started); one
// that had built before fails that build, retryable, and its queue goes to a fresh worker.
// The worker is a stand-in and the clock is a fake one the test fires (the timeout is 20 s or more),
// so nothing here needs Chromium or waits for the real budget.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read, allText } from './harness.mjs';

after(teardown);

let build, fonts;
before(async () => {
  await setup();
  [build, fonts] = await Promise.all([
    loadModule('/src/utils/pdfBuild.js'),
    loadModule('/src/utils/fontFallback.js'),
  ]);
});
afterEach(() => build._setPdfWorkerForTest(null));

const tick = () => new Promise((r) => { setImmediate(r); });

/** Wait for `ready()` — bounded, so a build that is never sent fails this test rather than hanging the run. */
async function until(ready, ms = 5000) {
  const stop = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > stop) assert.fail('timed out waiting for the build to be sent');
    await tick();
  }
}

/** `promise`'s outcome, or a failure if it has not settled in `ms` (a build left waiting for good). */
function within(promise, ms = 60_000) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('a build never settled')), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** A worker that answers only when told: `answer(reply)` for a job it holds, `die()` to fail it. */
function scriptedWorker() {
  const w = { sent: [], onmessage: null, onerror: null, onmessageerror: null, terminated: false, terminate() { this.terminated = true; } };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  w.answer = (reply) => w.onmessage({ data: reply });
  w.die = () => w.onerror({ message: 'worker script failed to load', preventDefault() {} });
  return w;
}

/** The watchdog's clock, run by the test: `armed` lists the timers running, `sets` every timer ever set. */
function fakeClock() {
  const live = new Map();
  let n = 0;
  const clock = {
    sets: [],
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

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
const sample = (summary = 'Builds checkout flows') => resume({
  template: 'modern',
  personal: { summary: `<p>${summary}</p>` },
  sections: [experience([{ description: '<ul><li>Cut page load by 40%</li></ul>' }, { role: 'Lead' }])],
});

describe('the budget a worker gets to answer a build', () => {
  it('is 20 s, twice that before the worker has replied, and more for every entry of a long résumé', () => {
    const entries = (n) => ({ kind: 'resume', resume: { sections: [{ items: new Array(n).fill({}) }, { items: new Array(n).fill({}) }] } });
    assert.equal(build.PDF_WORKER_TIMEOUT_MS, 20_000);
    assert.equal(build.pdfBuildTimeoutMs({ kind: 'resume', resume: { sections: [] } }), 20_000);
    assert.equal(build.pdfBuildTimeoutMs({ kind: 'resume', resume: { sections: [] } }, true), 40_000, 'cold: the engine and fonts are still loading');
    assert.equal(build.pdfBuildTimeoutMs(entries(10)), 20_000 + 20 * 250, 'each entry adds to it');
    assert.ok(build.pdfBuildTimeoutMs(entries(40)) > build.pdfBuildTimeoutMs(entries(10)), 'a bigger résumé gets longer');
    assert.equal(build.pdfBuildTimeoutMs(entries(5000)), 20_000 + 200 * 250, 'up to a limit, so a hang is still found');
    assert.equal(build.pdfBuildTimeoutMs({ kind: 'letter', resume: entries(40).resume }), 20_000, 'a letter prints no entries');
    for (const odd of [undefined, {}, { resume: { sections: 'x' } }, { resume: { sections: [null, { items: 3 }] } }]) {
      assert.equal(build.pdfBuildTimeoutMs(odd), 20_000, 'a job with no readable entries gets the base');
    }
  });

  it('counts the entries of a real résumé', () => {
    const r = sample();
    const items = r.sections.reduce((n, s) => n + s.items.length, 0);
    assert.ok(items >= 2);
    assert.equal(build.pdfBuildTimeoutMs({ kind: 'resume', resume: r }), 20_000 + items * 250);
  });
});

describe('a PDF worker that stops answering is let go (R2-142, PERF-6)', () => {
  it('an answer in time leaves no clock running, and a worker that has built gets the plain budget', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const pdf = await render(sample());
    const first = build.buildResumePdf(sample());
    await until(() => w.sent.length);
    assert.deepEqual(clock.armed, [build.pdfBuildTimeoutMs(w.sent[0], true)], 'the clock starts with the job, on the cold budget');
    w.answer({ id: w.sent[0].id, bytes: pdf, fallback: null });
    await within(first);
    assert.deepEqual(clock.armed, [], 'answered: no clock is left running');
    const second = build.buildResumePdf(sample());
    await until(() => w.sent.length > 1);
    assert.deepEqual(clock.armed, [build.pdfBuildTimeoutMs(w.sent[1], false)], 'it has built: the plain budget');
    w.answer({ id: w.sent[1].id, bytes: pdf, fallback: null });
    await within(second);
    assert.deepEqual(clock.armed, []);
    assert.equal(w.terminated, false, 'a worker that answers is left alone');
  });

  it('the clock runs on the job the worker is working on: a job queued behind others is not late, nor is a silent worker\'s clock pushed back by a new job', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const pdf = await render(sample());
    const jobs = [build.buildResumePdf(sample()), build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    await until(() => w.sent.length === 3);
    assert.equal(clock.sets.length, 1, 'one clock, on the first job: the two behind it did not start theirs or restart it');
    w.answer({ id: w.sent[0].id, bytes: pdf, fallback: null });
    await within(jobs[0]);
    assert.equal(clock.sets.length, 2, 'the first answered: the clock starts on the second');
    assert.equal(clock.armed.length, 1);
    w.answer({ id: w.sent[1].id, bytes: pdf, fallback: null });
    w.answer({ id: w.sent[2].id, bytes: pdf, fallback: null });
    await within(Promise.all(jobs));
    assert.deepEqual(clock.armed, [], 'every job answered: nothing left running');
    assert.equal(w.terminated, false);
  });

  it('a worker that never replies: the timeout lets it go and the main thread builds the file, and every build after', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const held = build.buildResumePdf(sample());
    await until(() => w.sent.length);
    assert.equal(w.terminated, false, 'not yet: it is within its budget');
    clock.fire();
    // The build settles (was: never), with the file the main thread makes.
    const bytes = await bytesOf(await within(held));
    assert.equal(allText(await read(bytes)), allText(await read(await render(sample()))), 'built on the main thread instead');
    assert.ok(w.terminated, 'the silent worker is terminated');
    assert.deepEqual(clock.armed, [], 'no clock is left running');
    await within(build.buildResumePdf(sample()));
    assert.equal(w.sent.length, 1, 'no build is sent to it again');
  });

  it('every job a silent worker held is built on the main thread, the warm-up included', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const empty = sample('Secondword');
    const jobs = [
      build.warmPdfBuild(sample()),
      build.buildResumePdf(sample('Firstword')),
      build.buildCoverLetterPdf({ ...empty, coverLetter: { ...empty.coverLetter, body: '' } }, { preview: true }),
    ];
    await until(() => w.sent.length === 3);
    clock.fire();
    const [, resumeBlob, letterBlob] = await within(Promise.all(jobs));
    assert.match(allText(await read(await bytesOf(resumeBlob))), /Firstword/);
    assert.equal((await read(await bytesOf(letterBlob))).length, 1, 'the letter built too');
    assert.deepEqual(clock.armed, []);
  });

  it('what a let-go worker sends late is ignored: a build it was held is not answered twice, and its font words nothing', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    fonts.setFontFallback(null);
    let fetched = 0;
    const off = fonts.onFaceFetched(() => { fetched += 1; });
    try {
      const held = build.buildResumePdf(sample('Mineword'));
      await until(() => w.sent.length);
      clock.fire();
      const mine = await bytesOf(await within(held));
      fonts.setFontFallback(null); // whatever the main thread's own build left
      w.answer({ id: w.sent[0].id, bytes: await render(sample('Staleword')), fallback: 'Lora' });
      w.onmessage({ data: { faceFetched: true } });
      assert.equal(fonts.fontFallback(), null, 'a font the dead worker named is not the editor\'s');
      assert.equal(fetched, 0, 'nor does its face-fetched word build the preview again');
      assert.match(allText(await read(mine)), /Mineword/, 'the file the build resolved with is the main thread\'s');
    } finally {
      off();
      fonts.setFontFallback(null);
    }
  });

  it('a worker that had built before and goes silent: that build fails with a retryable error, the queue behind it goes to a fresh worker, and a late reply from the old one is ignored', async () => {
    const workers = [];
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => { const x = scriptedWorker(); workers.push(x); return x; }, { timers: clock });
    const pdf = await render(sample('Freshword'));
    const stale = await render(sample('Staleword'));
    // It builds one résumé: from now its silence is this résumé's.
    const proof = build.buildResumePdf(sample());
    await until(() => workers[0]?.sent.length);
    workers[0].answer({ id: workers[0].sent[0].id, bytes: pdf, fallback: null });
    await within(proof);

    const hung = build.buildResumePdf(sample());
    const outcome = hung.then(() => null, (e) => e);
    const queued = build.buildResumePdf(sample());
    await until(() => workers[0].sent.length === 3);
    assert.deepEqual(clock.armed, [build.pdfBuildTimeoutMs(workers[0].sent[1], false)], 'the clock is on the job it is working on');
    clock.fire();

    const error = await within(outcome);
    assert.ok(error instanceof Error, 'the hung build failed (was: waited for good)');
    assert.equal(error.code, 'PDF_BUILD_TIMEOUT');
    assert.match(error.message, /took too long to build/, 'a message the preview and Export show, with Retry and "try again"');
    assert.ok(workers[0].terminated, 'the silent worker is terminated');

    // The queued job was sent again, to a fresh worker.
    await until(() => workers[1]?.sent.length);
    assert.deepEqual(workers[1].sent.map((j) => j.id), [workers[0].sent[2].id]);
    assert.equal(workers[1].terminated, false);
    // The old worker's late replies (its id is on the new worker's job) count for nothing.
    workers[0].answer({ id: workers[0].sent[2].id, bytes: stale, fallback: null });
    workers[0].onmessage({ data: { faceFetched: true } });
    workers[0].die();
    workers[1].answer({ id: workers[1].sent[0].id, bytes: pdf, fallback: null });
    assert.match(allText(await read(await bytesOf(await within(queued)))), /Freshword/, 'answered by the fresh worker, not the stale reply');
    assert.equal(workers[1].terminated, false, 'the old worker\'s error event does not break the new one');

    // Retry works: the next build goes to the fresh worker, on the plain budget.
    const retry = build.buildResumePdf(sample());
    await until(() => workers[1].sent.length === 2);
    assert.deepEqual(clock.armed, [build.pdfBuildTimeoutMs(workers[1].sent[1], false)]);
    workers[1].answer({ id: workers[1].sent[1].id, bytes: pdf, fallback: null });
    await within(retry);
    assert.equal(workers[0].sent.length, 3, 'nothing more went to the old one');
  });
});

describe('a worker that errors is let go at once, with no clock left behind', () => {
  it('an error event: its jobs are built on the main thread and the watchdog is stopped', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const held = build.buildResumePdf(sample('Errorword'));
    await until(() => w.sent.length);
    assert.equal(clock.armed.length, 1);
    w.die();
    assert.match(allText(await read(await bytesOf(await within(held)))), /Errorword/);
    assert.ok(w.terminated);
    assert.deepEqual(clock.armed, [], 'the dead worker\'s clock does not run on');
    await within(build.buildResumePdf(sample()));
    assert.equal(w.sent.length, 1, 'no build is sent to it again');
  });

  it('a message it cannot read does the same', async () => {
    const w = scriptedWorker();
    const clock = fakeClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const held = build.buildResumePdf(sample('Messageword'));
    await until(() => w.sent.length);
    assert.equal(clock.armed.length, 1);
    w.onmessageerror();
    assert.match(allText(await read(await bytesOf(await within(held)))), /Messageword/);
    assert.ok(w.terminated);
    assert.deepEqual(clock.armed, []);
  });
});

// The watchdog's clock runs on the page's main thread. A tab the browser froze in the background, or a
// phone that put the browser away, stops the page and the worker together; when it wakes, a clock whose
// time passed meanwhile rings at once, before the worker (which slept too) has had a moment to reply. It
// let that worker go: a cold one sent every build of the session to the main thread (the typing jank the
// worker is there to end), a warm one failed the build with "took too long". A clock that rings well
// past its time (ASLEEP_MS, 5 s) now starts again instead, with the whole budget.
describe('a clock that rings long past its time slept with the page: the worker gets its time again (R2-142, PERF-6)', () => {
  /** fakeClock with a `now` (ms) the test moves on: how late a timer rings. */
  function sleepyClock() {
    const clock = fakeClock();
    clock.at = 1_000;
    clock.now = () => clock.at;
    return clock;
  }

  it('a worker that has not replied yet, its clock ringing a minute late: not let go, and its reply builds the file', async () => {
    const w = scriptedWorker();
    const clock = sleepyClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const pdf = await render(sample('Wokeword'));
    const held = build.buildResumePdf(sample());
    await until(() => w.sent.length);
    const budget = build.pdfBuildTimeoutMs(w.sent[0], true);
    clock.at += budget + 60_000; // the tab was frozen for a minute past the budget
    clock.fire();
    assert.equal(w.terminated, false, 'not let go (was: terminated, and every build after on the main thread)');
    assert.deepEqual(clock.armed, [budget], 'its clock starts again, with the whole budget');
    w.answer({ id: w.sent[0].id, bytes: pdf, fallback: null });
    assert.match(allText(await read(await bytesOf(await within(held)))), /Wokeword/, 'the worker\'s file');
    assert.deepEqual(clock.armed, []);
    const next = build.buildResumePdf(sample());
    await until(() => w.sent.length === 2);
    assert.equal(w.sent.length, 2, 'the next build goes to the worker, not the main thread');
    w.answer({ id: w.sent[1].id, bytes: pdf, fallback: null });
    await within(next);
  });

  it('a worker that has built before, its clock ringing late: the build is not failed as "took too long"', async () => {
    const w = scriptedWorker();
    const clock = sleepyClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const pdf = await render(sample('Wokeword'));
    const proof = build.buildResumePdf(sample());
    await until(() => w.sent.length);
    w.answer({ id: w.sent[0].id, bytes: pdf, fallback: null });
    await within(proof);
    const held = build.buildResumePdf(sample());
    await until(() => w.sent.length === 2);
    const budget = build.pdfBuildTimeoutMs(w.sent[1], false);
    clock.at += budget + 10 * 60_000;
    clock.fire();
    assert.equal(w.terminated, false);
    assert.deepEqual(clock.armed, [budget]);
    w.answer({ id: w.sent[1].id, bytes: pdf, fallback: null });
    assert.match(allText(await read(await bytesOf(await within(held)))), /Wokeword/, 'resolved with the file (was: rejected, PDF_BUILD_TIMEOUT)');
  });

  it('a clock that rings on time, or a few seconds late (a busy page), still lets a silent worker go — after a late ring too', async () => {
    for (const late of [0, 4_000]) {
      const w = scriptedWorker();
      const clock = sleepyClock();
      build._setPdfWorkerForTest(() => w, { timers: clock });
      const held = build.buildResumePdf(sample('Ontimeword'));
      await until(() => w.sent.length);
      clock.at += build.pdfBuildTimeoutMs(w.sent[0], true) + late;
      clock.fire();
      assert.ok(w.terminated, `${late} ms late: let go`);
      assert.match(allText(await read(await bytesOf(await within(held)))), /Ontimeword/, 'built on the main thread');
    }
    // Asleep once, then silent for its whole budget again: let go then.
    const w = scriptedWorker();
    const clock = sleepyClock();
    build._setPdfWorkerForTest(() => w, { timers: clock });
    const held = build.buildResumePdf(sample('Twiceword'));
    await until(() => w.sent.length);
    const budget = build.pdfBuildTimeoutMs(w.sent[0], true);
    clock.at += budget + 60_000;
    clock.fire();
    assert.equal(w.terminated, false);
    clock.at += budget;
    clock.fire();
    assert.ok(w.terminated, 'awake and still silent for its budget: let go');
    assert.match(allText(await read(await bytesOf(await within(held)))), /Twiceword/);
    assert.deepEqual(clock.armed, []);
  });
});
