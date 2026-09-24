// Personal Info → Header Customization → Header spacing → Between contact rows (header_spacing_spec.md).
// The engine had `contactGapY` since the spec for Classic, Minimal and Executive (PdfContactRow's 2 pt
// under Single, 1.5 pt between wrapped Justify rows and 2 Grid rows), but no control set it, and Modern
// (its 1.5 pt), the Sidebar column (6 pt under each contact) and the cover letter ignored it. Each value
// moves every contact row after the first by exactly the change per row before it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, render, renderCover, renderDocx, read, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** Six contacts: two rows in a Justify row of icons (github on the second), three in a 2 Grid. */
const PERSONAL = {
  name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100', location: 'San Francisco, CA',
  website: 'jordanrivera.dev', linkedin: 'linkedin.com/in/jordanrivera', github: 'github.com/jordanrivera',
  summary: '<p>Summary line of an engineer.</p>',
};
const TWO = { name: 'Jordan Rivera', title: 'Staff Engineer', email: 'jordan@example.com', phone: '+1 555 0100' };
const ONE = { ...TWO, phone: '' };
/** The templates' own Between contact rows, pt, by Contact Layout (TEMPLATES' headerGaps.contactGapY). */
const OWN = { classic: 1.5, minimal: 1.5, executive: 1.5, modern: 1.5, sidebar: 6, timeline: 1.5, banner: 1.5 };
const SINGLE_OWN = 2;
const STACKED = ['classic', 'minimal', 'executive', 'timeline', 'banner'];
const near = (a, b, at) => assert.ok(Math.abs(a - b) < 0.01, `${at}: ${a} vs ${b}`);

/** Page 1's baselines, y down from the top, pt, of `needles`. */
async function ys(bytes, needles) {
  const [page] = await read(bytes);
  return Object.fromEntries(needles.map((s) => { const t = page.items.find((i) => i.str.includes(s)); assert.ok(t, `"${s}" prints`); return [s, page.H - t.y]; }));
}
const cv = (template, settings = {}, personal = PERSONAL, coverLetter = {}) => resume({ template, settings, personal, coverLetter });

describe('Between contact rows in the résumé PDF', () => {
  it('pins the templates\' own gaps the row starts from', async () => {
    const { templateGapPt } = await loadModule('/src/constants/headerSpacing.js');
    for (const t of TEMPLATES) assert.equal(templateGapPt(t, 'contactGapY'), OWN[t], t);
    for (const t of STACKED) assert.equal(templateGapPt(t, 'contactGapY', { contactLayout: 'single' }), SINGLE_OWN, `${t} Single`);
  });

  for (const template of [...STACKED, 'modern']) {
    it(`${template}: a wrapped row of icons — each value moves the second row by exactly its change; the first stays`, async () => {
      const needles = ['jordan@example.com', 'github.com/jordanrivera', 'Summary line'];
      const unset = await ys(await render(cv(template)), needles);
      assert.ok(unset['github.com/jordanrivera'] > unset['jordan@example.com'] + 5, `${template}: github wraps onto a second row`);
      for (const px of [0, 12, 24]) {
        const set = await ys(await render(cv(template, { contactGapY: px })), needles);
        const delta = px * 0.75 - OWN[template];
        near(set['jordan@example.com'], unset['jordan@example.com'], `${template} ${px}px: first row`);
        near(set['github.com/jordanrivera'] - unset['github.com/jordanrivera'], delta, `${template} ${px}px: second row`);
        near(set['Summary line'] - unset['Summary line'], delta, `${template} ${px}px: summary`);
      }
    });

    it(`${template}: a stored value out of range is clamped, and one that is not a number prints as unset`, async () => {
      const at = async (v) => (await ys(await render(cv(template, { contactGapY: v })), ['github']))['github'];
      near(await at(100), await at(24), `${template}: 100 → 24`);
      near(await at(-5), await at(0), `${template}: -5 → 0`);
      near(await at('abc'), (await ys(await render(cv(template)), ['github']))['github'], `${template}: 'abc' → unset`);
    });
  }

  for (const template of STACKED) {
    it(`${template}: Single — each contact under the one before by the gap (its own 2 pt)`, async () => {
      const needles = ['jordan@example.com', '+1 555 0100', 'San Francisco'];
      const unset = await ys(await render(cv(template, { contactLayout: 'single' })), needles);
      const set = await ys(await render(cv(template, { contactLayout: 'single', contactGapY: 20 })), needles);
      near(set['jordan@example.com'], unset['jordan@example.com'], `${template}: first`);
      near(set['+1 555 0100'] - unset['+1 555 0100'], 15 - SINGLE_OWN, `${template}: second`);
      near(set['San Francisco'] - unset['San Francisco'], 2 * (15 - SINGLE_OWN), `${template}: third`);
    });

    it(`${template}: 2 Grid — the second and third rows of cells move by one and two gaps`, async () => {
      const needles = ['jordan@example.com', '+1 555 0100', 'San Francisco', 'github.com/jordanrivera'];
      const unset = await ys(await render(cv(template, { contactLayout: '2grid' })), needles);
      const set = await ys(await render(cv(template, { contactLayout: '2grid', contactGapY: 20 })), needles);
      near(set['+1 555 0100'], unset['+1 555 0100'], `${template}: the first row's second cell`);
      near(set['San Francisco'] - unset['San Francisco'], 15 - 1.5, `${template}: second row`);
      near(set['github.com/jordanrivera'] - unset['github.com/jordanrivera'], 2 * (15 - 1.5), `${template}: third row`);
    });

    it(`${template}: a Bar or Bullet line wraps as text: nothing moves`, async () => {
      for (const s of [{ contactStyle: 'bar' }, { contactStyle: 'bullet' }]) {
        const needles = ['Jordan Rivera', 'Summary line'];
        assert.deepEqual(await ys(await render(cv(template, { ...s, contactGapY: 24 })), needles), await ys(await render(cv(template, s)), needles), `${template} ${JSON.stringify(s)}`);
      }
    });
  }

  it('sidebar: each contact sits the gap under the one before (its own 6 pt); the Contact block keeps its 6 pt under the last', async () => {
    // The side column's next section follows the last contact by the block's own spacing.
    const r = (s) => ({ ...cv('sidebar', s, TWO), sections: [section('skills', [{}])] });
    const [unset, set] = [await ys(await render(r({})), ['EMAIL', 'PHONE', 'SKILLS']), await ys(await render(r({ contactGapY: 20 })), ['EMAIL', 'PHONE', 'SKILLS'])];
    near(set.EMAIL, unset.EMAIL, 'first contact');
    near(set.PHONE - unset.PHONE, 15 - 6, 'second contact');
    near(set.SKILLS - unset.SKILLS, 15 - 6, 'the next section moves with the second contact, not twice');
  });

  it('a lone contact has no rows to space: nothing moves', async () => {
    for (const t of TEMPLATES) {
      const needles = ['Jordan Rivera', 'jordan@example.com'];
      assert.deepEqual(await ys(await render(cv(t, { contactGapY: 24 }, ONE)), needles), await ys(await render(cv(t, {}, ONE)), needles), t);
    }
  });
});

describe('Between contact rows in the cover letter', () => {
  it('the letterhead\'s contacts follow the résumé\'s set value, else their own (Single 2 pt)', async () => {
    for (const t of TEMPLATES) {
      const r = (s) => cv(t, s, TWO, { fieldsPosition: 'below-name', headerLayout: 'single' });
      const unset = await ys(await renderCover(r({})), ['jordan@example.com', '+1 555 0100']);
      const set = await ys(await renderCover(r({ contactGapY: 20 })), ['jordan@example.com', '+1 555 0100']);
      near(set['jordan@example.com'], unset['jordan@example.com'], `${t}: first`);
      near(set['+1 555 0100'] - unset['+1 555 0100'], 15 - 2, `${t}: second`);
    }
  });
});

describe('Between contact rows in Word', () => {
  it('Word keeps its own spacing between contact lines', async () => {
    for (const t of TEMPLATES) {
      // A hyperlink's relationship id is random per export.
      const xml = async (s) => (await renderDocx(cv(t, s))).xml.replace(/r:id="[^"]*"/g, '');
      assert.equal(await xml({ contactGapY: 24, contactLayout: 'single' }), await xml({ contactLayout: 'single' }), t);
    }
  });
});

describe('the Between contact rows row (Personal Info → Header Customization → Header spacing)', () => {
  it('is offered where contacts can print on rows of their own', async () => {
    const { headerGapRows } = await loadModule('/src/utils/headerSpacingRows.js');
    const row = (t, s = {}, p = PERSONAL) => headerGapRows(t, s, p).find((r) => r.key === 'contactGapY');
    for (const t of TEMPLATES) {
      const r = row(t);
      assert.deepEqual([r.label, r.name, r.set, r.min, r.max], ['Between contact rows', 'Space between contact rows', false, 0, 24], t);
      near(r.valuePx, OWN[t] / 0.75, `${t}: the template's own`);
      assert.deepEqual([row(t, { contactGapY: 100 }).valuePx, row(t, { contactGapY: 100 }).set], [24, true], `${t}: set, clamped`);
      assert.equal(row(t, {}, ONE), undefined, `${t}: one contact`);
      assert.ok(row(t, {}, TWO), `${t}: two contacts`);
    }
    for (const t of STACKED) {
      near(row(t, { contactLayout: 'single' }, TWO).valuePx, SINGLE_OWN / 0.75, `${t}: Single's own 2 pt`);
      assert.ok(row(t, { contactLayout: 'single', contactStyle: 'bar' }, TWO), `${t}: Single, any style`);
      assert.equal(row(t, { contactLayout: '2grid' }, TWO), undefined, `${t}: a 2 Grid of two is one row`);
      assert.ok(row(t, { contactLayout: '2grid' }, { ...TWO, location: 'Austin' }), `${t}: a 2 Grid of three`);
      assert.equal(row(t, { contactStyle: 'bar' }), undefined, `${t}: a Bar line`);
      assert.equal(row(t, { contactStyle: 'bullet' }), undefined, `${t}: a Bullet line`);
    }
  });

  it('the panel shows it', async () => {
    const { HeaderCustomization } = await loadModule('/src/components/PersonalInfoEditorHeader.jsx');
    const html = (template, s = {}) => renderToString(createElement(HeaderCustomization, {
      s, set() {}, clear() {}, personal: PERSONAL, template, templateLabel: template, open: true, onToggle() {},
    }));
    for (const t of TEMPLATES) assert.match(html(t), /data-gap="contactGapY"[\s\S]*?aria-label="Space between contact rows \(px\)"/, t);
    assert.doesNotMatch(html('classic', { contactStyle: 'bar' }), /data-gap="contactGapY"/);
  });
});
