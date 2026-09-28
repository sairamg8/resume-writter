// R4-SW-I-03: an address written out on an imported line ("… and https://b.com") became a link only
// when nothing else on the line was one: beside a Markdown [label](url), a Word hyperlink or a PDF
// link box it stayed plain text. Every written-out address is a link now, whatever else the line
// holds; the file's own links keep their labels, and a www. address links with https:// in front.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { docxXmlLines } from '../../src/utils/importFile.js';

const jobOf = (r) => r.sections.find((s) => s.type === 'experience')?.items[0];
const description = (bullets) => jobOf(resumeFromText(markdownLines([
  '# Pat Sample', '', '## Experience', '### **Acme** — *Engineer*', '*Mar 2021 – Present*', '', ...bullets,
].join('\n')))).description;

test('Markdown: a written-out address beside a link is a link too', () => {
  assert.equal(description(['- See [docs](https://a.com) and https://b.com']),
    '<ul><li>See <a href="https://a.com">docs</a> and <a href="https://b.com">https://b.com</a></li></ul>');
});

test('Markdown: a link whose label is its address is linked once, a www. address beside it with https://', () => {
  assert.equal(description(['- [https://a.com](https://a.com) and www.b.com.']),
    '<ul><li><a href="https://a.com">https://a.com</a> and <a href="https://www.b.com">www.b.com</a>.</li></ul>');
});

test('Word: a hyperlink and a written-out address on one line are both links', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Robin Vale</w:t></w:r></w:p><w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>Acme\t2020 – Present</w:t></w:r></w:p><w:p><w:r><w:t>Engineer</w:t></w:r></w:p>'
    + '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">Wrote the </w:t></w:r>'
    + '<w:hyperlink r:id="rId9"><w:r><w:t>API docs</w:t></w:r></w:hyperlink><w:r><w:t xml:space="preserve">, mirrored at www.mirror.example.com/api.</w:t></w:r></w:p></w:body></w:document>';
  const r = resumeFromText(docxXmlLines(xml, { rId9: 'https://docs.example.com/api' }));
  assert.equal(jobOf(r).description,
    '<ul><li>Wrote the <a href="https://docs.example.com/api">API docs</a>, mirrored at <a href="https://www.mirror.example.com/api">www.mirror.example.com/api</a>.</li></ul>');
});
