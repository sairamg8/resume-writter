// Header spacing (header_spacing_spec.md): the settings and how they resolve, and the gaps
// Classic, Minimal and Executive print — each set gap moves exactly what follows it, an unset one
// prints what the template always printed. The template's own values: tests/unit/header-spacing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, read, allText, loadModule } from './harness.mjs';
import { drawing, pdftotext, PNG_2X2 } from './extractors.mjs';

before(setup);
after(teardown);

const STACKED = ['classic', 'minimal', 'executive'];
const P = {
  name: 'Alex Johnson', title: 'Senior Engineer',
  email: 'alex@example.com', phone: '+1 555 0100', location: 'San Francisco, CA',
  website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj', github: 'github.com/alexj',
  summary: '<p>Summary line of an experienced engineer.</p>',
};
const CONTACTS = [P.email, P.phone, P.location, P.website, P.linkedin, P.github];
const LETTER = { date: '2026-01-15', recipientName: 'Jane Smith', body: '<p>Body line.</p>' };

const make = (template, settings = {}, personal = {}, coverLetter = {}) =>
  resume({ template, settings, personal: { ...P, ...personal }, coverLetter: { ...LETTER, ...coverLetter }, sections: [experience([{}])] });
const page = async (...args) => (await read(await render(make(...args))))[0];
const drawn = async (...args) => drawing(await render(make(...args)));

describe('header spacing settings (header_spacing_spec.md)', () => {
  it('a stored gap is a finite number of px, clamped to its range; anything else is unset (D9)', async () => {
    const { storedGapPx, HEADER_GAPS } = await loadModule('/src/constants/headerSpacing.js');
    for (const v of [undefined, null, '12', NaN, Infinity, -Infinity, true, {}, []]) {
      assert.equal(storedGapPx({ nameTitleGap: v }, 'nameTitleGap'), null, `${JSON.stringify(v)} prints as unset`);
    }
    assert.equal(storedGapPx(undefined, 'nameTitleGap'), null);
    assert.equal(storedGapPx({ nameTitleGap: 12 }, 'nameTitleGap'), 12);
    assert.equal(storedGapPx({ nameTitleGap: 2.5 }, 'nameTitleGap'), 2.5, 'kept as stored; the PDF takes any px');
    assert.equal(storedGapPx({ nameTitleGap: -5 }, 'nameTitleGap'), 0, 'below the range: its minimum');
    assert.equal(storedGapPx({ headerGapBelow: 10000 }, 'headerGapBelow'), 80, 'above the range: its maximum');
    assert.equal(storedGapPx({ headerInlineGap: 0 }, 'headerInlineGap'), 2, 'headerInlineGap starts at 2 px, as its stepper');
    for (const [key, { min, max }] of Object.entries(HEADER_GAPS)) assert.ok(min >= 0 && max > min, key);
    for (const key of ['headerPadY', 'headerPadX', 'headerRuleGap']) assert.ok(HEADER_GAPS[key].max * 0.75 <= 31, `${key} fits Word's 31 pt border space`);
  });

  it('headerGapsPt: an unset gap is the template\'s, a set one the stored px × 0.75, and a gap the template lacks stays null', async () => {
    const { headerGapsPt } = await loadModule('/src/constants/headerSpacing.js');
    const classic = headerGapsPt({}, 'classic', { contactLayout: 'justify', sectionGapPt: 12 });
    assert.deepEqual(classic, {
      nameTitleGap: 1, titleContactsGap: 3, contactGapX: 12, contactGapY: 1.5, iconTextGap: 2, photoTextGap: 10,
      summaryGap: 8, headerGapBelow: 15, headerRuleGap: 12, headerPadY: null, headerPadX: null, contactsSideGap: null,
    }, 'no headerInlineGap: resolveTemplateSettings resolves it as it always has');
    assert.equal(headerGapsPt({}, 'minimal', {}).summaryGap, 6);
    const set = headerGapsPt({ nameTitleGap: 8, headerGapBelow: 40, headerPadY: 20, contactGapX: 20 }, 'executive', { contactLayout: 'single', sectionGapPt: 12 });
    assert.equal(set.nameTitleGap, 6);
    assert.equal(set.headerGapBelow, 30);
    assert.equal(set.headerPadY, null, 'Executive has no banner: a stored banner padding is ignored');
    assert.equal(set.contactGapX, null, 'Single has no gap between contacts on a row');
    assert.equal(set.contactGapY, 2, 'Single\'s rows: 2 pt');
    assert.equal(headerGapsPt({}, 'classic', { contactLayout: 'Justify?' }).contactGapX, 12, 'any other layout prints as Justify (PdfContactRow)');
    assert.equal(headerGapsPt({}, 'classic', { sectionGapPt: 30 }).headerGapBelow, 30, 'Between Sections when wider than 15 pt');
    assert.equal(headerGapsPt({ headerGapBelow: 0 }, 'classic', { sectionGapPt: 30 }).headerGapBelow, 0, 'a set gap is the user\'s, even 0');
  });

  it('resolveTemplateSettings: the header gaps from the résumé\'s own settings, Contact Layout and Between Sections; headerInlineGap as before', async () => {
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    const s = resolveTemplateSettings({ contactLayout: '2grid', sectionGap: 40, summaryGap: 4, headerInlineGap: 20 }, 'minimal');
    assert.equal(s.headerGaps.contactGapY, 1.5, '2 Grid');
    assert.equal(s.headerGaps.contactGapX, null, '2 Grid');
    assert.equal(s.headerGaps.headerGapBelow, 30, 'Between Sections 40 px = 30 pt');
    assert.equal(s.headerGaps.summaryGap, 3);
    assert.equal(s.summaryGap, 4, 'the stored px stay as they are');
    assert.equal(s.headerInlineGap, 15, 'resolved as always: 20 px × 0.75');
    assert.equal(resolveTemplateSettings({}, 'classic').headerInlineGap, 6, '8 px when unset');
    assert.equal(resolveTemplateSettings({ sectionGap: 'abc' }, 'classic').headerGaps.headerGapBelow, 15, 'a sectionGap that is not a number kept 15 pt');
    assert.equal(resolveTemplateSettings({}, 'dark').headerGaps.summaryGap, 8, 'an unknown id: Classic\'s');
  });

  // Guard (D2): a gap stored in every new résumé would stop following its template.
  it('a new résumé stores no header gap but headerInlineGap, so each follows the template it prints with', async () => {
    const { ATS_DEFAULTS, defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const { HEADER_GAP_KEYS } = await loadModule('/src/constants/headerSpacing.js');
    for (const template of [...STACKED, 'modern', 'sidebar']) {
      assert.deepEqual(HEADER_GAP_KEYS.filter((k) => k in defaultSettings(template)), ['headerInlineGap'], template);
    }
    assert.equal(ATS_DEFAULTS.headerInlineGap, 8, 'the templates\' own 6 pt');
  });
});

/**
 * Where an anchor prints on page 1: its x, its right end, or its baseline's distance from the page
 * top. A bullet less than about 12 pt before its value reads as one run with it ("• alex@…"), so
 * a value after a bullet is measured by its right end.
 */
const A = {
  name: [P.name, 'y'], nameX: [P.name, 'x'], title: [P.title, 'y'], titleX: [P.title, 'x'],
  email: [P.email, 'y'], emailX: [P.email, 'x'], emailEnd: [P.email, 'end'], phone: [P.phone, 'y'], phoneX: [P.phone, 'x'],
  row2: [P.github, 'y'], summary: ['Summary line', 'y'], section: ['EXPERIENCE', 'y'],
};
function at(pg, anchor) {
  const [needle, axis] = A[anchor];
  const item = pg.items.find((t) => t.str.includes(needle));
  assert.ok(item, `"${needle}" prints`);
  return { x: item.x, end: item.x + item.w, y: pg.H - item.y }[axis];
}

/**
 * [key, the résumé's other settings, its personal details, what moves, what stays, how often the
 * gap repeats]. The gap is set to two values 8 px apart: what follows it moves 6 pt (8 px × 0.75)
 * per repeat, what comes before it not at all.
 */
const CASES = [
  ['nameTitleGap', {}, {}, ['title', 'email', 'summary', 'section'], ['name']],
  ['headerInlineGap', { headerLayout: 'inline' }, {}, ['titleX'], ['name', 'nameX', 'email']],
  ['titleContactsGap', {}, {}, ['email', 'row2', 'summary', 'section'], ['name', 'title']],
  ['titleContactsGap', {}, { title: '' }, ['email', 'section'], ['name']],
  ['titleContactsGap', { contactStyle: 'bar' }, {}, ['email', 'summary', 'section'], ['name', 'title']],
  ['titleContactsGap', { contactLayout: '2grid' }, {}, ['email', 'row2', 'section'], ['name', 'title']],
  ['contactGapX', {}, {}, ['phoneX'], ['emailX', 'email', 'title']],
  ['contactGapY', {}, {}, ['row2', 'summary', 'section'], ['email', 'title']],
  ['contactGapY', { contactLayout: 'single' }, {}, ['phone'], ['email', 'title']],
  ['contactGapY', { contactLayout: '2grid' }, {}, ['row2'], ['email', 'title'], 2], // github is on row 3 of 3
  ['iconTextGap', {}, {}, ['emailX'], ['email', 'nameX']],
  ['iconTextGap', { contactStyle: 'bullet', contactLayout: 'single' }, {}, ['emailEnd'], ['email', 'nameX']],
  ['photoTextGap', {}, { photo: PNG_2X2 }, ['nameX', 'emailX', 'titleX'], ['name']],
  ['photoTextGap', { headerAlign: 'center' }, { photo: PNG_2X2 }, ['name', 'email', 'section'], []],
  ['summaryGap', {}, {}, ['summary', 'section'], ['email', 'row2']],
  ['headerGapBelow', {}, {}, ['section'], ['summary', 'email']],
  ['headerRuleGap', { showHeaderBorder: true }, {}, ['section'], ['summary']],
];
const HIGH = { iconTextGap: 16 }; // the top of its range; every other case sets 16 and 24 px

describe('Classic, Minimal and Executive print the header gaps (header_spacing_spec.md)', () => {
  for (const template of STACKED) {
    for (const [key, settings, personal, moves, stays, times = 1] of CASES) {
      it(`${template}: ${key} ${JSON.stringify({ ...settings, ...personal }).replace(/"data:[^"]*"/, '(photo)')} moves ${moves.join(', ')} by exactly its gap, not ${stays.join(', ') || 'what precedes it'}`, async () => {
        const hi = HIGH[key] ?? 24;
        const [lo, up] = await Promise.all([page(template, { ...settings, [key]: hi - 8 }, personal), page(template, { ...settings, [key]: hi }, personal)]);
        const d = (anchor) => Math.round((at(up, anchor) - at(lo, anchor)) * 100) / 100;
        for (const m of moves) assert.ok(Math.abs(d(m) - 6 * times) < 0.02, `${m} moved ${d(m)} pt, want ${6 * times}`);
        for (const s of stays) assert.ok(Math.abs(d(s)) < 0.02, `${s} moved ${d(s)} pt, want 0`);
      });
    }
  }

  // Guard: the set path and the unset path are one path. Each value is the template's own gap in
  // px (pt ÷ 0.75), so set it prints what unset prints — which the golden check proved is what
  // the templates printed before the settings existed.
  it('every gap set to its template\'s own value prints exactly what unset prints', async () => {
    const OWN = (summaryGap) => ({
      nameTitleGap: 4 / 3, titleContactsGap: 4, contactGapX: 16, iconTextGap: 8 / 3, photoTextGap: 40 / 3,
      summaryGap, headerGapBelow: 20, headerRuleGap: 16,
    });
    const STATES = [
      [{}, {}], [{ contactLayout: 'single' }, { photo: PNG_2X2 }], [{ contactLayout: '2grid', showHeaderBorder: true }, {}],
      [{ headerAlign: 'center', contactStyle: 'bar' }, { photo: PNG_2X2 }], [{ headerLayout: 'inline', contactStyle: 'bullet' }, { title: '' }],
    ];
    for (const template of STACKED) {
      for (const [settings, personal] of STATES) {
        const rows = { single: 8 / 3 }[settings.contactLayout] ?? 2;
        const own = { ...OWN(template === 'classic' ? 32 / 3 : 8), contactGapY: rows };
        assert.equal(await drawn(template, { ...settings, ...own }, personal), await drawn(template, settings, personal),
          `${template} ${JSON.stringify(settings)}: set to its own values`);
      }
    }
  });

  it('a stored gap outside its range prints at the range\'s end; one that is not a number prints as unset (D9)', async () => {
    for (const template of STACKED) {
      assert.equal(await drawn(template, { headerGapBelow: 10000 }), await drawn(template, { headerGapBelow: 80 }), `${template}: 10000 px prints as 80`);
      assert.notEqual(await drawn(template, { headerGapBelow: 80 }), await drawn(template), `${template}: 80 px is not unset`);
      assert.equal(await drawn(template, { nameTitleGap: -5 }), await drawn(template, { nameTitleGap: 0 }), `${template}: -5 px prints as 0`);
      for (const junk of ['12', null, true]) {
        assert.equal(await drawn(template, { nameTitleGap: junk, summaryGap: junk }), await drawn(template), `${template}: ${JSON.stringify(junk)} prints as unset`);
      }
    }
  });

  it('at every gap\'s minimum and at its maximum, every contact is read whole and in order (ATS)', async () => {
    const { HEADER_GAPS } = await loadModule('/src/constants/headerSpacing.js');
    const ends = (end) => Object.fromEntries(Object.entries(HEADER_GAPS).map(([k, r]) => [k, r[end]]));
    for (const template of STACKED) {
      for (const end of ['min', 'max']) {
        const bytes = await render(make(template, { ...ends(end), showHeaderBorder: true }));
        // pdftotext's reading-order mode reorders wrapped Icon + Justify contacts whatever the gaps
        // (header_spacing_spec.md, side findings — the ATS lane's): -raw and -layout, as there.
        const readers = [['pdf.js', allText(await read(bytes))], ...pdftotext(bytes).filter(([name]) => !name.includes('reading order'))];
        for (const [reader, text] of readers) {
          const flat = text.replace(/\s+/g, ' ');
          const found = CONTACTS.map((c) => flat.indexOf(c));
          assert.ok(found.every((i, k) => i >= 0 && (k === 0 || i > found[k - 1])), `${template} ${end} ${reader}: ${JSON.stringify(found)}\n${flat.slice(0, 300)}`);
        }
      }
    }
  });

  // Guard, until the letterhead takes the résumé's gaps in its own batch (header_spacing_spec.md
  // D5 — this test then becomes its "follows the résumé" test): the letterhead keeps its own
  // spacing. PdfContactRow takes gaps only from its `gaps` prop, never from the résumé's resolved
  // settings the letter passes it — they carry the résumé's Contact Layout, not the letter's.
  it('the cover letter keeps its letterhead\'s spacing whatever header gaps the résumé sets', async () => {
    const SET = { nameTitleGap: 20, titleContactsGap: 20, contactGapX: 30, contactGapY: 12, iconTextGap: 10, photoTextGap: 30, headerGapBelow: 60, headerRuleGap: 30 };
    for (const template of [...STACKED, 'modern', 'sidebar']) {
      for (const coverLetter of [{ fieldsPosition: 'below-name', headerLayout: 'single' }, { fieldsPosition: 'right' }]) {
        const letter = async (settings) => drawing(await renderCover(make(template, settings, { photo: PNG_2X2 }, coverLetter)));
        assert.equal(await letter(SET), await letter({}), `${template} ${JSON.stringify(coverLetter)}`);
      }
    }
  });
});
