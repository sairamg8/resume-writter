// R5-HUNT5-IMPORT-HEADER-TITLE-WITH-COMMA-READ-AS-LOCATION: a job title with a comma under the name
// ("Product Manager, Payments") passed the place test, so it became the location, and the real place on
// the contact line went to "Additional Information". A line that names a role is now the job title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const header = (r) => [r.personal.title, r.personal.email, r.personal.phone, r.personal.location];
const types = (r) => r.sections.map((s) => s.type);

test('a title with a comma under the name is the job title, the place the location', () => {
  for (const title of ['Product Manager, Payments', 'Software Engineer, Backend', 'Director, Product Marketing']) {
    const r = resumeFromText(`Jane Doe\n${title}\njane@example.com | (206) 555-0100 | Seattle, WA\n\nEXPERIENCE\nAcme Corp\tJan 2020 – Present\nProduct Manager`);
    assert.deepEqual(header(r), [title, 'jane@example.com', '(206) 555-0100', 'Seattle, WA'], title);
    assert.deepEqual(types(r), ['experience'], `${title}: no "Additional Information"`);
  }
});

test('a place alone under the name is still the location', () => {
  const r = resumeFromText('Jane Doe\nSeattle, WA\njane@example.com\n\nEXPERIENCE\nAcme Corp\tJan 2020 – Present\nProduct Manager');
  assert.deepEqual(header(r), ['', 'jane@example.com', '', 'Seattle, WA']);
  assert.deepEqual(types(r), ['experience']);
});

test('the Markdown export of a title with a comma reads back the same', () => {
  const md = generateMarkdownResume({ personal: { name: 'Jane Doe', title: 'Software Engineer, Backend', email: 'jane@example.com', location: 'Seattle, WA' }, sections: [] });
  const r = resumeFromText(markdownLines(md));
  assert.equal(r.personal.title, 'Software Engineer, Backend', md);
  assert.equal(r.personal.location, 'Seattle, WA', md);
  assert.deepEqual(types(r), [], md);
});
