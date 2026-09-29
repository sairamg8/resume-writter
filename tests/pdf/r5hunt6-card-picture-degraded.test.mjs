// R5-HUNT6-CARD-PICTURE-KEPT-DEGRADED: a dashboard card's page-1 picture (pageImage.js) painted while
// the résumé's font could not be loaded (Noto Sans in its place) or its photo URL could not be fetched
// was kept — in memory for the session and in the card's storage key (savePicture) at the résumé's
// printHash, which says nothing of what loaded — so every later visit showed that wrong picture until
// the résumé was edited. A page picture builds with reportFont: false, and the worker's reply carried
// the editor's notice (fontFallback()), not its own build's. Now each build notes its own fallback
// (buildNote), the reply carries it, and a picture painted without the font or the photo is shown but
// kept neither in memory nor in storage: the next visit paints it again. Fictional data only.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';

const realFetch = globalThis.fetch;

let build, pictures, store, jobs;
before(async () => {
  await setup();
  [build, pictures, store, jobs] = await Promise.all([
    loadModule('/src/utils/pdfBuild.js'),
    loadModule('/src/utils/pageImage.js'),
    loadModule('/src/utils/pageImageStore.js'),
    loadModule('/src/utils/pdfWorkerJobs.js'),
  ]);
});
afterEach(async () => {
  build._setPdfWorkerForTest(null);
  (await loadModule('/src/utils/pdfjsLoader.js')).setPdfjsForTest(null);
  globalThis.fetch = realFetch;
  delete globalThis.document;
  delete globalThis.localStorage;
});
after(teardown);

const tick = () => new Promise((r) => { setImmediate(r); });

/** A localStorage stand-in. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let painted = 0;
/** pdf.js and a canvas as pageImage uses them: each paint a picture of its own. */
async function stubPainting() {
  (await loadModule('/src/utils/pdfjsLoader.js')).setPdfjsForTest({
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
    createElement: () => ({ width: 0, height: 0, getContext: () => ({}), toDataURL: () => `data:image/jpeg;base64,P${painted += 1}` }),
  };
  globalThis.localStorage = new MemoryStorage();
  store._forgetSavedForTest();
}

/** A worker that answers only when told (as r4pdf-font-notice's). */
function scriptedWorker() {
  const w = { sent: [], onmessage: null, onerror: null, terminate() {} };
  w.postMessage = (job) => { w.sent.push(structuredClone(job)); };
  w.answer = (reply) => w.onmessage({ data: reply });
  return w;
}

/** `host` unreachable: the font CDN, or the photo's. */
function offline(host = 'cdn.jsdelivr.net') {
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes(host)) throw new TypeError('fetch failed');
    return realFetch(url, opts);
  };
}

const PDF = new Uint8Array([37, 80, 68, 70]);

/** The card's own path (ResumeCard): paint through the queue, then keep it at the résumé's printHash. */
function paintCard(r) {
  const hash = store.printHash(r);
  const key = `resume:${r.id}:${hash}`;
  return new Promise((resolve) => {
    store.requestPicture(key, () => pictures.pageImage(r, { width: 160 }), (url) => {
      if (url) store.savePicture(r.id, hash, url);
      resolve({ url, key, hash });
    });
  });
}

describe('a card picture painted without the résumé\'s font or photo is not kept (R5-HUNT6-CARD-PICTURE-KEPT-DEGRADED)', () => {
  it('in the worker: a build in Noto Sans in place of Lato is shown but kept neither for the session nor the next visit; a whole one is kept', async () => {
    await stubPainting();
    const w = scriptedWorker();
    build._setPdfWorkerForTest(() => w);
    const r = resume({ settings: { font: 'lato' } });

    const first = paintCard(r);
    while (w.sent.length < 1) await tick();
    w.answer({ id: w.sent[0].id, bytes: PDF, fallback: 'Lato', borrowed: false });
    const degraded = await first;
    assert.match(degraded.url, /^data:image\/jpeg/, 'the card shows it meanwhile');
    assert.equal(store.pictureFor(degraded.key), null, 'not kept for the session');
    store._forgetSavedForTest();
    assert.equal(store.savedPicture(r.id, degraded.hash), null, 'not kept for the next visit');

    // Back online: the next visit paints again, and that picture is kept.
    const second = paintCard(r);
    while (w.sent.length < 2) await tick();
    w.answer({ id: w.sent[1].id, bytes: PDF, fallback: null, borrowed: false });
    const whole = await second;
    assert.equal(store.pictureFor(whole.key), whole.url);
    store._forgetSavedForTest();
    assert.equal(store.savedPicture(r.id, whole.hash), whole.url, 'the whole picture is kept');
  });

  it('a face borrowing another\'s data is not kept either', async () => {
    await stubPainting();
    const w = scriptedWorker();
    build._setPdfWorkerForTest(() => w);
    const r = resume({ settings: { font: 'lato' } });
    const card = paintCard(r);
    while (w.sent.length < 1) await tick();
    w.answer({ id: w.sent[0].id, bytes: PDF, fallback: null, borrowed: true });
    const { hash } = await card;
    store._forgetSavedForTest();
    assert.equal(store.savedPicture(r.id, hash), null);
  });

  it('the worker\'s reply for a page picture carries its own build\'s fallback, not the editor\'s notice', async () => {
    offline();
    const reply = await jobs.runJob({ id: 7, kind: 'resume', resume: resume({ settings: { customFont: 'Testface Card' } }), options: { reportFont: false } });
    assert.equal(reply.error, undefined, reply.error);
    assert.equal(reply.fallback, 'Testface Card');
  });

  it('on the main thread: a font that cannot load, or a photo URL that cannot be fetched, leaves no saved picture', async () => {
    await stubPainting();
    offline();
    const font = resume({ settings: { customFont: 'Testface Offline' } });
    const a = await paintCard(font);
    assert.match(a.url, /^data:image\/jpeg/);
    store._forgetSavedForTest();
    assert.equal(store.savedPicture(font.id, a.hash), null, 'painted in Noto Sans: not kept');

    offline('photos.example.test'); // the fonts load: only the photo is missing
    const photo = resume({ personal: { name: 'Robin Vale', photo: 'https://photos.example.test/robin.jpg' } });
    const b = await paintCard(photo);
    assert.match(b.url, /^data:image\/jpeg/);
    store._forgetSavedForTest();
    assert.equal(store.savedPicture(photo.id, b.hash), null, 'painted without its photo: not kept');
  });
});
