// R5-HUNT4-ATS-TEXT-IGNORES-LINK-URL-OVERRIDE: the ATS plain text (Export → ATS text, the ATS tab's
// Copy / Download) printed each website / LinkedIn / GitHub as typed and never read its "Link URL"
// override, the address contactHref makes the PDF, Word and Markdown link to. A field holding a handle
// ("janedoe") with the address in Link URL left no profile address in the pasted text. It now prints
// the override when one is set (as the Cover Letter Text does since R4-EXP-02), the value as typed
// otherwise (R4-DOUT-13), and never an override the PDF would not follow.
//
// Run: node --test tests/unit/r5-hunt4-ats-text-link-url.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { contactHref } from '../../src/utils/contacts.js';

const contactLine = (extra) => generateAtsPlainText({
  personal: { name: 'Jane Doe', title: 'Engineer', email: 'jane@example.com', summary: '', hiddenFields: [], ...extra },
  sections: [], settings: {},
}).split('\n')[2];

test('a Link URL override prints in place of the handle or name typed in the field', () => {
  const p = {
    github: 'janedoe', githubUrl: 'https://github.com/janedoe',
    linkedin: 'Jane Doe', linkedinUrl: ' https://linkedin.com/in/jdoe ',
    website: 'my site', websiteUrl: 'https://janedoe.dev',
  };
  assert.equal(contactLine(p), 'jane@example.com | https://janedoe.dev | https://linkedin.com/in/jdoe | https://github.com/janedoe');
  // The address the PDF, Word and Markdown link to.
  assert.equal(contactHref('github', p), 'https://github.com/janedoe');
});

test('without an override the value prints as typed, and a Display label still does not replace it', () => {
  assert.equal(contactLine({ github: 'github.com/janedoe', githubLabel: 'GitHub', githubUrl: '  ' }), 'jane@example.com | github.com/janedoe');
});

test('an override the PDF would not follow (javascript:) is not printed', () => {
  assert.equal(contactLine({ website: 'janedoe.dev', websiteUrl: 'javascript:alert(1)' }), 'jane@example.com | janedoe.dev');
});
