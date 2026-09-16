// Unit tests for uploaded images (src/utils/imageUpload.js): what the PDF can draw from a saved
// data URL, and what an upload is stored as — against a stand-in for the browser's FileReader,
// createImageBitmap and canvas. The real browser runs them in cypress/e2e/24-image-uploads.cy.js.
// Run: yarn test:unit
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { drawableImage, isDrawableImage, readImageFile, UNREADABLE_IMAGE } from '../../src/utils/imageUpload.js';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';
const JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';
const WEBP_B64 = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const b64 = (text) => Buffer.from(text).toString('base64');
/** An AVIF's opening box ("ftyp", brand "avif"): all the stand-in browser reads of one. */
const AVIF_B64 = b64('\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1miaf');
/** An SVG as Illustrator writes one: XML declaration, generator comment, DOCTYPE, then the root. */
const SVG_TEXT = '﻿<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 27.0 -->\n'
  + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
  + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';

describe('drawableImage: what the PDF draws from a saved image', () => {
  test('a PNG, JPEG or SVG labelled as what it is comes back as it is', () => {
    for (const src of [`data:image/png;base64,${PNG_B64}`, `data:image/jpeg;base64,${JPEG_B64}`, `data:image/jpg;base64,${JPEG_B64}`,
      `data:image/svg+xml;base64,${b64(SVG_TEXT)}`, `data:image/PNG;base64,${PNG_B64}`]) {
      assert.equal(drawableImage(src), src, src.slice(0, 20));
      assert.equal(isDrawableImage(src), true, src.slice(0, 20));
    }
  });

  // The browser labels a file by its name: these were stored before uploads were sniffed (R7-3).
  test('a WebP or GIF is never drawable, whatever its label says', () => {
    for (const bytes of [WEBP_B64, GIF_B64]) {
      for (const label of ['webp', 'gif', 'png', 'jpeg', 'svg+xml']) {
        assert.equal(drawableImage(`data:image/${label};base64,${bytes}`), null, `${bytes.slice(0, 6)} as ${label}`);
        assert.equal(isDrawableImage(`data:image/${label};base64,${bytes}`), false, `${bytes.slice(0, 6)} as ${label}`);
      }
    }
  });

  test('a PNG, JPEG or SVG under another label is relabelled by its bytes', () => {
    assert.equal(drawableImage(`data:image/png;base64,${JPEG_B64}`), `data:image/jpeg;base64,${JPEG_B64}`);
    assert.equal(drawableImage(`data:image/jpeg;base64,${PNG_B64}`), `data:image/png;base64,${PNG_B64}`);
    assert.equal(drawableImage(`data:image/webp;base64,${PNG_B64}`), `data:image/png;base64,${PNG_B64}`);
    assert.equal(drawableImage(`data:image/png;base64,${b64(SVG_TEXT)}`), `data:image/svg+xml;base64,${b64(SVG_TEXT)}`);
  });

  // Each comment matches one way only: a comment pattern that could end at any later "-->" tried
  // every split of 40 empty comments (280 bytes) before failing, and froze the render (> 20 s).
  test('an opening of many comments with no SVG after them is refused at once', () => {
    const started = performance.now();
    assert.equal(drawableImage(`data:image/svg+xml;base64,${b64(`${'<!---->'.repeat(585)}x`)}`), null);
    assert.equal(drawableImage(`data:image/svg+xml;base64,${b64(`<!DOCTYPE svg${' '.repeat(4000)}x`)}`), null);
    assert.ok(performance.now() - started < 500, `${Math.round(performance.now() - started)} ms`);
    assert.equal(isDrawableImage(`data:image/svg+xml;base64,${b64('<!-- a -- b --><!----><svg/>')}`), true, 'a "--" inside a comment is fine');
  });

  test('not an image: null; a plain URL: as it is (react-pdf fetches it and reads its bytes)', () => {
    for (const src of [undefined, null, '', 42, {}, 'data:image/png;base64,', 'data:image/png,iVBORw0KGgo',
      `data:text/plain;base64,${PNG_B64}`, `data:image/svg+xml;base64,${b64('<html><svg></svg></html>')}`, 'data:image/png;base64,!!!!']) {
      assert.equal(drawableImage(src), null, String(src));
    }
    assert.equal(drawableImage('https://example.com/me.webp'), 'https://example.com/me.webp');
  });
});

// ── A stand-in for the browser ───────────────────────────────────────────────────────────────
// createImageBitmap "decodes" the size in a file's header (PNG IHDR, JPEG SOF; a WebP, GIF, AVIF
// or BMP is 1×1) and refuses anything else; a canvas records what it was asked to encode, and
// encodes `detail` bytes per pixel (a noisy photo ~1, a flat one far less).

/** What the stand-in sees in a file beyond its header: { detail, seeThrough }. */
const looks = new WeakMap();
function withLooks(file, { detail, seeThrough } = {}) {
  looks.set(file, { detail, seeThrough });
  return file;
}
/** A PNG header for a `width`×`height` image, padded to `bytes` bytes. */
function pngFile(width, height, { bytes = 64, name = 'me.png', type = 'image/png', ...look } = {}) {
  const buf = Buffer.alloc(Math.max(bytes, 33));
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(buf);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return withLooks(new File([buf], name, { type }), look);
}
/** The 2×2 JPEG with `width`×`height` in its SOF, padded to `bytes` bytes. */
function jpegFile(width, height, { bytes = 0, name = 'me.jpg', type = 'image/jpeg', ...look } = {}) {
  const buf = Buffer.from(JPEG_B64, 'base64');
  const sof = buf.indexOf(Buffer.from([0xff, 0xc0]));
  buf.writeUInt16BE(height, sof + 5);
  buf.writeUInt16BE(width, sof + 7);
  return withLooks(new File([buf, Buffer.alloc(Math.max(0, bytes - buf.length))], name, { type }), look);
}
const fileOf = (b64data, name, type) => new File([Buffer.from(b64data, 'base64')], name, { type });
/** Bytes a data URL holds. */
const bytesOf = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').length;

const encoded = [];
function installBrowser() {
  encoded.length = 0;
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
        this.onload();
      });
    }
  };
  globalThis.createImageBitmap = async (file) => {
    const bytes = Buffer.from(await file.arrayBuffer());
    const head = bytes.toString('latin1', 0, 12);
    const bitmap = (width, height) => ({ width, height, ...looks.get(file), close() {} });
    if (head.startsWith('\x89PNG')) return bitmap(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
    if (head.startsWith('\xff\xd8\xff')) {
      const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
      return bitmap(bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5));
    }
    if (head.startsWith('RIFF') || head.startsWith('GIF8') || head.startsWith('BM') || head.slice(4) === 'ftypavif') return bitmap(1, 1);
    throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
  };
  globalThis.document = {
    createElement: () => {
      let drawn = null;
      const ctx = {
        fillRect() {},
        drawImage(bitmap) { drawn = bitmap; },
        getImageData(x, y, w, h) {
          const data = new Uint8ClampedArray(w * h * 4).fill(255);
          if (drawn?.seeThrough) data[3] = 0;
          return { data };
        },
      };
      const canvas = {
        width: 300,
        height: 150,
        getContext: () => ctx,
        toDataURL(type) {
          const bytes = Math.max(64, Math.round(canvas.width * canvas.height * (drawn?.detail ?? 0.05)));
          encoded.push({ type, width: canvas.width, height: canvas.height, bytes });
          const magic = Buffer.from(type === 'image/png' ? PNG_B64 : JPEG_B64, 'base64').subarray(0, 8);
          return `data:${type};base64,${Buffer.concat([magic, Buffer.alloc(bytes - magic.length)]).toString('base64')}`;
        },
      };
      return canvas;
    },
  };
}

describe('readImageFile: what an upload is stored as', () => {
  beforeEach(installBrowser);

  test('a PNG named .jpg is stored as the PNG it is, byte for byte (R7-3)', async () => {
    const url = await readImageFile(fileOf(PNG_B64, 'me.jpg', 'image/jpeg'));
    assert.equal(url, `data:image/png;base64,${PNG_B64}`);
    assert.deepEqual(encoded, [], 'not re-encoded');
  });

  test('a JPEG named .png is stored as the JPEG it is (R7-3)', async () => {
    assert.equal(await readImageFile(fileOf(JPEG_B64, 'me.png', 'image/png'), { kind: 'icon' }), `data:image/jpeg;base64,${JPEG_B64}`);
  });

  test('a WebP named .jpg is converted: a photo to JPEG, an icon to PNG (R7-3)', async () => {
    assert.match(await readImageFile(fileOf(WEBP_B64, 'me.jpg', 'image/jpeg')), /^data:image\/jpeg;base64,\/9j\//);
    assert.match(await readImageFile(fileOf(WEBP_B64, 'mail.png', 'image/png'), { kind: 'icon' }), /^data:image\/png;base64,iVBORw0KGgo/);
    assert.deepEqual(encoded.map((e) => e.type), ['image/jpeg', 'image/png']);
  });

  test('an SVG is stored as an SVG, whatever its name says', async () => {
    const svg = new File([SVG_TEXT], 'mail.png', { type: 'image/png' });
    assert.equal(await readImageFile(svg, { kind: 'icon' }), `data:image/svg+xml;base64,${b64(SVG_TEXT)}`);
  });

  test('a file the browser cannot decode is refused, even when named like a PNG', async () => {
    await assert.rejects(readImageFile(new File(['not an image'], 'me.png', { type: 'image/png' })), { message: UNREADABLE_IMAGE });
    await assert.rejects(readImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' })), { message: UNREADABLE_IMAGE });
  });

  test('a small PNG is kept as it is (a guard: nothing to scale)', async () => {
    const file = pngFile(800, 600, { bytes: 5000 });
    assert.equal(await readImageFile(file), `data:image/png;base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`);
    assert.deepEqual(encoded, []);
  });
});

describe('readImageFile: every upload is scaled to what the PDF prints (R7-4)', () => {
  beforeEach(installBrowser);
  const sizes = () => encoded.map(({ type, width, height }) => `${type.slice(6)} ${width}×${height}`);

  test('a 3840×2160 camera JPEG is stored at 1024×576', async () => {
    const url = await readImageFile(jpegFile(3840, 2160, { bytes: 2_000_000 }));
    assert.match(url, /^data:image\/jpeg;base64,\/9j\//);
    assert.deepEqual(sizes(), ['jpeg 1024×576']);
  });

  test('a PNG photo over 1024 px: a JPEG when it is opaque, a PNG when it has see-through pixels', async () => {
    assert.match(await readImageFile(pngFile(2000, 1500)), /^data:image\/jpeg;/);
    assert.match(await readImageFile(pngFile(1500, 2000, { seeThrough: true })), /^data:image\/png;/);
    assert.deepEqual(sizes(), ['jpeg 1024×768', 'png 768×1024']);
  });

  // R7-6: a cut-out portrait saved as WebP, GIF or AVIF was stored as a JPEG on white, so it
  // printed a white disc on Modern's banner or the Sidebar panel, where the same cut-out as a PNG
  // showed the ground through it. The alpha check came in with R7-4's scaling (a4a1f85) and only
  // a PNG source covered it; this fails on 49bd696, the module before it, with a JPEG data URL.
  test('a WebP, GIF or AVIF photo with see-through pixels is stored as a PNG, an opaque one as a JPEG (R7-6)', async () => {
    for (const [bytes, type] of [[WEBP_B64, 'image/webp'], [GIF_B64, 'image/gif'], [AVIF_B64, 'image/avif']]) {
      const name = `me.${type.slice(6)}`;
      assert.match(await readImageFile(withLooks(fileOf(bytes, name, type), { seeThrough: true })), /^data:image\/png;base64,iVBORw0KGgo/, `${name}, cut out`);
      assert.match(await readImageFile(fileOf(bytes, name, type)), /^data:image\/jpeg;base64,\/9j\//, `${name}, opaque`);
    }
    assert.deepEqual(sizes(), ['png 1×1', 'jpeg 1×1', 'png 1×1', 'jpeg 1×1', 'png 1×1', 'jpeg 1×1']);
  });

  test('a photo within 1024 px but over 300 KB is re-encoded at its own size', async () => {
    const url = await readImageFile(jpegFile(800, 600, { bytes: 900_000 }));
    assert.deepEqual(sizes(), ['jpeg 800×600']);
    assert.ok(bytesOf(url) < 300_000, `${bytesOf(url)} bytes`);
  });

  test('a detailed photo is made a quarter smaller until it holds at most 300 KB', async () => {
    const url = await readImageFile(jpegFile(3000, 3000, { bytes: 5_000_000, detail: 1 }));
    assert.deepEqual(sizes(), ['jpeg 1024×1024', 'jpeg 768×768', 'jpeg 576×576', 'jpeg 432×432']);
    assert.equal(bytesOf(url), 432 * 432);
  });

  test('an icon over 256 px is stored as a 256 px PNG, a JPEG one too', async () => {
    assert.match(await readImageFile(pngFile(1000, 500), { kind: 'icon' }), /^data:image\/png;/);
    assert.match(await readImageFile(jpegFile(600, 600), { kind: 'icon' }), /^data:image\/png;/);
    assert.deepEqual(sizes(), ['png 256×128', 'png 256×256']);
  });

  test('an SVG photo over 300 KB is refused with a message; within it, it is kept', async () => {
    const svg = (bytes) => new File([SVG_TEXT.replace('<circle', `<!--${'x'.repeat(bytes - SVG_TEXT.length)}--><circle`)], 'me.svg', { type: 'image/svg+xml' });
    await assert.rejects(readImageFile(svg(310_000)), { message: /too large.*300 KB/ });
    assert.match(await readImageFile(svg(290_000)), /^data:image\/svg\+xml;base64,/);
  });

  test('a PNG or JPEG within the side and the bytes is kept byte for byte (a guard)', async () => {
    for (const file of [jpegFile(1024, 1024, { bytes: 290_000 }), pngFile(256, 256, { bytes: 390_000, name: 'icon.png' })]) {
      const url = await readImageFile(file, { kind: file.name === 'icon.png' ? 'icon' : 'photo' });
      assert.equal(bytesOf(url), file.size, file.name);
    }
    assert.deepEqual(encoded, []);
  });
});
