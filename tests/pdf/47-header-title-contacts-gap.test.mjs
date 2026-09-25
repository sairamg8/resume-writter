// Personal Info → Header Customization → Header spacing → Title ↔ Contacts ("Name ↔ Contacts" without a
// title) (header_spacing_spec.md). The engine had `titleContactsGap` since the spec for Classic,
// Minimal and Executive (PdfContactRow's 3 pt), but no control set it, and Modern (its 4 pt), the cover
// letter (4 / 5 pt) and Word ignored it. The Sidebar has no such gap: its contacts are a section of
// the column. Each value moves the contacts — and what follows them — by exactly the change.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, renderDocx, read, readDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = {
  name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100',
  summary: '<p>Summary line of an engineer.</p>',
};
const NO_CONTACTS = { ...PERSONAL, email: '', phone: '' };
/** The templates' own Title ↔ Contacts, pt (TEMPLATES' headerGaps.titleContactsGap); the Sidebar has none. */
const OWN = { classic: 3, minimal: 3, executive: 3, modern: 4, sidebar: null, timeline: 3, banner: 3, academic: 3, compact: 3, gridline: 3, registry: 3, bookend: 3, lectern: 3, chronicle: 3, keystone: 3, banded: 3, keel: 3, linen: 3, broadsheet: 3 };
const WITH_GAP = TEMPLATES.filter((t) => OWN[t] != null);
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.01, `${at}: ${a} vs ${b}`);

/** Page 1's name, title, first contact and summary: y down from the page top, pt. */
async function header(bytes) {
  const [page] = await read(bytes);
  const y = (s) => { const t = page.items.find((i) => i.str.includes(s)); return t && page.H - t.y; };
  return { name: y('Jordan Rivera'), title: y('Staff Engineer'), contact: y('jordan@example.com'), summary: y('Summary line') };
}
// Stacked, as every template stacks the name and title but Compact, which prints them Inline where it is picked (T9).
const cv = (template, settings = {}, personal = PERSONAL, coverLetter = {}) => resume({ template, settings: { headerLayout: 'stack', ...settings }, personal, coverLetter });

describe('Title ↔ Contacts in the résumé PDF', () => {
  it('pins the templates\' own gaps the row starts from', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of TEMPLATES) assert.equal(templateGapPt(t, 'titleContactsGap'), OWN[t], t);
  });

  for (const template of WITH_GAP) {
    it(`${template}: each value moves the contacts and the summary by exactly its change; the name and title stay`, async () => {
      const unset = await header(await render(cv(template)));
      for (const px of [0, 12, 40]) {
        const set = await header(await render(cv(template, { titleContactsGap: px })));
        const delta = px * 0.75 - OWN[template];
        near(set.name, unset.name, `${template} ${px}px: name`);
        near(set.title, unset.title, `${template} ${px}px: title`);
        near(set.contact - unset.contact, delta, `${template} ${px}px: first contact`);
        near(set.summary - unset.summary, delta, `${template} ${px}px: summary`);
      }
    });

    it(`${template}: without a title it is the name's gap to the contacts`, async () => {
      const personal = { ...PERSONAL, title: '' };
      const unset = await header(await render(cv(template, {}, personal)));
      const set = await header(await render(cv(template, { titleContactsGap: 20 }, personal)));
      near(set.name, unset.name, `${template}: name`);
      near(set.contact - unset.contact, 15 - OWN[template], `${template}: first contact`);
    });

    it(`${template}: a stored value out of range is clamped, and one that is not a number prints as unset`, async () => {
      const at = async (v) => (await header(await render(cv(template, { titleContactsGap: v })))).contact;
      near(await at(100), await at(40), `${template}: 100 → 40`);
      near(await at(-5), await at(0), `${template}: -5 → 0`);
      near(await at('abc'), (await header(await render(cv(template)))).contact, `${template}: 'abc' → unset`);
    });

    it(`${template}: with no contact the gap changes nothing`, async () => {
      const unset = await header(await render(cv(template, {}, NO_CONTACTS)));
      const set = await header(await render(cv(template, { titleContactsGap: 40 }, NO_CONTACTS)));
      assert.deepEqual(set, unset, template);
    });
  }

  it('sidebar: the column has no such gap, and a stored one (from another template) changes nothing', async () => {
    assert.deepEqual(await header(await render(cv('sidebar', { titleContactsGap: 40 }))), await header(await render(cv('sidebar'))));
  });

  for (const template of ['classic', 'minimal', 'executive', 'timeline', 'banner', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet']) {
    it(`${template}: Inline — the contacts under the name and title's line move by the change`, async () => {
      const unset = await header(await render(cv(template, { headerLayout: 'inline' })));
      const set = await header(await render(cv(template, { headerLayout: 'inline', titleContactsGap: 20 })));
      near(set.title, unset.title, `${template}: title`);
      near(set.contact - unset.contact, 15 - 3, `${template}: first contact`);
    });
  }
});

describe('Title ↔ Contacts in the cover letter', () => {
  /** The letterhead's own gap above the contacts by Fields Position; beside the name (Right) it has none. */
  const LETTER_OWN = { 'below-name': 4, 'below-all': 5 };
  for (const template of TEMPLATES) {
    for (const fieldsPosition of ['below-name', 'below-all']) {
      it(`${template} ${fieldsPosition}: the contacts follow the résumé's set value, else the letterhead's own ${LETTER_OWN[fieldsPosition]} pt`, async () => {
        // Left-aligned (Academic's own header is centred, T8; the centred letterhead is tested below).
        const unset = await header(await renderCover(cv(template, { headerAlign: 'left' }, PERSONAL, { fieldsPosition })));
        const set = await header(await renderCover(cv(template, { headerAlign: 'left', titleContactsGap: 20 }, PERSONAL, { fieldsPosition })));
        near(set.name, unset.name, `${template}: name`);
        near(set.title, unset.title, `${template}: title`);
        near(set.contact - unset.contact, 15 - LETTER_OWN[fieldsPosition], `${template}: first contact`);
      });
    }
  }

  it('a centred letterhead: the contacts under the title follow it, else 4 pt', async () => {
    const unset = await header(await renderCover(cv('classic', { headerAlign: 'center' })));
    const set = await header(await renderCover(cv('classic', { headerAlign: 'center', titleContactsGap: 20 })));
    near(set.contact - unset.contact, 15 - 4, 'first contact');
  });

  it('without a title, the contacts under the name follow it', async () => {
    const personal = { ...PERSONAL, title: '' };
    const unset = await header(await renderCover(cv('classic', {}, personal, { fieldsPosition: 'below-name' })));
    const set = await header(await renderCover(cv('classic', { titleContactsGap: 20 }, personal, { fieldsPosition: 'below-name' })));
    near(set.contact - unset.contact, 15 - 4, 'first contact');
  });

  it('Right of Name: the contacts sit beside the name, and the gap changes nothing', async () => {
    const r = (s) => cv('classic', s, PERSONAL, { fieldsPosition: 'right' });
    assert.deepEqual(await header(await renderCover(r({ titleContactsGap: 40 }))), await header(await renderCover(r())));
  });
});

describe('Title ↔ Contacts in Word', () => {
  const spaceAfter = (doc, needle) => Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(doc.paragraphs.find((p) => p.text.includes(needle)).xml)?.[1]);
  const letterDocx = async (r) => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  };

  for (const template of WITH_GAP) {
    it(`${template}: the paragraph before the contacts keeps Word's own spacing unset, and takes the set value`, async () => {
      assert.equal(spaceAfter(await renderDocx(cv(template)), 'Staff Engineer'), 60);
      assert.equal(spaceAfter(await renderDocx(cv(template, { titleContactsGap: 20 })), 'Staff Engineer'), 300, '20 px = 15 pt = 300 twips');
      const noTitle = { ...PERSONAL, title: '' };
      assert.equal(spaceAfter(await renderDocx(cv(template, {}, noTitle)), 'Jordan Rivera'), 40, 'no title: the name, unset');
      assert.equal(spaceAfter(await renderDocx(cv(template, { titleContactsGap: 20 }, noTitle)), 'Jordan Rivera'), 300, 'no title: the name');
      assert.equal(spaceAfter(await renderDocx(cv(template, { titleContactsGap: 20 }, NO_CONTACTS)), 'Staff Engineer'), 60, 'no contacts: nothing to space');
    });
  }

  it('sidebar: a stored value it has no gap for changes nothing', async () => {
    assert.equal(spaceAfter(await renderDocx(cv('sidebar', { titleContactsGap: 20 })), 'Staff Engineer'), 60);
  });

  for (const template of ['classic', 'minimal', 'executive', 'timeline', 'banner', 'academic', 'compact', 'gridline', 'registry', 'bookend', 'lectern', 'chronicle', 'keystone', 'banded', 'keel', 'linen', 'broadsheet']) {
    it(`${template}: Inline — the name and title's paragraph takes it`, async () => {
      assert.equal(spaceAfter(await renderDocx(cv(template, { headerLayout: 'inline' })), 'Jordan Rivera'), 60);
      assert.equal(spaceAfter(await renderDocx(cv(template, { headerLayout: 'inline', titleContactsGap: 20 })), 'Jordan Rivera'), 300);
    });
  }

  for (const template of TEMPLATES) {
    const band = ['modern', 'sidebar', 'banner'].includes(template); // the letters whose letterhead is a band
    it(`${template}: the letter's title (or name) row keeps Word's own spacing unset${band ? ' (none on the band)' : ''}, and takes the set value`, async () => {
      assert.equal(spaceAfter(await letterDocx(cv(template)), 'Staff Engineer'), band ? 0 : 40);
      assert.equal(spaceAfter(await letterDocx(cv(template, { titleContactsGap: 20 })), 'Staff Engineer'), 300);
      const noTitle = { ...PERSONAL, title: '' };
      assert.equal(spaceAfter(await letterDocx(cv(template, {}, noTitle)), 'Jordan Rivera'), band ? 0 : 20);
      assert.equal(spaceAfter(await letterDocx(cv(template, { titleContactsGap: 20 }, noTitle)), 'Jordan Rivera'), 300);
    });
  }
});

describe('the Title ↔ Contacts row (Personal Info → Header Customization → Header spacing)', () => {
  it('follows Name ↔ Title where a contact prints, in every header that has the gap', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    const keys = (t, s, p = PERSONAL) => headerGapRows(t, s, p).map((r) => r.key);
    for (const t of WITH_GAP) {
      assert.deepEqual(keys(t, {}).slice(0, 2), ['nameTitleGap', 'titleContactsGap'], t);
      const r = headerGapRows(t, {}, PERSONAL).find((row) => row.key === 'titleContactsGap');
      assert.deepEqual([r.label, r.name, r.set, r.min, r.max], ['Title ↔ Contacts', 'Title to contacts spacing', false, 0, 40], t);
      near(r.valuePx, OWN[t] / 0.75, `${t}: the template's own`);
      const s = headerGapRows(t, { titleContactsGap: 100 }, PERSONAL).find((row) => row.key === 'titleContactsGap');
      assert.deepEqual([s.valuePx, s.set], [40, true], `${t}: set, clamped`);
      const noTitle = headerGapRows(t, {}, { ...PERSONAL, title: '' }).find((row) => row.key === 'titleContactsGap');
      assert.deepEqual([noTitle.label, noTitle.name], ['Name ↔ Contacts', 'Name to contacts spacing'], `${t}: no title`);
      assert.ok(!keys(t, {}, NO_CONTACTS).includes('titleContactsGap'), `${t}: no contacts`);
      assert.ok(!keys(t, {}, { ...PERSONAL, hiddenFields: ['email', 'phone'] }).includes('titleContactsGap'), `${t}: every contact hidden`);
    }
    assert.ok(!keys('sidebar', {}).includes('titleContactsGap'), 'the Sidebar column has no such gap');
    assert.ok(keys('sidebar', { sidebarSingleColumn: true }).includes('titleContactsGap'), 'its single column prints Classic\'s header');
  });

  it('the panel shows it, named for what it spaces', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = (template, personal) => renderToString(createElement(HeaderCustomization, {
      s: {}, set() {}, clear() {}, personal, template, templateLabel: template, open: true, onToggle() {},
    }));
    for (const t of WITH_GAP) {
      assert.match(html(t, PERSONAL), /data-gap="titleContactsGap"[\s\S]*?aria-label="Title to contacts spacing \(px\)"/, t);
      assert.match(html(t, { ...PERSONAL, title: '' }), /aria-label="Name to contacts spacing \(px\)"/, `${t}: no title`);
    }
    assert.doesNotMatch(html('sidebar', PERSONAL), /data-gap="titleContactsGap"/);
  });
});
