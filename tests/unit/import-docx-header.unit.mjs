// R4-IMP-05: the Word import read only word/document.xml, so a name and contact line set in Word's page
// header (Insert → Header, a common résumé layout) were lost: the résumé had no contacts, and its first
// body line ("Summary") became the name. The header the first page shows is now read before the body.
// The app's own export (a different first page with no header, "Name · Page N" on the others) adds nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, ExternalHyperlink, Header, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { docxLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

// A fictional person's body: no name in it, as in a résumé whose name sits in the page header.
const body = () => [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Summary')] }),
  new Paragraph('Product designer who ships design systems and the tools around them.'),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Experience')] }),
  new Paragraph('Juniper Labs — Senior Product Designer\tJan 2020 – Present'),
];
const headerOf = () => new Header({ children: [
  new Paragraph({ children: [new TextRun({ text: 'Robin Vale', bold: true })] }),
  new Paragraph({ children: [
    new TextRun('robin.vale@example.com | +1 555 0199 | '),
    new ExternalHyperlink({ link: 'https://www.linkedin.com/in/robin-vale-sample', children: [new TextRun('LinkedIn')] }),
  ] }),
] });
const docx = async (section) => docxLines(new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ ...section, children: body() }] }))));

test('the default page header: the name and the contacts, before the body', async () => {
  const r = resumeFromText(await docx({ headers: { default: headerOf() } }));
  assert.equal(r.personal.name, 'Robin Vale');
  assert.equal(r.personal.email, 'robin.vale@example.com');
  assert.equal(r.personal.phone, '+1 555 0199');
  assert.equal(r.personal.linkedin, 'https://www.linkedin.com/in/robin-vale-sample', 'the header\'s own hyperlinks are read');
  assert.match(r.personal.summary, /Product designer who ships/);
  assert.equal(r.sections.find((s) => s.type === 'experience')?.items[0]?.company, 'Juniper Labs');
});

test('a different first page: its "first page" header, not the others\'', async () => {
  const other = new Header({ children: [new Paragraph('Robin Vale · Page')] });
  const r = resumeFromText(await docx({ properties: { titlePage: true }, headers: { first: headerOf(), default: other } }));
  assert.equal(r.personal.name, 'Robin Vale');
  assert.equal(r.personal.email, 'robin.vale@example.com');
  assert.doesNotMatch(JSON.stringify(r), /· Page/);
});

test('a different first page with no header of its own (the app\'s running header): nothing is added', async () => {
  const running = new Header({ children: [new Paragraph('Robin Vale · Page')] });
  const lines = await docx({ properties: { titlePage: true }, headers: { default: running } });
  assert.equal(lines.find((l) => l.text.trim())?.text, 'Summary');
  assert.doesNotMatch(lines.map((l) => l.text).join('\n'), /Page/);
});

test('a header line the body starts with too is read once', async () => {
  const doc = new Document({ sections: [{ headers: { default: new Header({ children: [new Paragraph('Robin Vale')] }) },
    children: [new Paragraph('Robin Vale'), new Paragraph('robin.vale@example.com'), ...body()] }] });
  const lines = await docxLines(new Uint8Array(await Packer.toBuffer(doc)));
  assert.equal(lines.filter((l) => l.text === 'Robin Vale').length, 1);
});
