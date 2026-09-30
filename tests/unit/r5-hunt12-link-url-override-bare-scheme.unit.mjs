// R5-HUNT12-LINK-URL-OVERRIDE-BARE-SCHEME: a website, LinkedIn or GitHub with a valid value and a Link URL
// override of just a scheme or "www." ("https://", "www.", "https://www.") printed unlinked in the PDF,
// Word and Markdown (contactHref took the override and safeHref rejected it, never falling back to the
// value), or linked to the dead "https://www.". Such an override names no address: it counts as unset,
// and safeHref returns null for an http(s) address with no host.
//
// Run: node --test tests/unit/r5-hunt12-link-url-override-bare-scheme.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, contactItems } from '../../src/utils/contacts.js';
import { safeHref } from '../../src/utils/richText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

const BARE = ['https://', 'http://', 'www.', 'https://www.', 'https:///', 'http://www', ' HTTPS://WWW. '];

test('a bare-scheme Link URL falls back to the valid value typed in the field', () => {
  for (const override of BARE) {
    for (const key of ['website', 'linkedin', 'github']) {
      const personal = { [key]: 'janedoe.dev', [`${key}Url`]: override };
      assert.equal(contactHref(key, personal), 'https://janedoe.dev', `${key} / ${JSON.stringify(override)}`);
      assert.deepEqual(contactItems(personal).map(({ value, href }) => [value, href]), [['janedoe.dev', 'https://janedoe.dev']]);
    }
  }
});

test('the Markdown links the value; the ATS text and JSON Resume carry the value, not the bare override', () => {
  for (const override of BARE) {
    const personal = { name: 'Jane Doe', email: 'jane@x.com', website: 'janedoe.dev', websiteUrl: override };
    const md = generateMarkdownResume({ personal, sections: [] });
    assert.ok(md.includes('[janedoe.dev](https://janedoe.dev)'), md);
    const ats = generateAtsPlainText({ personal, sections: [] });
    assert.ok(ats.includes('jane@x.com | janedoe.dev'), ats);
    assert.equal(cpwtResumeToJsonResume({ personal, sections: [] }).basics.url, 'janedoe.dev', JSON.stringify(override));
  }
});

test('an http(s) address with no host is no link; a real one still is', () => {
  for (const v of ['https://www.', 'https:///', 'http://www', 'https://www./', 'https://:80/x', 'https://user@']) {
    assert.equal(safeHref(v), null, v);
  }
  for (const v of ['https://www.x.dev', 'https://localhost:3000', 'http://jane.dev/', 'https://pat@example.com', 'https://www.linkedin.com/in/pat/']) {
    assert.equal(safeHref(v), v, v);
  }
  // A labelled website of "https://www." prints its label, with no link to a dead address.
  assert.deepEqual(contactItems({ website: 'https://www.', websiteLabel: 'Portfolio' }).map(({ value, href }) => [value, href]), [['Portfolio', null]]);
});
