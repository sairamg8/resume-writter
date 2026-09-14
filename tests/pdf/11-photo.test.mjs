// The profile photo's ring, checked on the page as pdf.js paints it (FIDA-43).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, render, renderCover } from './harness.mjs';

before(setup);
after(teardown);

const SCALE = 4; // px per pt: the 1.125 pt ring is ~4.5 px wide
const PHOTO_RGB = [22, 163, 74];
const ACCENT = '#e11d48';

/** pdf.js paints through @napi-rs/canvas in Node; without it these tests skip. */
let canvasLib = null;
try { canvasLib = await import('@napi-rs/canvas'); } catch { /* skipped below */ }

/** A 64×64 photo of one flat colour, as the editor stores an upload (a data URL). */
function photo() {
  const c = canvasLib.createCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${PHOTO_RGB.join(',')})`;
  ctx.fillRect(0, 0, 64, 64);
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

/** The top 40 % of page 1, painted: { w, h, data } (RGBA bytes). */
async function paintTop(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: SCALE });
  const w = Math.ceil(viewport.width);
  const h = Math.ceil(viewport.height * 0.4);
  const { canvas, context } = doc.canvasFactory.create(w, h);
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  const { data } = context.getImageData(0, 0, w, h);
  await doc.loadingTask.destroy();
  return { w, h, data };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Distance of the pixel at (x, y) from colour `c`. */
const distAt = ({ w, data }, x, y, c) => {
  const i = (y * w + x) * 4;
  return Math.hypot(data[i] - c[0], data[i + 1] - c[1], data[i + 2] - c[2]);
};

/**
 * The colours just outside the photo, on the middle of each side: for each side, the painted
 * pixel (1 to 6 px out) closest to `expected`, and its distance from it.
 */
function ringAround(page, expected) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  for (let y = 0; y < page.h; y += 1) {
    for (let x = 0; x < page.w; x += 1) {
      if (distAt(page, x, y, PHOTO_RGB) < 30) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  assert.ok(x1 > x0 + 50, 'the photo is painted');
  const cx = Math.round((x0 + x1) / 2);
  const cy = Math.round((y0 + y1) / 2);
  const sides = { left: [x0, cy, -1, 0], right: [x1, cy, 1, 0], top: [cx, y0, 0, -1], bottom: [cx, y1, 0, 1] };
  const want = rgb(expected);
  return Object.fromEntries(Object.entries(sides).map(([side, [x, y, dx, dy]]) => {
    const seen = [1, 2, 3, 4, 5, 6].map((k) => distAt(page, x + dx * k, y + dy * k, want));
    return [side, Math.round(Math.min(...seen))];
  }));
}

const CASES = [
  // [template, settings, the ring's colour on the page]
  ['classic', { photoShape: 'circle' }, ACCENT],
  ['classic', { photoShape: 'rounded' }, ACCENT],
  ['classic', { photoShape: 'square' }, ACCENT],
  ['executive', {}, ACCENT],
  ['minimal', {}, ACCENT],
  ['classic', { photoBorder: 'thin' }, '#e5e7eb'],
  ['modern', {}, '#ffffff'], // the accent option is white on the accent banner
  ['modern', { photoBorder: 'thin' }, '#f08ea4'], // 50 % white over #e11d48, opaque
  ['sidebar', { photoBorder: 'thin' }, '#565f6c'], // 25 % white over #1e293b, opaque
  ['sidebar', {}, ACCENT],
  ['cover letter', { photoShape: 'rounded' }, ACCENT],
];

describe('photo ring', { skip: canvasLib ? false : '@napi-rs/canvas is not installed' }, () => {
  for (const [template, settings, expected] of CASES) {
    it(`${template} ${JSON.stringify(settings)}: the ring shows in ${expected} on every side (FIDA-43)`, async () => {
      const cover = template === 'cover letter';
      const r = resume({
        template: cover ? 'classic' : template,
        personal: { photo: photo() },
        settings: { accentColor: ACCENT, sidebarBg: '#1e293b', photoBorder: 'accent', ...settings },
      });
      const ring = ringAround(await paintTop(await (cover ? renderCover(r) : render(r))), expected);
      for (const [side, d] of Object.entries(ring)) assert.ok(d < 16, `${side}: nearest pixel is ${d} away from ${expected}`);
    });
  }

  it('no ring when the photo border is "none"', async () => {
    const r = resume({ personal: { photo: photo() }, settings: { accentColor: ACCENT, photoBorder: 'none' } });
    const ring = ringAround(await paintTop(await render(r)), ACCENT);
    for (const [side, d] of Object.entries(ring)) assert.ok(d > 100, `${side}: an accent pixel ${d} away`);
  });
});
