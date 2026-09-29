// R5-HUNT5-IMPORT-HEADER-TITLE-WITH-COMMA-READ-AS-LOCATION, review: the fix reads a place-like line under
// the name as the job title when it holds a role word, but towns have role words in their names too:
// "Hilton Head, SC", "Mentor, Ohio", "Lead, SD" alone under the name became the job title and the
// résumé lost its location, the app's own export of a résumé with a location and no title included.
// A line that ends in a state or country is the title only when the header has its place elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const header = (r) => [r.personal.title, r.personal.email, r.personal.location];
const types = (r) => r.sections.map((s) => s.type);

test('a town with a role word in its name, alone under the name, is the location', () => {
  for (const place of ['Hilton Head, SC', 'Mentor, Ohio', 'Lead, SD', 'Chief Lake, Ontario']) {
    const r = resumeFromText(`Jane Doe\n${place}\njane@example.com\n\nEXPERIENCE\nAcme Corp\tJan 2020 – Present\nProduct Manager`);
    assert.deepEqual(header(r), ['', 'jane@example.com', place], place);
    assert.deepEqual(types(r), ['experience'], place);
  }
});

test('the Markdown export of a résumé in such a town, with no title, reads back its location', () => {
  const md = generateMarkdownResume({ personal: { name: 'Jane Doe', location: 'Hilton Head, SC' }, sections: [] });
  const r = resumeFromText(markdownLines(md));
  assert.equal(r.personal.title, '', md);
  assert.equal(r.personal.location, 'Hilton Head, SC', md);
});

test('a title with a comma is still the title, with or without a place elsewhere', () => {
  for (const title of ['Director, Product Marketing', 'Software Engineer, QA', 'Account Manager, PR']) {
    const r = resumeFromText(`Jane Doe\n${title}\njane@example.com\n\nEXPERIENCE\nAcme Corp\tJan 2020 – Present\nProduct Manager`);
    assert.deepEqual(header(r), [title, 'jane@example.com', ''], title);
  }
  const r = resumeFromText('Jane Doe\nSales Manager, Texas\njane@example.com | Austin, TX\n\nEXPERIENCE\nAcme Corp\tJan 2020 – Present\nSales Manager');
  assert.deepEqual(header(r), ['Sales Manager, Texas', 'jane@example.com', 'Austin, TX']);
});
