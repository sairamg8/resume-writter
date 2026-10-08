// Job-seeker journey (cycle 7): Job Map, a Function / Level / Stack chosen in one country, then another country.
// The selects list only the values the country's rows have, so a value the new country lacks matched no option:
// the select drew its first option ("Any stack") while the filter still applied and the page said "0 roles" with
// nothing to undo it. filtersFor drops such a value, and the page filters by, and shows, what is left.
// Run: node --test tests/pdf/315-cyc7-job-map-filter-other-country.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

// A row: company, function, stack, level, title, location, url, position, careers (jobMapData's ROW).
const row = (fn, track, level, title) => [0, fn, track, level, title, 'Remote', 'https://example.com/x', '', ''];
const COMPANIES = [['Acme']];
const IN = [row('engineering', 'java', 'senior', 'Java Developer'), row('legal', 'other-eng', 'junior', 'Paralegal')];
const SG = [row('engineering', 'python', 'senior', 'Python Developer')];

it('a stack, function or level the other country has no rows for is not applied', async () => {
  const { filtersFor, filterRows } = await loadModule('/src/utils/jobMapData.js');
  const chosen = { fn: 'legal', level: 'junior', track: 'java', q: 'dev' };
  assert.deepEqual(filtersFor(IN, chosen), chosen, 'every value is in the country it was chosen in');

  const there = filtersFor(SG, chosen);
  assert.deepEqual(there, { fn: '', level: '', track: '', q: 'dev' }, 'none of the three is in the other country; the search stays');
  assert.equal(filterRows(SG, COMPANIES, chosen).length, 0, 'applied as chosen they leave no role (the bug)');
  assert.equal(filterRows(SG, COMPANIES, there).length, 1, 'the other country\'s Python Developer is listed');
});

it('only the values that are missing are dropped', async () => {
  const { filtersFor } = await loadModule('/src/utils/jobMapData.js');
  assert.deepEqual(filtersFor(SG, { fn: 'engineering', level: 'junior', track: 'python', q: '' }), { fn: 'engineering', level: '', track: 'python', q: '' });
  assert.deepEqual(filtersFor([], { fn: '', level: '', track: '', q: '' }), { fn: '', level: '', track: '', q: '' }, 'nothing chosen: nothing to drop');
});
