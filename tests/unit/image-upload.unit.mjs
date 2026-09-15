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

  test('not an image: null; a plain URL: as it is (react-pdf fetches it and reads its bytes)', () => {
    for (const src of [undefined, null, '', 42, {}, 'data:image/png;base64,', 'data:image/png,iVBORw0KGgo',
      `data:text/plain;base64,${PNG_B64}`, `data:image/svg+xml;base64,${b64('<html><svg></svg></html>')}`, 'data:image/png;base64,!!!!']) {
      assert.equal(drawableImage(src), null, String(src));
    }
    assert.equal(drawableImage('https://example.com/me.webp'), 'https://example.com/me.webp');
  });
});

// ── A stand-in for the browser ───────────────────────────────────────────────────────────────
// createImageBitmap "decodes" the sizes in a file's header (PNG IHDR, JPEG SOF, a 1×1 WebP or
// GIF) and refuses anything else; a canvas records what it was asked to encode.

/** A PNG header for a `width`×`height` image, padded to `bytes` bytes. */
function pngFile(width, height, { bytes = 64, name = 'me.png', type = 'image/png' } = {}) {
  const buf = Buffer.alloc(Math.max(bytes, 33));
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(buf);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return new File([buf], name, { type });
}
const fileOf = (b64data, name, type) => new File([Buffer.from(b64data, 'base64')], name, { type });

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
    if (head.startsWith('\x89PNG')) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), close() {} };
    if (head.startsWith('\xff\xd8\xff')) {
      const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
      return { width: bytes.readUInt16BE(sof + 7), height: bytes.readUInt16BE(sof + 5), close() {} };
    }
    if (head.startsWith('RIFF') || head.startsWith('GIF8')) return { width: 1, height: 1, close() {} };
    throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
  };
  globalThis.document = {
    createElement: () => {
      const canvas = {
        width: 300,
        height: 150,
        getContext: () => ({ fillRect() {}, drawImage() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) }),
        toDataURL(type) {
          encoded.push({ type, width: canvas.width, height: canvas.height });
          return `data:${type};base64,${type === 'image/png' ? PNG_B64 : JPEG_B64}`;
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
