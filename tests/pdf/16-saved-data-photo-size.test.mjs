// A photo saved at camera size stays that size (ONB-10): every build before a4a1f85 stored a PNG or
// JPEG upload whole — a 3840×2160 phone photo at 2 MB and more — and nothing made a saved one
// smaller. Uploads are scaled since (readImageFile), but a résumé saved before kept most of the
// browser's storage, a cloud document over 1 MiB (held back from the sync) and a photo every render
// embedded whole, until the user uploaded it again. The store now makes such a photo what an
// upload of it is, once, after it loads or takes a résumé in (src/utils/smallerPhotos.js).
// Here the real useAppStore is mounted with react-dom/client (tests/pdf/fake-dom.mjs), so its
// effects run, over a localStorage stand-in. Node has no image decoder: createImageBitmap reads a
// file's size from its header (PNG IHDR, JPEG SOF), and a canvas encodes a real flat PNG of its size,
// whatever type it is asked for — react-pdf draws it, so the pages below compare as printed.
// cypress/e2e/24-image-uploads.cy.js runs uploads in the real browser.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule, resume, render, TEMPLATES } from './harness.mjs';
import { painted, PNG_2X2 } from './extractors.mjs';
import { mount } from './fake-dom.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

const KEY = 'cpwtcv_v1';

// ── Images ──────────────────────────────────────────────────────────────────────────────────

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** A real PNG, `width`×`height` in one colour, with `padding` bytes in a private chunk every decoder skips. */
function png(width, height, { padding = 0, colour = [40, 90, 160] } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => colour).flat())]);
  const parts = [Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr)];
  if (padding) parts.push(chunk('prVt', Buffer.alloc(padding, 'x')));
  parts.push(chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))), chunk('IEND', Buffer.alloc(0)));
  return `data:image/png;base64,${Buffer.concat(parts).toString('base64')}`;
}

const JPEG_2X2 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAACAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AGn//2Q==';
/** A phone camera's JPEG as the stand-in sees one: `width`×`height` in its SOF, `bytes` long. */
function cameraJpeg(width, height, bytes, label = 'jpeg') {
  const buf = Buffer.from(JPEG_2X2, 'base64');
  const sof = buf.indexOf(Buffer.from([0xff, 0xc0]));
  buf.writeUInt16BE(height, sof + 5);
  buf.writeUInt16BE(width, sof + 7);
  return `data:image/${label};base64,${Buffer.concat([buf, Buffer.alloc(bytes - buf.length, 7)]).toString('base64')}`;
}

/** The size a PNG or JPEG data URL's header gives, as `W×H`. */
function sizeOf(url) {
  const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  if (bytes.toString('latin1', 1, 4) === 'PNG') return `${bytes.readUInt32BE(16)}×${bytes.readUInt32BE(20)}`;
  const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
  return `${bytes.readUInt16BE(sof + 7)}×${bytes.readUInt16BE(sof + 5)}`;
}
const bytesOf = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').length;

// ── The browser ─────────────────────────────────────────────────────────────────────────────

/** Each decode the stand-in was asked for: the size it found, or 'refused'. */
const decodes = [];

function installDecoder() {
  globalThis.createImageBitmap = async (blob) => {
    const bytes = Buffer.from(await blob.arrayBuffer());
    let size = null;
    if (bytes.toString('latin1', 1, 4) === 'PNG') size = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
      size = [bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)];
    }
    decodes.push(size ? size.join('×') : 'refused');
    if (!size) throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    return { width: size[0], height: size[1], close() {} };
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

/** The canvas readImageFile draws into: opaque pixels, encoded as a flat PNG of its size. */
function canvas() {
  const ctx = new Proxy({ getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) }, {
    get: (t, k) => (k in t ? t[k] : () => {}), // drawImage, fillRect …
  });
  const c = { width: 300, height: 150, getContext: () => ctx, toDataURL: () => png(c.width, c.height) };
  return c;
}

/** A localStorage stand-in over `entries`. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

before(async () => {
  await setup();
  installDecoder();
});
after(async () => {
  delete globalThis.createImageBitmap;
  delete globalThis.FileReader;
  await teardown();
});

/**
 * useAppStore mounted as the app mounts it (StrictMode) over a saved store of `resumes`: `store()`
 * → what it returned last, `saved()` → the résumés in localStorage now, `act`, `unmount`.
 */
async function openApp(resumes) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes, activeId: resumes[0]?.id ?? null, dataVersion: DATA_VERSION })]]);
  let current = null;
  function Probe() {
    current = useAppStore();
    return null;
  }
  const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
  // A copy is drawn well after this (readImageFile reads the file first): the page's canvas.
  const createElementWas = view.document.createElement.bind(view.document);
  view.document.createElement = (tag) => (tag === 'canvas' ? canvas() : createElementWas(tag));
  return {
    store: () => current,
    saved: () => JSON.parse(localStorage.getItem(KEY)).resumes,
    act: view.act,
    async unmount() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

/** Let the copies be made and the store save them: until `done()`, or `turns` turns have gone. */
async function until(done, turns = 400) {
  for (let i = 0; i < turns && !done(); i += 1) await new Promise((r) => { setImmediate(r); });
  // The store writes a change that follows another within a moment a short while later (R2-077).
  for (const deadline = Date.now() + 1500; !done() && Date.now() < deadline;) await new Promise((r) => { setTimeout(r, 10); });
  for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); // and anything after it
}

const saved = (id, extra = {}) => ({
  id, name: id, template: 'classic', dataVersion: DATA_VERSION, updatedAt: 1_700_000_000_000, settings: {}, sections: [],
  personal: { name: 'Sam Doe', photo: null }, coverLetter: { body: '<p>Hello</p>' }, ...extra,
});

describe('a photo saved at camera size is made the size an upload of it is now (ONB-10)', () => {
  it('the résumé\'s and the letter\'s: once, in storage, with the résumé otherwise as it was', async () => {
    const camera = cameraJpeg(3840, 2160, 2_000_000);
    const letter = png(1600, 900, { padding: 600_000 });
    const before = [
      saved('resume_a', { personal: { name: 'Sam Doe', photo: camera }, coverLetter: { body: '<p>Hi</p>', clPhoto: letter } }),
      saved('resume_b', { personal: { name: 'Copy', photo: camera } }), // a duplicate: the same photo
    ];
    const app = await openApp(before);
    try {
      const at = decodes.length;
      await until(() => app.saved().every((r) => r.personal.photo.length < 400_000 && (r.coverLetter.clPhoto ?? '').length < 400_000));
      const [a, b] = app.saved();
      assert.equal(sizeOf(a.personal.photo), '1024×576', `before: still the ${bytesOf(a.personal.photo)}-byte camera photo in storage`);
      assert.equal(sizeOf(a.coverLetter.clPhoto), '1024×576', 'the letter\'s own photo too');
      assert.equal(b.personal.photo, a.personal.photo, 'the duplicate takes the same copy');
      assert.ok(bytesOf(a.personal.photo) <= 300_000 && bytesOf(a.coverLetter.clPhoto) <= 300_000);
      assert.deepEqual(decodes.slice(at).toSorted(), ['1600×900', '3840×2160'], 'each photo decoded once');
      // Not an edit: the same résumés but for the photos, updatedAt included (no sync merge won by it).
      assert.deepEqual(a, { ...before[0], personal: { ...before[0].personal, photo: a.personal.photo }, coverLetter: { ...before[0].coverLetter, clPhoto: a.coverLetter.clPhoto } });
      assert.deepEqual(b, { ...before[1], personal: { ...before[1].personal, photo: a.personal.photo } });
      assert.deepEqual(app.store().appState.resumes.map((r) => r.personal.photo), [a.personal.photo, a.personal.photo], 'the preview prints the copy');
    } finally { await app.unmount(); }
  });

  it('left as they are: a photo an upload keeps, a plain URL, one this browser cannot decode, an SVG over the limit — and not tried again on every change', async () => {
    const broken = `data:image/webp;base64,${Buffer.alloc(700_000, 3).toString('base64')}`;
    const bigSvg = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><!--${'x'.repeat(500_000)}--></svg>`).toString('base64')}`;
    const kept = png(1024, 1024, { padding: 290_000 }); // within the side and the bytes: stored as it is
    const before = [
      saved('resume_a', { personal: { name: 'Sam', photo: broken }, coverLetter: { clPhoto: bigSvg } }),
      saved('resume_b', { personal: { name: 'Kim', photo: kept }, coverLetter: { clPhoto: PNG_2X2 } }),
      saved('resume_c', { personal: { name: 'Lee', photo: 'https://example.com/me.jpg' } }),
    ];
    const app = await openApp(before);
    try {
      const at = decodes.length;
      await until(() => decodes.length > at);
      assert.deepEqual(app.saved(), before);
      assert.deepEqual(decodes.slice(at), ['refused'], 'the WebP bytes no browser decodes; the SVG is refused unread, as an upload of it is');
      for (let i = 0; i < 3; i += 1) app.act(() => app.store().updatePersonal('name', `Sam ${i}`));
      await until(() => false, 40);
      assert.deepEqual(decodes.slice(at), ['refused'], 'a photo no copy can be made of is not decoded again');
      assert.equal(app.saved()[0].personal.photo, broken);
    } finally { await app.unmount(); }
  });

  it('an edit made while the copy is being made is kept; a photo uploaded meanwhile is not replaced', async () => {
    const camera = cameraJpeg(4000, 3000, 1_500_000);
    const other = cameraJpeg(3000, 4000, 1_200_000);
    const app = await openApp([saved('resume_a', { personal: { name: 'Sam', photo: camera }, coverLetter: { clPhoto: other } })]);
    try {
      app.act(() => app.store().updatePersonal('name', 'Sam Edited'));
      app.act(() => app.store().updateCoverLetter('clPhoto', PNG_2X2));
      const editedAt = app.store().appState.resumes[0].updatedAt;
      await until(() => decodes.includes('3000×4000') && app.saved()[0].personal.photo.length < 400_000);
      assert.ok(decodes.includes('3000×4000'), 'the letter\'s photo was being made smaller when it was replaced');
      const [a] = app.saved();
      assert.deepEqual([a.personal.name, sizeOf(a.personal.photo), a.coverLetter.clPhoto, a.updatedAt], ['Sam Edited', '1024×768', PNG_2X2, editedAt]);
    } finally { await app.unmount(); }
  });

  it('a résumé imported from a file saved with a camera-size photo is made smaller too', async () => {
    const app = await openApp([]);
    try {
      const file = saved('resume_file', { personal: { name: 'From a file', photo: cameraJpeg(2000, 2000, 900_000, 'jpg') } });
      app.act(() => app.store().importResume(file));
      await until(() => app.saved()[0]?.personal.photo.length < 400_000);
      assert.equal(sizeOf(app.saved()[0].personal.photo), '1024×1024');
    } finally { await app.unmount(); }
  });
});

describe('the smaller copy prints where the photo did (a guard)', () => {
  // The copy keeps the photo's proportions, and the photo box comes from Design, not the image.
  const photo = png(1600, 900, { padding: 450_000 });
  let copy;
  before(async () => {
    const app = await openApp([saved('resume_p', { personal: { name: 'Sam', photo } })]);
    try {
      await until(() => app.saved()[0].personal.photo !== photo);
      copy = app.saved()[0].personal.photo;
    } finally { await app.unmount(); }
  });

  for (const t of TEMPLATES) {
    it(`${t}: the page paints the same image box and clips`, async () => {
      assert.equal(sizeOf(copy), '1024×576');
      const boxes = async (src) => (await painted(await render(resume({ template: t, personal: { photo: src } }))))
        .filter((p) => p.paint === 'image' || p.paint === 'clip');
      const was = await boxes(photo);
      assert.ok(was.some((p) => p.paint === 'image'), 'the photo prints');
      assert.deepEqual(await boxes(copy), was);
    });
  }
});
