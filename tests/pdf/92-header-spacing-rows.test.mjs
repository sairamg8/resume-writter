// R2-137: Personal Info → Header Customization → Header spacing offers the header gaps that had no
// control — Contacts ↔ Summary (summaryGap), Text ↔ Border (headerRuleGap), the banner's padding
// (headerPadY, headerPadX) and Header ↔ First section (headerGapBelow) — each only where it moves
// something. Modern printed its banner's 15 / 18 pt padding, the 8 pt above its summary and Between
// Sections under the banner as constants, and the Sidebar column Between Sections under its name, so a
// stored value changed nothing there; the letter's Modern band and the gap under every letterhead, and
// Word's space above the summary and under the header, kept their own. Now each value moves what
// follows its gap by exactly its change, and unset every template prints what it always printed.
// contactsSideGap has no row there: no résumé header prints it. It is the letter's space between the name
// and the contacts on its right, a constant 12 pt: Cover Letter → Header Layout offers it under Right of
// Name, and the letterhead prints it; Personal Info's Reset leaves it to the letter's own ↺.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, renderCover, renderDocx, read, readDocx, loadModule, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';

before(setup);
after(teardown);

const P = {
  name: 'Alex Johnson', title: 'Senior Engineer', email: 'alex@example.com', phone: '+1 555 0100',
  summary: '<p>Summary line of an experienced engineer.</p>',
};
const LETTER = { date: '2026-01-15', recipientName: 'Jane Smith', body: '<p>Body line.</p>' };
const cv = (template, settings = {}, personal = {}, coverLetter = {}) =>
  resume({ template, settings, personal: { ...P, ...personal }, coverLetter: { ...LETTER, ...coverLetter }, sections: [experience([{}])] });
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.02, `${at}: ${a} vs ${b}`);
const drawn = async (...args) => drawing(await render(cv(...args)));
/** Stacked headers: every template but Modern's banner and the Sidebar column. */
const STACKED = ['classic', 'minimal', 'executive', 'timeline', 'banner', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet'];

/** Where each anchor prints on page 1: its x, and its baseline's depth from the page top, pt. */
async function anchors(bytes) {
  const [page] = await read(bytes);
  const out = {};
  for (const [k, s] of Object.entries({ name: P.name, title: P.title, email: P.email, summary: 'Summary line', section: 'Company 1', recipient: 'Jane Smith' })) {
    const t = page.items.find((i) => i.str.includes(s));
    if (t) { out[k] = page.H - t.y; out[`${k}X`] = t.x; }
  }
  return out;
}

/**
 * [template, key, other settings, what moves — anchor: how many times the gap it moves by — and what
 * stays]. The gap is set to 4 and 36 px: what follows it moves 24 pt per time, what precedes it not at all.
 */
const MOVES = [
  ['modern', 'summaryGap', {}, { summary: 1, section: 1 }, ['name', 'title', 'email']],
  ['modern', 'headerGapBelow', {}, { section: 1 }, ['name', 'email', 'summary']],
  ['modern', 'headerPadY', {}, { name: 1, email: 1, summary: 1, section: 2 }, []],
  ['modern', 'headerPadX', {}, { nameX: 1, emailX: 1, summaryX: 1 }, ['name', 'sectionX']],
  // The column's name block ↔ its Contact; the main column (the summary's About Me, the sections) stays.
  ['sidebar', 'headerGapBelow', {}, { email: 1 }, ['name', 'title', 'summary', 'section']],
  ...STACKED.flatMap((t) => [
    [t, 'summaryGap', {}, { summary: 1, section: 1 }, ['name', 'email']],
    [t, 'headerGapBelow', {}, { section: 1 }, ['name', 'email', 'summary']],
    // Banner draws its rule on the band, over the summary under it; the others under the summary.
    [t, 'headerRuleGap', { showHeaderBorder: true }, t === 'banner' ? { summary: 1, section: 1 } : { section: 1 }, t === 'banner' ? ['name', 'email'] : ['name', 'email', 'summary']],
  ]),
  ['banner', 'headerPadY', {}, { summary: 1, section: 1 }, ['name', 'email']],
];

describe('the gaps under the header move the résumé PDF by exactly their change', () => {
  for (const [template, key, settings, moves, stays] of MOVES) {
    it(`${template}: ${key}${Object.keys(settings).length ? ` ${JSON.stringify(settings)}` : ''} moves ${Object.keys(moves).join(', ')}; not ${stays.join(', ') || 'what precedes it'}`, async () => {
      const [lo, hi] = await Promise.all([4, 36].map(async (px) => anchors(await render(cv(template, { ...settings, [key]: px })))));
      for (const [a, times] of Object.entries(moves)) near(hi[a] - lo[a], 24 * times, `${template} ${key}: ${a}`);
      for (const a of stays) near(hi[a], lo[a], `${template} ${key}: ${a} stays`);
    });
  }

  it('a stored value out of range prints at its end; one that is not a number prints as unset', async () => {
    for (const [template, key, max] of [['modern', 'headerPadY', 40], ['modern', 'headerPadX', 40], ['modern', 'summaryGap', 48], ['modern', 'headerGapBelow', 80], ['sidebar', 'headerGapBelow', 80]]) {
      assert.equal(await drawn(template, { [key]: 1000 }), await drawn(template, { [key]: max }), `${template} ${key}: 1000 → ${max}`);
      assert.equal(await drawn(template, { [key]: -5 }), await drawn(template, { [key]: 0 }), `${template} ${key}: -5 → 0`);
      assert.equal(await drawn(template, { [key]: 'abc' }), await drawn(template), `${template} ${key}: 'abc' → unset`);
    }
  });

  it('a stored gap a template does not print changes nothing there', async () => {
    const none = { summaryGap: 40, headerRuleGap: 40, headerPadY: 40, headerPadX: 40, showHeaderBorder: true };
    assert.equal(await drawn('sidebar', none), await drawn('sidebar', { showHeaderBorder: true }), 'the Sidebar column: no summary gap, rule or banner');
    assert.equal(await drawn('modern', { headerRuleGap: 40, showHeaderBorder: true }), await drawn('modern', { showHeaderBorder: true }), 'Modern: no rule');
    for (const t of ['classic', 'minimal', 'executive', 'timeline', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet']) {
      assert.equal(await drawn(t, { headerPadY: 40, headerPadX: 40 }), await drawn(t), `${t}: no banner`);
    }
    assert.equal(await drawn('banner', { headerPadX: 40 }), await drawn('banner'), 'Banner: its text keeps the page margins');
    assert.equal(await drawn('classic', { headerRuleGap: 40 }), await drawn('classic'), 'Classic with its border off: no rule to pad');
  });
});

// Guard: unset, Modern and the Sidebar print the constants they printed before the keys reached them
// (px-6 py-5 → 18 / 15 pt, the summary's 8 pt, Between Sections) — the drawing of those values set
// is the unset drawing, at the default and at other Between Sections.
describe('unset, every template prints the header it always printed', () => {
  for (const settings of [{}, { sectionGap: 40 }, { sectionGap: 0 }]) {
    it(`Modern and the Sidebar, Between Sections ${settings.sectionGap ?? 16} px`, async () => {
      const between = settings.sectionGap ?? 16;
      assert.equal(await drawn('modern', { ...settings, headerPadY: 20, headerPadX: 24, summaryGap: 32 / 3, headerGapBelow: between }), await drawn('modern', settings), 'modern');
      assert.equal(await drawn('sidebar', { ...settings, headerGapBelow: between }), await drawn('sidebar', settings), 'sidebar');
    });
  }

  it('Banner, Timeline, Academic and Compact: each gap set to the template\'s own prints the unset page', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of ['timeline', 'banner', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet']) {
      const base = cv(t, { showHeaderBorder: true });
      const sectionGapPt = base.settings.sectionGap * 0.75;
      const own = Object.fromEntries(['summaryGap', 'headerGapBelow', 'headerRuleGap', 'headerPadY']
        .map((k) => [k, templateGapPt(t, k, { sectionGapPt })]).filter(([, pt]) => pt != null).map(([k, pt]) => [k, pt / 0.75]));
      assert.equal(await drawing(await render(cv(t, { showHeaderBorder: true, ...own }))), await drawing(await render(base)), t);
    }
  });
});

describe('the rows (Personal Info → Header Customization → Header spacing)', () => {
  const rowsOf = async () => (await loadModule('/src/utils/headerSpacingRows.js')).headerGapRows;
  const NEW = ['summaryGap', 'headerRuleGap', 'headerPadY', 'headerPadX', 'headerGapBelow'];

  it('each new row is offered where its gap prints, after the contacts, top to bottom as the header prints them', async () => {
    const headerGapRows = await rowsOf();
    const keys = (t, s = {}, p = P) => headerGapRows(t, s, p).map((r) => r.key).filter((k) => NEW.includes(k));
    // Classic's own border is on where the résumé stores none; a new résumé stores it off.
    assert.deepEqual(keys('classic'), ['summaryGap', 'headerRuleGap', 'headerGapBelow'], 'classic, its border unset');
    for (const t of ['classic', 'minimal', 'executive', 'timeline', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet']) {
      assert.deepEqual(keys(t, { showHeaderBorder: false }), ['summaryGap', 'headerGapBelow'], t);
      assert.deepEqual(keys(t, { showHeaderBorder: true }), ['summaryGap', 'headerRuleGap', 'headerGapBelow'], `${t}: border on`);
    }
    assert.deepEqual(keys('banner', { showHeaderBorder: true }), ['headerRuleGap', 'headerPadY', 'summaryGap', 'headerGapBelow'], 'banner: the summary prints under the band');
    assert.deepEqual(keys('modern', { showHeaderBorder: true }), ['summaryGap', 'headerPadY', 'headerPadX', 'headerGapBelow'], 'modern: no rule');
    assert.deepEqual(keys('sidebar', { showHeaderBorder: true }), ['headerGapBelow'], 'the Sidebar column');
    assert.deepEqual(keys('sidebar', { sidebarSingleColumn: true, showHeaderBorder: true }), keys('classic', { showHeaderBorder: true }), 'its single column prints Classic\'s header');
    for (const t of TEMPLATES) {
      assert.ok(!keys(t, {}, { ...P, summary: '' }).includes('summaryGap'), `${t}: no summary`);
      assert.ok(!keys(t, {}, { ...P, summary: '<p></p>' }).includes('summaryGap'), `${t}: an empty summary prints nothing`);
      assert.ok(!keys(t, {}, { ...P, hiddenFields: ['summary'] }).includes('summaryGap'), `${t}: summary hidden`);
      assert.ok(!headerGapRows(t, { showHeaderBorder: true }, P).some((r) => r.key === 'contactsSideGap'), `${t}: the letter's own gap`);
    }
    const all = headerGapRows('classic', { showHeaderBorder: true }, P).map((r) => r.key);
    assert.deepEqual(all.slice(-3), ['summaryGap', 'headerRuleGap', 'headerGapBelow'], 'after the contact rows');
  });

  it('each is named for what it spaces, starts from the template\'s own and takes the range the engine clamps to', async () => {
    const headerGapRows = await rowsOf();
    const row = (t, key, s = {}, p = P) => headerGapRows(t, { showHeaderBorder: true, ...s }, p).find((r) => r.key === key);
    const shape = (r) => [r.label, r.name, r.set, r.min, r.max, Math.round(r.valuePx * 100) / 100];
    assert.deepEqual(shape(row('classic', 'summaryGap')), ['Contacts ↔ Summary', 'Contacts to summary spacing', false, 0, 48, 10.67]);
    assert.deepEqual(shape(row('minimal', 'summaryGap')), ['Contacts ↔ Summary', 'Contacts to summary spacing', false, 0, 48, 8]);
    assert.deepEqual(shape(row('modern', 'summaryGap')), ['Contacts ↔ Summary', 'Contacts to summary spacing', false, 0, 48, 10.67]);
    assert.deepEqual(shape(row('banner', 'summaryGap')), ['Banner ↔ Summary', 'Banner to summary spacing', false, 0, 48, 16]);
    assert.deepEqual(row('classic', 'summaryGap', {}, { ...P, email: '', phone: '' }).label, 'Title ↔ Summary', 'no contacts');
    assert.deepEqual(row('classic', 'summaryGap', {}, { ...P, email: '', phone: '', title: '' }).label, 'Name ↔ Summary', 'no contacts, no title');
    assert.deepEqual(shape(row('classic', 'headerRuleGap')), ['Text ↔ Border', 'Text to border spacing', false, 0, 40, 16]);
    assert.deepEqual(shape(row('modern', 'headerPadY')), ['Banner top & bottom', 'Banner top and bottom padding', false, 0, 40, 20]);
    assert.deepEqual(shape(row('modern', 'headerPadX')), ['Banner sides', 'Banner side padding', false, 0, 40, 24]);
    assert.deepEqual(shape(row('banner', 'headerPadY')), ['Banner padding', 'Banner padding under the text', false, 0, 40, 26.67]);
    assert.deepEqual(shape(row('classic', 'headerGapBelow')), ['Header ↔ First section', 'Header to first section spacing', false, 0, 80, 20]);
    assert.deepEqual(shape(row('modern', 'headerGapBelow')).slice(-1), [16], 'Modern: Between Sections');
    assert.deepEqual(shape(row('sidebar', 'headerGapBelow')).slice(-1), [16], 'the Sidebar column: Between Sections');
    assert.deepEqual(shape(row('academic', 'headerGapBelow')).slice(-1), [16], 'Academic: its 12 pt');
    // The gap under the header follows Between Sections where it is wider, as the PDF resolves it.
    assert.equal(row('classic', 'headerGapBelow', { sectionGap: 40 }).valuePx, 40);
    assert.equal(row('modern', 'headerGapBelow', { sectionGap: 8 }).valuePx, 8);
    assert.equal(row('classic', 'headerGapBelow', { sectionGap: 8 }).valuePx, 20, 'Classic keeps 15 pt under a narrower one');
    // Set, clamped; a stored value that is what the template prints anyway is not a choice (AUD-34).
    assert.deepEqual([row('classic', 'headerGapBelow', { headerGapBelow: 100 }).valuePx, row('classic', 'headerGapBelow', { headerGapBelow: 100 }).set], [80, true]);
    assert.equal(row('classic', 'headerGapBelow', { headerGapBelow: 20 }).set, false, 'Classic\'s own 15 pt');
    assert.equal(row('classic', 'headerGapBelow', { headerGapBelow: 40, sectionGap: 40 }).set, false, 'Between Sections\' own 30 pt');
    assert.equal(row('classic', 'headerGapBelow', { headerGapBelow: 20, sectionGap: 40 }).set, true, 'narrower than Between Sections');
    assert.equal(row('modern', 'headerPadX', { headerPadX: 30 }).set, true);
  });

  it('the panel shows them, and Reset still clears every gap', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const { headerGapKeysSet } = await loadModule('/src/utils/headerSpacingRows.js');
    const html = (template, s = {}) => renderToString(createElement(HeaderCustomization, {
      s, set() {}, clear() {}, personal: P, template, templateLabel: template, open: true, onToggle() {},
    }));
    assert.match(html('classic', { showHeaderBorder: true }), /data-gap="summaryGap"[\s\S]*?aria-label="Contacts to summary spacing \(px\)"[\s\S]*data-gap="headerRuleGap"[\s\S]*?aria-label="Text to border spacing \(px\)"[\s\S]*data-gap="headerGapBelow"[\s\S]*?aria-label="Header to first section spacing \(px\)"/);
    assert.match(html('modern'), /data-gap="headerPadY"[\s\S]*?aria-label="Banner top and bottom padding \(px\)"[\s\S]*?value="20"[\s\S]*data-gap="headerPadX"[\s\S]*?aria-label="Banner side padding \(px\)"[\s\S]*?value="24"/);
    assert.match(html('sidebar'), /data-gap="headerGapBelow"/);
    assert.doesNotMatch(html('sidebar'), /data-gap="summaryGap"/);
    assert.deepEqual(headerGapKeysSet('modern', { headerPadY: 30, headerGapBelow: 40, summaryGap: 2 }).toSorted(), ['headerGapBelow', 'headerPadY', 'summaryGap']);
  });
});

describe('the cover letter follows them where its letterhead prints the same gap', () => {
  it('every letter: the space under its letterhead is the résumé\'s Header ↔ First section, else its own 16 pt', async () => {
    for (const template of TEMPLATES) {
      const at = async (settings) => (await anchors(await renderCover(cv(template, settings)))).recipient;
      const unset = await at({});
      near(await at({ headerGapBelow: 40 }) - unset, 30 - 16, `${template}: 40 px`);
      near(await at({ headerGapBelow: 0 }) - unset, -16, `${template}: 0 px`);
      assert.equal(await drawing(await renderCover(cv(template, { headerGapBelow: 64 / 3 }))), await drawing(await renderCover(cv(template))), `${template}: its own 16 pt, set, prints the unset letter`);
    }
  });

  it('Modern\'s band is padded as the résumé\'s banner: Banner top & bottom and Banner sides, else 15 / 18 pt', async () => {
    const at = async (settings) => anchors(await renderCover(cv('modern', settings)));
    const unset = await at({});
    const set = await at({ headerPadY: 40, headerPadX: 40 });
    near(set.name - unset.name, 30 - 15, 'the name under the band\'s top');
    near(set.nameX - unset.nameX, 30 - 18, 'the name inside the band\'s side');
    near(set.recipient - unset.recipient, 2 * (30 - 15), 'the letter under the band');
    assert.equal(await drawing(await renderCover(cv('modern', { headerPadY: 20, headerPadX: 24 }))), await drawing(await renderCover(cv('modern'))), 'set to its own, the unset letter');
  });

  it('in Word: the letterhead\'s last row keeps the gap under it, and Modern\'s band its padding', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const docx = async (template, settings) => readDocx(new Uint8Array(await (await renderCoverLetterDocx(cv(template, settings, { email: '', phone: '' }))).arrayBuffer()));
    const titleRow = (doc) => doc.paragraphs.find((p) => p.text.includes(P.title)).xml;
    const after = (doc) => Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(titleRow(doc))[1]);
    // Classic with its border off adds its 12 pt pad; a band adds none (the letter's PDF).
    assert.equal(after(await docx('classic', {})), 560, '16 + 12 pt');
    assert.equal(after(await docx('classic', { headerGapBelow: 40 })), 840, '30 + 12 pt');
    assert.equal(after(await docx('modern', {})), 320, '16 pt under the band');
    assert.equal(after(await docx('modern', { headerGapBelow: 40 })), 600, '30 pt under the band');
    const band = (doc) => [/<w:top [^>]*w:space="(\d+)"/.exec(titleRow(doc))?.[1], /<w:ind [^>]*w:left="(\d+)"/.exec(titleRow(doc))?.[1]].map(Number);
    assert.deepEqual(band(await docx('modern', {})), [15, 360], 'its own 15 pt band, 18 pt in');
    assert.deepEqual(band(await docx('modern', { headerPadY: 40, headerPadX: 40 })), [30, 600], 'the résumé banner\'s 30 / 30 pt');
  });
});

describe('Word follows a set gap above the summary and under the header, and keeps its own otherwise', () => {
  const xmlParas = (doc) => doc.xml.split('</w:p>');
  const afterOf = (xml) => Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(xml)?.[1]);
  const afterText = (doc, needle) => afterOf(doc.paragraphs.find((p) => p.text.includes(needle)).xml);
  /** The paragraph closing the header: the first after the summary. */
  const headerEnd = (doc) => { const all = xmlParas(doc); return all[all.findIndex((p) => p.includes('Summary line')) + 1]; };

  for (const template of TEMPLATES) {
    const has = template !== 'sidebar'; // the Sidebar prints its summary as the main column's About Me
    it(`${template}: Contacts ↔ Summary${has ? '' : ' (none: a stored one changes nothing)'} and Header ↔ First section`, async () => {
      assert.equal(afterText(await renderDocx(cv(template)), P.phone), 80, 'the contacts: Word\'s own 4 pt');
      assert.equal(afterText(await renderDocx(cv(template, { summaryGap: 20 })), P.phone), has ? 300 : 80, '20 px = 15 pt');
      assert.equal(afterText(await renderDocx(cv(template, { summaryGap: 20 }, { summary: '' })), P.phone), 80, 'no summary: nothing to space');
      assert.equal(afterText(await renderDocx(cv(template, { summaryGap: 20 }, { email: '', phone: '' })), P.title), has ? 300 : 60, 'no contacts: the title');
      assert.equal(afterOf(headerEnd(await renderDocx(cv(template)))), 80, 'the header\'s end: Word\'s own 4 pt');
      assert.equal(afterOf(headerEnd(await renderDocx(cv(template, { headerGapBelow: 40 })))), 600, '40 px = 30 pt');
    });
  }

  it('Classic with its rule: the rule\'s paragraph keeps the gap under it', async () => {
    const doc = await renderDocx(cv('classic', { showHeaderBorder: true, headerGapBelow: 40 }));
    assert.match(headerEnd(doc), /<w:bottom [^>]*w:val="single"/);
    assert.equal(afterOf(headerEnd(doc)), 600);
  });
});

describe('the letter\'s Name ↔ Contacts (contactsSideGap): Cover Letter → Header Layout, Right of Name', () => {
  /** Whether the letter prints its contacts beside the name (else they fell under it for want of room). */
  const beside = async (name, settings) => {
    const [page] = await read(await renderCover(cv('classic', settings, { name, photo: '' })));
    const depth = (s) => page.H - page.items.find((i) => i.str.includes(s)).y;
    return depth(P.email) < depth(name) + 4;
  };

  it('the gap is the least room between the name and the contacts: wider, a name that fitted beside them puts them under it', async () => {
    // A one-word name grown until the contacts no longer fit beside it at the widest gap.
    let found = null;
    for (let n = 8; n <= 60 && !found; n += 2) {
      const name = 'M'.repeat(n);
      if (!(await beside(name, { contactsSideGap: 48 })) && await beside(name, { contactsSideGap: 0 })) found = name;
    }
    assert.ok(found, 'some name fits beside the contacts at 0 px and not at 48 px');
    const at = async (settings) => drawing(await renderCover(cv('classic', settings, { name: found, photo: '' })));
    assert.equal(await at({ contactsSideGap: 16 }), await at({}), 'unset: the letter\'s own 12 pt (16 px)');
    assert.equal(await at({ contactsSideGap: 1000 }), await at({ contactsSideGap: 48 }), 'clamped to 48 px');
    assert.equal(await at({ contactsSideGap: 'abc' }), await at({}), 'not a number: unset');
  });

  it('under Below Name or Below Everything, and on the résumé, it changes nothing', async () => {
    for (const fieldsPosition of ['below-name', 'below-all']) {
      const at = async (settings) => drawing(await renderCover(cv('classic', settings, {}, { fieldsPosition })));
      assert.equal(await at({ contactsSideGap: 48 }), await at({}), fieldsPosition);
    }
    for (const t of TEMPLATES) assert.equal(await drawn(t, { contactsSideGap: 48 }), await drawn(t), `${t}: the résumé`);
  });

  it('Personal Info\'s Reset neither turns on for it nor clears it: it is the letter\'s, reset in the letter\'s panel', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const { headerGapKeysSet } = await loadModule('/src/utils/headerSpacingRows.js');
    const { mount, elements, reactProps } = await import('./fake-dom.mjs');
    assert.deepEqual(headerGapKeysSet('classic', { contactsSideGap: 30 }), [], 'nothing of the résumé\'s header is set');
    const reset = async (s) => {
      let cleared = null;
      const view = mount(HeaderCustomization, {
        s, set() {}, clear(keys) { cleared = keys; }, personal: P, template: 'classic', templateLabel: 'Classic', open: true, onToggle() {},
      });
      try {
        const btn = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.includes('Reset') && el.getAttribute('aria-label') === 'Reset header spacing to the template\'s');
        if (reactProps(btn).disabled) return 'disabled';
        view.act(() => reactProps(btn).onClick());
        return cleared;
      } finally { await view.unmount(); }
    };
    assert.equal(await reset({ contactsSideGap: 30 }), 'disabled', 'only the letter\'s gap set: nothing to reset here');
    const cleared = await reset({ contactsSideGap: 30, headerGapBelow: 40 });
    assert.ok(cleared.includes('headerGapBelow') && cleared.includes('photoTextGap'), 'the résumé\'s gaps, shown or not');
    assert.ok(!cleared.includes('contactsSideGap'), 'the letter keeps its Name ↔ Contacts');
  });

  it('the panel offers it under Right of Name only, from the letter\'s own 16 px', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    const html = (coverLetter, settings = {}) => renderToString(createElement(CoverLetterPanel, {
      resume: cv('classic', settings), coverLetter: { ...LETTER, ...coverLetter }, personal: P, settings, template: 'classic',
      updateCoverLetter() {}, updateSetting() {}, clearSettings() {},
    }));
    assert.match(html({ fieldsPosition: 'right' }), /data-gap="contactsSideGap"[\s\S]*?aria-label="Name to contacts spacing \(px\)"[\s\S]*?value="16"/);
    assert.match(html({ fieldsPosition: 'right' }, { contactsSideGap: 30 }), /data-gap="contactsSideGap"[\s\S]*?value="30"/);
    assert.doesNotMatch(html({ fieldsPosition: 'below-name' }), /data-gap="contactsSideGap"/);
    assert.doesNotMatch(html({ fieldsPosition: 'below-all' }), /data-gap="contactsSideGap"/);
  });
});
