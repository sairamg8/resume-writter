// The PDF is built off the main thread (R2-142, PERF-6). Every build — the preview, Export PDF, 1-Page
// Fit, the ATS tab's parser view and the editor's warm-up — ran react-pdf on the main thread, and the
// editor stopped answering for as long as a long résumé took to lay out. Now pdfBuild.js hands each
// build to a Web Worker (pdfWorker.js → pdfWorkerJobs.js) that runs the very same renderResumePdf and
// renderCoverLetterPdf, so the file is the one the main thread would have written: here a stand-in
// worker runs the real jobs in this process, through a structured clone as a real one would. The font
// the worker could not load reaches the editor's fontFallback (latest build only); a build that fails
// there fails here with its message; a worker that cannot start or dies hands its builds to the main
// thread, and where there is no Worker at all (Node) everything builds on the main thread as before.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read, allText } from './harness.mjs';

before(setup);
after(teardown);

let build, jobs, fonts;
before(async () => {
  [build, jobs, fonts] = await Promise.all([
    loadModule('/src/utils/pdfBuild.js'),
    loadModule('/src/utils/pdfWorkerJobs.js'),
    loadModule('/src/utils/fontFallback.js'),
  ]);
});
afterEach(() => build._setPdfWorkerForTest(null));

const tick = () => new Promise((r) => { setImmediate(r); });

/** A stand-in pdfWorker.js running the real jobs here: what it was sent, as a worker receives it. */
function inProcessWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminated: false, terminate() { this.terminated = true; } };
  const queue = jobs.runJobs((reply) => { setImmediate(() => w.onmessage?.({ data: structuredClone(reply) })); });
  w.postMessage = (job) => { const copy = structuredClone(job); w.sent.push(copy); queue(copy); };
  return w;
}

/** A worker that answers only when told: `answer(reply)` for the job it holds, `die()` to fail it. */
function scriptedWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminated: false, terminate() { this.terminated = true; } };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  w.answer = (reply) => w.onmessage({ data: reply });
  w.die = () => w.onerror({ message: 'worker script failed to load', preventDefault() {} });
  return w;
}

/** The PDF with its creation and modification dates taken out: the one thing two builds differ in. */
const undated = (bytes) => new TextDecoder('latin1').decode(bytes).replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, '');
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

const sample = () => resume({
  template: 'modern',
  personal: { summary: '<p>Builds <strong>checkout</strong> flows.</p>' },
  sections: [experience([{ description: '<ul><li>Cut page load by 40%</li></ul>' }, { role: 'Lead' }])],
});

describe('the PDF is built in a Web Worker (R2-142, PERF-6)', () => {
  it('the résumé and the letter are built in the worker, and the file is the one the main thread writes', async () => {
    const w = inProcessWorker();
    build._setPdfWorkerForTest(() => w);
    const r = sample();
    const fromWorker = await bytesOf(await build.buildResumePdf(r));
    assert.deepEqual(w.sent.map((j) => j.kind), ['resume'], 'the build went to the worker');
    const here = await render(r);
    assert.equal(undated(fromWorker), undated(here), 'byte for byte the main thread’s PDF, but for its dates');
    assert.equal(allText(await read(fromWorker)), allText(await read(here)));

    const letter = await build.buildCoverLetterPdf({ ...r, coverLetter: { ...r.coverLetter, body: '' } }, { preview: true });
    assert.deepEqual(w.sent.map((j) => [j.kind, j.options]), [['resume', undefined], ['letter', { preview: true }]]);
    assert.equal((await read(await bytesOf(letter))).length, 1);
    assert.equal(letter.type, 'application/pdf');
  });

  it('Export PDF, 1-Page Fit and the warm-up go to the worker too', async () => {
    const w = inProcessWorker();
    build._setPdfWorkerForTest(() => w);
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { fitOnePage } = await loadModule('/src/utils/pageFit.js');
    const { mount } = await import('./fake-dom.mjs');
    let hook;
    function Harness({ tab }) {
      hook = useEditorExports({ resume: sample(), activeTab: tab, authUser: null, importResume: () => {}, navigate: () => {} });
      return null;
    }
    const view = mount(Harness, { tab: 'resume' });
    try {
      await hook.handleExportPDF();
      for (let i = 0; i < 5; i += 1) await tick();
      assert.deepEqual(w.sent.map((j) => j.kind), ['resume'], 'Export PDF built in the worker');
      view.update({ tab: 'coverletter' });
      await hook.handleExportPDF();
      assert.deepEqual(w.sent.map((j) => j.kind), ['resume', 'letter'], 'Export Cover Letter PDF built in the worker');
    } finally {
      await view.unmount();
    }
    const fit = await fitOnePage(sample());
    assert.equal(fit.pages, 1);
    assert.equal(w.sent.at(-1).kind, 'resume', '1-Page Fit counts pages from the worker’s build');
    await build.warmPdfBuild(sample());
    assert.equal(w.sent.at(-1).kind, 'warm');
  });

  it('the font the worker could not load reaches the editor — from the latest build only', async () => {
    const w = scriptedWorker();
    build._setPdfWorkerForTest(() => w);
    fonts.setFontFallback(null);
    const pdf = await render(sample());
    const older = build.buildResumePdf(sample());
    const newer = build.buildResumePdf(sample());
    while (w.sent.length < 2) await tick();
    // The newer build (Lora came back) finishes first; the older one, still for a font that failed, after it.
    w.answer({ id: w.sent[1].id, bytes: pdf, fallback: null });
    await newer;
    w.answer({ id: w.sent[0].id, bytes: pdf, fallback: 'Lora' });
    await older;
    assert.equal(fonts.fontFallback(), null, 'an older build does not name a font the latest one printed');
    const latest = build.buildResumePdf(sample());
    while (w.sent.length < 3) await tick();
    w.answer({ id: w.sent[2].id, bytes: pdf, fallback: 'Lora' });
    assert.equal((await bytesOf(await latest)).length, pdf.length);
    assert.equal(fonts.fontFallback(), 'Lora', 'the latest build’s fallback is the editor’s');
    fonts.setFontFallback(null);
  });

  it('a build that fails in the worker fails with its message', async () => {
    const w = scriptedWorker();
    build._setPdfWorkerForTest(() => w);
    const failing = build.buildResumePdf(sample());
    while (!w.sent.length) await tick();
    w.answer({ id: w.sent[0].id, error: 'Font family not registered: Nope' });
    await assert.rejects(failing, /Font family not registered: Nope/);
  });

  it('a worker that fails to start hands its builds to the main thread, and so does every build after', async () => {
    const w = scriptedWorker();
    build._setPdfWorkerForTest(() => w);
    const held = build.buildResumePdf(sample());
    while (!w.sent.length) await tick();
    w.die();
    const bytes = await bytesOf(await held);
    assert.equal(allText(await read(bytes)), allText(await read(await render(sample()))), 'built on the main thread instead');
    assert.ok(w.terminated, 'the dead worker is let go');
    await build.buildResumePdf(sample());
    assert.equal(w.sent.length, 1, 'no build is sent to it again');
  });

  it('with no Worker (Node), the build runs on the main thread as before', async () => {
    assert.equal(typeof globalThis.Worker, 'undefined');
    const r = sample();
    const bytes = await bytesOf(await build.buildResumePdf(r));
    assert.equal(undated(bytes), undated(await render(r)));
  });
});
