// The letter's own options under every letterhead look (FIDB-51): photo, its size and ring,
// Fields Position, Text Position, contact style and layout, its hidden contacts, the business
// block — and letters saved before the looks existed.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allItems, allText, overlaps, loadModule, readDocx, MM, TEMPLATES } from './harness.mjs';
import { drawing, painted, pdftotext, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';
const CONTACTS = { email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin, Germany', website: 'pat.dev', linkedin: 'linkedin.com/in/pat' };
const BLOCK = { body: '<p>Dear Sarah,</p>', date: '2026-01-15', recipientName: 'Sarah Smith', company: 'Globex Corp', subject: 'Re: the role' };

const letter = (template, { settings, personal, coverLetter } = {}) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', ...CONTACTS, hiddenFields: [], ...personal },
  coverLetter: { ...BLOCK, ...coverLetter },
});

/** The band a banded look draws (Modern's accent, the Sidebar panel's navy), else null. */
const bandOf = (template, paths) => {
  const colour = { modern: ACCENT, sidebar: '#1e293b' }[template];
  return colour ? paths.find((p) => p.paint === 'fill' && p.colour === colour && p.x1 - p.x0 > 100) : null;
};

const squash = (s) => s.replace(/\s+/g, '');
const STYLES = [['icon', 'justify'], ['bar', 'single'], ['bullet', '2grid']];

describe('the letter\'s options under every look (FIDB-51)', () => {
  // Classic, Minimal and Executive: guards (a rule changes no layout); Modern and Sidebar: the
  // letterhead and photo are on the band in every layout.
  for (const template of TEMPLATES) {
    it(`${template}: every Fields Position, with and without a photo, in every contact style`, async () => {
      for (const [k, fieldsPosition] of ['right', 'below-name', 'below-all'].entries()) {
        for (const photo of [PNG, '']) {
          const [headerStyle, headerLayout] = STYLES[(k + (photo ? 1 : 0)) % 3];
          const at = `${fieldsPosition}, ${photo ? 'photo' : 'no photo'}, ${headerStyle}/${headerLayout}`;
          const bytes = await renderCover(letter(template, {
            personal: { photo }, coverLetter: { fieldsPosition, headerStyle, headerLayout, hiddenFields: ['phone'] },
          })).catch((e) => assert.fail(`${at}: ${e.message}`));
          const pages = await read(bytes);
          const text = squash(allText(pages));
          for (const s of ['Pat Sample', 'Staff Engineer', 'pat@example.com', 'Berlin, Germany', 'pat.dev', 'linkedin.com/in/pat', '15 January 2026', 'Sarah Smith', 'Globex Corp', 'Re: the role', 'Dear Sarah,']) {
            assert.ok(text.includes(squash(s)), `${at}: "${s}" is printed`);
          }
          assert.ok(!text.includes('5550100'), `${at}: the phone the letter hides`);
          const right = pages[0].W - 18 * MM;
          assert.deepEqual(pages[0].items.filter((t) => t.x + t.w > right + 0.5).map((t) => t.str), [], `${at}: text past the margin`);
          assert.deepEqual(overlaps(pages[0]), [], `${at}: overlapping text`);
          const paths = await painted(bytes);
          const images = paths.filter((p) => p.paint === 'image');
          assert.equal(images.length, photo ? 1 : 0, `${at}: the photo`);
          const band = bandOf(template, paths);
          assert.equal(!!band, template === 'modern' || template === 'sidebar', `${at}: a band exactly in the banded looks`);
          if (band) {
            const head = allItems(pages).filter((t) => t.y > band.y0 - 1);
            assert.ok(head.length >= 5, `${at}: the letterhead is in the band`);
            for (const t of head) assert.ok(t.y + t.h * 0.75 <= band.y1 && t.x >= band.x0 && t.x + t.w <= band.x1 + 0.5, `${at}: "${t.str}" inside the band`);
            for (const p of images) assert.ok(p.y0 >= band.y0 && p.y1 <= band.y1 && p.x0 >= band.x0, `${at}: the photo inside the band`);
          }
        }
      }
    });
  }

  for (const template of ['modern', 'sidebar']) {
    it(`${template}: Text Position moves the name against the photo on the band, as on a white page`, async () => {
      const at = {};
      for (const photoTextAlign of ['top', 'center', 'bottom']) {
        const bytes = await renderCover(letter(template, {
          settings: { photoShape: 'square', photoHeight: 'taller' }, personal: { photo: PNG }, coverLetter: { photoTextAlign },
        }));
        const paths = await painted(bytes);
        const photo = paths.find((p) => p.paint === 'image');
        const band = bandOf(template, paths);
        assert.ok(band && photo.y0 >= band.y0 && photo.y1 <= band.y1, `${photoTextAlign}: the photo is on the band`);
        at[photoTextAlign] = { photo, name: allItems(await read(bytes)).find((t) => t.str === 'Pat Sample').y };
      }
      assert.ok(at.top.photo.y0 === at.center.photo.y0 && at.bottom.photo.y0 === at.center.photo.y0, 'the photo stays put');
      const up = at.top.name - at.center.name;
      const down = at.center.name - at.bottom.name;
      assert.ok(up > 3 && Math.abs(up - down) < 0.5, `top ${up.toFixed(1)} pt up, bottom ${down.toFixed(1)} pt down`);
    });
  }

  // Guard: the letter's photo sizes (R3-5) are its own in every look.
  it('Photo → Size keeps the letter\'s 30 / 38 / 48 pt photo in every look', async () => {
    for (const template of TEMPLATES) {
      for (const [photoSize, w] of [['sm', 30], ['md', 38], ['lg', 48]]) {
        const bytes = await renderCover(letter(template, { settings: { photoSize, photoShape: 'rounded', photoBorder: 'none' }, personal: { photo: PNG } }));
        const [photo] = (await painted(bytes)).filter((p) => p.paint === 'image');
        assert.equal(Math.round(photo.x1 - photo.x0), w, `${template} ${photoSize}`);
      }
    }
  });

  it('the photo\'s ring shows on the band: white or half-white on Modern\'s accent, a readable accent on the Sidebar panel', async () => {
    const { readableOn, solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    // The ring: 1.5 pt, stroked at 3 pt and clipped to the photo's box.
    const ring = async (template, settings) => [...new Set((await painted(await renderCover(letter(template, {
      settings: { photoShape: 'circle', ...settings }, personal: { photo: PNG },
    })))).filter((p) => p.paint === 'stroke' && p.width === 1.5 && p.x1 - p.x0 < 60).map((p) => p.colour))];
    assert.deepEqual(await ring('modern', { photoBorder: 'accent' }), ['#ffffff'], 'Modern: Accent is white, as on the banner');
    assert.deepEqual(await ring('modern', { photoBorder: 'thin' }), [solid('rgba(255,255,255,0.5)', 1, ACCENT)], 'Modern: Thin');
    assert.deepEqual(await ring('sidebar', { photoBorder: 'accent', accentColor: '#374151' }), [readableOn('#374151', '#1e293b', 3)], 'Sidebar: a dark accent lightened');
    assert.deepEqual(await ring('classic', { photoBorder: 'accent' }), [ACCENT], 'Classic: the accent');
  });
});

describe('the text reads in letter order in every look (FIDB-51)', () => {
  // Guard: a band or a rule is drawn, never text, so every look reads as the Classic letter did.
  // pdftotext reads the contacts beside the name as a column of their own (after the body, in
  // its reading-order mode) — in the Classic letter as before; they are checked as present.
  it('pdf.js reads the same text as the Classic letter; pdftotext reads name → block → body → closing', async () => {
    const texts = {};
    for (const template of TEMPLATES) {
      const bytes = await renderCover(letter(template));
      texts[template] = allText(await read(bytes));
      for (const [mode, out] of pdftotext(bytes)) {
        const at = ['Pat Sample', '15 January 2026', 'Sarah Smith', 'Re: the role', 'Dear Sarah,', 'Sincerely,'].map((s) => out.indexOf(s));
        assert.ok(!at.includes(-1) && at.every((v, i) => !i || v > at[i - 1]), `${template}, ${mode}: ${at}`);
        assert.ok(out.includes('pat@example.com'), `${template}, ${mode}: the contacts`);
      }
    }
    for (const template of TEMPLATES) assert.equal(texts[template], texts.classic, template);
  });
});

describe('letters saved before the looks (FIDB-51)', () => {
  /** A résumé as an older build saved it: no dataVersion, no name/title/header/sidebar colours, the old letter default. */
  const legacy = (template) => {
    const r = letter(template, { coverLetter: { recipientTitle: 'Hiring Manager', recipientName: '', company: '', subject: '', date: '' } });
    for (const key of ['nameColor', 'jobTitleColor', 'headerTextColor', 'sidebarBg', 'showHeaderBorder', 'photoTextAlign', 'headerAlign']) delete r.settings[key];
    delete r.dataVersion;
    return { ...r, updatedAt: Date.UTC(2026, 7, 20) }; // last edited before 4bc56fe: the title never printed
  };

  it('load, then print in the résumé template\'s look without an error, in the PDF and in Word', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    for (const template of TEMPLATES) {
      const r = normalizeResume(legacy(template));
      const bytes = await renderCover(r);
      assert.equal(allText(await read(bytes)), 'Pat Sample Staff Engineer pat@example.com +1 555 0100 Berlin, Germany pat.dev linkedin.com/in/pat Dear Sarah, Sincerely, Pat Sample Staff Engineer', template);
      if (template === 'modern' || template === 'sidebar') assert.ok(bandOf(template, await painted(bytes)), `${template}: its band, from the defaults`);
      const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
      assert.equal(doc.texts[0], 'Pat Sample', `${template}: Word`);
    }
  });

  it('a template id the app does not offer ("dark", an import\'s) prints the Classic letter exactly', async () => {
    // drawing() makes pdf.js's per-document font ids neutral, or no two renders compare equal.
    const page = async (template) => drawing(await renderCover(legacy(template)));
    const classic = await page('classic');
    assert.notEqual(await page('modern'), classic, 'the comparison sees a different look');
    for (const template of ['dark', 'aurora', '']) assert.equal(await page(template), classic, template);
  });
});
