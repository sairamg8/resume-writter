// R5-HUNT12-ATS-TEXT-BARE-SCHEME-UNDER-LABEL: a website, LinkedIn or GitHub typed as just "https://" (or
// "www.") under a Display label prints the label, unlinked, in the PDF, Word, Markdown and the cover
// letter, but the ATS text printed the typed value — "jane@x.com | https://", an address with no host —
// and lost the label. It now prints the label; a real typed address (or Link URL) still prints in full.
//
// Run: node --test tests/unit/r5-hunt12-ats-text-bare-scheme-label.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const contactLine = (personal) => generateAtsPlainText({ personal: { name: 'Jane Doe', email: 'jane@x.com', ...personal }, sections: [] })
  .split('\n')[1];

test('a bare scheme under a Display label prints the label, not the scheme', () => {
  for (const bare of ['https://', 'www.', ' http:// ', 'https://www.', 'https:///']) {
    assert.equal(contactLine({ website: bare, websiteLabel: 'Portfolio' }), 'jane@x.com | Portfolio', JSON.stringify(bare));
    assert.equal(contactLine({ linkedin: bare, linkedinLabel: 'Me' }), 'jane@x.com | Me', JSON.stringify(bare));
    assert.equal(contactLine({ github: bare, githubLabel: 'My code', githubUrl: 'https://' }), 'jane@x.com | My code', JSON.stringify(bare));
  }
});

test('a real address still prints as typed, and a Link URL still wins', () => {
  assert.equal(contactLine({ website: 'https://jane.dev', websiteLabel: 'Portfolio' }), 'jane@x.com | https://jane.dev');
  assert.equal(contactLine({ website: 'https://', websiteLabel: 'Portfolio', websiteUrl: 'jane.dev' }), 'jane@x.com | jane.dev');
});
