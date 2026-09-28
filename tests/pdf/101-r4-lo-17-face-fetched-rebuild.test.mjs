// R4-LO-17: a borrowing font face's own data that arrives after its build stopped waiting (3 s) is put
// in by the next build — and nothing asked for one, so the preview kept the stand-in face until the
// next edit. Pinned here: the preview builds again when fontFallback.js's faceFetched says so, and
// pdfBuild.js passes on the PDF worker's { faceFetched } message (pdfWorker.js), which is no build's
// reply. The font loader's side is in tests/pdf/101-r4-lo-17-font-face-retry.
// Run: node --test tests/pdf/101-r4-lo-17-face-fetched-rebuild.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, resume, render } from './harness.mjs';
import { setupPreview, teardownPreview, opened, versions, settle } from './preview-stub.mjs';

before(setupPreview);
// PdfPreview.jsx not loading (fail-first) must not leave the harness's servers up: that hung the run.
after(() => teardownPreview());

it('the preview builds again, once, when a face arrived after its build', async () => {
  const fonts = await loadModule('/src/utils/fontFallback.js');
  fonts.setFontFallback(null);
  const [v0] = versions(1);
  const { view, calls } = await opened(v0);
  try {
    assert.equal(calls.length, 1);
    view.act(() => fonts.faceFetched());
    await settle();
    assert.equal(calls.length, 2, 'built again, to put the face in');
    assert.equal(calls[1].input, v0);
  } finally {
    await view.unmount();
  }
});

it('the worker\'s { faceFetched } reaches the main thread\'s subscribers, and is no build\'s reply', async () => {
  const build = await loadModule('/src/utils/pdfBuild.js');
  const fonts = await loadModule('/src/utils/fontFallback.js');
  const w = { sent: [], onmessage: null, onerror: null, terminate() {} };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  build._setPdfWorkerForTest(() => w);
  let heard = 0;
  const stop = fonts.onFaceFetched(() => { heard += 1; });
  try {
    const pending = build.buildResumePdf(resume({}));
    while (!w.sent.length) await new Promise((r) => { setImmediate(r); });
    w.onmessage({ data: { faceFetched: true } });
    assert.equal(heard, 1, 'passed on to the preview');
    w.onmessage({ data: { id: w.sent[0].id, bytes: await render(resume({})), fallback: null, borrowed: false } });
    assert.ok((await pending) instanceof Blob, 'the build still gets its own reply');
  } finally {
    stop();
    build._setPdfWorkerForTest(null);
  }
});
