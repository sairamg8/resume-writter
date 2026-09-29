// R5-HUNT6-LETTER-TEXT-IGNORES-LINK-URL-OVERRIDE: the Cover Letter Text (.txt) keeps a website /
// LinkedIn / GitHub's Link URL override when the field has no Display label. It printed only the typed
// value ('@jdoe'), while the letter's PDF and Word link that value to the override address, so the
// plain text carried no address anyone could follow. It now prints '@jdoe (github.com/jdoe)'.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const contactLine = async (personal) => {
  const { generateCoverLetterPlainText } = await loadModule('/src/utils/coverLetterText.js');
  return generateCoverLetterPlainText({
    personal: { name: 'Jo Doe', email: 'jo@example.com', hiddenFields: [], ...personal },
    settings: {},
    sections: [],
    coverLetter: { body: '<p>Hello.</p>', closing: 'Best', signatureName: 'Jo Doe' },
  }).split('\n').find((l) => l.includes('jo@example.com'));
};

describe('the letter text keeps an unlabelled link\'s Link URL (R5-HUNT6-LETTER-TEXT-IGNORES-LINK-URL-OVERRIDE)', () => {
  it('an unlabelled GitHub with a Link URL keeps that address beside the typed value', async () => {
    assert.equal(await contactLine({ github: '@jdoe', githubUrl: 'https://github.com/jdoe' }), 'jo@example.com | @jdoe (github.com/jdoe)');
  });

  it('an unlabelled website named in words keeps its Link URL address', async () => {
    assert.equal(await contactLine({ website: 'My portfolio', websiteUrl: 'https://jdoe.dev/' }), 'jo@example.com | My portfolio (jdoe.dev)');
  });

  it('a Link URL that is the typed address again prints it once; one the PDF would not follow is not printed', async () => {
    assert.equal(await contactLine({ linkedin: 'linkedin.com/in/jdoe', linkedinUrl: 'https://www.linkedin.com/in/jdoe/' }), 'jo@example.com | linkedin.com/in/jdoe');
    assert.equal(await contactLine({ website: 'My site', websiteUrl: 'javascript:alert(1)' }), 'jo@example.com | My site');
  });

  it('a labelled link and a link with no override print as before (R4-EXP-02)', async () => {
    assert.equal(await contactLine({ github: 'jdoe', githubLabel: 'My code', githubUrl: 'https://github.com/jdoe' }), 'jo@example.com | My code (github.com/jdoe)');
    assert.equal(await contactLine({ website: 'https://jdoe.dev' }), 'jo@example.com | jdoe.dev');
  });
});
