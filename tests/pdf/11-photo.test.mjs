// The profile photo's ring, checked on the page as pdf.js paints it (FIDA-43), and what shows
// through a see-through photo (R7-6).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, render, renderCover, loadModule } from './harness.mjs';
import { drawing, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const SCALE = 4; // px per pt: the 1.125 pt ring is ~4.5 px wide
const PHOTO_RGB = [22, 163, 74];
const ACCENT = '#e11d48';

/**
 * pdf.js paints through @napi-rs/canvas in Node. It is a devDependency now (R2-169): these tests used to
 * skip without it, so an install that lost pdf.js's optional copy passed them unrun; now it fails them.
 */
const canvasLib = await import('@napi-rs/canvas');

/** A 64×64 photo of one flat colour, as the editor stores an upload (a data URL). */
function photo() {
  const c = canvasLib.createCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${PHOTO_RGB.join(',')})`;
  ctx.fillRect(0, 0, 64, 64);
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

/**
 * A 64×64 cut-out — a disc of the photo colour, radius 12, on a see-through ground — as an upload
 * stores it, a PNG; `onWhite`: as a JPEG on white, the way uploads stored a WebP or GIF one (R7-6).
 */
function cutOut({ onWhite = false } = {}) {
  const c = canvasLib.createCanvas(64, 64);
  const ctx = c.getContext('2d');
  if (onWhite) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
  }
  ctx.fillStyle = `rgb(${PHOTO_RGB.join(',')})`;
  ctx.beginPath();
  ctx.arc(32, 32, 12, 0, 2 * Math.PI);
  ctx.fill();
  const type = onWhite ? 'image/jpeg' : 'image/png';
  return `data:${type};base64,${c.toBuffer(type).toString('base64')}`;
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

/** The box around every pixel painted in the photo colour: { x0, y0, x1, y1 }. */
function photoColourBox(page) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  for (let y = 0; y < page.h; y += 1) {
    for (let x = 0; x < page.w; x += 1) {
      if (distAt(page, x, y, PHOTO_RGB) < 30) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * The colours just outside the photo, on the middle of each side: for each side, the painted
 * pixel (1 to 6 px out) closest to `expected`, and its distance from it.
 */
function ringAround(page, expected) {
  const { x0, y0, x1, y1 } = photoColourBox(page);
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

describe('photo ring', () => {
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

  // Guard and the detector's soundness check (it passed before FIDA-43 too): where no ring is
  // drawn, ringAround() finds none, so the cases above can fail.
  it('no ring when the photo border is "none"', async () => {
    const r = resume({ personal: { photo: photo() }, settings: { accentColor: ACCENT, photoBorder: 'none' } });
    const ring = ringAround(await paintTop(await render(r)), ACCENT);
    for (const [side, d] of Object.entries(ring)) assert.ok(d > 100, `${side}: an accent pixel ${d} away`);
  });
});

describe('a see-through photo shows the ground it sits on (R7-6)', () => {
  /** What page 1 paints beside the cut-out's disc (1.5 radii from its centre, inside the photo). */
  const besideDisc = async (template, src, cover = false) => {
    const r = resume({ template, personal: { photo: src }, settings: { accentColor: ACCENT, sidebarBg: '#1e293b' } });
    const page = await paintTop(await (cover ? renderCover(r) : render(r)));
    const { x0, y0, x1, y1 } = photoColourBox(page);
    assert.ok(x1 > x0 + 20, 'the disc is painted');
    const i = (Math.round((y0 + y1) / 2) * page.w + Math.round(x1 + (x1 - x0) / 4)) * 4;
    return Array.from(page.data.slice(i, i + 3)); // a Uint8ClampedArray; deepEqual wants an array
  };

  // Guards: react-pdf always drew a PNG's see-through pixels, and a4a1f85 made an upload that has
  // see-through pixels store them (R7-6 — cypress/e2e/24-image-uploads.cy.js and
  // tests/unit/image-upload.unit.mjs, which fail on the module before it). These hold the printed
  // half: the last case, a cut-out flattened onto white the way a WebP or GIF one was, shows that
  // the check does see such a photo.
  for (const [where, template, cover, ground] of [
    ['Sidebar: the panel', 'sidebar', false, '#1e293b'],
    ['Modern: the banner', 'modern', false, ACCENT],
    ['cover letter in the Sidebar look: the panel', 'sidebar', true, '#1e293b'],
    ['cover letter in the Modern look: the band', 'modern', true, ACCENT],
  ]) {
    it(`${where} shows through a cut-out PNG`, async () => {
      const seen = await besideDisc(template, cutOut(), cover);
      const [r, g, b] = rgb(ground);
      assert.ok(Math.hypot(seen[0] - r, seen[1] - g, seen[2] - b) < 16, `[${seen}] beside the disc, expected ${ground}`);
    });
  }

  it('a cut-out stored as a JPEG on white prints a white disc on the Sidebar panel', async () => {
    assert.deepEqual(await besideDisc('sidebar', cutOut({ onWhite: true })), [255, 255, 255]);
  });
});

describe('Photo → Text Position (R3-0)', () => {
  const pages = (template, settings) => Promise.all(['top', 'center', 'bottom'].map(async (photoTextAlign) =>
    drawing(await render(resume({ template, personal: { photo: PNG, email: 'me@example.com' }, settings: { photoSize: 'lg', ...settings, photoTextAlign } })))));

  // Modern's two cases are the fix; Classic, Minimal and Executive always took the setting (guards).
  for (const [template, settings] of [['modern', {}], ['classic', {}], ['minimal', {}], ['executive', {}], ['modern', { headerAlign: 'center' }]]) {
    it(`${template}${settings.headerAlign ? ' (centred header)' : ''}: Top, Center and Bottom draw three different pages`, async () => {
      const [top, center, bottom] = await pages(template, settings);
      assert.ok(top !== center && center !== bottom && top !== bottom, 'each position moves the text or the photo');
    });
  }

  it('the editor offers it exactly where it applies: not in Sidebar, not with a centred header (except Modern\'s banner)', async () => {
    const { photoTextPositionApplies } = await loadModule('/src/constants/templates.js');
    for (const t of ['classic', 'minimal', 'executive', 'modern']) assert.equal(photoTextPositionApplies({}, t), true, t);
    assert.equal(photoTextPositionApplies({ headerAlign: 'center' }, 'modern'), true, 'Modern ignores header alignment');
    for (const t of ['classic', 'minimal', 'executive']) assert.equal(photoTextPositionApplies({ headerAlign: 'center' }, t), false, `${t} centred`);
    assert.equal(photoTextPositionApplies({}, 'sidebar'), false, 'sidebar');
    // Where it is hidden, it really does nothing: the three positions draw the same page.
    for (const [t, s] of [['sidebar', {}], ['classic', { headerAlign: 'center' }]]) {
      const [top, center, bottom] = await pages(t, s);
      assert.ok(top === center && center === bottom, `${t} ${JSON.stringify(s)}`);
    }
  });
});

describe('Sidebar photo height (R3-1)', () => {
  // The name sits right under the photo in the Sidebar column, so its baseline moves down by
  // exactly the photo box's extra height.
  const nameY = async (settings) => {
    const bytes = await render(resume({ template: 'sidebar', personal: { photo: PNG, name: 'Pat Sample' }, settings: { photoShape: 'square', photoBorder: 'none', ...settings } }));
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
    const items = (await (await doc.getPage(1)).getTextContent()).items;
    await doc.loadingTask.destroy();
    return items.find((t) => t.str.includes('Pat Sample')).transform[5];
  };
  // The Sidebar photo's width at each size: Classic's 130 / 165 / 200 px × 0.75 pt/px × 0.55.
  const WIDTH = { sm: 53.625, md: 68.0625, lg: 82.5 };

  for (const photoSize of ['sm', 'md', 'lg']) {
    it(`${photoSize}: Square, Tall and Portrait print 1 : 1.4 : 1.8 boxes`, async () => {
      const w = WIDTH[photoSize];
      const square = await nameY({ photoSize, photoHeight: 'match' });
      for (const [photoHeight, ratio] of [['tall', 1.4], ['taller', 1.8]]) {
        const h = w + (square - await nameY({ photoSize, photoHeight }));
        assert.ok(Math.abs(h / w - ratio) < 0.01, `${photoHeight}: ${h.toFixed(1)} × ${w} pt is 1:${(h / w).toFixed(2)}, expected 1:${ratio}`);
      }
    });
  }
});
