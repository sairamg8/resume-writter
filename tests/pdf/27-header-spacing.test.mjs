// Header spacing (header_spacing_spec.md): the settings and how a stored gap, else the
// template's own, resolves for the PDF. The template's own values: tests/unit/header-spacing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const STACKED = ['classic', 'minimal', 'executive'];

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
