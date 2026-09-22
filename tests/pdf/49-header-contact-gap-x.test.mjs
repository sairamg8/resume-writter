// Personal Info → Header Customization → Header spacing → Between contacts (header_spacing_spec.md). The
// engine had `contactGapX` since the spec for Classic, Minimal and Executive (Icon + Justify's 12 pt
// column gap), but no control set it, and Modern (its 12 pt) and the cover letter ignored it. Each
// value moves every contact after the first along the row by exactly the change per gap before it.
// A Bar or Bullet line spaces its values with its separator, a 2 Grid has its own columns, Single one
// contact to a line, and the Sidebar column one to a row: none has the gap (spec D7).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, renderDocx, read, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const PERSONAL = { name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100', location: 'Austin, TX' };
const ONE_CONTACT = { ...PERSONAL, phone: '', location: '' };
/** The templates' own Between contacts, pt (TEMPLATES' headerGaps.contactGapX, Icon + Justify); the Sidebar has none. */
const OWN = { classic: 12, minimal: 12, executive: 12, modern: 12, sidebar: null };
const WITH_GAP = TEMPLATES.filter((t) => OWN[t] != null);
const STACKED = ['classic', 'minimal', 'executive'];
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.01, `${at}: ${a} vs ${b}`);

/** Page 1's name and the three contacts: x from the left, y down from the top, pt. */
async function header(bytes) {
  const [page] = await read(bytes);
  const at = (s) => { const t = page.items.find((i) => i.str.includes(s)); return t && { x: t.x, y: page.H - t.y }; };
  return { name: at('Jordan Rivera'), email: at('jordan@example.com'), phone: at('+1 555 0100'), location: at('Austin, TX') };
}
const cv = (template, settings = {}, personal = PERSONAL, coverLetter = {}) => resume({ template, settings, personal, coverLetter });

describe('Between contacts in the résumé PDF', () => {
  it('pins the templates\' own gaps the row starts from', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of TEMPLATES) assert.equal(templateGapPt(t, 'contactGapX'), OWN[t], t);
  });

  for (const template of WITH_GAP) {
    it(`${template}: each value moves each contact along the row by exactly its change per gap before it`, async () => {
      const unset = await header(await render(cv(template)));
      for (const px of [0, 20, 40]) {
        const set = await header(await render(cv(template, { contactGapX: px })));
        const delta = px * 0.75 - OWN[template];
        near(set.email.x, unset.email.x, `${template} ${px}px: first contact`);
        near(set.phone.x - unset.phone.x, delta, `${template} ${px}px: second contact`);
        near(set.location.x - unset.location.x, 2 * delta, `${template} ${px}px: third contact`);
        near(set.location.y, unset.location.y, `${template} ${px}px: on the same row`);
      }
    });

    it(`${template}: a stored value out of range is clamped, and one that is not a number prints as unset`, async () => {
      const at = async (v) => (await header(await render(cv(template, { contactGapX: v })))).phone.x;
      near(await at(100), await at(40), `${template}: 100 → 40`);
      near(await at(-5), await at(0), `${template}: -5 → 0`);
      near(await at('abc'), (await header(await render(cv(template)))).phone.x, `${template}: 'abc' → unset`);
    });

    it(`${template}: a lone contact has no gap: nothing moves`, async () => {
      assert.deepEqual(await header(await render(cv(template, { contactGapX: 40 }, ONE_CONTACT))), await header(await render(cv(template, {}, ONE_CONTACT))));
    });
  }

  it('sidebar: one contact to a row in the column — a stored value changes nothing', async () => {
    assert.deepEqual(await header(await render(cv('sidebar', { contactGapX: 40 }))), await header(await render(cv('sidebar'))));
  });

  for (const template of STACKED) {
    it(`${template}: Bar and Bullet lines, Single and 2 Grid have no such gap: nothing moves`, async () => {
      for (const s of [{ contactStyle: 'bar' }, { contactStyle: 'bullet' }, { contactLayout: 'single' }, { contactLayout: '2grid' }, { contactStyle: 'bar', contactLayout: '2grid' }]) {
        assert.deepEqual(await header(await render(cv(template, { ...s, contactGapX: 40 }))), await header(await render(cv(template, s))), `${template} ${JSON.stringify(s)}`);
      }
    });
  }
});

describe('Between contacts in the cover letter', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the letterhead's Icon + Justify contacts follow the résumé's set value, else their own 12 pt`, async () => {
      const unset = await header(await renderCover(cv(template, {}, PERSONAL, { fieldsPosition: 'below-name' })));
      const set = await header(await renderCover(cv(template, { contactGapX: 40 }, PERSONAL, { fieldsPosition: 'below-name' })));
      near(set.email.x, unset.email.x, `${template}: first contact`);
      near(set.phone.x - unset.phone.x, 30 - 12, `${template}: second contact`);
      near(set.location.x - unset.location.x, 2 * (30 - 12), `${template}: third contact`);
    });
  }

  it('the letter\'s own 2 Grid, Single or Bar keeps its spacing', async () => {
    for (const own of [{ headerLayout: '2grid' }, { headerLayout: 'single' }, { headerStyle: 'bar' }]) {
      const r = (s) => cv('classic', s, PERSONAL, { fieldsPosition: 'below-name', ...own });
      assert.deepEqual(await header(await renderCover(r({ contactGapX: 40 }))), await header(await renderCover(r({}))), JSON.stringify(own));
    }
  });
});

describe('Between contacts in Word', () => {
  it('Word prints the contacts as a line of text: nothing changes', async () => {
    for (const t of TEMPLATES) {
      // A hyperlink's relationship id is random per export.
      const xml = async (s) => (await renderDocx(cv(t, s))).xml.replace(/r:id="[^"]*"/g, '');
      assert.equal(await xml({ contactGapX: 40 }), await xml(), t);
    }
  });
});

describe('the Between contacts row (Personal Info → Header Customization → Header spacing)', () => {
  it('is offered where two contacts or more flow in a row of icons', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    const row = (t, s = {}, p = PERSONAL) => headerGapRows(t, s, p).find((r) => r.key === 'contactGapX');
    for (const t of WITH_GAP) {
      const r = row(t);
      assert.deepEqual([r.label, r.name, r.set, r.min, r.max], ['Between contacts', 'Space between contacts', false, 0, 40], t);
      near(r.valuePx, OWN[t] / 0.75, `${t}: the template's own`);
      assert.deepEqual([row(t, { contactGapX: 100 }).valuePx, row(t, { contactGapX: 100 }).set], [40, true], `${t}: set, clamped`);
      assert.equal(row(t, {}, ONE_CONTACT), undefined, `${t}: one contact`);
    }
    for (const t of STACKED) {
      for (const s of [{ contactStyle: 'bar' }, { contactStyle: 'bullet' }, { contactLayout: 'single' }, { contactLayout: '2grid' }]) {
        assert.equal(row(t, s), undefined, `${t} ${JSON.stringify(s)}`);
      }
    }
    assert.ok(row('modern', { contactStyle: 'bar', contactLayout: 'single' }), 'Modern prints its icons in a row whatever the stored style and layout');
    assert.equal(row('sidebar'), undefined, 'the Sidebar column has no such gap');
  });

  it('the panel shows it', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = (template, s = {}) => renderToString(createElement(HeaderCustomization, {
      s, set() {}, clear() {}, personal: PERSONAL, template, templateLabel: template, open: true, onToggle() {},
    }));
    for (const t of WITH_GAP) assert.match(html(t), /data-gap="contactGapX"[\s\S]*?aria-label="Space between contacts \(px\)"/, t);
    assert.doesNotMatch(html('classic', { contactLayout: 'single' }), /data-gap="contactGapX"/);
  });
});
