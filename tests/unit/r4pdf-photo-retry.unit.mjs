// R4-PDF-03: a photo stored as a URL (an imported JSON Resume's basics.image) whose fetch failed for a
// passing reason — offline, a timeout, a 503 or 429 — was remembered as unprintable for the session
// (src/utils/printableImage.js cached null), so it never printed again, even back online. Pinned: such
// a failure prints no photo for now (printableNow null, so the panel still says so) but the next build
// (printableImage, withPrintablePhotos) fetches it again and prints it once it arrives; a definitive
// failure — a 404, or a file that is not an image — is still fetched once a session.
// Node has no image decoder: createImageBitmap, the canvas and the FileReader are stand-ins, as in
// tests/pdf/80-photo-url; fetch is one too, answering each URL as the test sets it.
// Run: yarn test:unit
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { printableImage, printableNow, withPrintablePhotos } from '../../src/utils/printableImage.js';

const WEBP_BYTES = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
/** A 2×2 JPEG: what the stand-in's canvas encodes. */
const JPEG_2X2 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';

/** How the stand-in fetch answers each URL now: 'offline', 'timeout', 'image', 'page' or an HTTP status. */
const answer = {};
const fetched = [];
const times = (url) => fetched.filter((u) => u === url).length;

const saved = {};
before(() => {
  for (const k of ['createImageBitmap', 'document', 'FileReader', 'fetch']) saved[k] = globalThis[k];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    const how = answer[String(url)];
    if (how === 'offline') throw new TypeError('Failed to fetch');
    if (how === 'timeout') throw new DOMException('The operation timed out.', 'TimeoutError');
    if (how === 'image') return new Response(Buffer.from(WEBP_BYTES, 'base64'), { headers: { 'content-type': 'image/webp' } });
    if (how === 'page') return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    return new Response('No', { status: how, headers: { 'content-type': 'image/jpeg' } });
  };
  globalThis.createImageBitmap = async (blob) => {
    const head = Buffer.from(await blob.slice(0, 4).arrayBuffer()).toString('latin1');
    if (head !== 'RIFF') throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    return { width: 1, height: 1, close() {} };
  };
  const context = { getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) };
  const ctx = new Proxy(context, { get: (t, k) => (k in t ? t[k] : () => {}) });
  globalThis.document = { createElement: () => ({ width: 300, height: 150, getContext: () => ctx, toDataURL: () => JPEG_2X2 }) };
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => { this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`; this.onload(); });
    }
  };
});
after(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete globalThis[k];
    else globalThis[k] = v;
  }
});

describe('a photo URL that failed for a passing reason is fetched again (R4-PDF-03)', () => {
  it('timeout: none for now, not fetched again at once (a hanging host would hold every build), then after a minute', async () => {
    const url = 'https://img.example.com/slow.webp';
    answer[url] = 'timeout';
    assert.equal(await printableImage(url), null);
    answer[url] = 'image';
    assert.equal(await printableImage(url), null, 'the next build does not wait on it again');
    assert.equal(times(url), 1);
    const now = Date.now;
    Date.now = () => now() + 61_000;
    try {
      assert.equal(await printableImage(url), JPEG_2X2, 'a minute on, it is fetched again and prints');
    } finally { Date.now = now; }
    assert.equal(times(url), 2);
  });

  for (const reason of ['offline', 503, 429]) {
    it(`${reason}: none for now, then printed once the fetch succeeds`, async () => {
      const url = `https://img.example.com/${reason}.webp`;
      answer[url] = reason;
      assert.equal(await printableImage(url), null, 'no photo while it cannot be fetched');
      assert.equal(printableNow(url), null, 'the panel can say it is not printed');
      answer[url] = 'image';
      assert.equal(await printableImage(url), JPEG_2X2, 'the next build fetches it again and prints it');
      assert.equal(times(url), 2);
      assert.equal(printableNow(url), JPEG_2X2);
      assert.equal(await printableImage(url), JPEG_2X2);
      assert.equal(times(url), 2, 'and keeps the copy: not fetched a third time');
    });
  }

  it('a résumé built offline prints the photo in a build after reconnecting', async () => {
    const url = 'https://img.example.com/imported.webp';
    const r = { id: 'r1', personal: { name: 'A', photo: url }, settings: {} };
    answer[url] = 'offline';
    assert.equal((await withPrintablePhotos(r)).personal.photo, url, 'offline: the URL stays, PdfPhoto prints none');
    answer[url] = 'image';
    assert.equal((await withPrintablePhotos(r)).personal.photo, JPEG_2X2, 'back online: its copy prints');
  });
});

describe('a definitive failure is still fetched once a session (R4-PDF-03)', () => {
  for (const [what, how] of [['a 404', 404], ['a 403', 403], ['a file that is not an image', 'page']]) {
    it(`${what}: not fetched again`, async () => {
      const url = `https://img.example.com/final-${how}`;
      answer[url] = how;
      assert.equal(await printableImage(url), null);
      answer[url] = 'image';
      assert.equal(await printableImage(url), null);
      assert.equal(times(url), 1);
    });
  }
});
