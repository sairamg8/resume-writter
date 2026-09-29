// R5-HUNT7-BULLETED-HEADER-CONTACTS: contacts set as a bulleted list under the name ("- Email: jane@x.com"
// in Markdown, "• 555-123-4567" in a text file, a Word bulleted list) kept their list mark on the header
// piece, so none read as a contact: the email became the job title, the phone and place went to
// "Additional Information", and a link's Display label began "• ". The same under a "Contact" heading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';
import { docxXmlLines } from '../../src/utils/importFile.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information');
const contacts = (p) => [p.email, p.phone, p.location];

test('Markdown: a bulleted, labelled contact list under the name', () => {
  const r = resumeFromText(markdownLines('# Jane Doe\n\n- Email: jane@x.com\n- Phone: 555-123-4567\n- Location: Austin, TX\n- [LinkedIn](https://linkedin.com/in/jane)\n\n## Experience\n\n### Acme Corp — Software Engineer\n*Jan 2020 – Present*\n\n- Built things'));
  assert.equal(r.personal.name, 'Jane Doe');
  assert.equal(r.personal.title, '');
  assert.deepEqual(contacts(r.personal), ['jane@x.com', '555-123-4567', 'Austin, TX']);
  assert.equal(r.personal.linkedin, 'https://linkedin.com/in/jane');
  assert.equal(r.personal.linkedinLabel, 'LinkedIn');
  assert.equal(extra(r), undefined);
});

test('text: a job title, then contacts each behind a "•"', () => {
  const r = resumeFromText('Jane Doe\nSoftware Engineer\n• jane@x.com\n• 555-123-4567\n• Austin, TX\n\nExperience\nAcme Corp\tJan 2020 – Present\nEngineer\n• Built things');
  assert.equal(r.personal.title, 'Software Engineer');
  assert.deepEqual(contacts(r.personal), ['jane@x.com', '555-123-4567', 'Austin, TX']);
  assert.equal(extra(r), undefined);
});

test('text: a bulleted list under a "Contact" heading', () => {
  const r = resumeFromText('Jane Doe\n\nContact\n• jane@x.com\n• 555-123-4567\n• Austin, TX\n\nExperience\nAcme Corp\tJan 2020 – Present\nEngineer');
  assert.deepEqual(contacts(r.personal), ['jane@x.com', '555-123-4567', 'Austin, TX']);
  assert.equal(extra(r), undefined);
});

test('Word: the contacts a bulleted list under the name', () => {
  const li = (text) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const xml = '<w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Jane Doe</w:t></w:r></w:p>'
    + li('jane@x.com') + li('555-123-4567') + li('Austin, TX')
    + '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Experience</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>Acme Corp</w:t><w:tab/><w:t>Jan 2020 – Present</w:t></w:r></w:p></w:body>';
  const r = resumeFromText(docxXmlLines(xml));
  assert.equal(r.personal.title, '');
  assert.deepEqual(contacts(r.personal), ['jane@x.com', '555-123-4567', 'Austin, TX']);
  assert.equal(extra(r), undefined);
});

test('a bulleted line in the header that is no contact keeps its mark where it goes', () => {
  const r = resumeFromText('Jane Doe\nSoftware Engineer\njane@x.com\n• Open to relocation\n\nExperience\nAcme Corp\tJan 2020 – Present\nEngineer');
  assert.equal(r.personal.email, 'jane@x.com');
  assert.match(extra(r).items[0].description, /Open to relocation/);
});
