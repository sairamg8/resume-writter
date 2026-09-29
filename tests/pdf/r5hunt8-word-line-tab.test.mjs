// R5-HUNT8-WORD-XMLSAFE-GLUES-WORDS: xmlSafe (R5-HUNT7-WORD-CONTROL-CHAR-CORRUPT-DOCX) deleted a line
// tab (U+000B, Word's Shift+Enter in plain text) or form feed (U+000C) from the résumé before its rich
// text was parsed, so the two words it parted were glued into one in the .docx ("Cut costsSaved time"),
// where the Markdown and ATS text print them apart. It now prints a space, in the résumé and the letter.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, readDocx } from './harness.mjs';

before(setup);
after(teardown);

async function bytesOf(blob) {
  return Buffer.from(new Uint8Array(await blob.arrayBuffer()));
}

const r = () => resume({
  personal: { name: 'Jane Doe', title: 'Engineer', summary: '<p>Led the team\u000bShipped v2</p>' },
  sections: [experience([{
    company: 'Acme\u000cCorp', role: 'Dev',
    description: '<ul><li>Cut costs\u000bSaved time</li></ul><p>Page one\u000cpage two</p>',
  }])],
  coverLetter: { body: '<p>Dear\u000bteam, page\u000cbreak</p>', signatureName: 'Jane Doe' },
});

describe('Word export: a line tab or form feed parts two words', () => {
  it('the résumé .docx keeps the words apart', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const text = readDocx(await bytesOf(await renderResumeDocx(r()))).texts.join(' | ');
    for (const words of ['Led the team Shipped v2', 'Cut costs Saved time', 'Page one page two', 'Acme Corp']) {
      assert.ok(text.includes(words), `${words} in: ${text}`);
    }
    for (const glued of ['teamShipped', 'costsSaved', 'onepage', 'AcmeCorp']) assert.ok(!text.includes(glued), text);
  });

  it('the cover letter .docx keeps the words apart', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const text = readDocx(await bytesOf(await renderCoverLetterDocx(r()))).texts.join(' | ');
    assert.ok(text.includes('Dear team, page break'), text);
  });

  it('xmlSafe turns a line tab or form feed into a space and still drops other controls', async () => {
    const { xmlSafe } = await loadModule('/src/utils/wordExportUtils.js');
    assert.equal(xmlSafe('a\u000bb\u000cc\u0002d'), 'a b cd');
  });
});
