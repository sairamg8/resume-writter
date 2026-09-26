// R2-147 — Personal Info → Photo → Position and Tone. Position Right prints the header's photo right of
// the name on every template whose header sets it beside the name (Classic, Minimal, Executive, Modern,
// Compact, Timeline, Academic, Banner, and the Sidebar's single column), and Word's header row puts its
// cell on the right; a centred header and the Sidebar's column photo take none. Tone Grayscale prints a
// greyscale copy of the photo — drawn through a canvas, colour where there is none — in the PDF and the
// cover letter, and Word's picture carries <a:grayscl/>. Unset, every template prints as before: the
// photo left of the name, in colour. The text exports print no photo, so neither changes a word there.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, renderDocx, loadModule, installPhotoCanvas, TEMPLATES } from './harness.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';
import { snapshot, item } from './parity/measure.mjs';

before(setup);
after(teardown);

const NAME = 'Avery Quinlan';
const cv = (template, settings = {}, extra = {}) => {
  const r = resume({ template, personal: { name: NAME, photo: PNG, email: 'avery@example.com' }, settings, ...extra });
  // As a résumé saved before R2-147 holds them: no Position and no Tone (new ones store the defaults).
  for (const key of ['photoPosition', 'photoTone']) if (!(key in settings)) delete r.settings[key];
  return r;
};
const shot = async (r) => snapshot(await render(r));
const photoOf = (snap) => snap.paint.filter((p) => p.paint === 'image' && p.page === 1)[0];
/** The photo's side of the name: 'left', 'right', or what went wrong. */
function side(snap) {
  const photo = photoOf(snap);
  const name = item(snap, NAME);
  if (!photo || !name) return 'the photo or the name does not print';
  if (photo.x1 <= name.x + 0.5) return 'left';
  if (photo.x0 >= name.x + name.w - 0.5) return 'right';
  return `overlapping (photo ${photo.x0.toFixed(1)}–${photo.x1.toFixed(1)}, name ${name.x.toFixed(1)}–${(name.x + name.w).toFixed(1)})`;
}

/** Templates whose header prints the photo beside the name (the Sidebar's column stacks it above). */
const BESIDE = TEMPLATES.filter((t) => t !== 'sidebar');

describe('Photo → Position (R2-147)', () => {
  it('unset prints exactly what Left prints, on every template', async () => {
    for (const template of TEMPLATES) {
      const [unset, left] = await Promise.all([shot(cv(template)), shot(cv(template, { photoPosition: 'left' }))]);
      assert.equal(unset.drawing, left.drawing, template);
    }
  });

  it('Right prints the photo right of the name, Left left of it, where the photo sits beside the name', async () => {
    const wrong = [];
    for (const template of [...BESIDE, 'sidebar']) {
      // A header aligned left, where the photo sits beside the name: Academic's own style centres it.
      const settings = template === 'sidebar' ? { sidebarSingleColumn: true, headerAlign: 'left' } : { headerAlign: 'left' };
      const left = side(await shot(cv(template, settings)));
      const right = side(await shot(cv(template, { ...settings, photoPosition: 'right' })));
      if (left !== 'left') wrong.push(`${template} Left: ${left}`);
      if (right !== 'right') wrong.push(`${template} Right: ${right}`);
    }
    assert.deepEqual(wrong, []);
  });

  it('the editor offers it where it applies, and where it does not it changes nothing', async () => {
    const { photoTextPositionApplies } = await loadModule('/src/constants/templates.js');
    for (const t of BESIDE) assert.equal(photoTextPositionApplies({}, t), true, t);
    for (const [t, s] of [['sidebar', {}], ['classic', { headerAlign: 'center' }], ['banner', { headerAlign: 'center' }]]) {
      assert.equal(photoTextPositionApplies(s, t), false, `${t} ${JSON.stringify(s)}`);
      const [left, right] = await Promise.all([shot(cv(t, s)), shot(cv(t, { ...s, photoPosition: 'right' }))]);
      assert.equal(left.drawing, right.drawing, `${t} ${JSON.stringify(s)}: Right changes nothing`);
    }
  });

  it('Word: the header row puts the photo on the same side of the name', async () => {
    // The Sidebar's Single · ATS-safe Layout prints Classic's header: beside the name in Word too, as in
    // its PDF — Word stacked it above the name, the Sidebar column's way (the review of R2-147).
    for (const [template, extra] of [['classic', {}], ['sidebar', { sidebarSingleColumn: true, headerAlign: 'left' }]]) {
      for (const photoPosition of ['left', 'right']) {
        const { xml } = await renderDocx(cv(template, { ...extra, photoPosition }));
        const photoAt = xml.indexOf('<w:drawing');
        const nameAt = xml.indexOf(`>${NAME}<`); // the name's text, not the picture's alt text
        assert.ok(photoAt >= 0 && nameAt >= 0, `${template}: the photo and the name print`);
        assert.equal(photoAt < nameAt ? 'left' : 'right', photoPosition, `${template} ${photoPosition}`);
      }
    }
  });

  // The review of R2-147: the letter took the résumé's photo Shape, Size, Border and Tone, but not its
  // Position — every letterhead printed the photo left of the name.
  it('the cover letter puts the photo on the résumé\'s side of the name', async () => {
    const wrong = [];
    let beside = 0;
    for (const template of BESIDE) {
      const settings = { headerAlign: 'left' };
      // Only a letterhead that sets the photo beside the name has a side to put it on (a centred one stacks it).
      const left = side(await snapshot(await renderCover(cv(template, settings))));
      if (left !== 'left') continue;
      beside += 1;
      const right = side(await snapshot(await renderCover(cv(template, { ...settings, photoPosition: 'right' }))));
      if (right !== 'right') wrong.push(`${template} Right: ${right}`);
    }
    assert.ok(beside >= 3, `letterheads with the photo beside the name: ${beside}`);
    assert.deepEqual(wrong, []);
  });

  it('the text exports print the same words whatever the side or tone', async () => {
    const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const plain = cv('classic');
    const set = cv('classic', { photoPosition: 'right', photoTone: 'grayscale' });
    set.id = plain.id;
    assert.equal(generateAtsPlainText(set), generateAtsPlainText(plain));
    assert.equal(generateMarkdownResume(set), generateMarkdownResume(plain));
  });
});

describe('Photo → Tone (R2-147)', () => {
  it('without a canvas, Grayscale prints the photo in colour (the render never breaks)', async () => {
    const { _setPhotoCanvasForTest } = await loadModule('/src/utils/printableImage.js');
    _setPhotoCanvasForTest(null);
    const photo = photoOf(await shot(cv('classic', { photoTone: 'grayscale' })));
    assert.ok(photo, 'the photo prints');
    assert.equal(photo.grey, false, 'in colour');
  });

  it('unset prints exactly what Color prints, the photo in colour (the fixture is red)', async () => {
    await installPhotoCanvas();
    for (const template of TEMPLATES) {
      const [unset, color] = await Promise.all([shot(cv(template)), shot(cv(template, { photoTone: 'color' }))]);
      assert.equal(unset.drawing, color.drawing, template);
      assert.equal(photoOf(unset).grey, false, `${template}: the photo prints in colour`);
    }
  });

  it('Grayscale prints the photo grey on every template, the same box where Color prints it', async () => {
    await installPhotoCanvas();
    const wrong = [];
    for (const template of TEMPLATES) {
      const [color, grey] = await Promise.all([shot(cv(template)), shot(cv(template, { photoTone: 'grayscale' }))]);
      const [a, b] = [photoOf(color), photoOf(grey)];
      if (!b) { wrong.push(`${template}: no photo`); continue; }
      if (b.grey !== true) wrong.push(`${template}: the photo is not grey`);
      if (a.digest === b.digest) wrong.push(`${template}: the same pixels as Color`);
      if (['x0', 'x1', 'y0', 'y1'].some((k) => Math.abs(a[k] - b[k]) > 0.01)) wrong.push(`${template}: the photo moved`);
    }
    assert.deepEqual(wrong, []);
  });

  it('the cover letter prints the résumé\'s photo, and its own, grey too — they take the résumé\'s Shape, Size and Border already', async () => {
    await installPhotoCanvas();
    const RED_OWN = PNG; // the letter's own upload, as coloured as the résumé's
    for (const extra of [{}, { coverLetter: { clPhoto: RED_OWN, showPhoto: true } }]) {
      const color = photoOf(await snapshot(await renderCover(cv('classic', {}, extra))));
      const grey = photoOf(await snapshot(await renderCover(cv('classic', { photoTone: 'grayscale' }, extra))));
      assert.equal(color?.grey, false, `${JSON.stringify(extra)}: Color`);
      assert.equal(grey?.grey, true, `${JSON.stringify(extra)}: Grayscale`);
    }
  });

  // RES-R2-126b: an SVG photo's grey copy was drawn at the SVG's own size — this 4 × 2 SVG became a 4 × 2
  // raster — so Grayscale printed it soft in the PDF and in Word, where in colour it prints sharp (as
  // vectors in the PDF, as svgPhotoCopy's PNG in Word, its longer side 1024 px). The grey copy is drawn
  // at that PNG copy's size now, for both.
  it('Grayscale draws an SVG photo\'s grey copy at its PNG copy\'s size, not the SVG\'s own, for the PDF and Word (RES-R2-126b)', async () => {
    await installPhotoCanvas();
    const canvas = await import('@napi-rs/canvas');
    const { withPrintablePhotos } = await loadModule('/src/utils/printableImage.js');
    const { withWordPhoto } = await loadModule('/src/utils/wordExportPhoto.js');
    const SVG_4X2 = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2" viewBox="0 0 4 2"><rect width="4" height="2" fill="#ff0000"/></svg>').toString('base64')}`;
    const r = cv('classic', { photoTone: 'grayscale' });
    r.personal.photo = SVG_4X2;
    const wrong = [];
    for (const [what, out] of [['PDF', await withPrintablePhotos(r)], ['Word', await withWordPhoto(r)]]) {
      const photo = out.personal.photo;
      if (!/^data:image\/(png|jpeg);base64,/.test(photo)) { wrong.push(`${what}: no grey copy (${String(photo).slice(0, 30)})`); continue; }
      const img = await canvas.loadImage(Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64'));
      if (img.width !== 1024 || img.height !== 512) wrong.push(`${what}: ${img.width} × ${img.height}, not 1024 × 512`);
      // Still the SVG's picture, grey: red's luminance (0.299 × 255 = 76) in every channel.
      const g = canvas.createCanvas(img.width, img.height).getContext('2d');
      g.drawImage(img, 0, 0);
      const [R, G, B] = g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
      if (Math.max(R, G, B) - Math.min(R, G, B) > 3 || Math.abs(G - 76) > 6) wrong.push(`${what}: the middle is ${R},${G},${B}, not grey 76`);
    }
    assert.deepEqual(wrong, []);
  });

  it('Word: Grayscale\'s picture carries <a:grayscl/> in its blip; unset and Color do not', async () => {
    const blip = (xml) => (xml.match(/<a:blip\s[\s\S]*?(?:\/>|<\/a:blip>)/) || [''])[0];
    for (const [settings, grey] of [[{}, false], [{ photoTone: 'color' }, false], [{ photoTone: 'grayscale' }, true]]) {
      const { xml } = await renderDocx(cv('classic', settings));
      assert.ok(blip(xml), 'the photo prints');
      assert.equal(/<a:grayscl\s*\/>/.test(blip(xml)), grey, JSON.stringify(settings));
    }
  });
});
