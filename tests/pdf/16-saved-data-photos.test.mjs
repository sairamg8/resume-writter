// A photo saved before uploads were converted (c7b1aa6) — a WebP or GIF — showed in the editor but
// printed nothing, and a letter's own such photo hid the résumé's (R7-7). The preview and the PDF
// now print a copy of it, converted as an upload is (src/utils/printableImage.js), and the saved
// résumé is left as it is. Node has no image decoder: here the browser's createImageBitmap and
// canvas are a stand-in, as in tests/unit/image-upload.unit.mjs, whose canvas encodes a real 2×2
// JPEG for react-pdf to draw. cypress/e2e/24-image-uploads.cy.js runs it in the real browser.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, TEMPLATES, loadModule } from './harness.mjs';
import { drawing, PNG_2X2 } from './extractors.mjs';

const WEBP_BYTES = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
const WEBP = `data:image/webp;base64,${WEBP_BYTES}`;
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
/** Bytes no browser decodes, under a WebP label: a photo no copy can be made of. */
const BROKEN = `data:image/webp;base64,${Buffer.from('not an image at all').toString('base64')}`;
/** A 2×2 JPEG: what the stand-in's canvas encodes, and what an upload of the WebP would store. */
const JPEG_2X2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';
/** A 1×1 PNG résumé photo: pdf.js reports each image's size, so it is told apart from the letter's own. */
const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Each decode the stand-in was asked for: the Blob's type. */
const decodes = [];

/**
 * The browser, as far as readImageFile uses it: createImageBitmap decodes a WebP or GIF (anything
 * else fails, as a broken file does); a canvas encodes whatever was drawn as a real 2×2 JPEG (PNG
 * when asked) and reads back opaque pixels; a FileReader reads a Blob as a data URL.
 */
function installBrowser() {
  globalThis.createImageBitmap = async (blob) => {
    decodes.push(blob.type);
    const head = Buffer.from(await blob.slice(0, 4).arrayBuffer()).toString('latin1');
    if (head !== 'RIFF' && head !== 'GIF8') throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    return { width: 1, height: 1, close() {} };
  };
  const context = { getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) };
  const ctx = new Proxy(context, { get: (t, k) => (k in t ? t[k] : () => {}) }); // drawImage, fillRect …
  globalThis.document = {
    createElement: () => ({ width: 300, height: 150, getContext: () => ctx, toDataURL: (type) => (type === 'image/png' ? PNG_2X2 : JPEG_2X2) }),
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
  await setup();
  installBrowser();
});
after(async () => {
  delete globalThis.createImageBitmap;
  delete globalThis.document;
  delete globalThis.FileReader;
  await teardown();
});

describe('a photo saved as WebP or GIF, before uploads were converted, prints (R7-7)', () => {
  // Pages are compared as drawn (drawing): equal strings print the same page.
  for (const t of TEMPLATES) {
    it(`${t}: prints the photo as an upload of it is stored, and the saved résumé keeps what it holds`, async () => {
      const asUploaded = await drawing(await render(resume({ template: t, personal: { photo: JPEG_2X2 } })));
      assert.ok(asUploaded !== await drawing(await render(resume({ template: t }))), 'the JPEG prints');
      for (const photo of [WEBP, GIF, `data:image/jpeg;base64,${WEBP_BYTES}`]) {
        const r = resume({ template: t, personal: { photo } });
        const saved = JSON.stringify(r);
        assert.ok(await drawing(await render(r)) === asUploaded, `${photo.slice(0, 22)}: the page an upload of it prints`);
        assert.equal(JSON.stringify(r), saved, `${photo.slice(0, 22)}: the résumé is not changed`);
      }
    });
  }

  for (const t of TEMPLATES) {
    it(`${t} letter: its own WebP photo prints; one no copy can be made of gives way to the résumé photo`, async () => {
      const letter = async (clPhoto, photo) => drawing(await renderCover(resume({ template: t, personal: { photo }, coverLetter: { clPhoto, body: '<p>Hello</p>' } })));
      const own = await letter(JPEG_2X2, PNG_1X1);
      const resumePhoto = await letter(null, PNG_1X1);
      assert.ok(own !== resumePhoto, 'the two photos are told apart');
      assert.ok(await letter(WEBP, PNG_1X1) === own, 'its own WebP photo, as an upload of it is stored');
      assert.ok(await letter(BROKEN, PNG_1X1) === resumePhoto, 'an own photo no copy can be made of: the résumé photo');
      assert.ok(await letter(BROKEN, WEBP) === own, 'and a résumé photo saved as WebP prints too');
      assert.ok(await letter(BROKEN, BROKEN) === await letter(null, null), 'neither prints: no photo, no room kept');
    });
  }
});

describe('printableImage: the copy the PDF prints (R7-7)', () => {
  const printable = () => loadModule('/src/utils/printableImage.js');

  // A plain URL is fetched for a copy now (R2-093): tests/pdf/80-photo-url.test.mjs.
  it('a PNG, JPEG or SVG prints as it is; no image prints nothing — nothing is decoded for them', async () => {
    const { printableNow, printableImage } = await printable();
    const before = decodes.length;
    for (const src of [PNG_2X2, JPEG_2X2]) {
      assert.equal(printableNow(src), src);
      assert.equal(await printableImage(src), src);
    }
    for (const src of [undefined, null, '', 42, {}, `data:text/plain;base64,${WEBP_BYTES}`, 'data:image/webp;base64,!!!']) {
      assert.equal(await printableImage(src), null, String(src).slice(0, 30));
    }
    assert.equal(decodes.length, before);
  });

  it('a copy is made once a session, by the first preview or panel that asks: the others share it', async () => {
    const { printableNow, printableImage, onPrintableChange } = await printable();
    const gif = `data:image/png;base64,${GIF.split(',')[1]}`; // a GIF named .png: no other test asks for it
    let told = 0;
    const stop = onPrintableChange(() => { told += 1; });
    assert.equal(printableNow(gif), undefined, 'not known before it is asked for');
    const before = decodes.length;
    const [a, b] = await Promise.all([printableImage(gif), printableImage(gif)]);
    await render(resume({ personal: { photo: gif } }));
    stop();
    assert.equal(a, JPEG_2X2);
    assert.equal(b, JPEG_2X2);
    assert.equal(printableNow(gif), JPEG_2X2);
    assert.equal(decodes.length - before, 1, 'decoded once');
    assert.equal(told, 1, 'the panels are told once');
  });

  it('one no copy can be made of prints nothing, and is not decoded again', async () => {
    const { printableNow, printableImage } = await printable();
    const broken = BROKEN.replace('image/webp', 'image/gif'); // no other test asks for it
    const before = decodes.length;
    assert.equal(await printableImage(broken), null);
    assert.equal(await printableImage(broken), null);
    assert.equal(printableNow(broken), null);
    assert.equal(decodes.length - before, 1);
  });

  it('an SVG saved as text (not base64) prints as the base64 SVG an upload of it is', async () => {
    const { printableImage } = await printable();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2"/></svg>';
    assert.equal(await printableImage(`data:image/svg+xml,${encodeURIComponent(svg)}`), `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  });

  it('withPrintablePhotos: the same résumé when nothing needs a copy; otherwise a new one, the saved one untouched', async () => {
    const { withPrintablePhotos } = await printable();
    const plain = resume({ personal: { photo: PNG_2X2 }, coverLetter: { clPhoto: JPEG_2X2 } });
    assert.equal(await withPrintablePhotos(plain), plain);
    const old = resume({ personal: { photo: WEBP }, coverLetter: { clPhoto: BROKEN } });
    const saved = JSON.stringify(old);
    const printed = await withPrintablePhotos(old);
    assert.equal(printed.personal.photo, JPEG_2X2);
    assert.equal(printed.coverLetter.clPhoto, BROKEN, 'no copy: kept, for the letter to pass over');
    assert.equal(JSON.stringify(old), saved);
  });
});

/** The entities React writes out, back as the characters the user reads. */
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'" };

/** A panel's text, as rendered with `props` (tags and React's text separators dropped). */
async function panelText(file, name, props) {
  const mod = await loadModule(file);
  const html = renderToString(createElement(name ? mod[name] : mod.default, props));
  return html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#x27);/g, (e) => ENTITIES[e]).replace(/\s+/g, ' ').trim();
}
const noop = () => {};
/** The Photo panel, opened, for a saved `photo`. */
const photoPanel = (photo) => panelText('/src/components/PersonalInfoEditorPhoto.jsx', 'PhotoSection', {
  personal: { photo }, updatePersonal: noop, toggleFieldVisibility: noop, hidden: new Set(),
  s: {}, set: noop, template: 'classic', open: true, onToggle: noop,
});
/** The Cover Letter panel for a letter photo `clPhoto` beside the résumé's `photo`. */
const letterPanel = (clPhoto, photo) => panelText('/src/components/CoverLetterPanel.jsx', null, {
  coverLetter: { clPhoto }, personal: { photo }, settings: {}, template: 'classic', updateCoverLetter: noop,
});

describe('the panels say what the PDF prints for a saved photo (R7-7)', () => {
  // The copies the preview has made are what the panels read (usePrintableImage), so they are made
  // here as a render makes them; the panels start the rest in the browser, through useEffect.
  before(async () => {
    const { printableImage } = await loadModule('/src/utils/printableImage.js');
    await Promise.all([WEBP, GIF, BROKEN].map(printableImage));
  });

  // A guard (it passed before too): the panel must not start warning about a photo that prints.
  it('a WebP photo, which prints as a copy, is "Added" as any photo is', async () => {
    const out = await photoPanel(WEBP);
    assert.match(out, /Added/);
    assert.doesNotMatch(out, /Not printed|can't be printed/);
  });

  it('one no copy can be made of: "Not printed", and the line saying to upload it again', async () => {
    const out = await photoPanel(BROKEN);
    assert.match(out, /Not printed/);
    assert.match(out, /can't be printed\. Upload it again as a PNG or JPEG\./);
    assert.doesNotMatch(out, /Added/);
  });

  it('the letter names the photo it prints: its own, the résumé’s in place of one that cannot print, or none', async () => {
    assert.match(await letterPanel(GIF, null), /Using own photo/);
    assert.match(await letterPanel(null, WEBP), /Using resume photo/);
    assert.match(await letterPanel(BROKEN, WEBP), /can't be printed, so the letter uses your résumé photo/);
    assert.match(await letterPanel(BROKEN, null), /can't be printed\. Upload it again/);
    assert.match(await letterPanel(null, null), /No photo/);
  });
});
