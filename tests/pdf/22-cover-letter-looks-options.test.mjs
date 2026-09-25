// The letter's own options under every letterhead look (FIDB-51): photo, its size and ring,
// Fields Position, Text Position, contact style and layout, its hidden contacts, the business
// block — and letters saved before the looks existed.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, read, allItems, allText, drawState, overlaps, loadModule, readDocx, MM, TEMPLATES } from './harness.mjs';
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

/** The looks whose letterhead is a band: Modern's accent, the Sidebar panel's navy, Banner's accent (T7), Banded's pale accent (R2-138 B2). */
const BANDED = ['modern', 'sidebar', 'banner', 'banded'];
let PALE = null; // Banded's band colour at ACCENT (designedMarks.js), read once the harness is up
before(async () => { PALE = (await loadModule('/src/templates/pdf/shared/designedMarks.js')).bandedGround(ACCENT); });
/** The band a banded look draws, else null. */
const bandOf = (template, paths) => {
  const colour = { modern: ACCENT, sidebar: '#1e293b', banner: ACCENT, banded: PALE }[template];
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
          const r = letter(template, { personal: { photo }, coverLetter: { fieldsPosition, headerStyle, headerLayout, hiddenFields: ['phone'] } });
          const bytes = await renderCover(r).catch((e) => assert.fail(`${at}: ${e.message}`));
          const pages = await read(bytes);
          const text = squash(allText(pages));
          for (const s of ['Pat Sample', 'Staff Engineer', 'pat@example.com', 'Berlin, Germany', 'pat.dev', 'linkedin.com/in/pat', '15 January 2026', 'Sarah Smith', 'Globex Corp', 'Re: the role', 'Dear Sarah,']) {
            assert.ok(text.includes(squash(s)), `${at}: "${s}" is printed`);
          }
          assert.ok(!text.includes('5550100'), `${at}: the phone the letter hides`);
          const right = pages[0].W - (r.settings.marginH ?? 18) * MM; // the résumé's margins: Compact's 12 mm (T9)
          assert.deepEqual(pages[0].items.filter((t) => t.x + t.w > right + 0.5).map((t) => t.str), [], `${at}: text past the margin`);
          assert.deepEqual(overlaps(pages[0]), [], `${at}: overlapping text`);
          const paths = await painted(bytes);
          const images = paths.filter((p) => p.paint === 'image');
          assert.equal(images.length, photo ? 1 : 0, `${at}: the photo`);
          const band = bandOf(template, paths);
          assert.equal(!!band, BANDED.includes(template), `${at}: a band exactly in the banded looks`);
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

  for (const template of BANDED) {
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
    assert.deepEqual(await ring('banner', { photoBorder: 'accent' }), ['#ffffff'], 'Banner: Accent is white, as on its band');
    assert.deepEqual(await ring('sidebar', { photoBorder: 'accent', accentColor: '#374151' }), [readableOn('#374151', '#1e293b', 3)], 'Sidebar: a dark accent lightened');
    assert.deepEqual(await ring('classic', { photoBorder: 'accent' }), [ACCENT], 'Classic: the accent');
  });
});

describe('the Bar and Bullet marks on a band take its colours (VFIDB-51-0)', () => {
  // The marks were the white page's greys (#cccccc bars, #bbbbbb bullets) on every band: 1.47:1
  // on a light Sidebar panel and 1.29:1 on a light Modern accent — gone — while the letter's
  // Word export printed them in the contacts' colour.
  const MARKS = [['bar', 'justify', '|'], ['bullet', 'justify', '•'], ['bullet', 'single', '•'], ['bullet', '2grid', '•']];
  const BANDS = [
    ['sidebar', { sidebarBg: '#f1f5f9' }, '#f1f5f9'],
    ['sidebar', {}, '#1e293b'],
    ['modern', { accentColor: '#fde68a', headerTextColor: '#1e293b' }, '#fde68a'],
    ['modern', { accentColor: '#2563eb' }, '#2563eb'],
    ['modern', { accentColor: '#ea580c' }, '#ea580c'], // white values at 3.56:1
    ['banner', {}, ACCENT],
    ['banner', { accentColor: '#fde68a', headerTextColor: '#1e293b' }, '#fde68a'],
  ];
  /** The distinct colours of the runs Word prints `mark` in. */
  const wordMarks = (doc, mark) => [...new Set(doc.xml.split('</w:r>')
    .filter((run) => new RegExp(`>\\s*\\${mark}\\s*<`).test(run))
    .map((run) => run.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase()))];

  it('Modern, Sidebar and Banner: every mark reads on the band (3:1 or more), no stronger than the values, in the colour Word prints', async () => {
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    for (const [template, settings, band] of BANDS) {
      for (const [headerStyle, headerLayout, mark] of MARKS) {
        const at = `${template} ${JSON.stringify(settings)}, ${headerStyle}/${headerLayout}`;
        const r = letter(template, { settings, coverLetter: { headerStyle, headerLayout } });
        const bytes = await renderCover(r);
        const drawn = [...new Set((await drawState(bytes, mark)).map((h) => h.fill))];
        assert.equal(drawn.length, 1, `${at}: one colour for every mark (${drawn})`);
        const k = contrast(drawn[0], band);
        assert.ok(k >= 3, `${at}: ${drawn[0]} on the band reads ${k.toFixed(2)}:1`);
        const [value] = await drawState(bytes, 'pat@example.com');
        assert.ok(k <= contrast(value.fill, band), `${at}: ${drawn[0]} no stronger than the values' ${value.fill}`);
        const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
        assert.deepEqual(wordMarks(doc, mark), [drawn[0].slice(1)], `${at}: Word's marks`);
        if (template === 'banner') { // its résumé's band takes Contact Style too: the same marks
          const cv = await render(resume({ template, settings: { accentColor: ACCENT, ...settings, contactStyle: headerStyle, contactLayout: headerLayout }, personal: { name: 'Pat Sample', ...CONTACTS } }));
          assert.deepEqual([...new Set((await drawState(cv, mark)).map((h) => h.fill))], drawn, `${at}: the résumé's band`);
        }
      }
    }
  });

  // Guard: on the white page the marks keep the light greys every letter and résumé header printed.
  it('Classic, Minimal and Executive letters and every résumé header keep the page\'s greys', async () => {
    const personal = { name: 'Pat Sample', ...CONTACTS, hiddenFields: [] };
    for (const template of TEMPLATES) {
      for (const [style, layout, mark, grey] of [['bar', 'justify', '|', '#cccccc'], ['bullet', 'justify', '•', '#bbbbbb'], ['bullet', '2grid', '•', '#bbbbbb']]) {
        const at = `${template}, ${style}/${layout}`;
        if (template === 'banner') continue; // its band's marks, on the letter and the résumé: above
        if (!BANDED.includes(template)) {
          const bytes = await renderCover(letter(template, { coverLetter: { headerStyle: style, headerLayout: layout } }));
          assert.deepEqual([...new Set((await drawState(bytes, mark)).map((h) => h.fill))], [grey], `${at}: the letter`);
        }
        const cv = await render(resume({ template, settings: { accentColor: ACCENT, contactStyle: style, contactLayout: layout }, personal }));
        const drawn = [...new Set((await drawState(cv, mark)).map((h) => h.fill))];
        // Modern's banner and the Sidebar column draw no marks.
        assert.deepEqual(drawn, ['modern', 'sidebar'].includes(template) ? [] : [grey], `${at}: the résumé`);
      }
    }
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
      if (BANDED.includes(template)) assert.ok(bandOf(template, await painted(bytes)), `${template}: its band, from the defaults`);
      const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
      // The name alone on its line, or with the title beside it where the header prints them Inline (Compact's own, T9).
      assert.equal(doc.texts[0], r.settings.headerLayout === 'inline' ? 'Pat Sample Staff Engineer' : 'Pat Sample', `${template}: Word`);
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

describe('a Fields Position the panel does not offer (V2FIDB-51-1)', () => {
  // An import's or a hand-edited file's ("Right of Name", "RIGHT", "below"): no build ever wrote
  // one, but the letterhead drew Right of Name for it without the cap on the name side, so with a
  // photo, a long title and icons the contacts got no width and react-pdf threw on the first icon
  // — no preview and no PDF — and without a photo the contacts ran past the right margin.
  const TITLE = 'Principal Distinguished Staff Engineer, Platform Infrastructure and Developer Tooling';
  const UNKNOWN = ['Right of Name', 'RIGHT', 'below', 42];
  const long = (template, fieldsPosition, photo) => letter(template, {
    personal: { title: TITLE, photo }, coverLetter: { fieldsPosition, headerStyle: 'icon', headerLayout: 'justify' },
  });

  it('prints the Right of Name letterhead exactly, in every look, with and without a photo — and Word the same letter', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const word = async (r) => readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer())).texts;
    for (const template of TEMPLATES) {
      for (const photo of [PNG, '']) {
        const letterOf = long(template, 'right', photo);
        const right = await renderCover(letterOf);
        const page = await drawing(right);
        const [first] = await read(right);
        const margin = first.W - (letterOf.settings.marginH ?? 18) * MM; // the résumé's margins: Compact's 12 mm (T9)
        assert.deepEqual(first.items.filter((t) => t.x + t.w > margin + 0.5).map((t) => t.str), [], `${template}: Right of Name keeps inside the margin`);
        for (const fieldsPosition of UNKNOWN) {
          const at = `${template}, ${photo ? 'photo' : 'no photo'}, ${JSON.stringify(fieldsPosition)}`;
          const bytes = await renderCover(long(template, fieldsPosition, photo)).catch((e) => assert.fail(`${at}: ${e.message}`));
          assert.equal(await drawing(bytes), page, `${at}: the PDF`);
        }
      }
      assert.deepEqual(await word(long(template, 'Right of Name', PNG)), await word(long(template, 'right', PNG)), `${template}: Word`);
    }
    // The comparison sees a different layout.
    assert.notEqual(await drawing(await renderCover(long('classic', 'below-all', PNG))), await drawing(await renderCover(long('classic', 'right', PNG))));
  });

  it('the panel marks Right of Name for it — the layout it prints — and each offered position for itself', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    const marked = (fieldsPosition) => {
      const out = renderToString(createElement(CoverLetterPanel, {
        coverLetter: { fieldsPosition }, personal: { name: 'Pat Sample', ...CONTACTS }, settings: {}, template: 'classic', updateCoverLetter: () => {},
      }));
      return [...out.matchAll(/<button class="w-full text-left[^"]*"><div class="font-medium">([^<]*)<\/div>/g)]
        .map((m) => (m[0].includes('bg-blue-600') ? `[${m[1]}]` : m[1]));
    };
    assert.deepEqual(marked('below-all'), ['Right of Name', 'Below Name', '[Below Everything]'], 'the three options, in order');
    assert.deepEqual(marked('below-name'), ['Right of Name', '[Below Name]', 'Below Everything']);
    for (const fieldsPosition of ['right', undefined, '', ...UNKNOWN]) {
      assert.deepEqual(marked(fieldsPosition), ['[Right of Name]', 'Below Name', 'Below Everything'], JSON.stringify(fieldsPosition));
    }
  });
});
