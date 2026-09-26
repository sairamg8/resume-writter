// R4-LO-02: a certificate or an award listed a bullet each, with indented sub-bullets under it (its
// issuer, what it was for), became one entry per sub-bullet: markdownLines and clean() took the indent
// off, so a nested item looked like the next entry. A nested item is its entry's text now — an award's
// description; a certificate's link, else its "Additional Information" — in Markdown, a text file and
// a Word list (its list level).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { docxXmlLines } from '../../src/utils/importFile.js';

const section = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('Markdown: nested items under an award are its description', () => {
  const md = '# Robin Vale\n\n## Awards\n- Best Paper Award – 2021\n  - For the tapir parser\n  - Chosen from 300 papers\n- Dean\'s List – 2019\n';
  const awards = section(resumeFromText(markdownLines(md)), 'awards');
  assert.deepEqual(awards.map((a) => [a.title, a.date]), [['Best Paper Award', '2021'], ['Dean\'s List', '2019']]);
  assert.match(awards[0].description, /For the tapir parser/);
  assert.match(awards[0].description, /Chosen from 300 papers/);
});

test('a text file: nested items under a certificate are its link and its extra text', () => {
  const text = 'Robin Vale\nrobin.vale@example.com\n\nCERTIFICATIONS\n'
    + '• AWS Certified Developer – 2022\n    ◦ https://example.com/cert/123\n    ◦ Renewed every three years\n'
    + '• CKA – 2023\n\t◦ Linux Foundation\n';
  const r = resumeFromText(text);
  const certs = section(r, 'certifications');
  assert.deepEqual(certs.map((c) => c.name), ['AWS Certified Developer', 'CKA']);
  assert.equal(certs[0].url, 'https://example.com/cert/123');
  assert.match(JSON.stringify(section(r, 'custom')), /Renewed every three years/);
});

test('Word: a list item at level 1 under one at level 0 is its entry\'s text', () => {
  const li = (text, lvl) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const xml = `<w:document><w:body><w:p><w:r><w:t>Robin Vale</w:t></w:r></w:p><w:p><w:r><w:t>AWARDS</w:t></w:r></w:p>${li('Best Paper Award – 2021', 0)}${li('For the tapir parser', 1)}${li('Dean&apos;s List – 2019', 0)}</w:body></w:document>`;
  const awards = section(resumeFromText(docxXmlLines(xml)), 'awards');
  assert.deepEqual(awards.map((a) => a.title), ['Best Paper Award', 'Dean\'s List']);
  assert.match(awards[0].description, /For the tapir parser/);
});

test('a list of certificates with no nesting is one entry each, as before', () => {
  const md = '# Robin Vale\n\n## Certifications\n- AWS Certified Developer – 2022\n- CKA – 2023\n';
  assert.deepEqual(section(resumeFromText(markdownLines(md)), 'certifications').map((c) => c.name), ['AWS Certified Developer', 'CKA']);
});
