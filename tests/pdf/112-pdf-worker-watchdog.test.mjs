// A PDF build that never comes back must not hold every later one behind it (R2-142). The worker runs
// its jobs one at a time, and nothing timed a job: a font fetch that stalled (a captive portal, a CDN
// that takes the connection and never answers) left the preview on "Updating preview…" for good, with
// Export PDF, 1-Page Fit and the ATS parser view dead behind it, until the page was reloaded. Now the job
// the worker is on gets BUILD_TIMEOUT_MS: past it the worker is stopped, that build fails with a message
// (the preview shows it with Retry) and the builds that waited behind it go to a fresh worker. The clock
// runs on the job the worker is ON, not on one waiting its turn; the main thread's fallback has the same
// limit. A stand-in worker that answers only when told, and a short limit (pdfBuild._setPdfWorkerForTest).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience } from './harness.mjs';

after(teardown);

let build;
before(async () => {
  await setup();
  build = await loadModule('/src/utils/pdfBuild.js').catch(() => null);
});
afterEach(() => build?._setPdfWorkerForTest(null));

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const sample = () => resume({ template: 'modern', sections: [experience([{ role: 'Lead' }])] });

/** A worker that answers only when told: `answer(reply)` for a job it holds. */
function scriptedWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminated: false, terminate() { this.terminated = true; } };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  w.answer = (reply) => w.onmessage({ data: reply });
  return w;
}
/** What a worker sends for a finished build. */
const done = (id) => ({ id, bytes: new Uint8Array([37, 80, 68, 70]), fallback: null, borrowed: false });
/** Start the stand-in: every worker the code under test starts is kept, in order, in the array returned. */
function workers(timeoutMs) {
  const made = [];
  build._setPdfWorkerForTest(() => { const w = scriptedWorker(); made.push(w); return w; }, { timeoutMs });
  return made;
}

describe('a PDF build the worker never answers fails, and the builds behind it go on (R2-142)', () => {
  it('it fails with a message once the limit passes, and the worker is stopped', { timeout: 5000 }, async () => {
    const made = workers(120);
    await assert.rejects(build.buildResumePdf(sample()), /took more than/);
    assert.equal(made.length, 1);
    assert.deepEqual([made[0].sent.length, made[0].terminated], [1, true], 'the one worker had the job, and is stopped');
  });

  it('the next build runs on a fresh worker', { timeout: 5000 }, async () => {
    const made = workers(120);
    await assert.rejects(build.buildResumePdf(sample()), /took more than/);
    const next = build.buildResumePdf(sample());
    await wait(30);
    assert.equal(made.length, 2, 'a new worker started');
    assert.equal(made[1].sent.length, 1, 'and holds the new build');
    made[1].answer(done(made[1].sent[0].id));
    const blob = await next;
    assert.equal(blob.type, 'application/pdf');
    assert.equal(made[1].terminated, false);
  });

  it('builds that waited behind it go to the fresh worker, in order, and finish', { timeout: 5000 }, async () => {
    const made = workers(150);
    const [a, b, c] = [build.buildResumePdf(sample()), build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    const aFails = assert.rejects(a, /took more than/);
    await wait(40);
    assert.equal(made[0].sent.length, 3, 'all three were with the first worker');
    const ids = made[0].sent.map((j) => j.id);
    await aFails;
    await wait(40);
    assert.equal(made.length, 2);
    assert.deepEqual(made[1].sent.map((j) => j.id), [ids[1], ids[2]], 'the two that never ran, in order');
    made[1].answer(done(ids[1]));
    made[1].answer(done(ids[2]));
    assert.deepEqual((await Promise.all([b, c])).map((blob) => blob.type), ['application/pdf', 'application/pdf']);
  });

  it('the clock runs on the job the worker is on: one that waited behind a slow job is not failed for it', { timeout: 5000 }, async () => {
    const made = workers(400);
    const [a, b] = [build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    await wait(40);
    const [ja, jb] = made[0].sent;
    await wait(260);
    made[0].answer(done(ja.id));
    await a;
    // b has now been with the worker for 560 ms, over the limit, but it has been on it for 260.
    await wait(260);
    assert.equal(made[0].terminated, false, 'b was timed from when it began, not from when it was sent');
    made[0].answer(done(jb.id));
    assert.equal((await b).type, 'application/pdf');
    assert.equal(made.length, 1);
  });

  it('a second stall in a row fails the next build too, on yet another fresh worker', { timeout: 5000 }, async () => {
    const made = workers(120);
    await assert.rejects(build.buildResumePdf(sample()), /took more than/);
    await assert.rejects(build.buildResumePdf(sample()), /took more than/);
    assert.deepEqual(made.map((w) => w.terminated), [true, true], 'each stalled worker was stopped, one build each');
  });

  it('a late word from the stopped worker changes nothing', { timeout: 5000 }, async () => {
    const made = workers(120);
    const a = build.buildResumePdf(sample());
    await wait(30);
    const idA = made[0].sent[0].id;
    await assert.rejects(a, /took more than/);
    made[0].answer(done(idA)); // a message already on its way when the worker was stopped
    const b = build.buildResumePdf(sample());
    await wait(30);
    made[1].answer(done(made[1].sent[0].id));
    assert.equal((await b).type, 'application/pdf');
  });

  it('a build moved to the fresh worker gets a whole limit of its own', { timeout: 5000 }, async () => {
    const made = workers(300);
    const [a, b] = [build.buildResumePdf(sample()), build.buildResumePdf(sample())];
    const aFails = assert.rejects(a, /took more than/);
    await wait(40);
    const idB = made[0].sent[1].id;
    await aFails;
    await wait(150); // b was sent over 450 ms ago, past the limit it was first held to
    assert.equal(made[1].terminated, false, 'b has been on the fresh worker for 150 ms only');
    made[1].answer(done(idB));
    assert.equal((await b).type, 'application/pdf');
  });

  it('a build the worker answers in time leaves nothing to fail later', { timeout: 5000 }, async () => {
    const made = workers(120);
    const a = build.buildResumePdf(sample());
    await wait(30);
    made[0].answer(done(made[0].sent[0].id));
    assert.equal((await a).type, 'application/pdf');
    await wait(250);
    assert.deepEqual([made.length, made[0].terminated], [1, false], 'no late stop');
  });

  it('on the main thread, where there is no worker to stop, a build past the limit fails too', { timeout: 5000 }, async () => {
    build._setPdfWorkerForTest(null, { timeoutMs: 1 });
    await assert.rejects(build.buildResumePdf(sample()), /took more than/);
    // The build it gave up on runs on unheard; the next one, with the real limit, is not held behind it.
    build._setPdfWorkerForTest(null);
    assert.equal((await build.buildResumePdf(sample())).type, 'application/pdf');
  });
});
