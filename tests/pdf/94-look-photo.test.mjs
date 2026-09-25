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
    for (const photoPosition of ['left', 'right']) {
      const { xml } = await renderDocx(cv('classic', { photoPosition }));
      const photoAt = xml.indexOf('<w:drawing');
      const nameAt = xml.indexOf(`>${NAME}<`); // the name's text, not the picture's alt text
      assert.ok(photoAt >= 0 && nameAt >= 0, 'the photo and the name print');
      assert.equal(photoAt < nameAt ? 'left' : 'right', photoPosition);
    }
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

  it('Word: Grayscale\'s picture carries <a:grayscl/> in its blip; unset and Color do not', async () => {
    const blip = (xml) => (xml.match(/<a:blip\s[\s\S]*?(?:\/>|<\/a:blip>)/) || [''])[0];
    for (const [settings, grey] of [[{}, false], [{ photoTone: 'color' }, false], [{ photoTone: 'grayscale' }, true]]) {
      const { xml } = await renderDocx(cv('classic', settings));
      assert.ok(blip(xml), 'the photo prints');
      assert.equal(/<a:grayscl\s*\/>/.test(blip(xml)), grey, JSON.stringify(settings));
    }
  });
});
