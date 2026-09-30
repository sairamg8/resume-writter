// R5-HUNT11-TITLECASE-UNKNOWN-HEADING-BECOMES-ENTRY: in a file with no heading marks, a Title-Case section
// title the import does not know ("Research Experience", "Teaching Experience") was no section: it became
// a blank entry of the section above (a fake degree), and that section's entries took its jobs. Such a
// title after a blank line starts a custom section now, as it does in capitals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('"Research Experience" and "Teaching Experience" in Title Case are sections of their own', () => {
  const r = resumeFromText('Dana Park\ndana@park.edu | 555-111-2222\n\nEducation\n\nStanford University\t2018 – 2024\nPh.D. Computer Science\n\nResearch Experience\n\nStanford AI Lab\t2019 – 2024\nGraduate Researcher\n• Published 5 papers on RL\n\nTeaching Experience\n\nStanford University\t2020 – 2021\nTeaching Assistant, CS229\n\nSkills\n\nPython, PyTorch, JAX\n');
  assert.deepEqual(r.sections.map((s) => [s.type, s.title]), [['education', 'Education'], ['custom', 'Research Experience'], ['custom', 'Teaching Experience'], ['skills', 'Skills']]);
  assert.deepEqual(items(r, 'education').map((e) => [e.institution, e.degree]), [['Stanford University', 'Ph.D. Computer Science']]);
  const research = r.sections[1].items;
  assert.deepEqual(research.map((x) => [x.title, x.subtitle]), [['Stanford AI Lab', 'Graduate Researcher']]);
  assert.match(research[0].description, /Published 5 papers on RL/);
  assert.equal(r.sections[2].items[0].title, 'Stanford University');
});

test('a job title or a label inside an entry after a blank line is no section', () => {
  const r = resumeFromText('Dana Park\ndana@park.edu\n\nExperience\n\nHead of Customer Experience\nAcme Corp\t2019 – 2024\n• Ran support\n\nNotable Projects\n• Rebuilt the help centre\n\nGlobex\t2016 – 2019\nSupport Lead\n');
  assert.deepEqual(r.sections.map((s) => s.type), ['experience']);
  const jobs = items(r, 'experience');
  assert.deepEqual(jobs.map((j) => [j.company, j.role]), [['Acme Corp', 'Head of Customer Experience'], ['Globex', 'Support Lead']]);
});
