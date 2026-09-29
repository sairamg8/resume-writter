// R4-SW-I-05: a "|" the user typed in a field — a company "R&D | Ops", a location "Boston | Remote", a
// headline "Designer | Illustrator" — is escaped by the Markdown export ("\|"), but the import took the
// escape off before it split fields at " | ": the company came back as "R&D" with "Ops" in the
// description, the place cut in two, and the headline lost to "Additional Information". An escaped
// "\|" is the user's character now, never a field's edge; the export's own unescaped " | " still is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const fromMd = (md) => resumeFromText(markdownLines(md));
const first = (r, type) => r.sections.find((s) => s.type === type)?.items[0];

test('a company with a typed "|" stays the company', () => {
  const r = fromMd('# Pat Sample\n\n## Experience\n### **Engineer** — *R&D \\| Ops*\n*Mar 2021 – Present | Portland, OR*\n\n- Built it.\n');
  const job = first(r, 'experience');
  assert.deepEqual([job.company, job.role, job.location], ['R&D | Ops', 'Engineer', 'Portland, OR']);
  assert.equal(job.description, '<ul><li>Built it.</li></ul>');
});

test('a meta line\'s place with a typed "|" stays the place', () => {
  const r = fromMd('# Pat Sample\n\n## Education\n### **B.S., Computer Science** — *Boston University*\n*2019 | Boston \\| Remote*\n');
  const school = first(r, 'education');
  assert.equal(school.location, 'Boston | Remote');
  assert.ok(!school.description, school.description);
});

test('the export\'s own Markdown: a typed "|" in the headline, a company and a place round-trips', () => {
  const md = generateMarkdownResume({
    personal: { name: 'Pat Sample', title: 'Designer | Illustrator', email: 'pat@example.com' },
    sections: [
      { id: 's1', type: 'experience', title: 'Experience', settings: {}, items: [
        { id: 'e1', company: 'R&D | Ops', role: 'Engineer', location: 'Leeds | Remote', startDate: 'Mar 2021', current: true, description: '<ul><li>Built it.</li></ul>' },
      ] },
    ],
  });
  const r = fromMd(md);
  assert.equal(r.personal.title, 'Designer | Illustrator', md);
  const job = first(r, 'experience');
  assert.deepEqual([job.company, job.role, job.location, job.description], ['R&D | Ops', 'Engineer', 'Leeds | Remote', '<ul><li>Built it.</li></ul>'], md);
  assert.equal(r.sections.find((s) => s.title === 'Additional Information'), undefined, md);
  assert.ok(!JSON.stringify(r).includes('﷐'), 'no placeholder is stored');
});
