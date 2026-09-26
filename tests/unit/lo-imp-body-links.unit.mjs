// R4-LO-05: a link inside body text — a Markdown [label](url), a Word hyperlink, a PDF's link box —
// imported as plain text, "label (url)", in the description or the summary: the address printed after
// the label, and nothing to click. The rich text holds it as a link now, <a href="url">label</a>; an
// address written out in a text file's body ("see https://…") is a link too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { docxXmlLines, pdfLinesOfPages } from '../../src/utils/importFile.js';

const jobOf = (r) => r.sections.find((s) => s.type === 'experience')?.items[0];

test('Markdown: a link in a job\'s bullet and in the summary is a link', () => {
  const md = '# Robin Vale\n\n## Summary\nMaintainer of [Tidewater](https://github.com/robin-vale-sample/tidewater), a CDC tool.\n\n'
    + '## Experience\n### Acme — Engineer\n*2020 – Present*\n\n- Wrote the [billing API docs](https://docs.example.com/billing) and [x.com](https://x.com)\n- Shipped v2\n';
  const r = resumeFromText(markdownLines(md));
  assert.equal(r.personal.summary, '<p>Maintainer of <a href="https://github.com/robin-vale-sample/tidewater">Tidewater</a>, a CDC tool.</p>');
  assert.equal(jobOf(r).description,
    '<ul><li>Wrote the <a href="https://docs.example.com/billing">billing API docs</a> and <a href="https://x.com">x.com</a></li><li>Shipped v2</li></ul>');
});

test('Word: a hyperlink in a job\'s paragraph is a link', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Robin Vale</w:t></w:r></w:p><w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>Acme\t2020 – Present</w:t></w:r></w:p><w:p><w:r><w:t>Engineer</w:t></w:r></w:p>'
    + '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">Wrote the </w:t></w:r>'
    + '<w:hyperlink r:id="rId9"><w:r><w:t>API docs</w:t></w:r></w:hyperlink><w:r><w:t xml:space="preserve"> for partners.</w:t></w:r></w:p></w:body></w:document>';
  const r = resumeFromText(docxXmlLines(xml, { rId9: 'https://docs.example.com/api' }));
  assert.equal(jobOf(r).description, '<ul><li>Wrote the <a href="https://docs.example.com/api">API docs</a> for partners.</li></ul>');
});

test('PDF: a link box over body text is a link', () => {
  const item = (str, x, y, w) => ({ str, x, y, w, h: 10 });
  const docs = item('Wrote the API docs.', 60, 640, 120);
  docs.links = [{ label: 'API docs', url: 'https://docs.example.com/api' }];
  const page = [item('Robin Vale', 40, 760, 80), item('EXPERIENCE', 40, 720, 70),
    item('Acme', 40, 690, 40), item('2020 – Present', 450, 690, 80), item('Engineer', 40, 676, 60),
    item('•', 48, 640, 4), docs];
  const r = resumeFromText(pdfLinesOfPages([page]));
  assert.equal(jobOf(r).description, '<ul><li>Wrote the <a href="https://docs.example.com/api">API docs</a>.</li></ul>');
});

test('a text file: an address written out is a link; its text stays as typed', () => {
  const text = 'Robin Vale\nrobin.vale@example.com\n\nEXPERIENCE\nAcme - Engineer\n2020 - Present\n* Demo at https://demo.example.com/app.\n* See www.example.com/work & more\n';
  assert.equal(jobOf(resumeFromText(text)).description,
    '<ul><li>Demo at <a href="https://demo.example.com/app">https://demo.example.com/app</a>.</li><li>See <a href="https://www.example.com/work">www.example.com/work</a> &amp; more</li></ul>');
});
