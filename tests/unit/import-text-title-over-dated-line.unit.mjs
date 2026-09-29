// R5-HUNT2: text, PDF and unstyled Word files whose entry prints its title on the line over its dated
// line ("Degree" over "School ⇥ 2014 – 2018", "Role" over "Company ⇥ Jan 2020 – Present"), or its
// employer or school in capitals over it ("ACME CORP" over "Senior Engineer ⇥ …"). Before, the title
// over went into the description (or the job above's), a job title was read as a grouped employer,
// and an employer in capitals started a custom section of its own, dropping Experience or Education.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const section = (r, type) => r.sections.find((s) => s.type === type);

test('a degree over "School ⇥ dates" is the entry\'s degree, not its description (R5-HUNT2-TEXT-IMPORT-DEGREE-OVER-SCHOOL-DATE-GOES-TO-DESCRIPTION)', () => {
  for (const dated of ['University of Oregon\t2014 – 2018', 'University of Oregon, 2014 – 2018']) {
    const r = resumeFromText(`Jane Doe\njane@x.com\n\nEducation\nBachelor of Science in Computer Science\n${dated}`);
    const [e, ...more] = section(r, 'education').items;
    assert.equal(more.length, 0);
    assert.deepEqual([e.institution, e.degree, e.startDate, e.endDate, e.description],
      ['University of Oregon', 'Bachelor of Science in Computer Science', '2014', '2018', ''], dated);
  }
});
