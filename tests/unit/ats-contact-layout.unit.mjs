// The ATS Check's "Multi-column contact header" item reads the header the résumé prints (AUD-27).
// It used to read `settings.contactCols`, a setting no control writes: every résumé carries 1 or
// nothing, so the item passed even when Design → Contact Details → Layout "2 Grid" printed the
// contacts in two columns, and a stale `contactCols: 2` in an imported file warned about a grid the
// header does not print, with nothing in the app able to clear it.
//
// Run: node --test tests/unit/ats-contact-layout.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

/** Enough of a résumé for analyzeAtsScore to reach the layout category: three visible contacts. */
const sample = {
  id: 'ats_contact_layout', name: 'Sample', template: 'classic', settings: {},
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
  ],
};

const score = (template, settings = {}, personal = {}) => analyzeAtsScore({
  ...sample, template, settings: { ...sample.settings, ...settings }, personal: { ...sample.personal, ...personal },
});

/** The report's contact_layout item for `template` with `settings`. */
const verdict = (template, settings, personal) =>
  score(template, settings, personal).categories.layout.items.find((i) => i.id === 'contact_layout');

/** The templates whose header takes Contact Layout (PdfContactRow): hasHeaderControls. */
const HEADER_CONTROLS = [
  ['classic', {}], ['minimal', {}], ['executive', {}],
  ['sidebar', { sidebarSingleColumn: true }], // prints Classic's page and header
];
const label = (t, s) => `${t}${s.sidebarSingleColumn ? ' (single)' : ''}`;

test('2 Grid prints two columns of contacts, so the check warns (AUD-27)', () => {
  for (const [t, s] of HEADER_CONTROLS) {
    const v = verdict(t, { ...s, contactLayout: '2grid' });
    assert.equal(v.status, 'warn', `${label(t, s)} on 2 Grid`);
    assert.equal(v.text, 'Multi-column contact header', `${label(t, s)} on 2 Grid`);
  }
  const grid = score('classic', { contactLayout: '2grid' }).categories.layout.score;
  const row = score('classic', { contactLayout: 'justify' }).categories.layout.score;
  assert.equal(grid, row - 1, 'the warn costs the layout score one point');
});

test('Single, Justify and no layout at all are linear, so the check passes (AUD-27)', () => {
  for (const [t, s] of HEADER_CONTROLS) {
    for (const contactLayout of ['single', 'justify', undefined]) {
      const v = verdict(t, { ...s, contactLayout });
      assert.equal(v.status, 'pass', `${label(t, s)} on ${contactLayout ?? 'unset'}`);
      assert.equal(v.text, 'Linear contact formatting', `${label(t, s)} on ${contactLayout ?? 'unset'}`);
    }
  }
});

test('Modern and the two-column Sidebar ignore Contact Layout, so 2 Grid passes there (AUD-27)', () => {
  for (const [t, s] of [['modern', {}], ['sidebar', { sidebarSingleColumn: false }]]) {
    assert.equal(verdict(t, { ...s, contactLayout: '2grid' }).status, 'pass', `${label(t, s)} prints no grid`);
  }
});

test('a stale contactCols, which no control writes, neither warns nor clears the warning (AUD-27)', () => {
  assert.equal(verdict('classic', { contactCols: 2, contactLayout: 'justify' }).status, 'pass');
  assert.equal(verdict('modern', { contactCols: 2, contactLayout: 'justify' }).status, 'pass');
  assert.equal(verdict('classic', { contactCols: 1, contactLayout: '2grid' }).status, 'warn');
});

test('2 Grid with one visible contact prints one cell and no second column, so it passes (AUD-27)', () => {
  const v = verdict('classic', { contactLayout: '2grid' }, { hiddenFields: ['phone', 'location'] });
  assert.equal(v.status, 'pass', 'only the e-mail prints');
  const blank = verdict('classic', { contactLayout: '2grid' }, { phone: '', location: '  ' });
  assert.equal(blank.status, 'pass', 'blank values print nothing either');
});
