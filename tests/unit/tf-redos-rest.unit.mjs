// Typing-freeze finding 7 (the last of the paste/import sweep's leftovers, named by the second review): seven more places read a
// long input in time squared, each of a shape the sweep had already fixed elsewhere, and now read once:
//  - importText.js bareAddress cut the slashes off an address's end with /\/+$/, which tries a long run of slashes again
//    from each of them when a letter follows it ('http://' and 100 000 slashes and an 'x': seconds), the same pattern
//    contacts.js had fixed with a loop;
//  - importText.js takeContacts asked, for each header line, whether any later line gave a place (placeAt.slice(k + 1).some(...)),
//    a copy of the rest of the lines each time: a text résumé of 80 000 lines with no heading took time squared;
//  - importFile.js PAGE_OF ended in \s* and FURNITURE_TAIL went on with \s*$, so "Page", a long run of spaces and a letter,
//    after a separator, was read as every split of the run between the two;
//  - importFile.js read a Word table's date cell (readDateRange, whose patterns read a long run of white space from each of its
//    characters) as it came, not with each run of white space made one space;
//  - importFile.js joined a wrapped PDF paragraph's link list again for each line it added (a copy of the whole list each time);
//  - atsChecker.js tested the email with /^[^\s@]+@[^\s@]+\.[^\s@]+$/, which tries every dot of a long domain as the last one;
//  - atsChecker.js extractBulletsFromItem copied the open items up to a continuation paragraph's depth for each paragraph.
// Each reads what it read, on the cases below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Header, Packer, Paragraph, TextRun } from 'docx';
import { linkText, resumeFromText } from '../../src/utils/importText.js';
import { docxLines, docxXmlLines, pdfLinesOfPages } from '../../src/utils/importFile.js';
import { analyzeAtsScore, extractBulletsFromItem } from '../../src/utils/atsChecker.js';
import * as before from '../fixtures/typing-freeze-reference/importFile.mjs';

const LIMIT_MS = 1000;
const N = 100_000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a link whose address ends in a long run of slashes and then a letter is read in linear time', () => {
  const to = `http://${'/'.repeat(N)}y`;
  const { out, ms } = timed(() => linkText('my site', to));
  assert.ok(String(out).startsWith('my site'), String(out).slice(0, 40));
  assert.ok(ms < LIMIT_MS, `linkText took ${ms.toFixed(0)} ms on an address of ${to.length} characters`);
  // The address and its label are still told apart as they were: the same address with its trailing slashes is its own label.
  assert.equal(linkText('example.com', 'https://www.example.com//'), 'example.com');
  assert.equal(linkText('example.com', 'https://example.com/'), 'example.com');
});

test('a text résumé of 80 000 lines with no heading is read in linear time', () => {
  const text = Array.from({ length: 80_000 }, (_, i) => `Word${i} and more`).join('\n');
  const { out, ms } = timed(() => resumeFromText(text));
  assert.ok(out, 'a résumé comes back');
  assert.ok(ms < 3 * LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms on ${text.length} characters`);
});

const zipOf = (parts) => {
  // A .docx of the given parts as stored (not deflated) entries: enough for the reader's own unzip.
  const enc = new TextEncoder();
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const files = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255];
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, text] of Object.entries(parts)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const header = [0x50, 0x4b, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc(data)), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), 0, 0];
    files.push(...header, ...nameBytes, ...data);
    central.push(0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc(data)), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset), ...nameBytes);
    offset += header.length + nameBytes.length + data.length;
  }
  const end = [0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(Object.keys(parts).length), ...u16(Object.keys(parts).length), ...u32(central.length), ...u32(offset), 0, 0];
  return new Uint8Array([...files, ...central, ...end]);
};

const header = async (text, reader = docxLines) => reader(new Uint8Array(await Packer.toBuffer(new Document({
  sections: [{ headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun(text)] })] }) }, children: [new Paragraph('Summary'), new Paragraph('body text')] }],
}))));

test('a page header with a separator, "Page" and a long run of spaces is read in linear time, and its furniture still goes', async () => {
  for (const tail of ['x', '3x', 'of']) {
    const text = `Robin Vale – Page${' '.repeat(80_000)}${tail}`;
    const start = performance.now();
    const lines = await header(text);
    const ms = performance.now() - start;
    assert.ok(lines.some((l) => l.text.startsWith('Robin Vale')), `the header is read (${tail})`);
    assert.ok(ms < 3 * LIMIT_MS, `docxLines took ${ms.toFixed(0)} ms on a header of ${text.length} characters (${tail})`);
  }
  for (const text of ['Robin Vale – Page 2 of 3', 'Robin Vale – Page', 'Robin Vale – Page 7', 'Robin Vale – page of 4', 'Robin Vale\t\tConfidential', 'Page', 'Page   ', 'page 3 of 9', 'Robin Vale – Pages 2', 'Robin Vale – Page 2 of']) {
    assert.deepEqual((await header(text)).map((l) => l.text), (await header(text, before.docxLines)).map((l) => l.text), JSON.stringify(text));
  }
});

test('a Word table whose date cell has a long run of white space is read in linear time', () => {
  const cell = (text) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
  const row = (a, b) => `<w:tr>${cell(a)}${cell(b)}</w:tr>`;
  const xml = (date) => `<w:document><w:body><w:tbl>${row('Engineer', date)}${row('Analyst', '2016 – 2018')}</w:tbl></w:body></w:document>`;
  const date = `2019 – 2021${' '.repeat(80_000)}x`;
  const { out, ms } = timed(() => docxXmlLines(xml(date)));
  assert.ok(out.length >= 2);
  assert.ok(ms < 3 * LIMIT_MS, `docxXmlLines took ${ms.toFixed(0)} ms on a cell of ${date.length} characters`);
  assert.deepEqual(docxXmlLines(xml('2019 – 2021')).map((l) => l.text), before.docxXmlLines(xml('2019 – 2021')).map((l) => l.text));
});

test('a wrapped PDF paragraph of 40 000 linked lines keeps every link and is read in linear time', () => {
  const rows = Array.from({ length: 40_000 }, (_, r) => ({ str: `word${r} text`, x: 50, y: 800 - r * 12, w: 40, h: 10, links: [{ label: `l${r}`, url: 'https://x.io' }] }));
  const { out, ms } = timed(() => pdfLinesOfPages([rows]));
  const links = out.flatMap((l) => l.links || []);
  assert.equal(links.length, 40_000);
  assert.deepEqual(links.slice(0, 2).map((k) => k.label), ['l0', 'l1']);
  assert.ok(ms < 3 * LIMIT_MS, `pdfLinesOfPages took ${ms.toFixed(0)} ms`);
  // The links of the lines the paragraph was made of are not added to by it: the items it was read from are as they were.
  assert.equal(rows[0].links.length, 1);
});

const resumeWith = (email) => ({
  id: 'tf_email', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Sarah Connor', title: 'Engineer', email, phone: '', location: '', linkedin: '', github: '', summary: '', photo: null, hiddenFields: [] },
  sections: [],
});
const emailStatus = (email) => analyzeAtsScore(resumeWith(email)).categories.contact.items.find((i) => i.id === 'email').status;

test('an email with a long domain of dots is checked in linear time, and the same values pass as before', () => {
  const email = `a@${'a.'.repeat(50_000)}!`;
  const { out, ms } = timed(() => emailStatus(email));
  assert.equal(out, 'pass');
  assert.ok(ms < LIMIT_MS, `analyzeAtsScore took ${ms.toFixed(0)} ms on an address of ${email.length} characters`);
  const old = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const pieces = ['a', 'b', '.', '..', '@', '@@', ' ', '\t', '\n', 'co', 'com', '-', '+', ' ', '_', 'x@y.z', '.@', '@.'];
  let seed = 1234;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 5000; n += 1) {
    let value = '';
    for (let i = 0, k = 1 + Math.floor(random() * 8); i < k; i += 1) value += pieces[Math.floor(random() * pieces.length)];
    // The check reads the trimmed value, and an empty one is "missing".
    const shown = value.trim();
    if (!shown) continue;
    assert.equal(emailStatus(value), old.test(shown) ? 'pass' : 'fail', JSON.stringify(value));
  }
});

test('a deep list with many continuation paragraphs is read in linear time, and a continuation still joins its item (its seeded old-reading comparison is tf-redos-ats-bullets)', () => {
  const depth = 40_000;
  const description = `${'<ul><li>a'.repeat(depth)}${'<p>x</p>'.repeat(40_000)}${'</li></ul>'.repeat(depth)}`;
  const { out, ms } = timed(() => extractBulletsFromItem({ description }));
  assert.ok(out.length >= 1);
  assert.ok(out.at(-1).startsWith('a x x'), out.at(-1).slice(0, 20));
  assert.ok(ms < 3 * LIMIT_MS, `extractBulletsFromItem took ${ms.toFixed(0)} ms`);
});
