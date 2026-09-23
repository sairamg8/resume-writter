// One source of truth for "is this template ATS-safe" (TUI-5). The Design panel's badge and the ATS
// Check tab's template verdict used to be two hardcoded lists — `ats: true|false` per template in
// src/constants/templates.js, and a `currentTemplate === 'classic' || 'minimal' || 'executive'` chain
// in src/utils/atsChecker.js — plus two more copies of the same trio in the tests. Nothing compared
// them, and they had already drifted: Modern carried no badge while the checker scored it `pass`, and
// the Sidebar's Single · ATS-safe mode carried no badge while the checker called it ATS-Certified.
//
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
// A namespace import, not named ones: a helper that is missing is undefined and fails only its own
// test, where a missing named import stops the whole file loading (R2-8, R9-11).
import * as templates from '../../src/constants/templates.js';

const { TEMPLATE_IDS, TEMPLATE_PICKER, atsRating } = templates;
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

/** Enough of a résumé for analyzeAtsScore to reach the layout category. */
const sample = {
  id: 'ats_rating', name: 'Sample', template: 'classic', settings: { contactLayout: 'justify' },
  personal: {
    name: 'Sarah Connor', title: 'Senior Full Stack Engineer', email: 'sarah@example.com',
    phone: '+1 (555) 234-5678', location: 'San Francisco, CA',
    summary: 'Results-driven engineer with over 8 years of experience building distributed systems.',
  },
  sections: [
    { id: 's1', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', visible: true, company: 'Acme', role: 'Engineer', startDate: '2020-01', endDate: '2023-01',
        bullets: ['Led the rebuild of the checkout flow, cutting drop-off by 18%.'] },
    ] },
    { id: 's2', type: 'skills', title: 'Skills', visible: true, items: [
      { id: 'k1', visible: true, category: 'Languages', skills: 'TypeScript, Go, SQL' },
    ] },
  ],
};

/** The ATS Check tab's own verdict on the template, for `template` with `settings`. */
const checkerVerdict = (template, settings = {}) => analyzeAtsScore({
  ...sample, template, settings: { ...sample.settings, ...settings },
}).categories.layout.items.find((i) => i.id === 'template');

/** Every state a user can actually be in: each template, and the Sidebar in both of its modes. */
const STATES = [
  ...TEMPLATE_IDS.filter((t) => t !== 'sidebar').map((t) => [t, {}]),
  ['sidebar', { sidebarSingleColumn: false }],
  ['sidebar', { sidebarSingleColumn: true }],
];

test('atsRating is the only answer: the picker\'s badge and the ATS Check verdict never disagree (TUI-5)', () => {
  for (const [template, settings] of STATES) {
    const rating = atsRating(template, settings);
    const verdict = checkerVerdict(template, settings);
    const label = `${template}${settings.sidebarSingleColumn ? ' (single)' : ''}`;
    assert.equal(
      rating.safe, verdict.status === 'pass',
      `${label}: atsRating says safe=${rating.safe}, the ATS Check says ${verdict.status} — they must be one answer`,
    );
  }
});

test('the picker\'s badge is derived from atsRating, not a second list (TUI-5)', () => {
  for (const t of TEMPLATE_PICKER) {
    assert.equal(t.ats, atsRating(t.id).safe, `${t.id}: the badge must come from atsRating`);
  }
});

test('Modern carries the badge it earns: single-column, and the checker passes it (TUI-5)', () => {
  assert.equal(checkerVerdict('modern').status, 'pass', 'the checker passes Modern');
  assert.equal(atsRating('modern').safe, true, 'so Modern is ATS-safe');
  assert.equal(TEMPLATE_PICKER.find((t) => t.id === 'modern').ats, true, 'and the picker badges it');
  // Still a notch below: its banner is a coloured ground, where the certified four print on the page.
  assert.equal(atsRating('modern').tier, 'good');
  assert.equal(atsRating('classic').tier, 'certified');
});

test('the Sidebar is rated by its Layout, because single column prints Classic\'s page (TUI-5)', () => {
  assert.equal(atsRating('sidebar', { sidebarSingleColumn: true }).tier, 'certified');
  assert.equal(atsRating('sidebar', { sidebarSingleColumn: true }).safe, true);
  assert.equal(atsRating('sidebar', { sidebarSingleColumn: false }).tier, 'risky');
  assert.equal(atsRating('sidebar', { sidebarSingleColumn: false }).safe, false);
  assert.equal(atsRating('sidebar').safe, false, 'two columns is the default');
});

test('atsRating answers for every template, and its points match the checker\'s score (TUI-5)', () => {
  for (const [template, settings] of STATES) {
    const rating = atsRating(template, settings);
    assert.ok(['certified', 'good', 'risky'].includes(rating.tier), `${template}: a known tier`);
    assert.equal(typeof rating.points, 'number');
    const report = analyzeAtsScore({ ...sample, template, settings: { ...sample.settings, ...settings } });
    // The layout category is the template's points plus the other layout checks; the template's own
    // contribution is what atsRating promises, so the total can never be below it.
    assert.ok(report.categories.layout.score >= rating.points, `${template}: layout score covers the template's points`);
  }
});

test('an unknown or oddly-cased template is rated as the one it prints as (TUI-5)', () => {
  assert.deepEqual(atsRating(' Modern '), atsRating('modern'));
  assert.deepEqual(atsRating('NotATemplate'), atsRating('classic'));
});
