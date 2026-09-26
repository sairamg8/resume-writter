// R4-LO-18: a photo stored as a URL whose fetch failed for a passing reason (offline) prints as none,
// and printableImage fetches it again on a later build (R4-PDF-03). But the preview built again on
// the browser's 'online' event only after a font fallback (R2-146), so the photo came back only on
// the next edit. Pinned: back online with such a photo waiting, the preview builds again at once;
// with nothing waiting, it still does not.
// Run: node --test tests/pdf/101-r4-lo-18-preview-photo-online.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './harness.mjs';
import { setupPreview, teardownPreview, opened, versions, settle } from './preview-stub.mjs';

const PHOTO = 'https://photos.example.test/r4-lo-18.jpg';
const realFetch = globalThis.fetch;

describe('the preview builds again when back online with a photo waiting to be fetched (R4-LO-18)', () => {
  before(setupPreview);
  // PdfPreview.jsx not loading (fail-first) must not leave the harness's servers up: that hung the run.
  after(() => { globalThis.fetch = realFetch; return teardownPreview(); });

  it('no font fallback, no photo waiting: no build; a photo that failed offline: one new build', async () => {
    const fonts = await loadModule('/src/utils/fontFallback.js');
    const images = await loadModule('/src/utils/printableImage.js');
    fonts.setFontFallback(null);
    const [v0] = versions(1);
    const { view, calls } = await opened(v0);
    try {
      view.act(() => view.window.dispatchEvent({ type: 'online' }));
      await settle();
      assert.equal(calls.length, 1, 'nothing was missing: no build');

      // The photo's fetch fails as it does offline: it prints as none for now.
      globalThis.fetch = async (url, opts) => {
        if (String(url) === PHOTO) throw new TypeError('Failed to fetch');
        return realFetch(url, opts);
      };
      assert.equal(await images.printableImage(PHOTO), null, 'no photo while the fetch fails');

      view.act(() => view.window.dispatchEvent({ type: 'online' }));
      await settle();
      assert.equal(calls.length, 2, 'built again, to fetch the photo');
      assert.equal(calls[1].input, v0);
    } finally {
      await view.unmount();
    }
  });
});
