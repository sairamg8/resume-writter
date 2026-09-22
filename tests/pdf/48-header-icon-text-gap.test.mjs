// Personal Info → Header Customization → Header spacing → Icon ↔ Text ("Bullet ↔ Text" for Contact Style
// Bullet) (header_spacing_spec.md). The engine had `iconTextGap` since the spec for Classic, Minimal and
// Executive (PdfContactRow's 2 pt), but no control set it, and Modern (its 2 pt), the Sidebar column
// (3.5 pt, and the value's indent under its label) and the cover letter ignored it. Each value moves
// every contact's text by exactly the change past its own icon or bullet; nothing above moves.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, renderDocx, read, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100' };
const NO_CONTACTS = { ...PERSONAL, email: '', phone: '' };
/** The templates' own Icon ↔ Text, pt (TEMPLATES' headerGaps.iconTextGap). */
const OWN = { classic: 2, minimal: 2, executive: 2, modern: 2, sidebar: 3.5 };
const STACKED = ['classic', 'minimal', 'executive'];
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.01, `${at}: ${a} vs ${b}`);

/**
 * Page 1's name, title and the two contacts: x from the left, its right `end`, y down from the top,
 * pt. A bullet less than about 12 pt before its value reads as one run with it ("• jordan@…"), so a
 * value after a bullet is measured by its end.
 */
async function header(bytes) {
  const [page] = await read(bytes);
  const at = (s) => { const t = page.items.find((i) => i.str.includes(s)); return t && { x: t.x, end: t.x + t.w, y: page.H - t.y }; };
  return { name: at('Jordan Rivera'), title: at('Staff Engineer'), email: at('jordan@example.com'), phone: at('+1 555 0100') };
}
const cv = (template, settings = {}, personal = PERSONAL, coverLetter = {}) => resume({ template, settings, personal, coverLetter });

describe('Icon ↔ Text in the résumé PDF', () => {
  it('pins the templates\' own gaps the row starts from', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of TEMPLATES) assert.equal(templateGapPt(t, 'iconTextGap'), OWN[t], t);
  });

  for (const template of TEMPLATES) {
    it(`${template}: each value moves the contacts' text past their icons by exactly its change; the name and title stay`, async () => {
      const unset = await header(await render(cv(template)));
      for (const px of [0, 8, 16]) {
        const set = await header(await render(cv(template, { iconTextGap: px })));
        const delta = px * 0.75 - OWN[template];
        near(set.name.x, unset.name.x, `${template} ${px}px: name`);
        near(set.title.y, unset.title.y, `${template} ${px}px: title`);
        near(set.email.x - unset.email.x, delta, `${template} ${px}px: first contact x`);
        near(set.email.y, unset.email.y, `${template} ${px}px: first contact y`);
        // In a row the second contact is past two icons; in the Sidebar column each has its own line.
        near(set.phone.x - unset.phone.x, template === 'sidebar' ? delta : 2 * delta, `${template} ${px}px: second contact x`);
      }
    });

    it(`${template}: a stored value out of range is clamped, and one that is not a number prints as unset`, async () => {
      const at = async (v) => (await header(await render(cv(template, { iconTextGap: v })))).email.x;
      near(await at(100), await at(16), `${template}: 100 → 16`);
      near(await at(-5), await at(0), `${template}: -5 → 0`);
      near(await at('abc'), (await header(await render(cv(template)))).email.x, `${template}: 'abc' → unset`);
    });

    it(`${template}: with no contact the gap changes nothing`, async () => {
      assert.deepEqual(await header(await render(cv(template, { iconTextGap: 16 }, NO_CONTACTS))), await header(await render(cv(template, {}, NO_CONTACTS))));
    });
  }

  it('sidebar: the value under its label is indented past the icon by the same gap', async () => {
    const label = async (s) => { const [page] = await read(await render(cv('sidebar', s))); return page.items.find((i) => i.str === 'EMAIL').x; };
    near(await label({ iconTextGap: 16 }) - await label({}), 12 - 3.5, 'the label beside the icon');
  });

  for (const template of STACKED) {
    it(`${template}: Bullet, one contact to a cell (Single, 2 Grid), moves the text past the bullet`, async () => {
      for (const contactLayout of ['single', '2grid']) {
        const s = { contactStyle: 'bullet', contactLayout };
        const unset = await header(await render(cv(template, s)));
        const set = await header(await render(cv(template, { ...s, iconTextGap: 16 })));
        near(set.email.end - unset.email.end, 12 - 2, `${template} ${contactLayout}`);
      }
    });

    it(`${template}: a Bar line, or Bullet in a Justify line, has no such gap: nothing moves`, async () => {
      for (const s of [{ contactStyle: 'bar' }, { contactStyle: 'bar', contactLayout: 'single' }, { contactStyle: 'bullet' }]) {
        assert.deepEqual(await header(await render(cv(template, { ...s, iconTextGap: 16 }))), await header(await render(cv(template, s))), `${template} ${JSON.stringify(s)}`);
      }
    });
  }
});

describe('Icon ↔ Text in the cover letter', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the letterhead's contacts follow the résumé's set value, else their own 2 pt`, async () => {
      const unset = await header(await renderCover(cv(template, {}, PERSONAL, { fieldsPosition: 'below-name' })));
      const set = await header(await renderCover(cv(template, { iconTextGap: 16 }, PERSONAL, { fieldsPosition: 'below-name' })));
      near(set.name.x, unset.name.x, `${template}: name`);
      near(set.email.x - unset.email.x, 12 - 2, `${template}: first contact`);
      near(set.phone.x - unset.phone.x, 2 * (12 - 2), `${template}: second contact`);
    });
  }

  it('the letter\'s own Bullet, one to a line: the text past the bullet', async () => {
    const r = (s) => cv('classic', s, PERSONAL, { fieldsPosition: 'below-name', headerStyle: 'bullet', headerLayout: 'single' });
    near((await header(await renderCover(r({ iconTextGap: 16 })))).email.end - (await header(await renderCover(r({})))).email.end, 10, 'first contact');
  });

  it('Right of Name: the contacts stay whole at the right margin whatever the gap (the icons move left)', async () => {
    const EMAIL = 'jordan.rivera.long.address@example.com';
    const ends = async (s) => {
      const [page] = await read(await renderCover(cv('classic', s, { ...PERSONAL, email: EMAIL }, { fieldsPosition: 'right', headerLayout: 'single' })));
      return [EMAIL, '+1 555 0100'].map((v) => { const t = page.items.find((i) => i.str === v); assert.ok(t, `"${v}" prints whole on its line (${JSON.stringify(s)})`); return t.x + t.w; });
    };
    const [unset, set] = [await ends({}), await ends({ iconTextGap: 16 })];
    for (const i of [0, 1]) near(set[i], unset[i], `contact ${i + 1} ends at the right margin`);
  });
});

describe('Icon ↔ Text in Word', () => {
  it('Word prints icons as bars, with no such gap: nothing changes', async () => {
    for (const t of TEMPLATES) {
      // A hyperlink's relationship id is random per export.
      const xml = async (s) => (await renderDocx(cv(t, s))).xml.replace(/r:id="[^"]*"/g, '');
      assert.equal(await xml({ iconTextGap: 16 }), await xml(), t);
    }
  });
});

describe('the Icon ↔ Text row (Personal Info → Header Customization → Header spacing)', () => {
  it('is offered where a contact prints with an icon, or a bullet in its own cell', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    const row = (t, s, p = PERSONAL) => headerGapRows(t, s, p).find((r) => r.key === 'iconTextGap');
    for (const t of TEMPLATES) {
      const r = row(t, {});
      assert.deepEqual([r.label, r.name, r.set, r.min, r.max], ['Icon ↔ Text', 'Icon to text spacing', false, 0, 16], t);
      near(r.valuePx, OWN[t] / 0.75, `${t}: the template's own`);
      assert.deepEqual([row(t, { iconTextGap: 100 }).valuePx, row(t, { iconTextGap: 100 }).set], [16, true], `${t}: set, clamped`);
      assert.equal(row(t, {}, NO_CONTACTS), undefined, `${t}: no contacts`);
    }
    for (const t of STACKED) {
      for (const contactLayout of ['single', '2grid']) {
        assert.deepEqual([row(t, { contactStyle: 'bullet', contactLayout }).label, row(t, { contactStyle: 'bullet', contactLayout }).name], ['Bullet ↔ Text', 'Bullet to text spacing'], `${t} bullet ${contactLayout}`);
        assert.equal(row(t, { contactStyle: 'bar', contactLayout }), undefined, `${t} bar ${contactLayout}`);
      }
      assert.equal(row(t, { contactStyle: 'bullet' }), undefined, `${t}: a bullet in a Justify line is text`);
      assert.equal(row(t, { contactStyle: 'bar' }), undefined, `${t}: Bar`);
    }
    for (const t of ['modern', 'sidebar']) assert.equal(row(t, { contactStyle: 'bar' }).label, 'Icon ↔ Text', `${t} always prints icons`);
  });

  it('the panel shows it, named for the mark it spaces', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = (template, s = {}) => renderToString(createElement(HeaderCustomization, {
      s, set() {}, clear() {}, personal: PERSONAL, template, templateLabel: template, open: true, onToggle() {},
    }));
    for (const t of TEMPLATES) assert.match(html(t), /data-gap="iconTextGap"[\s\S]*?aria-label="Icon to text spacing \(px\)"/, t);
    assert.match(html('classic', { contactStyle: 'bullet', contactLayout: 'single' }), /aria-label="Bullet to text spacing \(px\)"/);
    assert.doesNotMatch(html('classic', { contactStyle: 'bar' }), /data-gap="iconTextGap"/);
  });
});
