// The ATS Check's layout category certified a single column while Section Options → Grids 2 printed a
// section's entries side by side (R2-021). Two jobs in a row of two cells are two columns on the page:
// a parser that reads a page line by line — Poppler, and the older Workday and Taleo readers — reads
// across both cells and interleaves the jobs' lines. The layout check only looked at the template, so
// on Classic it still said "Single-column text flow ensures 100% sequential parsing". It now looks at
// the sections too: a shown section of multi-line entries (jobs, degrees, projects, volunteer roles,
// custom entries) printing two or more of them per row is a warning with its own fix, Grids 1, and the
// text flow's points are what two columns earn. Short sections (skills, languages, certificates,
// awards, references) print one line or a card per cell and are the template tier's business (Compact).
// tests/pdf/77-ats-section-grids.test.mjs checks the PDF prints these entries side by side.
//
// Run: node --test tests/unit/ats-section-grids.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore, entriesInOneColumn } from '../../src/utils/atsChecker.js';
import { TEMPLATE_IDS, ATS_TIER_POINTS, atsRating } from '../../src/constants/templates.js';

const job = (id, company) => ({ id, company, role: 'Engineer', startDate: '2019-01', endDate: '2021-01', bullets: ['Built 3 services.'] });

const sample = ({ template = 'classic', settings = {}, exp = {}, expExtra = {}, jobs = [job('e1', 'Acme'), job('e2', 'Initech')], more = [] } = {}) => ({
  id: 'grids', template, settings,
  personal: { name: 'Lena Novak', hiddenFields: [] },
  sections: [
    { id: 'exp', type: 'experience', title: 'Professional Experience', visible: true, settings: exp, items: jobs, ...expExtra },
    ...more,
  ],
});

const layout = (r) => analyzeAtsScore(r).categories.layout;
const gridItem = (r) => layout(r).items.find((i) => i.id === 'section_grids');

test('the repro: Classic with its experience in Grids 2 is not a certified single column', () => {
  const r = sample({ exp: { columns: 2 } });
  const item = gridItem(r);
  assert.ok(item, 'the layout category warns about the grid');
  assert.equal(item.status, 'warn');
  assert.match(item.text, /Professional Experience/);
  assert.match(`${item.text} ${item.detail}`, /Grids/, 'it names the control');
  assert.deepEqual(item.actions, ['grids_one_column']);
  assert.doesNotMatch(layout(r).items.find((i) => i.id === 'template').detail, /100% sequential/, 'the template item no longer promises it');
  const flat = layout(sample({ exp: { columns: 1 } })).score;
  assert.equal(layout(r).score, flat - (atsRating('classic').points - ATS_TIER_POINTS.risky), 'the text flow scores as two columns');
});

test('Grids 1, one entry, a hidden section or hidden entries: nothing prints side by side (the guards)', () => {
  assert.equal(gridItem(sample()), undefined);
  assert.equal(gridItem(sample({ exp: { columns: 1 } })), undefined);
  assert.equal(gridItem(sample({ exp: { columns: 2 }, jobs: [job('e1', 'Acme')] })), undefined, 'one cell is one column');
  assert.equal(gridItem(sample({ exp: { columns: 2 }, expExtra: { visible: false } })), undefined, 'a hidden section prints nothing');
  assert.equal(gridItem(sample({ exp: { columns: 2 }, jobs: [job('e1', 'Acme'), { ...job('e2', 'Initech'), visible: false }] })), undefined);
});

test('every template: a grid of jobs warns, and the template\'s own verdict stays its own', () => {
  for (const template of TEMPLATE_IDS) {
    for (const settings of template === 'sidebar' ? [{}, { sidebarSingleColumn: true }] : [{}]) {
      const r = sample({ template, settings, exp: { columns: 2 } });
      assert.ok(gridItem(r), `${template} ${JSON.stringify(settings)}`);
      const verdict = layout(r).items.find((i) => i.id === 'template');
      assert.equal(verdict.status === 'pass', atsRating(template, settings).safe, `${template}: the template item is still atsRating's answer`);
    }
  }
});

test('each type of multi-line entry is checked; short sections are the template tier\'s', () => {
  const two = (type, a, b) => ({ id: type, type, title: type, visible: true, settings: { columns: 2 }, items: [{ id: `${type}1`, ...a }, { id: `${type}2`, ...b }] });
  for (const [type, a, b] of [
    ['education', { institution: 'MIT', degree: 'BS' }, { institution: 'ETH', degree: 'MS' }],
    ['projects', { name: 'Ledger' }, { name: 'Atlas' }],
    ['volunteering', { org: 'Code Club', role: 'Mentor' }, { org: 'Food Bank', role: 'Driver' }],
    ['custom', { title: 'Talk', subtitle: 'KubeCon' }, { title: 'Paper', subtitle: 'VLDB' }],
  ]) {
    const item = gridItem(sample({ more: [two(type, a, b)] }));
    assert.ok(item, type);
    assert.match(item.text, new RegExp(type));
  }
  for (const [type, a, b] of [
    ['skills', { category: 'Languages', skills: 'Go' }, { category: 'Cloud', skills: 'AWS' }],
    ['languages', { language: 'Spanish' }, { language: 'German' }],
    ['certifications', { name: 'CKA' }, { name: 'AWS SAA' }],
    ['awards', { title: 'Hackathon' }, { title: 'Dean\'s list' }],
    ['references', { name: 'Tom Reyes' }, { name: 'Ann Lee' }],
  ]) {
    assert.equal(gridItem(sample({ more: [two(type, a, b)] })), undefined, type);
  }
});

test('the Sidebar\'s side column prints one column whatever Grids says', () => {
  const edu = { id: 'edu', type: 'education', title: 'Education', visible: true, settings: { columns: 2 },
    items: [{ id: 'd1', institution: 'MIT', degree: 'BS' }, { id: 'd2', institution: 'ETH', degree: 'MS' }] };
  assert.equal(gridItem(sample({ template: 'sidebar', more: [edu] })), undefined, 'education sits in the side column');
  assert.ok(gridItem(sample({ template: 'sidebar', settings: { sidebarSingleColumn: true }, more: [edu] })), 'single column: it is in the main column');
});

test('its fix sets Grids 1 on the flagged sections and changes nothing else', () => {
  const skills = { id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: { columns: 2 }, items: [] };
  const hidden = { id: 'old', type: 'experience', title: 'Earlier', visible: false, settings: { columns: 2 }, items: [job('o1', 'Hooli'), job('o2', 'Globex')] };
  const r = sample({ exp: { columns: 2, spacing: 'compact' }, more: [skills, hidden] });
  const fixed = entriesInOneColumn(r.sections, r.template, r.settings);
  assert.deepEqual(fixed[0].settings, { columns: 1, spacing: 'compact' });
  assert.equal(fixed[1], r.sections[1], 'the skills grid is not the warning\'s');
  assert.equal(fixed[2], r.sections[2], 'a hidden section is not the warning\'s');
  assert.equal(gridItem({ ...r, sections: fixed }), undefined, 'and the warning is gone');
});
