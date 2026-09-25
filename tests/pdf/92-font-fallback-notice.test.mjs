// R2-146: the offline font fallback is no longer silent. A chosen web font that cannot be loaded —
// its metadata unreachable, or none of its faces — prints in Noto Sans, and resolvePdfFonts (the
// preview's and Export PDF's one font step) says so: `fallback` names the font and fontFallback.js
// holds it for the editor. The next build that loads the font clears it, even after react-pdf kept a
// failed face load — and its own subsets load again with it; only the latest build sets it, so a slow
// build for a font since changed cannot name it. The preview pane shows the notice naming the font ("… until you are back online"
// while offline) and drops it when it clears; the preview builds again when the browser is back online.
// Fonts come from a stand-in fetch (a fictional "Testface" family, drawn with the bundled Noto Sans).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';
import { setupPreview, teardownPreview, opened, versions, settle } from './preview-stub.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = readFileSync(path.join(ROOT, 'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
const realFetch = globalThis.fetch;

/**
 * The CDN as the network answers it: `meta` / `faces` false throw as offline does; any other font on
 * it is offline. The harness's own server (the bundled Noto Sans) answers as ever.
 */
function network({ meta = true, faces = true, subsets = ['latin'], gate = null } = {}) {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const offline = () => { throw new TypeError('fetch failed'); };
    const pkg = u.match(/@fontsource\/([^@/]+)@/)?.[1];
    if (u.endsWith('/metadata.json')) {
      // `gate`: a slow CDN — this package's metadata answers (offline) only once the gate opens.
      if (gate && pkg === gate.pkg) { await gate.open; return offline(); }
      if (!meta || !pkg?.startsWith('testface')) return offline();
      const family = pkg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return new Response(JSON.stringify({ family, weights: [400], styles: ['normal'], subsets }), { status: 200 });
    }
    if (u.endsWith('.woff') && pkg?.startsWith('testface')) {
      if (!faces) return offline();
      return new Response(NOTO, { status: 200 });
    }
    return offline();
  };
}

const primaryOf = (fontFamily) => (Array.isArray(fontFamily) ? fontFamily[0] : fontFamily);

describe('resolvePdfFonts names a font it could not load, and clears it once loaded (R2-146)', () => {
  let loader;
  let store;
  before(async () => {
    await setup();
    // A module that does not load (fail-first, without the fix) fails the tests rather than this hook:
    // a failed hook skipped `after`, left the harness's servers up, and the run hung instead of failing.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
    store = await loadModule('/src/utils/fontFallback.js').catch(() => null);
  });
  afterEach(() => { globalThis.fetch = realFetch; });
  after(teardown);

  it('offline, a custom font prints in Noto Sans and is named; back online it prints in itself and the name clears', async () => {
    network({ meta: false });
    const settings = { customFont: 'Testface Serif' };
    const off = await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(primaryOf(off.fontFamily), 'NotoSans');
    assert.equal(off.fallback, 'Testface Serif');
    assert.equal(store.fontFallback(), 'Testface Serif', 'the editor learns of it');

    network();
    const on = await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(primaryOf(on.fontFamily), 'Testface Serif');
    assert.equal(on.fallback, null);
    assert.equal(store.fontFallback(), null, 'the notice clears');
  });

  it('a font whose faces all failed once loads on a later build (react-pdf keeps a failed load)', async () => {
    network({ faces: false });
    const settings = { customFont: 'Testface Sans' };
    const off = await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(primaryOf(off.fontFamily), 'NotoSans');
    assert.equal(store.fontFallback(), 'Testface Sans');

    network();
    const on = await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(primaryOf(on.fontFamily), 'Testface Sans', 'the faces are fetched again');
    assert.equal(store.fontFallback(), null);
  });

  it('back online, the font\'s own subsets load again too: a name\'s "ł" prints in its latin-ext, not Noto Sans\'s', async () => {
    network({ faces: false, subsets: ['latin', 'latin-ext'] });
    const settings = { customFont: 'Testface Mono' };
    const off = await loader.resolvePdfFonts(settings, 'Paweł Example');
    assert.equal(primaryOf(off.fontFamily), 'NotoSans');

    network({ subsets: ['latin', 'latin-ext'] });
    const on = await loader.resolvePdfFonts(settings, 'Paweł Example');
    assert.equal(primaryOf(on.fontFamily), 'Testface Mono');
    assert.ok([on.fontFamily].flat().includes('Testface Mono latin-ext'), `its latin-ext is fetched again: ${JSON.stringify(on.fontFamily)}`);
  });

  it('a slow build for a font since changed does not name it after a later build printed the new one', async () => {
    let open;
    const gate = { pkg: 'testface-slow', open: new Promise((resolve) => { open = resolve; }) };
    network({ gate });
    const slow = loader.resolvePdfFonts({ customFont: 'Testface Slow' }, 'Pat Example');
    try {
      const now = await loader.resolvePdfFonts({ font: 'notosans' }, 'Pat Example');
      assert.equal(now.fallback, null);
    } finally { open(); }
    assert.equal((await slow).fallback, 'Testface Slow', 'that build itself printed in Noto Sans');
    assert.equal(store.fontFallback(), null, 'the editor shows what the latest build printed');
  });

  it('a picker font is named by its label; Noto Sans, bundled, is never a fallback', async () => {
    network({ meta: false });
    const georgia = await loader.resolvePdfFonts({ font: 'georgia' }, 'Pat Example');
    assert.equal(georgia.fallback, 'Georgia', 'the label the picker shows, not Gelasio');
    assert.equal(store.fontFallback(), 'Georgia');
    const noto = await loader.resolvePdfFonts({ font: 'notosans' }, 'Pat Example');
    assert.equal(noto.fallback, null);
    assert.equal(store.fontFallback(), null, 'switching to Noto Sans clears it');
  });
});

describe('the preview pane shows the notice while the fallback holds (R2-146)', () => {
  before(setup);
  after(teardown);

  it('names the font, says "until you are back online" offline, and goes when it clears', async () => {
    const { FontFallbackNotice } = await loadModule('/src/components/FontFallbackNotice.jsx');
    const store = await loadModule('/src/utils/fontFallback.js');
    store.setFontFallback(null);
    const view = mount(FontFallbackNotice, {});
    const notice = () => [...elements(view.container)].find((el) => el.hasAttribute('data-font-fallback'));
    try {
      assert.equal(notice(), undefined, 'nothing while the chosen font prints');
      view.window.navigator.onLine = false;
      view.act(() => store.setFontFallback('Lora'));
      assert.equal(notice()?.textContent, 'Lora could not be loaded — the PDF uses Noto Sans until you are back online.');
      view.act(() => store.setFontFallback(null));
      assert.equal(notice(), undefined, 'cleared once the font loads');
    } finally { await view.unmount(); }
  });

  it('EditorPreviewPane holds the notice', () => {
    const src = readFileSync(path.join(ROOT, 'src/components/EditorPreviewPane.jsx'), 'utf8');
    assert.match(src, /<FontFallbackNotice \/>/);
  });
});

describe('the preview builds again when the browser is back online (R2-146)', () => {
  before(setupPreview);
  // PdfPreview.jsx not loading (fail-first) must not leave the harness's servers up: that hung the run.
  after(() => teardownPreview().catch(() => teardown()));

  it('back online with a font fallback: one new build at once; with none: no build', async () => {
    const store = await loadModule('/src/utils/fontFallback.js');
    const [v0] = versions(1);
    store.setFontFallback(null);
    const { view, calls } = await opened(v0);
    try {
      view.act(() => view.window.dispatchEvent({ type: 'online' }));
      await settle();
      assert.equal(calls.length, 1, 'nothing was missing: no build');
      store.setFontFallback('Lora');
      view.act(() => view.window.dispatchEvent({ type: 'online' }));
      await settle();
      assert.equal(calls.length, 2, 'built again, to load the font');
      assert.equal(calls[1].input, v0);
    } finally {
      store.setFontFallback(null);
      await view.unmount();
    }
  });
});
