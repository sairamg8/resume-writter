// R4-LO-03: Word writes many a link as a HYPERLINK field rather than a <w:hyperlink>: the instruction
// in <w:instrText> runs between <w:fldChar w:fldCharType="begin"/> and "separate", the text it shows up
// to "end" — or a <w:fldSimple w:instr="HYPERLINK …"> around the text. The import read only
// <w:hyperlink>, so a contact shown as "LinkedIn" through a field lost its address (R4-IMP-10's case).
// A HYPERLINK field reads as a <w:hyperlink> does now: "LinkedIn (https://…)".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docxXmlLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const run = (text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const field = (instr, shown) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${instr}</w:instrText></w:r>`
  + `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${shown}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
const doc = (...paras) => `<w:document><w:body>${paras.map((p) => `<w:p>${p}</w:p>`).join('')}</w:body></w:document>`;
const texts = (xml) => docxXmlLines(xml).map((l) => l.text);

test('a complex HYPERLINK field: its text with its address', () => {
  const xml = doc(run('Robin Vale'), [
    run('robin.vale@example.com | '),
    field(' HYPERLINK &quot;https://www.linkedin.com/in/robin-vale-sample&quot; \\o &quot;Profile&quot; ', run('Linked') + run('In')),
    run(' | '),
    field(' HYPERLINK "https://github.com/robin-vale-sample" ', run('GitHub')),
  ].join(''));
  assert.deepEqual(texts(xml), ['Robin Vale',
    'robin.vale@example.com | LinkedIn (https://www.linkedin.com/in/robin-vale-sample) | GitHub (https://github.com/robin-vale-sample)']);
  const p = resumeFromText(docxXmlLines(xml)).personal;
  assert.equal(p.linkedin, 'https://www.linkedin.com/in/robin-vale-sample');
  assert.equal(p.linkedinLabel, 'LinkedIn');
  assert.equal(p.github, 'https://github.com/robin-vale-sample');
});

test('an instruction split over several runs, and a simple field', () => {
  const split = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK </w:instrText></w:r>'
    + '<w:r><w:instrText>"https://robinvale.example.com/work"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'
    + `${run('Portfolio')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const xml = doc(split, `<w:fldSimple w:instr=" HYPERLINK &quot;mailto:robin.vale@example.com&quot; ">${run('Email me')}</w:fldSimple>`);
  assert.deepEqual(texts(xml), ['Portfolio (https://robinvale.example.com/work)', 'Email me (mailto:robin.vale@example.com)']);
});

test('a field that is no web link, and a link to a bookmark, stay their text', () => {
  const xml = doc(
    run('Page ') + field(' PAGE ', run('3')),
    field(' HYPERLINK \\l "_Toc1" ', run('See Projects')),
    field(' HYPERLINK "https://example.com/x" ', run('https://example.com/x')),
  );
  assert.deepEqual(texts(xml), ['Page 3', 'See Projects', 'https://example.com/x']);
});
