// R2-147-col — where a section prints on the Sidebar, by its column layout (Design → Template → Layout):
// a short section (skills, education, languages, certifications, interests, references) is in the side
// column on the two columns, in one of the two Mixed columns in Mixed — each a column of its own, one
// entry to a row whatever its Grids — and in neither on Single · ATS-safe or another template. The ATS
// Check reads it so: an education in Grids 2 in a Mixed column prints one degree to a row, so it is no
// "entries side by side" warning, and its fix (Grids 1) leaves it alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBAR_COLUMN_TYPES, inMixedColumns, inSidebarColumn } from '../../src/constants/templates.js';
import { analyzeAtsScore, entriesInOneColumn } from '../../src/utils/atsChecker.js';

test('a short section is in the side column on the two columns, in a Mixed column in Mixed, and in neither elsewhere', () => {
  for (const type of SIDEBAR_COLUMN_TYPES) {
    assert.deepEqual([inSidebarColumn('sidebar', type, {}), inMixedColumns('sidebar', type, {})], [true, false], `${type}: two columns`);
    assert.deepEqual([inSidebarColumn('sidebar', type, { layoutColumns: 'mixed' }), inMixedColumns('sidebar', type, { layoutColumns: 'mixed' })], [false, true], `${type}: Mixed`);
    assert.deepEqual([inSidebarColumn('sidebar', type, { layoutColumns: 'mixed', sidebarSingleColumn: true }), inMixedColumns('sidebar', type, { layoutColumns: 'mixed', sidebarSingleColumn: true })], [false, false], `${type}: Single · ATS-safe`);
    assert.equal(inMixedColumns('classic', type, { layoutColumns: 'mixed' }), false, `${type}: Classic`);
    assert.equal(inMixedColumns('sidebar', type, { layoutColumns: 'grid' }), false, `${type}: a value no build offered is the two columns`);
  }
  for (const type of ['experience', 'projects', 'awards', 'volunteering', 'custom']) {
    assert.equal(inMixedColumns('sidebar', type, { layoutColumns: 'mixed' }), false, `${type} prints across the page in Mixed`);
  }
});

const degree = (id, school) => ({ id, institution: school, degree: 'MSc', startDate: '2012-09', endDate: '2014-06' });
const withEducation = (template, settings) => ({
  id: 'r', template, settings,
  personal: { name: 'Lena Novak', hiddenFields: [] },
  sections: [{ id: 'edu', type: 'education', title: 'Education', visible: true, settings: { columns: 2 }, items: [degree('d1', 'Porto'), degree('d2', 'Lisbon')] }],
});
const gridWarning = (r) => analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'section_grids');

test('the ATS Check: an education in Grids 2 in a Mixed column is no side-by-side warning, and Grids 1 leaves it alone', () => {
  const mixed = withEducation('sidebar', { layoutColumns: 'mixed' });
  assert.equal(gridWarning(mixed), undefined, 'Mixed: one degree to a row, no warning');
  assert.equal(entriesInOneColumn(mixed.sections, mixed.template, mixed.settings)[0], mixed.sections[0], 'Mixed: the fix changes nothing');
  const classic = withEducation('classic', {});
  assert.ok(gridWarning(classic), 'Classic prints the two degrees side by side');
  assert.equal(entriesInOneColumn(classic.sections, 'classic', {})[0].settings.columns, 1);
});
