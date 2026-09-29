// R5-HUNT7-REVIEW-WORD-LONE-SURROGATE: xmlSafe (R5-HUNT7-WORD-CONTROL-CHAR-CORRUPT-DOCX) left out the
// C0 controls XML forbids, but not a lone surrogate — half an emoji, from a JSON import's "\ud83d" or
// text cut between a pair's halves — which is no XML character either. In the browser docx's zip wrote
// it as bytes that are not UTF-8 (Node's Buffer writes U+FFFD instead), and Word would not open the
// file. The Word export now leaves a lone half out and keeps a whole emoji.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, readDocx, unzipEntry } from './harness.mjs';

before(setup);
after(teardown);

const LONE = /[\uD800-\uDFFF�]/;

async function bytesOf(blob) {
  return Buffer.from(new Uint8Array(await blob.arrayBuffer()));
}

function assertNoHalves(buffer) {
  for (const part of ['word/document.xml', 'docProps/core.xml']) {
    const xml = unzipEntry(buffer, part) || '';
    // The whole emoji is kept; nothing is left of a lone half, neither itself nor Node's U+FFFD for it.
    const bad = xml.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').match(LONE);
    assert.equal(bad, null, `${part} holds U+${bad && bad[0].charCodeAt(0).toString(16).padStart(4, '0')}`);
  }
}

const r = () => resume({
  personal: { name: 'Jane Doe\uD83D', title: 'Engineer 😀' },
  sections: [experience([{ company: 'Acme\uDE00Corp', role: 'Dev', description: '<ul><li>Built\uD83D things</li></ul>' }])],
  coverLetter: { body: '<p>Dear\uD83D team</p>' },
});

describe('Word export: a lone surrogate', () => {
  it('the résumé .docx leaves it out and keeps a whole emoji', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const buffer = await bytesOf(await renderResumeDocx(r()));
    assertNoHalves(buffer);
    const doc = readDocx(buffer);
    const all = doc.texts.join(' | ');
    assert.ok(doc.texts.some((t) => t.includes('AcmeCorp')), all);
    assert.ok(doc.texts.some((t) => t.includes('Built things')), all);
    assert.ok(doc.texts.some((t) => t.includes('Engineer 😀')), all);
  });

  it('the cover letter .docx leaves it out', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const buffer = await bytesOf(await renderCoverLetterDocx(r()));
    assertNoHalves(buffer);
    const doc = readDocx(buffer);
    assert.ok(doc.texts.some((t) => t.includes('Dear team')), doc.texts.join(' | '));
  });

  it('xmlSafe drops a lone high or low half and keeps pairs', async () => {
    const { xmlSafe } = await loadModule('/src/utils/wordExportUtils.js');
    assert.equal(xmlSafe('a\uDC00b\uD83D'), 'ab');
    assert.equal(xmlSafe('\uD83D😀\uDE00'), '😀');
    assert.equal(xmlSafe('x 😀 y'), 'x 😀 y');
  });
});
