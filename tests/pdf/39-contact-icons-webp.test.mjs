// A contact icon uploaded before c7b1aa6 (WebP/GIF) prints as a converted copy (ONB-11).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, loadModule } from './harness.mjs';
import { PNG_2X2 } from './extractors.mjs';

let pdfjs;

const WEBP_BYTES = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
const WEBP = `data:image/webp;base64,${WEBP_BYTES}`;
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const BROKEN = `data:image/webp;base64,${Buffer.from('not an image at all').toString('base64')}`;
const JPEG_2X2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';

const PERSONAL = {
  email: 'me@example.com', phone: '+1 555 0100', location: 'Berlin',
  website: 'example.com', linkedin: 'linkedin.com/in/me', github: 'github.com/me',
};

const decodes = [];

function installBrowser() {
  decodes.length = 0;
  globalThis.createImageBitmap = async (blob) => {
    decodes.push(blob.type);
    const head = Buffer.from(await blob.slice(0, 4).arrayBuffer()).toString('latin1');
    if (head !== 'RIFF' && head !== 'GIF8') throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    return { width: 1, height: 1, close() {} };
  };
  const context = { getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) };
  const ctx = new Proxy(context, { get: (t, k) => (k in t ? t[k] : () => {}) });
  globalThis.document = {
    createElement: () => ({
      width: 300,
      height: 150,
      getContext: () => ctx,
      toDataURL: (type) => (type === 'image/png' ? PNG_2X2 : JPEG_2X2),
    }),
  };
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
        this.onload();
      });
    }
  };
}

before(async () => {
  ({ pdfjs } = await setup());
  installBrowser();
});

after(async () => {
  delete globalThis.createImageBitmap;
  delete globalThis.document;
  delete globalThis.FileReader;
  await teardown();
});

/** How many images page 1 paints. */
async function images(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const O = pdfjs.OPS;
  return ops.fnArray.filter((fn) => fn === O.paintImageXObject || fn === O.paintInlineImageXObject).length;
}

/** The contact icons on page 1, in drawing order. */
async function icons(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const O = pdfjs.OPS;
  const out = [];
  ops.fnArray.forEach((fn, k) => {
    const a = ops.argsArray[k];
    if (fn === O.transform && a[0] === a[3] && a[0] > 0 && a[0] < 1 && !a[1] && !a[2] && !a[4] && !a[5]) {
      out.push(k);
    }
  });
  return out;
}

describe('ONB-11: a contact icon uploaded before c7b1aa6 (WebP/GIF) prints as a converted copy', () => {
  it('Classic: a WebP email icon prints as an image (paintImageXObject) alongside a PNG phone icon', async () => {
    const settings = { iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: WEBP, phone: PNG_2X2 } };
    const r = resume({ template: 'classic', settings, personal: PERSONAL });
    const saved = JSON.stringify(r);
    const bytes = await render(r);

    // Both email (converted from WebP) and phone (PNG) are drawn as images
    assert.equal(await images(bytes), 2, 'both the WebP email icon and PNG phone icon are drawn as images');
    const drawnIcons = await icons(bytes);
    assert.equal(drawnIcons.length, 4, 'the other 4 fields keep their pack vector icons');

    // Stored resume remains untouched
    assert.equal(JSON.stringify(r), saved, 'stored data is not mutated');
  });

  it('Cover letter: a WebP email icon prints as an image on cover letter', async () => {
    const settings = { iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: WEBP } };
    const r = resume({ template: 'classic', settings, personal: PERSONAL, coverLetter: { headerStyle: 'icon' } });
    const bytes = await renderCover(r);
    assert.equal(await images(bytes), 1, 'the WebP email icon is drawn as an image on cover letter');
  });

  it('Guard: an unprintable/broken icon falls back to the pack icon rather than crashing or printing nothing', async () => {
    const settings = { iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: BROKEN, phone: PNG_2X2 } };
    const bytes = await render(resume({ template: 'classic', settings, personal: PERSONAL }));
    assert.equal(await images(bytes), 1, 'only the PNG phone icon is drawn as an image');
    const drawnIcons = await icons(bytes);
    assert.equal(drawnIcons.length, 5, 'email falls back to pack vector icon');
  });
});

describe('printableImage with kind: icon', () => {
  it('converts WebP/GIF to PNG data URL', async () => {
    const { printableImage } = await loadModule('/src/utils/printableImage.js');
    const converted = await printableImage(WEBP, { kind: 'icon' });
    assert.equal(converted, PNG_2X2, 'converted icon is PNG');
    const convertedGif = await printableImage(GIF, { kind: 'icon' });
    assert.equal(convertedGif, PNG_2X2, 'converted GIF icon is PNG');
    const brokenResult = await printableImage(BROKEN, { kind: 'icon' });
    assert.equal(brokenResult, null, 'broken icon returns null');
  });
});

describe('editor warns when a custom contact icon cannot be printed', () => {
  it('renders unprintable warning for undecodable icon in editor', async () => {
    const { printableImage } = await loadModule('/src/utils/printableImage.js');
    await printableImage(BROKEN, { kind: 'icon' });

    const { EditorResumeTab } = await loadModule('/src/components/EditorResumeTab.jsx');
    const noop = () => {};
    const r = resume({
      template: 'classic',
      settings: { iconSet: 'lucide', contactStyle: 'icon', customContactIcons: { email: BROKEN } },
      personal: PERSONAL,
    });
    const html = renderToString(createElement(EditorResumeTab, {
      resume: r, store: new Proxy({}, { get: () => noop }), personalOpen: true, setPersonalOpen: noop,
      allExpanded: false, forceOpenKey: 0, toggleAllSections: noop, addSectionOpen: false, setAddSectionOpen: noop,
    }));
    assert.match(html, /This icon can(?:&#x27;|')t be printed; upload a PNG or JPEG/);
  });
});
