// R5-HUNT4-TEXT-IMPORT-ROLE-COMPANY-PLACE-LINE: a job's title line that names its role, its company
// and then its place ("Product Manager, Google — Mountain View, CA", "Software Engineer | Google |
// Mountain View, CA | June 2018 - Present"). Before, the place became the company and the role kept
// the company ("Product Manager, Google"), or the place went into the description as a paragraph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const job = (lines) => {
  const [j, ...more] = resumeFromText(`Jane Doe\njane@x.com\n\nEXPERIENCE\n${lines}\n• Led launch`).sections.find((s) => s.type === 'experience').items;
  assert.equal(more.length, 0);
  return [j.role, j.company, j.location, j.startDate, j.current, j.description];
};
const want = ['Product Manager', 'Google', 'Mountain View, CA', 'June 2018', true, '<ul><li>Led launch</li></ul>'];

test('"Role, Company — Place" over its dates: the role, the company and the location', () => {
  assert.deepEqual(job('Product Manager, Google — Mountain View, CA\nJune 2018 - Present'), want);
  assert.deepEqual(job('Product Manager, Google — Mountain View, CA\tJune 2018 - Present'), want);
});

test('"Role | Company | Place | Dates" and "Role — Company — Place": the place is the location, not the description', () => {
  assert.deepEqual(job('Product Manager | Google | Mountain View, CA | June 2018 - Present'), want);
  assert.deepEqual(job('Product Manager — Google — Mountain View, CA\tJune 2018 - Present'), want);
});

test('a role and a company with a comma of its own read as before', () => {
  assert.deepEqual(job('Senior Engineer — Acme, Inc.\tJune 2018 - Present').slice(0, 3), ['Senior Engineer', 'Acme, Inc.', '']);
  assert.deepEqual(job('Google — Mountain View, CA\nProduct Manager\tJune 2018 - Present').slice(0, 3), ['Product Manager', 'Google', 'Mountain View, CA']);
});
