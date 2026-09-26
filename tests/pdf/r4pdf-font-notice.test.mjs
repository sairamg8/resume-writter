// R4-PDF-01: the font notice above the editor's preview ("PT Serif could not be loaded — …") speaks of
// the open résumé only. The page pictures of the template gallery, the dashboard's cards and /new
// (pageImage.js) are PDF builds too, and they owned it: whichever build was asked for last set it, so a
// gallery card in a font that could not load named that font for a résumé that needs no web font, a
// card that loaded cleared the notice while the résumé still printed in Noto Sans, and the preview's own
// reply queued behind a card was ignored. Now a page picture never touches the notice, in the worker
// (pdfBuild.js) and on the main thread (resolvePdfFonts), and the preview's build still sets it.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';

const realFetch = globalThis.fetch;

let build, fonts, pictures, pdfjsLoader;
before(async () => {
  await setup();
  [build, fonts, pictures, pdfjsLoader] = await Promise.all([
    loadModule('/src/utils/pdfBuild.js'),
    loadModule('/src/utils/fontFallback.js'),
    loadModule('/src/utils/pageImage.js'),
    loadModule('/src/utils/pdfjsLoader.js'),
  ]);
});
afterEach(() => {
  build._setPdfWorkerForTest(null);
  pdfjsLoader.setPdfjsForTest(null);
  fonts.setFontFallback(null);
  globalThis.fetch = realFetch;
  delete globalThis.document;
});
after(teardown);

const tick = () => new Promise((r) => { setImmediate(r); });

/** pdf.js and a canvas as pageImage uses them: page 1 opens and paints, nothing is read from the bytes. */
function stubPainting() {
  pdfjsLoader.setPdfjsForTest({
    worker: {},
    lib: {
      getDocument: () => ({
        promise: Promise.resolve({
          getPage: async () => ({
            getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
            render: () => ({ promise: Promise.resolve() }),
          }),
          loadingTask: { destroy() {} },
        }),
      }),
    },
  });
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/jpeg;base64,AA==' }),
  };
}

/** A worker that answers only when told (as tests/pdf/97-pdf-worker's): `answer(reply)` for a job it holds. */
function scriptedWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminate() {} };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  w.answer = (reply) => w.onmessage({ data: reply });
  return w;
}

/** The CDN offline for every font; `gate` holds one package's metadata until it opens. */
function offline(gate = null) {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const pkg = u.match(/@fontsource\/([^@/]+)@/)?.[1];
    if (gate && pkg === gate.pkg && u.endsWith('/metadata.json')) await gate.open;
    throw new TypeError('fetch failed');
  };
}

const PDF = new Uint8Array([37, 80, 68, 70]); // what pdf.js is handed: the stand-in reads none of it

describe('page pictures never set the editor’s font notice (R4-PDF-01)', () => {
  it('in the worker: a gallery card neither names its font nor clears the résumé’s, and the preview queued before it still sets the notice', async () => {
    stubPainting();
    const w = scriptedWorker();
    build._setPdfWorkerForTest(() => w);

    // The preview asks first; a gallery card (Chronicle, in PT Serif) asks after it.
    const preview = build.buildResumePdf(resume());
    const card = pictures.pageImage(resume({ template: 'chronicle' }));
    while (w.sent.length < 2) await tick();

    const job = (template) => w.sent.find((j) => j.resume.template === template);
    w.answer({ id: job('chronicle').id, bytes: PDF, fallback: 'PT Serif' });
    assert.match(await card, /^data:image\/jpeg/);
    assert.equal(fonts.fontFallback(), null, 'the card’s font is not named above the résumé');

    w.answer({ id: job('classic').id, bytes: PDF, fallback: 'Lora' });
    await preview;
    assert.equal(fonts.fontFallback(), 'Lora', 'the preview’s reply, queued behind the card, is the notice');

    // The reverse: a card in a font that loads does not clear the résumé's notice, nor does a letter's.
    const again = pictures.pageImage(resume({ template: 'modern' }));
    const letter = pictures.pageImage(resume(), { letter: true });
    while (w.sent.length < 4) await tick();
    w.answer({ id: w.sent[2].id, bytes: PDF, fallback: null });
    w.answer({ id: w.sent[3].id, bytes: PDF, fallback: null });
    await Promise.all([again, letter]);
    assert.equal(fonts.fontFallback(), 'Lora', 'the résumé still prints in Noto Sans, and the notice stays');
  });

  it('on the main thread: a card whose font cannot load leaves the notice alone, and does not stop a slower preview from setting it', async () => {
    stubPainting();
    assert.equal(typeof globalThis.Worker, 'undefined', 'no Worker in Node: builds run here');

    // A card in a font the CDN cannot serve: its PDF prints in Noto Sans, and the notice says nothing.
    offline();
    await pictures.pageImage(resume({ settings: { customFont: 'Testface Gallery' } }));
    assert.equal(fonts.fontFallback(), null, 'the card’s missing font is not named');

    // The preview's font is slow to fail; a card is built and finished while it waits.
    let open;
    const gate = { pkg: 'testface-slow', open: new Promise((resolve) => { open = resolve; }) };
    offline(gate);
    const preview = build.buildResumePdf(resume({ settings: { customFont: 'Testface Slow' } }));
    try {
      await pictures.pageImage(resume());
    } finally { open(); }
    await preview;
    assert.equal(fonts.fontFallback(), 'Testface Slow', 'the preview is still the latest build of the résumé');
  });
});
