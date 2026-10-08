// The empty cover letter's writing hint in the preview told the reader to write "in the "Cover Letter"
// tab on the left". Since the rebuild there is no such tab: the Résumé | Cover Letter switch is in the
// bar, and the writing box is on the left only in the split view (a phone's Preview and Preview only
// have no left at all). The hint now says "in the editor" and names no place. An exported letter never
// carries the hint, and a letter with a body prints the body alone.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allText } from './harness.mjs';

before(setup);
after(teardown);

const letter = (coverLetter) => resume({ coverLetter: { body: '', ...coverLetter } });

describe('the empty letter\'s writing hint (cyc6)', () => {
  it('the preview says to write in the editor and names no tab or side', async () => {
    const text = allText(await read(await renderCover(letter({ body: '<p><br></p>' }), { preview: true })));
    assert.ok(text.includes('Start writing your cover letter in the editor'), text);
    assert.ok(!text.includes('on the left') && !text.includes('"Cover Letter" tab'), text);
  });

  it('an exported letter carries no hint, and a letter with a body prints the body alone', async () => {
    const exported = allText(await read(await renderCover(letter({ body: '' }))));
    assert.ok(!exported.includes('Start writing'), exported);
    const written = allText(await read(await renderCover(letter({ body: '<p>Hello there</p>' }), { preview: true })));
    assert.ok(written.includes('Hello there') && !written.includes('Start writing'), written);
  });
});
