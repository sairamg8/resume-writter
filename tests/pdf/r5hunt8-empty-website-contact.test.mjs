// R5-HUNT8-EMPTY-WEBSITE-CONTACT: the cover letter's plain text printed a website, LinkedIn or GitHub
// typed as just "https://", "http://" or "www." as an empty slot between separators
// ("jo@example.com | 555-0100 |  | "). A contact whose printed value is empty is left out.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const letter = (personal) => ({
  personal: { name: 'Jo Doe', email: 'jo@example.com', phone: '555-0100', hiddenFields: [], ...personal },
  settings: {},
  sections: [],
  coverLetter: { body: '<p>Hello.</p>', closing: 'Best', signatureName: 'Jo Doe' },
});

describe('the letter text prints no empty contact (R5-HUNT8-EMPTY-WEBSITE-CONTACT)', () => {
  it('leaves out a link field holding only a scheme or "www."', async () => {
    const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
    const line = generateCoverLetterPlainText(letter({ website: 'https://', linkedin: 'www.', github: 'http://' }))
      .split('\n').find((l) => l.includes('jo@example.com'));
    assert.equal(line, 'jo@example.com | 555-0100');
  });
});
