// T7 — the Banner band takes every Header Customization control (BannerTemplatePDF.jsx): alignment,
// Stack or Inline, the header rule (drawn on the band in its text colour), contact style and layout,
// the photo, the colours of what is on the band, hidden fields — and the cover letter's letterhead takes
// the band with them (letterhead.js LOOKS.banner); the Word files print the header on the page and the
// chips as shaded headings. The gaps (Name ↔ Title … Between contact rows) are 45–50-header-*.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, renderDocx, read, drawState, loadModule, readDocx, MM } from './harness.mjs';
import { painted, PNG_2X2 } from './extractors.mjs';
import { paintedPages, topBands } from './banner-paint.mjs';

before(setup);
after(teardown);

const ACCENT = '#1e3a8a';
const PERSONAL = { name: 'Pat Sample', title: 'Principal Architect', email: 'pat@example.com', phone: '+1 555 0100', location: 'Austin, TX', summary: '<p>Builds fast web apps.</p>', hiddenFields: [] };
const JOB = { company: 'Northwind Traders', role: 'Staff Engineer', startDate: '03/2022', endDate: '', current: true, description: '<ul><li>Led the checkout rebuild.</li></ul>' };
const make = (settings = {}, personal = {}) => resume({
  template: 'banner', settings: { accentColor: ACCENT, marginH: 18, marginV: 14, ...settings }, personal: { ...PERSONAL, ...personal },
  sections: [experience([JOB])], coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});
const item = (pages, str) => pages[0].items.find((i) => i.str.includes(str));
const inks = async (bytes, needle) => [...new Set((await drawState(bytes, needle)).map((h) => h.fill))];
/** Page 1's band: the full-width accent fill from the top edge. */
const bandOf = async (bytes, accent = ACCENT) => {
  const [page] = await read(bytes);
  return topBands((await paintedPages(bytes))[0], accent, page.W, page.H)[0];
};
/** Page 1's rules: strokes wider than 100 pt, as "colour/width". */
const rules = async (bytes) => (await painted(bytes)).filter((p) => p.paint === 'stroke' && p.x1 - p.x0 > 100 && p.y1 - p.y0 < 1).map((p) => `${p.colour}/${p.width}`);

describe('Header Customization on the band (T7)', () => {
  it('Text Alignment Center centres the name, title and contacts on the page; Left keeps them on the margin', async () => {
    const [page] = await read(await render(make({ headerAlign: 'center' })));
    for (const s of ['Pat Sample', 'Principal Architect']) {
      const i = item([page], s);
      assert.ok(Math.abs(i.x + i.w / 2 - page.W / 2) < 0.5, `${s}: centred`);
    }
    const [left] = await read(await render(make()));
    for (const s of ['Pat Sample', 'Principal Architect', 'pat@example.com']) assert.ok(item([left], s).x < 18 * MM + 12, `${s}: on the left`);
  });

  it('Name & Title Layout Inline sets the title on the name\'s line, after it', async () => {
    const [page] = await read(await render(make({ headerLayout: 'inline' })));
    const name = item([page], 'Pat Sample');
    const title = item([page], 'Principal Architect');
    assert.ok(Math.abs(name.y - title.y) < 2, `one line (baselines ${name.y.toFixed(1)}, ${title.y.toFixed(1)}), as Classic's Inline`);
    assert.ok(title.x > name.x + name.w, 'the title after the name');
  });

  it('Header Bottom Border: a rule in the band\'s text colour at its Thickness, under the contacts, inside the band; off, none', async () => {
    const off = await render(make({ showHeaderBorder: false }));
    assert.deepEqual(await rules(off), []);
    for (const width of [1, 3, 6]) {
      const bytes = await render(make({ showHeaderBorder: true, headerBorderWidth: width }));
      assert.deepEqual(await rules(bytes), [`#ffffff/${width}`], `${width} pt`);
      const [rule] = (await painted(bytes)).filter((p) => p.paint === 'stroke' && p.x1 - p.x0 > 100);
      const [page] = await read(bytes);
      const band = await bandOf(bytes);
      assert.ok(rule.y1 < item([page], 'pat@example.com').y && rule.y0 > band.y0, `${width} pt: under the contacts, on the band`);
      assert.ok(Math.abs(rule.x0 - 18 * MM) < 0.5 && Math.abs(rule.x1 - (page.W - 18 * MM)) < 0.5, `${width} pt: margin to margin`);
      assert.ok(Math.abs((await bandOf(off)).y0 - band.y0 - (12 + width)) < 0.05, `${width} pt: the band grows by the Text ↔ Border gap and the rule`);
    }
    const junk = await render(make({ showHeaderBorder: true, headerBorderWidth: -3 }));
    assert.deepEqual(await rules(junk), [], 'an imported -3: no rule');
    assert.ok(Math.abs((await bandOf(off)).y0 - (await bandOf(junk)).y0 - 12) < 0.05, 'but the gap, as Classic pads its header');
  });

  it('Contact Style Bar and Bullet: the values in the band\'s text colour, the marks in its mark colour; Single stacks them', async () => {
    const { letterheadLook } = await loadModule('/src/templates/pdf/shared/letterhead.js');
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    const { marks } = letterheadLook('banner', resolveTemplateSettings({ accentColor: ACCENT }, 'banner'));
    for (const [contactStyle, mark] of [['bar', '|'], ['bullet', '•']]) {
      const bytes = await render(resume({ template: 'banner', settings: { accentColor: ACCENT, contactStyle }, personal: PERSONAL })); // no list bullets
      assert.deepEqual(await inks(bytes, 'pat@example.com'), ['#ffffff'], contactStyle);
      assert.deepEqual(await inks(bytes, mark), [marks], `${contactStyle}: its marks`);
    }
    const [page] = await read(await render(make({ contactLayout: 'single' })));
    const ys = ['pat@example.com', '+1 555 0100', 'Austin, TX'].map((s) => item([page], s).y);
    assert.ok(ys[0] > ys[1] && ys[1] > ys[2], 'one contact to a row');
  });

  it('Header Text Color, Name color and Job title color reach the band; a white one on a light accent prints a readable tint', async () => {
    const picked = await render(make({ headerTextColor: '#fde68a' }));
    for (const s of ['Pat Sample', 'Principal Architect', 'pat@example.com']) assert.deepEqual(await inks(picked, s), ['#fde68a'], s);
    const own = await render(make({ nameColor: '#fca5a5', jobTitleColor: '#bfdbfe' }));
    assert.deepEqual([await inks(own, 'Pat Sample'), await inks(own, 'Principal Architect'), await inks(own, 'pat@example.com')], [['#fca5a5'], ['#bfdbfe'], ['#ffffff']]);
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const light = await render(make({ accentColor: '#fde68a' }));
    assert.ok(await bandOf(light, '#fde68a'), 'the band in the light accent');
    for (const s of ['Pat Sample', 'pat@example.com']) {
      const [ink] = await inks(light, s);
      assert.ok(contrast(ink, '#fde68a') >= 3, `${s}: ${ink} reads ${contrast(ink, '#fde68a').toFixed(2)}:1 on the band`);
    }
  });

  it('Photo: on the band, on the left margin with the text Photo ↔ Text beside it; above the name when centred; hidden, gone', async () => {
    // The photo's clip: Medium on the band is Modern's 54 px (40.5 pt) wide (pdfPhoto.js).
    const photoBox = async (bytes) => (await painted(bytes)).find((p) => p.paint === 'clip' && Math.abs(p.x1 - p.x0 - 40.5) < 0.1);
    const bytes = await render(make({}, { photo: PNG_2X2 }));
    const [page] = await read(bytes);
    const img = await photoBox(bytes);
    const band = await bandOf(bytes);
    assert.ok((await painted(bytes)).some((p) => p.paint === 'image'), 'the photo is drawn');
    assert.ok(img && img.y0 > band.y0 && img.y1 < page.H, 'the photo inside the band');
    assert.ok(Math.abs(img.x0 - 18 * MM) < 0.5, `on the left margin (${img.x0})`);
    assert.ok(Math.abs(item([page], 'Pat Sample').x - img.x1 - 10) < 0.5, 'the name 10 pt (Photo ↔ Text) beside it');
    const centred = await render(make({ headerAlign: 'center' }, { photo: PNG_2X2 }));
    const cImg = await photoBox(centred);
    assert.ok(Math.abs((cImg.x0 + cImg.x1) / 2 - page.W / 2) < 0.5 && cImg.y0 > item(await read(centred), 'Pat Sample').y, 'centred, above the name');
    const hidden = await render(make({}, { photo: PNG_2X2, hiddenFields: ['photo', 'email', 'summary'] }));
    assert.deepEqual((await painted(hidden)).filter((p) => p.paint === 'image'), [], 'no photo');
    const [h] = await read(hidden);
    assert.ok(!item([h], 'pat@example.com') && !item([h], 'Builds fast'), 'no email, no summary');
    const chip = item([h], 'EXPERIENCE');
    assert.ok(Math.abs((await bandOf(hidden)).y0 - (chip.y + chip.h) - 15) < 4, 'the first section 15 pt (Header gap below) under the band');
  });
});

describe('the cover letter\'s letterhead takes the band (T7)', () => {
  it('the accent from the paper\'s top and side edges, the name and contacts in the band\'s text colour, the letter under it', async () => {
    const bytes = await renderCover(make());
    const [page] = await read(bytes);
    const band = await bandOf(bytes);
    assert.ok(band, 'the band');
    assert.equal((await drawState(bytes, 'Pat Sample'))[0].fill, '#ffffff', 'the name (the signature under the letter is on the paper)');
    assert.deepEqual(await inks(bytes, 'pat@example.com'), ['#ffffff']);
    assert.ok(Math.abs(item([page], 'Pat Sample').x - 18 * MM) < 0.5, 'on the margin');
    assert.ok(item([page], '15 January 2026').y < band.y0, 'the letter below the band');
  });

  it('Header Bottom Border draws the résumé\'s rule on the letter\'s band too, at its Thickness', async () => {
    for (const width of [2, 6]) {
      const r = make({ showHeaderBorder: true, headerBorderWidth: width });
      assert.deepEqual(await rules(await renderCover(r)), await rules(await render(r)), `${width} pt: as the résumé`);
      assert.deepEqual(await rules(await renderCover(r)), [`#ffffff/${width}`]);
    }
    assert.deepEqual(await rules(await renderCover(make({ showHeaderBorder: false }))), []);
  });
});

describe('the Word files (T7)', () => {
  it('the résumé: the header on the page in its page colours, each title shaded in the chip\'s fill in white', async () => {
    const { paragraphs } = await renderDocx(make());
    const heading = paragraphs.find((p) => p.text === 'PROFESSIONAL EXPERIENCE');
    assert.equal(/<w:shd [^>]*w:fill="([0-9a-fA-F]{6})"/.exec(heading.xml)?.[1]?.toLowerCase(), ACCENT.slice(1));
    assert.equal(/<w:color w:val="([0-9a-fA-F]{6})"/.exec(heading.xml.replace(/<w:pPr>.*?<\/w:pPr>/s, ''))?.[1]?.toLowerCase(), 'ffffff');
    const name = paragraphs.find((p) => p.text.includes('Pat Sample'));
    assert.notEqual(/<w:color w:val="([0-9a-fA-F]{6})"/.exec(name.xml)?.[1]?.toLowerCase(), 'ffffff', 'no band in Word: the name is not white on white');
  });

  it('the letter: its letterhead shaded in the band\'s accent', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const { paragraphs } = readDocx(new Uint8Array(await (await renderCoverLetterDocx(make())).arrayBuffer()));
    const name = paragraphs.find((p) => p.text.includes('Pat Sample'));
    assert.equal(/<w:shd [^>]*w:fill="([0-9a-fA-F]{6})"/.exec(name.xml)?.[1]?.toLowerCase(), ACCENT.slice(1));
  });
});
