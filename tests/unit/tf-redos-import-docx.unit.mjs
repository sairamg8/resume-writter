// Typing-freeze finding 7a/7b (the sweep of what an import reaches): importFile.js read a Word file's XML with patterns that
// ran to a ">" or an end tag from each start tag. A document.xml with 30 000 start tags that never close took four to
// eighteen seconds (time squared), and the relationships file the same; paragraphs nested 40 000 deep took
// minutes (each one put its line in with splice, which moves every line after it); a paragraph of 30 000
// hyperlinks took five seconds (each one rebuilt the paragraph's text); and a page header with a long run of white
// space took as long again to cut its furniture ("Page 1", "Confidential") off. The XML is made well-formed first
// where it is not (a stray "<" is the text "&lt;", a missing end tag is written where its parent ends), which
// Word's own files never need; the paragraphs are written out in order at the end; a hyperlink's text is
// taken off the end of the paragraph's pieces. Word's own XML comes out as it did, on a seeded corpus (the old file is kept in
// tests/fixtures/typing-freeze-reference as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Header, Packer, Paragraph, TextRun } from 'docx';
import { docxLines, docxLinks, docxXmlLines } from '../../src/utils/importFile.js';
import * as before from '../fixtures/typing-freeze-reference/importFile.mjs';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}
const doc = (body) => `<w:document><w:body>${body}</w:body></w:document>`;

test('start tags that never close are read in linear time', () => {
  const cases = {
    "'<w:fldChar ' x 30 000": '<w:fldChar '.repeat(30_000),
    "'<w:p ' x 60 000": '<w:p '.repeat(60_000),
    "'<w:body ' x 60 000": '<w:body '.repeat(60_000),
    "'<mc:Fallback ' x 40 000": '<mc:Fallback '.repeat(40_000),
    "'<w:pPr>' x 60 000": '<w:pPr>'.repeat(60_000),
  };
  for (const [name, xml] of Object.entries(cases)) {
    const { ms } = timed(() => docxXmlLines(xml));
    assert.ok(ms < LIMIT_MS, `${name}: docxXmlLines took ${ms.toFixed(0)} ms`);
  }
});

test('relationships that never close are read in linear time', () => {
  const rels = '<Relationship '.repeat(40_000);
  const { out, ms } = timed(() => docxLinks(rels));
  assert.deepEqual(out, {});
  assert.ok(ms < LIMIT_MS, `docxLinks took ${ms.toFixed(0)} ms`);
});

test('paragraphs nested 120 000 deep come out in order, in linear time', () => {
  const xml = doc(`${'<w:p>'.repeat(120_000)}<w:r><w:t>deep</w:t></w:r>${'</w:p>'.repeat(120_000)}`);
  const { out, ms } = timed(() => docxXmlLines(xml));
  assert.equal(out.length, 120_000);
  assert.equal(out.filter((l) => l.text === 'deep').length, 1);
  assert.ok(ms < LIMIT_MS, `docxXmlLines took ${ms.toFixed(0)} ms`);
});

test('a paragraph of 30 000 hyperlinks, or 40 000 fields, is read in linear time, each as a link', () => {
  const links = doc(`<w:p>${'<w:hyperlink r:id="rId1"><w:r><w:t>ab</w:t></w:r></w:hyperlink>'.repeat(30_000)}</w:p>`);
  const { out, ms } = timed(() => docxXmlLines(links, { rId1: 'https://example.com' }));
  assert.equal(out.length, 1);
  assert.equal(out[0].links.length, 30_000);
  assert.ok(ms < LIMIT_MS, `docxXmlLines took ${ms.toFixed(0)} ms on hyperlinks`);
  const field = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPERLINK "https://x.io" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>ab</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const fields = timed(() => docxXmlLines(doc(`<w:p>${field.repeat(40_000)}</w:p>`)));
  assert.equal(fields.out[0].links.length, 40_000);
  assert.ok(fields.ms < LIMIT_MS, `docxXmlLines took ${fields.ms.toFixed(0)} ms on fields`);
});

test('a stray "<" in the text is the text, and an element left open is closed where its parent ends', () => {
  assert.deepEqual(docxXmlLines(doc('<w:p><w:r><w:t>a</w:t></w:r></w:p><w:p><w:r><w:t>b'), {}).map((l) => l.text), ['a', '']);
  assert.deepEqual(docxXmlLines(doc('<w:p><w:r><w:t>one</w:t></w:r><w:p><w:r><w:t>two</w:t></w:r></w:p>'), {}).map((l) => l.text), ['one', 'two']);
});

/** A .docx of the parts given as text, stored (not deflated): enough for the reader's own unzip. */
function zipOf(parts) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true);
    ev.setUint32(20, data.length, true);
    ev.setUint32(24, data.length, true);
    ev.setUint16(28, nameBytes.length, true);
    ev.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    chunks.push(local, data);
    central.push(entry);
    offset += local.length + data.length;
  }
  const size = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, central.length, true);
  dv.setUint16(10, central.length, true);
  dv.setUint32(12, size, true);
  dv.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of all) { out.set(c, at); at += c.length; }
  return out;
}

test('a document with 40 000 section-properties start tags and no end tag is read in linear time', async () => {
  const xml = `<w:document><w:body><w:p><w:r><w:t>Summary</w:t></w:r></w:p>${'<w:sectPr>'.repeat(40_000)}</w:body></w:document>`;
  const start = performance.now();
  const lines = await docxLines(zipOf({ 'word/document.xml': xml }));
  const ms = performance.now() - start;
  assert.equal(lines[0].text, 'Summary');
  assert.ok(ms < LIMIT_MS, `docxLines took ${ms.toFixed(0)} ms`);
});

const header = async (text) => docxLines(new Uint8Array(await Packer.toBuffer(new Document({
  sections: [{ headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun(text)] })] }) }, children: [new Paragraph('Summary'), new Paragraph('body text')] }],
}))));

test('a page header with a run of 80 000 spaces in it is read in linear time, and its furniture still goes', async () => {
  for (const text of [`Robin Vale${' '.repeat(80_000)}x`, `Page${' '.repeat(80_000)}x`, `Robin${'\t'.repeat(80_000)}x`]) {
    const start = performance.now();
    const lines = await header(text);
    const ms = performance.now() - start;
    assert.ok(lines.some((l) => l.text.startsWith(text.slice(0, 4))), 'the header is read');
    assert.ok(ms < LIMIT_MS, `docxLines took ${ms.toFixed(0)} ms`);
  }
  assert.equal((await header('Robin Vale – Page 2 of 3'))[0].text, 'Robin Vale');
  assert.equal((await header('Robin Vale\t\tConfidential'))[0].text, 'Robin Vale');
  assert.equal((await header('Page 1')).some((l) => l.text === 'Page 1'), false);
});

// A seeded corpus of Word-shaped XML, each document well-formed as Word writes it: the old and the new reader agree.
let seed = 11;
const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (list) => list[Math.floor(random() * list.length)];
const WORDS = ['Pat Doe', 'Experience', 'Acme Corp', 'Engineer', 'Jan 2020 – Present', 'Skills', 'Python', ' x ', '2019', 'Page 1', 'a &lt; b', 'R&amp;D', '&lt;tag&gt;', 'Education', 'MIT'];
const FIELD = '<w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://x.io" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>link</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/>';
const run = () => {
  const parts = [];
  for (let i = 0, k = 1 + Math.floor(random() * 3); i < k; i += 1) {
    const r = random();
    if (r < 0.5) parts.push(`<w:t${random() < 0.3 ? ' xml:space="preserve"' : ''}>${pick(WORDS)}</w:t>`);
    else if (r < 0.6) parts.push('<w:tab/>');
    else if (r < 0.65) parts.push('<w:br/>');
    else if (r < 0.7) parts.push('<w:noBreakHyphen/>');
    else if (r < 0.75) parts.push('<w:ptab w:relativeTo="margin"/>');
    else if (r < 0.8) parts.push(FIELD);
    else if (r < 0.85) parts.push('<w:softHyphen/>');
    else parts.push(`<w:t>${pick(WORDS)}</w:t>`);
  }
  return `<w:r>${random() < 0.3 ? '<w:rPr><w:b/></w:rPr>' : ''}${parts.join('')}</w:r>`;
};
const paragraph = (depth = 0) => {
  let inner = '';
  if (random() < 0.5) inner += `<w:pPr>${random() < 0.3 ? `<w:pStyle w:val="${pick(['Heading1', 'Heading2', 'ListBullet', 'Title', 'ListBullet2', 'Normal'])}"/>` : ''}${random() < 0.3 ? '<w:numPr><w:ilvl w:val="1"/></w:numPr>' : ''}</w:pPr>`;
  for (let i = 0, k = Math.floor(random() * 4); i < k; i += 1) {
    const r = random();
    if (r < 0.15) inner += `<w:hyperlink r:id="rId1" w:history="1">${run()}</w:hyperlink>`;
    else if (r < 0.2) inner += `<w:fldSimple w:instr=" HYPERLINK &quot;https://y.io&quot; ">${run()}</w:fldSimple>`;
    else if (r < 0.28 && depth < 2) {
      inner += `<mc:AlternateContent><mc:Choice Requires="wps"><w:r><w:drawing><w:txbxContent>${paragraph(depth + 1)}${paragraph(depth + 1)}</w:txbxContent></w:drawing></w:r></mc:Choice>`
        + `<mc:Fallback><w:pict><w:txbxContent>${paragraph(depth + 1)}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent>`;
    } else inner += run();
  }
  return random() < 0.05 ? '<w:p/>' : `<w:p${random() < 0.2 ? ' w:rsidR="00A1"' : ''}>${inner}</w:p>`;
};
const table = () => {
  let rows = '';
  for (let i = 0, nr = 1 + Math.floor(random() * 3); i < nr; i += 1) {
    let cells = '';
    for (let j = 0, nc = 1 + Math.floor(random() * 3); j < nc; j += 1) cells += `<w:tc><w:tcPr/>${paragraph()}${random() < 0.2 ? paragraph() : ''}</w:tc>`;
    rows += `<w:tr>${cells}</w:tr>`;
  }
  return `<w:tbl><w:tblPr/>${rows}</w:tbl>`;
};

test('Word-shaped XML reads as it did, on 6000 seeded documents', () => {
  const links = { rId1: 'https://example.com/me' };
  for (let n = 0; n < 6000; n += 1) {
    let body = '';
    for (let i = 0, k = 1 + Math.floor(random() * 6); i < k; i += 1) body += random() < 0.2 ? table() : paragraph();
    const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="x"><w:body>${body}<w:sectPr><w:pgSz/></w:sectPr></w:body></w:document>`;
    assert.deepEqual(docxXmlLines(xml, links), before.docxXmlLines(xml, links), xml);
  }
});
