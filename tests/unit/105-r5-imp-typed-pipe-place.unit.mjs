// IMP-REV-2 (R4-SW-I-05 review): a "|" the user typed in a place ("Boston, MA | Remote") is held as a
// placeholder through the Markdown import, and the place test failed on it: the export's own contact
// line gave no location — the whole of it went to "Additional Information" (before the fix the part
// before the "|" was kept) — and a grouped employer's place went to the first role's description. A
// place with a typed "|" is one place now, "|" and all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const fromMd = (md) => resumeFromText(markdownLines(md));
const extra = (r) => r.sections.find((s) => s.title === 'Additional Information');

for (const location of ['Boston, MA | Remote', 'London | Remote']) {
  test(`the contact line's location "${location}" comes back as the location`, () => {
    const md = generateMarkdownResume({ personal: { name: 'Pat Sample', email: 'pat@example.com', location }, sections: [] });
    const r = fromMd(md);
    assert.equal(r.personal.location, location, md);
    assert.equal(r.personal.email, 'pat@example.com', md);
    assert.equal(extra(r), undefined, md);
  });
}

test('a grouped employer\'s place with a typed "|" is each role\'s location, not a description', () => {
  const md = generateMarkdownResume({
    personal: { name: 'Pat Sample', email: 'pat@example.com' },
    sections: [{
      id: 's1', type: 'experience', title: 'Experience', settings: { groupRoles: true },
      items: [
        { id: 'e1', company: 'Acme', role: 'Engineering Manager', location: 'Leeds, UK | Remote', startDate: 'Mar 2021', current: true, description: '<ul><li>Grew the team.</li></ul>' },
        { id: 'e2', company: 'Acme', role: 'Senior Engineer', location: 'Leeds, UK | Remote', startDate: 'Jun 2018', endDate: 'Feb 2021', description: '<ul><li>Built billing.</li></ul>' },
      ],
    }],
  });
  const jobs = fromMd(md).sections.find((s) => s.type === 'experience')?.items || [];
  assert.deepEqual(jobs.map((j) => [j.company, j.role, j.location, j.description]), [
    ['Acme', 'Engineering Manager', 'Leeds, UK | Remote', '<ul><li>Grew the team.</li></ul>'],
    ['Acme', 'Senior Engineer', 'Leeds, UK | Remote', '<ul><li>Built billing.</li></ul>'],
  ], md);
});
