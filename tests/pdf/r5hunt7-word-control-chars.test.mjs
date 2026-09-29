// R5-HUNT7-WORD-CONTROL-CHAR-CORRUPT-DOCX: a character XML 1.0 forbids (a C0 control but tab, LF and
// CR — a U+000B from Word's Shift+Enter, a U+0002 a PDF viewer copies for a hyphen) went into the
// .docx's XML as it was, as docx escapes only & " ' < >, and Word would not open the file. The Word
// export now leaves those characters out, of the résumé's and of the letter's; a line tab or form
// feed, which parts two words, prints as a space (R5-HUNT8-WORD-XMLSAFE-GLUES-WORDS).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, readDocx, unzipEntry } from './harness.mjs';

before(setup);
after(teardown);

// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;

async function bytesOf(blob) {
  return Buffer.from(new Uint8Array(await blob.arrayBuffer()));
}

function assertWellFormedParts(buffer) {
  for (const part of ['word/document.xml', 'docProps/core.xml', 'word/_rels/document.xml.rels']) {
    const xml = unzipEntry(buffer, part) || '';
    const bad = xml.match(FORBIDDEN);
    assert.equal(bad, null, `${part} holds U+${bad && bad[0].charCodeAt(0).toString(16).padStart(4, '0')}`);
  }
}

const r = () => resume({
  personal: { name: 'Jane\u0002 Doe', title: 'Engi\u000cneer', summary: '<p>Line\u000bbreak</p>' },
  sections: [experience([{ company: 'Acme\u000bCorp', role: 'Dev\u0001', description: '<ul><li>Built\u0002 things</li></ul>' }])],
  coverLetter: { body: '<p>Dear\u000b team</p>', signatureName: 'J.\u0003 Doe' },
});

describe('Word export: characters XML forbids', () => {
  it('the résumé .docx holds none of them, and its text prints without them', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const buffer = await bytesOf(await renderResumeDocx(r()));
    assertWellFormedParts(buffer);
    const doc = readDocx(buffer);
    assert.ok(doc.texts.some((t) => t.includes('Acme Corp')), doc.texts.join(' | '));
    assert.ok(doc.texts.some((t) => t.includes('Line break')), doc.texts.join(' | '));
    assert.ok(doc.texts.some((t) => t.includes('Built things')), doc.texts.join(' | '));
  });

  it('the cover letter .docx holds none of them', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const buffer = await bytesOf(await renderCoverLetterDocx(r()));
    assertWellFormedParts(buffer);
    const doc = readDocx(buffer);
    assert.ok(doc.texts.some((t) => t.includes('Dear team')), doc.texts.join(' | '));
  });

  it('tabs and line breaks the text holds are kept', async () => {
    const { xmlSafe } = await loadModule('/src/utils/wordExportUtils.js');
    assert.deepEqual(xmlSafe({ a: ['x\ty\nz\r', 'p\u0000q'], n: 3, b: true, z: null }), { a: ['x\ty\nz\r', 'pq'], n: 3, b: true, z: null });
  });
});
