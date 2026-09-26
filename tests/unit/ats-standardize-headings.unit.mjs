// Unit test for standardizeSectionsForAts (TUI-7): it changes the headings the ATS report flags, by
// the report's own rule, and nothing else.
//
// The report (analyzeAtsScore's std_headings item) flags a heading only when its section is visible
// and its title is not on that type's alias list (isStandardAtsTitle). The fixer used neither rule:
// it set every typed section's title to the canonical heading — "Work Experience" and "Awards",
// which the report passes, and hidden sections, which it never looks at — and it set titleOrder:
// 'role' on every experience section, which the button's label never mentions.
// Run: node --test tests/unit/ats-standardize-headings.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATS_STANDARD_SECTIONS,
  standardizeSectionsForAts,
  analyzeAtsScore,
} from '../../src/utils/atsChecker.js';

/**
 * Visible headings the report flags, visible ones it passes, a hidden one and a custom one — each
 * with an entry, as a section with none prints no heading at all (R4-CL-11).
 */
const mixedSections = () => [
  { id: 'exp', type: 'experience', title: 'Work Experience', visible: true, settings: { titleOrder: 'company' }, items: [{ id: 'i' }] },
  { id: 'edu', type: 'education', title: 'My College', visible: true, settings: {}, items: [{ id: 'i' }] },
  { id: 'skl', type: 'skills', title: 'Technical Skills', visible: true, settings: {}, items: [{ id: 'i' }] },
  { id: 'prj', type: 'projects', title: 'Side Quests', visible: false, settings: {}, items: [{ id: 'i' }] },
  { id: 'awd', type: 'awards', title: 'Awards', visible: true, settings: {}, items: [{ id: 'i' }] },
  { id: 'hob', type: 'custom', title: 'Hobbies', visible: true, settings: {}, items: [{ id: 'i' }] },
  { id: 'vol', type: 'volunteering', title: 'Giving Back', settings: {}, items: [{ id: 'i' }] }, // no `visible`: shown
];

const stdHeadings = (sections) => analyzeAtsScore({ template: 'classic', settings: {}, personal: {}, sections })
  .categories.headings.items.find((i) => i.id === 'std_headings');

/** The `"title" → "canonical"` pairs the report lists in its std_headings detail. */
const reportedPairs = (sections) => [...(stdHeadings(sections).detail.matchAll(/"([^"]+)" → "([^"]+)"/g))]
  .map(([, from, to]) => `${from} → ${to}`).sort();

test('standardizeSectionsForAts: renames only the visible headings the report flags', () => {
  const out = standardizeSectionsForAts(mixedSections());
  assert.deepEqual(out.map((s) => s.title), [
    'Work Experience', // on the alias list: the report passes it
    'Education', // "My College": flagged
    'Technical Skills', // on the alias list
    'Side Quests', // hidden: the report never looks at it
    'Awards', // on the alias list
    'Hobbies', // custom sections have no canonical heading
    'Volunteering', // "Giving Back", visible by default: flagged
  ]);
});

test('standardizeSectionsForAts: renames exactly the pairs the report lists, and the warning clears', () => {
  const before = mixedSections();
  const out = standardizeSectionsForAts(before);
  const renamed = before.flatMap((s, i) => (out[i].title !== s.title ? [`${s.title} → ${out[i].title}`] : [])).sort();
  assert.deepEqual(renamed, reportedPairs(before));
  assert.deepEqual(renamed, ['Giving Back → Volunteering', 'My College → Education']);
  assert.equal(stdHeadings(out).status, 'pass');
});

test('standardizeSectionsForAts: writes no title order — that is the separate "Put Job Title First" fix', () => {
  const [exp] = standardizeSectionsForAts(mixedSections());
  assert.equal(exp.titleOrder, undefined);
  assert.equal(exp.settings.titleOrder, 'company');
  // Nor on an experience section it does rename.
  const [renamed] = standardizeSectionsForAts([
    { id: 'e', type: 'experience', title: 'Where I Worked', settings: { titleOrder: 'company' }, items: [{ id: 'i' }] },
  ]);
  assert.equal(renamed.title, ATS_STANDARD_SECTIONS.experience.canonical);
  assert.equal(renamed.titleOrder, undefined);
  assert.deepEqual(renamed.settings, { titleOrder: 'company' });
});

test('standardizeSectionsForAts: a section it does not rename is returned as the same object', () => {
  const before = mixedSections();
  const out = standardizeSectionsForAts(before);
  for (const i of [0, 2, 3, 4, 5]) assert.equal(out[i], before[i], `${before[i].title} is untouched`);
  // The one it renames changes only its title, on a copy.
  assert.notEqual(out[1], before[1]);
  assert.deepEqual({ ...out[1], title: before[1].title }, before[1]);
  assert.equal(before[1].title, 'My College', 'the input is not mutated');
});

test('standardizeSectionsForAts: an alias in any case or spacing already passes, so it stays as typed', () => {
  const sections = [{ id: 'x', type: 'skills', title: '  CORE competencies ', visible: true }];
  assert.equal(stdHeadings(sections).status, 'pass');
  assert.equal(standardizeSectionsForAts(sections)[0], sections[0]);
});

test('standardizeSectionsForAts: a hidden section is renamed once it is shown and flagged', () => {
  const shown = mixedSections().map((s) => (s.id === 'prj' ? { ...s, visible: true } : s));
  assert.match(stdHeadings(shown).detail, /"Side Quests" → "Projects"/);
  assert.equal(standardizeSectionsForAts(shown).find((s) => s.id === 'prj').title, 'Projects');
});

test('standardizeSectionsForAts: headings that all pass come back untouched; odd input is passed through', () => {
  const clean = mixedSections().filter((s) => !['edu', 'vol'].includes(s.id));
  assert.equal(stdHeadings(clean).status, 'pass');
  const out = standardizeSectionsForAts(clean);
  clean.forEach((s, i) => assert.equal(out[i], s));
  assert.equal(standardizeSectionsForAts(undefined), undefined);
  const odd = [null, { id: 'n', title: 'No type' }];
  const oddOut = standardizeSectionsForAts(odd);
  assert.equal(oddOut[0], null);
  assert.equal(oddOut[1], odd[1]);
});

// R4-CL-11: a section with no shown entry prints no heading (sectionPrints, R2-057), yet the report
// called its heading non-standard and withheld 4 points, and the fix renamed it. Only headings that
// print are judged — the rule has_exp, has_edu and has_skills already use.
test('an empty or all-hidden section is neither flagged nor renamed', () => {
  const sections = [
    { id: 'exp', type: 'experience', title: 'Work Experience', items: [{ id: 'e1', role: 'Engineer', company: 'Acme' }] },
    { id: 'empty', type: 'projects', title: 'Side Stuff', items: [] },
    { id: 'none', type: 'awards', title: 'Shiny Things' },
    { id: 'hidden', type: 'education', title: 'My College', items: [{ id: 'd1', degree: 'BSc', visible: false }] },
  ];
  const item = stdHeadings(sections);
  assert.equal(item.status, 'pass', item.detail);
  const out = standardizeSectionsForAts(sections, 'classic');
  sections.forEach((s, i) => assert.equal(out[i], s, `${s.title} is untouched`));
  // With an entry shown, the same heading is flagged and renamed.
  const shown = sections.map((s) => (s.id === 'empty' ? { ...s, items: [{ id: 'p1', name: 'Tool' }] } : s));
  assert.match(stdHeadings(shown).detail, /"Side Stuff" → "Projects"/);
  assert.equal(standardizeSectionsForAts(shown, 'classic').find((s) => s.id === 'empty').title, 'Projects');
});
