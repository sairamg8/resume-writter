// R4-SW-I-02, what it left open: a Word paragraph whose list is only its paragraph STYLE's — a custom
// "Dash" style with its <w:numPr> in word/styles.xml and none on the paragraph — was read as a plain
// paragraph, so a résumé's bullets came in as lines of text. The list a paragraph is in is now its own
// <w:numPr>'s, else its style's (through the styles it is based on too: a style says nothing of what it
// leaves to its base), else Word's built-in List Bullet / List Number by their names (the old rule, kept).
// A numId of 0 is "no list" wherever it stands, a loop of basedOn ends, and the numbering a Heading style
// carries (numbered sections) is no bullet. Each case is read from a .docx built here, as a file is read.
// Fictional people only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as importFile from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const { docxLines } = importFile;

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
/** A <w:numPr>: the list `numId` at level `ilvl`, either left out where it names none. */
const numPr = (numId, ilvl) => `<w:numPr>${ilvl === undefined ? '' : `<w:ilvl w:val="${ilvl}"/>`}${numId === undefined ? '' : `<w:numId w:val="${numId}"/>`}</w:numPr>`;
/** A style as styles.xml writes it: its list in its own <w:pPr>, not in the paragraphs that use it. */
const style = (id, { basedOn, list = '', type = 'paragraph' } = {}) => `<w:style w:type="${type}" w:customStyle="1" w:styleId="${id}"><w:name w:val="${id}"/>${basedOn ? `<w:basedOn w:val="${basedOn}"/>` : ''}<w:pPr>${list}</w:pPr></w:style>`;
const stylesPart = (...all) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr/></w:rPrDefault></w:docDefaults>${all.join('')}</w:styles>`;
/** A paragraph: its text, and its <w:pPr>'s content. */
const p = (text, props = '') => `<w:p><w:pPr>${props}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const plain = (text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const inStyle = (id) => `<w:pStyle w:val="${id}"/>`;
const doc = (...paras) => `<w:document ${W}><w:body>${paras.join('')}</w:body></w:document>`;

/** A .docx of the parts given as text (or `{ bytes, method }`), stored: enough for the reader's own unzip. */
function zipOf(parts) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, part] of Object.entries(parts)) {
    const nameBytes = encoder.encode(name);
    const data = typeof part === 'string' ? encoder.encode(part) : part.bytes;
    const method = typeof part === 'string' ? 0 : part.method;
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const ev = new DataView(entry.buffer);
    ev.setUint32(0, 0x02014b50, true);
    ev.setUint16(10, method, true);
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

const LOOPS = [
  style('Loop1', { basedOn: 'Loop2' }), style('Loop2', { basedOn: 'Loop1' }), // a loop with no list in it
  style('Ring1', { basedOn: 'Ring2', list: numPr(5) }), style('Ring2', { basedOn: 'Ring1' }), // one with a list in it
  style('Self', { basedOn: 'Self', list: numPr(6) }),
];
const STYLES = stylesPart(
  style('Normal'),
  style('Plain', { basedOn: 'Normal' }),
  style('Dash', { basedOn: 'Normal', list: numPr(4) }), // a bulleted list's style: list 4, at its first level
  style('DashSub', { basedOn: 'Dash', list: numPr(undefined, 1) }), // based on it, naming only its level: the list is Dash's
  style('Steps', { basedOn: 'Normal', list: numPr(7, 0) }), // a numbered list's style
  style('StepsSub', { basedOn: 'Steps', list: numPr(7, 1) }),
  style('Quiet', { basedOn: 'Dash', list: numPr(0) }), // takes its base's list off
  style('Heading1', { basedOn: 'Normal', list: numPr(9) }), // numbered sections
  style('Section', { basedOn: 'Heading1' }),
  style('ListBullet2', { basedOn: 'Normal', list: numPr(2) }), // as Word's own: the list is in the style, its level is not
  style('TableDash', { type: 'table', list: numPr(3) }), // a table style's numbering numbers no paragraph
  ...LOOPS,
);

/** `xml` as the body of a .docx with `styles` as its styles part (none: the file has no styles part). */
const read = (xml, styles = STYLES) => docxLines(zipOf({ 'word/document.xml': xml, ...(styles ? { 'word/styles.xml': styles } : {}) }));
const shown = (lines) => lines.map((l) => [l.text, l.depth || 0]);

test('a paragraph in a custom list style, its list only in styles.xml, is a list item at its style\'s level', async () => {
  const xml = doc(
    p('Led the design system', inStyle('Dash')),
    p('Measured over six sprints', inStyle('DashSub')),
    p('Open the file', inStyle('Steps')),
    p('Pick a template', inStyle('StepsSub')),
    p('A plain paragraph', inStyle('Plain')),
    p('Another one'),
  );
  assert.deepEqual(shown(await read(xml)), [
    ['• Led the design system', 0], ['• Measured over six sprints', 1], ['• Open the file', 0], ['• Pick a template', 1],
    ['A plain paragraph', 0], ['Another one', 0],
  ]);
  // The same paragraphs in a file with no styles part are the plain lines they were: the style is what says.
  assert.deepEqual(shown(await read(xml, null)), [
    ['Led the design system', 0], ['Measured over six sprints', 0], ['Open the file', 0], ['Pick a template', 0],
    ['A plain paragraph', 0], ['Another one', 0],
  ]);
});

test('docxStyles: the paragraph styles that name a list, each with the list its chain of styles gives', () => {
  const styles = importFile.docxStyles(STYLES);
  const listOf = (id) => { const v = styles.get(id); return v && [v.numId, v.ilvl]; };
  assert.deepEqual(listOf('Dash'), [4, undefined]);
  assert.deepEqual(listOf('DashSub'), [4, 1], 'its level its own, its list its base\'s');
  assert.deepEqual(listOf('Steps'), [7, 0]);
  assert.deepEqual(listOf('StepsSub'), [7, 1]);
  assert.deepEqual(listOf('Quiet'), [0, undefined], 'a numId of 0 stands over the base\'s list');
  assert.deepEqual(listOf('ListBullet2'), [2, undefined]);
  for (const none of ['Normal', 'Plain', 'Heading1', 'Section', 'TableDash', 'Loop1', 'Loop2', 'NotDefined']) assert.equal(listOf(none), undefined, none);
  assert.equal(importFile.docxStyles(undefined).size, 0);
  assert.equal(importFile.docxStyles('').size, 0);
});

test('the paragraph\'s own numPr stands over its style\'s: its level, its numId of 0, and a list on a plain style', async () => {
  const lines = await read(doc(
    p('Deep', inStyle('Dash') + numPr(4, 2)),
    p('Level only', inStyle('Dash') + numPr(undefined, 1)),
    p('Level 0 of a style at level 1', inStyle('DashSub') + numPr(4, 0)),
    p('List switched off', inStyle('Dash') + numPr(0, 0)),
    p('Own list on a plain style', inStyle('Plain') + numPr(4, 1)),
  ));
  assert.deepEqual(shown(lines), [
    ['• Deep', 2], ['• Level only', 1], ['• Level 0 of a style at level 1', 0], ['List switched off', 0], ['• Own list on a plain style', 1],
  ]);
});

test('a style that takes its base\'s list off is no list; Word\'s built-in names are list items still, defined in styles.xml or not', async () => {
  const lines = await read(doc(
    p('Quiet', inStyle('Quiet')),
    p('Top', inStyle('ListBullet')), // not defined in this styles.xml: its name says
    p('Sub', inStyle('ListBullet2')), // defined, with its list and no level: the level its name gives
    p('Third', inStyle('ListNumber3')),
    p('Off', inStyle('ListBullet') + numPr(0, 0)), // a built-in style with its list taken off
  ));
  assert.deepEqual(shown(lines), [['Quiet', 0], ['• Top', 0], ['• Sub', 1], ['• Third', 2], ['Off', 0]]);
});

test('a loop of basedOn styles ends, with the list a style in it names; a chain longer than any real one ends too', async () => {
  const chain = Array.from({ length: 200 }, (_, i) => style(`S${i}`, i === 199 ? { list: numPr(5) } : { basedOn: `S${i + 1}` }));
  const lines = await read(doc(
    p('In a loop', inStyle('Loop1')),
    p('In a ring', inStyle('Ring2')),
    p('The ring\'s own', inStyle('Ring1')),
    p('Itself', inStyle('Self')),
    p('Near the list', inStyle('S195')),
    p('Far from it', inStyle('S0')),
  ), stylesPart(...LOOPS, ...chain));
  assert.deepEqual(shown(lines), [['In a loop', 0], ['• In a ring', 0], ['• The ring\'s own', 0], ['• Itself', 0], ['• Near the list', 0], ['Far from it', 0]]);
});

test('a Heading style that carries numbering stays a heading, not a bullet, and so does a style based on it', async () => {
  const lines = await read(doc(p('Intro', inStyle('Plain')), p('Experience', inStyle('Heading1')), p('Projects', inStyle('Section'))));
  assert.deepEqual(lines.map((l) => [l.text, l.hint]), [['Intro', undefined], ['Experience', 'heading'], ['Projects', undefined]]);
});

const cell = (...paras) => `<w:tc><w:tcPr/>${paras.join('')}</w:tc>`;
const row = (...cells) => `<w:tr><w:trPr/>${cells.join('')}</w:tr>`;
const table = (...rows) => `<w:tbl><w:tblPr/>${rows.join('')}</w:tbl>`;

test('a table row with a list item in a cell, by its style alone too, is read a line a paragraph, as a numPr\'s is', async () => {
  const xml = doc(table(row(cell(plain('Acme Corp')), cell(plain('2019 – 2021'))), row(cell(p('One', inStyle('Dash'))), cell(plain('Two')))));
  assert.deepEqual((await read(xml)).map((l) => l.text), ['Acme Corp\t2019 – 2021', '• One', 'Two']);
  // Without the styles the Dash cell is no list item, and its row joins like the first one.
  assert.deepEqual((await read(xml, null)).map((l) => l.text), ['Acme Corp\t2019 – 2021', 'One\tTwo']);
});

test('a job\'s bullets in a custom list style come in as its bullets', async () => {
  const lines = await read(doc(
    plain('Robin Vale'), plain('EXPERIENCE'), plain('Juniper Labs\t2020 – Present'), plain('Product Designer'),
    p('Led the design system used by nine teams.', inStyle('Dash')),
    p('Cut review time by half.', inStyle('Dash')),
  ));
  assert.deepEqual(lines.slice(-2).map((l) => l.text), ['• Led the design system used by nine teams.', '• Cut review time by half.']);
  const job = resumeFromText(lines).sections.find((s) => s.type === 'experience')?.items[0];
  assert.equal(job.description, '<ul><li>Led the design system used by nine teams.</li><li>Cut review time by half.</li></ul>');
});

test('a styles part that cannot be read costs the styles\' lists and not the import', async () => {
  const xml = doc(plain('Robin Vale'), p('One bullet', inStyle('Dash')), p('Another', inStyle('ListBullet')));
  const damaged = { bytes: new Uint8Array([0xff, 0xff, 0xff, 0xff]), method: 8 }; // "deflated" with a block type no stream has
  assert.deepEqual((await docxLines(zipOf({ 'word/document.xml': xml, 'word/styles.xml': damaged }))).map((l) => l.text), ['Robin Vale', 'One bullet', '• Another']);
  assert.deepEqual((await read(xml, null)).map((l) => l.text), ['Robin Vale', 'One bullet', '• Another']);
});

test('a styles part of tags that never close is read, and names no list', () => {
  assert.equal(importFile.docxStyles(`<w:styles>${'<w:style w:styleId="a" '.repeat(20_000)}`).size, 0);
  assert.equal(importFile.docxStyles(`<w:styles>${'<w:style w:styleId="a"><w:basedOn <w:numPr>'.repeat(20_000)}`).size, 0);
});
