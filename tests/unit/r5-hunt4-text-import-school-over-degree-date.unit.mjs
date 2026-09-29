// R5-HUNT4-TEXT-IMPORT-SCHOOL-OVER-DEGREE-DATE-CONSECUTIVE: text, PDF and Word files whose schools
// each print over their "Degree ⇥ dates" line, with no blank line between entries. Before, the next
// school was read as the second line of the entry above: the first entry got the next school and
// its own in its description, and the second had no institution. After a list, the next school went
// into the description above. Each school is now its own entry's, as a degree over its school is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const schools = (text) => resumeFromText(text).sections.find((s) => s.type === 'education').items
  .map((e) => [e.institution, e.degree, e.startDate, e.endDate, e.description]);

test('consecutive "School" over "Degree ⇥ dates" entries each keep their own school', () => {
  assert.deepEqual(schools('Jane Doe\njane@x.com\n\nEDUCATION\nStanford University\nMBA\t2013 - 2015\nUniversity of Texas at Austin\nB.S. Electrical Engineering\t2007 - 2011'), [
    ['Stanford University', 'MBA', '2013', '2015', ''],
    ['University of Texas at Austin', 'B.S. Electrical Engineering', '2007', '2011', ''],
  ]);
});

test('with a list under the first entry, the next school is still the next entry\'s', () => {
  assert.deepEqual(schools('Jane Doe\njane@x.com\n\nEDUCATION\nStanford University\nMBA\t2013 - 2015\n• Dean list\nUniversity of Texas at Austin\nB.S. Electrical Engineering\t2007 - 2011'), [
    ['Stanford University', 'MBA', '2013', '2015', '<ul><li>Dean list</li></ul>'],
    ['University of Texas at Austin', 'B.S. Electrical Engineering', '2007', '2011', ''],
  ]);
});

test('a degree over its school, and a school under its degree\'s dated line, read as before', () => {
  assert.deepEqual(schools('Jane Doe\njane@x.com\n\nEducation\nMaster of Science in Data Science\nStanford University\t2018 – 2020\nBachelor of Science in Computer Science\nUniversity of Oregon\t2014 – 2018'), [
    ['Stanford University', 'Master of Science in Data Science', '2018', '2020', ''],
    ['University of Oregon', 'Bachelor of Science in Computer Science', '2014', '2018', ''],
  ]);
  assert.deepEqual(schools('Jane Doe\njane@x.com\n\nEducation\nMBA\t2013 - 2015\nStanford University'), [
    ['Stanford University', 'MBA', '2013', '2015', ''],
  ]);
});
