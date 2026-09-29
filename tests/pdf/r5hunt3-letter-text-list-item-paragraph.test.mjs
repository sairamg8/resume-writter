// Cover Letter Text (.txt): a paragraph inside a list item stays under its bullet (R5-HUNT3).
// parseRichText gives the second <p> of an <li> (a Google Docs or Word paste) marker null, inList true
// and indent 1; bodyLines() treated it as a plain paragraph, printing it flush left between blank lines
// and splitting the list in two. It now goes under the item's text, as the PDF, Word, Markdown and the
// ATS text (R5-HUNT2) print it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const text = async (body) => {
  const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
  return generateCoverLetterPlainText({
    personal: { name: 'Jo Doe', hiddenFields: [] }, settings: {}, sections: [],
    coverLetter: { body, closing: 'Best', signatureName: 'Jo Doe' },
  });
};

describe('the letter text keeps a list item\'s second paragraph under its bullet (R5-HUNT3)', () => {
  it('indents the paragraph under the item and keeps the list whole', async () => {
    const out = await text('<p>Highlights:</p><ul><li><p>Led the migration</p><p>Cut costs by 30%.</p></li><li><p>Built the API</p></li></ul><p>Thanks.</p>');
    assert.ok(out.includes('Highlights:\n\n- Led the migration\n  Cut costs by 30%.\n- Built the API\n\nThanks.'), out);
  });

  it('indents a nested item\'s paragraph to that item\'s text', async () => {
    const out = await text('<ul><li>Top<ul><li><p>Inner</p><p>More</p></li></ul></li></ul><p>End.</p>');
    assert.ok(out.includes('- Top\n  - Inner\n    More\n\nEnd.'), out);
  });

  it('keeps a paragraph after the list flush left after a blank line', async () => {
    const out = await text('<ul><li>One</li></ul><p>After.</p>');
    assert.ok(out.includes('- One\n\nAfter.'), out);
  });
});
