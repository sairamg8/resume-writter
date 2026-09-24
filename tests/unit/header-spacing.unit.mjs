// Unit tests for the header spacing each template prints where the résumé sets none (TEMPLATES'
// `headerGaps`, src/constants/templates.js; header_spacing_spec.md). Run: yarn test:unit
// Their own file, with a namespace import, so the template table's other tests still load on
// code without these gaps (R2-8, R9-11). How a stored value overrides them: 27-header-spacing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as templates from '../../src/constants/templates.js';

const { TEMPLATE_IDS, templateHeaderGaps } = templates;

/**
 * pt — each the constant the template printed before the gap became a setting. A changed number
 * here is a changed print for every résumé that has not set that gap. null: no such gap.
 */
const STACKED = {
  nameTitleGap: 1, headerInlineGap: 6, titleContactsGap: 3,
  contactGapX: { justify: 12 }, contactGapY: { single: 2, justify: 1.5, '2grid': 1.5 },
  iconTextGap: 2, photoTextGap: 10, summaryGap: 8, headerRuleGap: 12, headerPadY: null, headerPadX: null,
};
const EXPECTED = {
  classic: STACKED,
  minimal: { ...STACKED, summaryGap: 6 },
  executive: { ...STACKED, summaryGap: 6 },
  // Modern ignores Contact Layout: plain numbers (a map by layout dropped its gaps for a résumé
  // storing Classic's 'single' — the bug the spec's golden check caught).
  modern: {
    nameTitleGap: 1, headerInlineGap: null, titleContactsGap: 4, contactGapX: 12, contactGapY: 1.5,
    iconTextGap: 2, photoTextGap: 12, summaryGap: 8, headerRuleGap: null, headerPadY: 15, headerPadX: 18,
  },
  sidebar: {
    nameTitleGap: 2, headerInlineGap: null, titleContactsGap: null, contactGapX: null, contactGapY: 6,
    iconTextGap: 3.5, photoTextGap: 10, summaryGap: null, headerRuleGap: null, headerPadY: null, headerPadX: null,
  },
  // Templates added since print Classic's stacked header, so they start from its gaps (T6 on).
  timeline: STACKED,
  // Banner prints that header in a band: the band's padding under its text, and band ↔ summary (T7).
  banner: { ...STACKED, summaryGap: 12, headerPadY: 20 },
  // Academic sets Classic's header tighter: its italic title 2 pt under the name, the summary 6 pt under
  // the contacts (T8); its gap under the header is below.
  academic: { ...STACKED, nameTitleGap: 2, summaryGap: 6 },
  // Compact sets it tight for one page: the summary 5 pt under the contacts (T9); its gap under the header is below.
  compact: { ...STACKED, summaryGap: 5 },
};

test('each template\'s header gaps are the constants it printed before they became settings (header_spacing_spec.md)', () => {
  assert.deepEqual(TEMPLATE_IDS.toSorted(), Object.keys(EXPECTED).toSorted(), 'every template has its header gaps (R3-6)');
  for (const t of TEMPLATE_IDS) {
    const { headerGapBelow, ...gaps } = templateHeaderGaps(t);
    assert.deepEqual(gaps, EXPECTED[t], `${t}: a changed gap moves every résumé that has not set it`);
    assert.equal(typeof headerGapBelow, 'function', `${t}: the gap below the header follows Between Sections`);
  }
});

test('header ↔ first section: Classic, Minimal, Executive, Timeline and Banner keep 15 pt (mb-5) until Between Sections is wider; Modern and Sidebar follow it', () => {
  for (const t of ['classic', 'minimal', 'executive', 'timeline', 'banner']) {
    const below = templateHeaderGaps(t).headerGapBelow;
    for (const [sectionGapPt, want] of [[12, 15], [15, 15], [30, 30], [0, 15]]) assert.equal(below(sectionGapPt), want, `${t} at ${sectionGapPt} pt`);
    // Math.max(HEADER_MARGIN_BOTTOM_PT, sectionGap || 0), as it was: a sectionGap that is not a
    // number (an imported "abc" resolves to NaN) kept the 15 pt.
    for (const junk of [NaN, undefined, null]) assert.equal(below(junk), 15, `${t} at ${junk}`);
  }
  for (const t of ['modern', 'sidebar']) {
    for (const sectionGapPt of [0, 12, 30]) assert.equal(templateHeaderGaps(t).headerGapBelow(sectionGapPt), sectionGapPt, `${t} at ${sectionGapPt} pt`);
  }
});

test('header ↔ first section: Academic keeps 12 pt, a dense CV\'s, until Between Sections is wider (T8)', () => {
  const below = templateHeaderGaps('academic').headerGapBelow;
  for (const [sectionGapPt, want] of [[9, 12], [12, 12], [30, 30], [0, 12]]) assert.equal(below(sectionGapPt), want, `at ${sectionGapPt} pt`);
  for (const junk of [NaN, undefined, null]) assert.equal(below(junk), 12, `at ${junk}`);
});

test('header ↔ first section: Compact keeps 10 pt, a one-pager\'s, until Between Sections is wider (T9)', () => {
  const below = templateHeaderGaps('compact').headerGapBelow;
  for (const [sectionGapPt, want] of [[7.5, 10], [10, 10], [30, 30], [0, 10]]) assert.equal(below(sectionGapPt), want, `at ${sectionGapPt} pt`);
  for (const junk of [NaN, undefined, null]) assert.equal(below(junk), 10, `at ${junk}`);
});

test('an id the app does not offer gets Classic\'s header gaps, as it prints Classic (M15)', () => {
  for (const id of ['dark', '', undefined]) assert.equal(templateHeaderGaps(id), templateHeaderGaps('classic'), String(id));
});
