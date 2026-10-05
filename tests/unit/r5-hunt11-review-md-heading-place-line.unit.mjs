// R5-HUNT11 review of R5-HUNT11-MD-ENTRY-HEADING-ROLE-LINE-SPLITS-ENTRY: an undated "###" heading takes
// the one short line under it into its header when a date line follows (the role, the degree). Where
// that line was the entry's place ("### Amazon", "Seattle, WA", "*Jan 2020 – Present*"), the job's role
// read "Seattle, WA" and a school's degree "Cambridge, MA". A place there is the entry's location.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const md = (s) => resumeFromText(markdownLines(s));

test('"### Amazon" over "Seattle, WA" over the dates: Amazon in Seattle, no role; "Remote" the same', () => {
  const r = md('# Alex Kim\n\n## Experience\n\n### Amazon\nSeattle, WA\n*Jan 2020 – Present*\n- Built things\n\n### Globex\nRemote\n*Jun 2016 – Dec 2019*\n- Shipped it\n');
  assert.deepEqual(items(r, 'experience').map((j) => [j.company, j.role, j.location, j.startDate]), [['Amazon', '', 'Seattle, WA', 'Jan 2020'], ['Globex', '', 'Remote', 'Jun 2016']]);
});

test('"### MIT" over "Cambridge, MA" over the years: in Cambridge, the place no degree (MIT alone reads as "### MIT" over its years does)', () => {
  const [school] = items(md('# Alex Kim\n\n## Education\n\n### MIT\nCambridge, MA\n2012 – 2016\n'), 'education');
  const [alone] = items(md('# Alex Kim\n\n## Education\n\n### MIT\n2012 – 2016\n'), 'education');
  assert.deepEqual([school.location, school.startDate, school.endDate], ['Cambridge, MA', '2012', '2016']);
  assert.deepEqual([school.institution, school.degree], [alone.institution, alone.degree]);
});

test('the role line under the heading is still the role', () => {
  const r = md('# Alex Kim\n\n## Experience\n\n### Amazon\n**Senior Engineer**\n*Jan 2020 – Present*\n');
  assert.deepEqual(items(r, 'experience').map((j) => [j.company, j.role, j.location]), [['Amazon', 'Senior Engineer', '']]);
});
