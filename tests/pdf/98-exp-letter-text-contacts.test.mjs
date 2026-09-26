// Cover Letter Text (.txt): a contact shown under a Display label keeps its address (R4-EXP-02).
// contactItems() gives a website, LinkedIn or GitHub with a Display label as the label alone, the
// PDF's link carrying the address; the plain text joined only that label, so a pasted letter read
// "… | LinkedIn" with no profile address anywhere. Plain text cannot carry a link, so it now prints
// "LinkedIn (linkedin.com/in/jdoe)", the address the Link URL override points to when one is set.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const letter = (personal) => ({
  personal: { name: 'Jo Doe', email: 'jo@example.com', hiddenFields: [], ...personal },
  settings: {},
  sections: [],
  coverLetter: { body: '<p>Hello.</p>', closing: 'Best', signatureName: 'Jo Doe' },
});

const contactLine = async (personal) => {
  const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
  return generateCoverLetterPlainText(letter(personal)).split('\n').find((l) => l.includes('jo@example.com'));
};

describe('the letter text keeps a labelled link\'s address (R4-EXP-02)', () => {
  it('prints the label with its address', async () => {
    const line = await contactLine({ linkedin: 'https://www.linkedin.com/in/jdoe/', linkedinLabel: 'LinkedIn' });
    assert.equal(line, 'jo@example.com | LinkedIn (linkedin.com/in/jdoe)');
  });

  it('prints the Link URL override\'s address when one is set', async () => {
    const line = await contactLine({ github: 'jdoe', githubLabel: 'My code', githubUrl: 'https://github.com/jdoe' });
    assert.equal(line, 'jo@example.com | My code (github.com/jdoe)');
  });

  it('prints an unlabelled link and the other contacts as before', async () => {
    const line = await contactLine({ website: 'https://jdoe.dev', phone: '+1 555 0100' });
    assert.equal(line, 'jo@example.com | +1 555 0100 | jdoe.dev');
  });
});
