// Personal Info → Header Customization → Header spacing → Name ↔ Title (header_spacing_spec.md). The
// engine had `nameTitleGap` since the spec (Classic, Minimal, Executive), but no control set it, and
// Modern, Sidebar, the letter and Word ignored it. Each value moves the title — and only what follows
// it — by exactly the change; unset prints the template's own gap; the letter follows a set value.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, renderDocx, read, readDocx, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100' };
/** The templates' own Name ↔ Title, pt (TEMPLATES' headerGaps.nameTitleGap). */
const OWN = { classic: 1, minimal: 1, executive: 1, modern: 1, sidebar: 2 };
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.01, `${at}: ${a} vs ${b}`);

/** Page 1's baselines (pt from the page bottom) of the name, the title and the first contact. */
async function header(bytes) {
  const [page] = await read(bytes);
  const y = (s) => page.items.find((t) => t.str.includes(s))?.y;
  return { name: y('Jordan Rivera'), title: y('Staff Engineer'), contact: y('jordan@example.com') };
}
const cv = (template, settings = {}, personal = PERSONAL) => resume({ template, settings, personal });

describe('Name ↔ Title in the résumé PDF', () => {
  it('pins the templates\' own gaps the row starts from', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of TEMPLATES) assert.equal(templateGapPt(t, 'nameTitleGap'), OWN[t], t);
  });

  for (const template of TEMPLATES) {
    it(`${template}: each value moves the title and what follows by exactly its change; the name stays`, async () => {
      const unset = await header(await render(cv(template)));
      for (const px of [0, 12, 40]) {
        const set = await header(await render(cv(template, { nameTitleGap: px })));
        const delta = px * 0.75 - OWN[template];
        near(set.name, unset.name, `${template} ${px}px: name`);
        near(unset.title - set.title, delta, `${template} ${px}px: title`);
        near(unset.contact - set.contact, delta, `${template} ${px}px: first contact`);
      }
    });

    it(`${template}: a stored value out of range is clamped, and one that is not a number prints as unset`, async () => {
      const at = async (v) => (await header(await render(cv(template, { nameTitleGap: v })))).title;
      near(await at(100), await at(40), `${template}: 100 → 40`);
      near(await at(-5), await at(0), `${template}: -5 → 0`);
      near(await at('abc'), (await header(await render(cv(template)))).title, `${template}: 'abc' → unset`);
    });

    it(`${template}: with no job title the gap changes nothing`, async () => {
      const personal = { ...PERSONAL, title: '' };
      const unset = await header(await render(cv(template, {}, personal)));
      const set = await header(await render(cv(template, { nameTitleGap: 30 }, personal)));
      near(set.contact, unset.contact, `${template}: first contact`);
    });
  }

  for (const template of ['classic', 'minimal', 'executive']) {
    it(`${template}: Inline prints the title beside the name, whatever the stacked gap`, async () => {
      const a = await header(await render(cv(template, { headerLayout: 'inline' })));
      const b = await header(await render(cv(template, { headerLayout: 'inline', nameTitleGap: 40 })));
      near(b.title, a.title, `${template}: title`);
      near(b.contact, a.contact, `${template}: contact`);
    });
  }
});

describe('Name ↔ Title in the cover letter', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the letterhead follows the résumé's set value, else its own 1 pt`, async () => {
      const unset = await header(await renderCover(cv(template)));
      const set = await header(await renderCover(cv(template, { nameTitleGap: 20 })));
      near(set.name, unset.name, `${template}: name`);
      near(unset.title - set.title, 20 * 0.75 - 1, `${template}: title`);
    });
  }
});

describe('Name ↔ Title in Word', () => {
  const nameAfter = (doc) => Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(doc.paragraphs.find((p) => p.text.includes('Jordan Rivera')).xml)?.[1]);
  const letterDocx = async (r) => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  };

  for (const template of TEMPLATES) {
    it(`${template}: the résumé's name keeps Word's own 2 pt unset, and takes the set value`, async () => {
      assert.equal(nameAfter(await renderDocx(cv(template))), 40);
      assert.equal(nameAfter(await renderDocx(cv(template, { nameTitleGap: 20 }))), 300, '20 px = 15 pt = 300 twips');
      assert.equal(nameAfter(await renderDocx(cv(template, { nameTitleGap: 20 }, { ...PERSONAL, title: '' }))), 40, 'no title');
    });

    it(`${template}: the letter's name keeps Word's own spacing unset (none on Modern's and Sidebar's band), and takes the set value`, async () => {
      assert.equal(nameAfter(await letterDocx(cv(template))), ['modern', 'sidebar'].includes(template) ? 0 : 20);
      assert.equal(nameAfter(await letterDocx(cv(template, { nameTitleGap: 20 }))), 300);
    });
  }
});

describe('the Header spacing row (Personal Info → Header Customization)', () => {
  it('Name ↔ Title writes the gap of the layout the header prints, starting from the template\'s own', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    // The Name ↔ Title row (the group has others: 46-, 47-…); none when there is none.
    const only = (rows) => { const r = rows.filter((row) => ['nameTitleGap', 'headerInlineGap'].includes(row.key)); assert.ok(r.length <= 1); return r[0]; };
    for (const t of TEMPLATES) {
      const r = only(headerGapRows(t, {}, PERSONAL));
      assert.deepEqual([r.key, r.label, r.set, r.min, r.max], ['nameTitleGap', 'Name ↔ Title', false, 0, 40], t);
      near(r.valuePx, OWN[t] / 0.75, `${t}: the template's own`);
      const s = only(headerGapRows(t, { nameTitleGap: 12 }, PERSONAL));
      assert.deepEqual([s.valuePx, s.set], [12, true], `${t}: set`);
      assert.equal(only(headerGapRows(t, { nameTitleGap: 100 }, PERSONAL)).valuePx, 40, `${t}: clamped`);
      assert.equal(only(headerGapRows(t, {}, { ...PERSONAL, title: '' })), undefined, `${t}: no title, no row`);
    }
    for (const t of ['classic', 'minimal', 'executive']) {
      const r = only(headerGapRows(t, { headerLayout: 'inline' }, PERSONAL));
      assert.deepEqual([r.key, r.min, r.max, r.valuePx], ['headerInlineGap', 2, 48, 8], `${t}: Inline`);
    }
    for (const t of ['modern', 'sidebar']) {
      assert.equal(only(headerGapRows(t, { headerLayout: 'inline' }, PERSONAL)).key, 'nameTitleGap', `${t} has no Inline layout`);
    }
  });

  it('the panel offers the row in every template, and says why when there is no title', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = (template, personal, s = {}) => renderToString(createElement(HeaderCustomization, {
      s, set() {}, clear() {}, personal, template, templateLabel: template, open: true, onToggle() {},
    }));
    for (const t of TEMPLATES) {
      const withTitle = html(t, PERSONAL);
      assert.match(withTitle, /data-gap="nameTitleGap"/, t);
      assert.match(withTitle, /aria-label="Name to title spacing \(px\)"/, t);
      assert.match(withTitle, new RegExp(`value="${String(Math.round((OWN[t] / 0.75) * 10) / 10)}"`), `${t}: shows the template's own`);
      assert.doesNotMatch(withTitle, /Name &amp; Title Spacing/, `${t}: the old Inline-only row is gone`);
      assert.match(html(t, { ...PERSONAL, title: '' }), /Add a job title to set the space between your name and title/, t);
    }
    assert.match(html('classic', PERSONAL, { headerLayout: 'inline', headerInlineGap: 24 }), /data-gap="headerInlineGap"[\s\S]*value="24"/);
  });
});
