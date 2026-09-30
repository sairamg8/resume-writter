// R5-HUNT12-LINK-URL-PLACEHOLDER-KILLS-CONTACT-LINK: contactHref took any non-empty "Link URL" as the
// link, so a box holding only "https://", "http://" or "www." (safeHref: no address) left the Website,
// LinkedIn or GitHub with no link at all, though its value "janedoe.com" is a good one — in the PDF,
// Word and Markdown, while the JSON Resume file still wrote the value. An override that gives no safe
// link now falls back to the value, as it does when the box is empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, contactItems } from '../../src/utils/contacts.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

test('a Link URL holding only a scheme or "www." does not take the value\'s link away', () => {
  for (const key of ['website', 'linkedin', 'github']) {
    for (const override of ['https://', 'http://', 'www.', ' HTTPS:// ']) {
      assert.equal(contactHref(key, { [key]: 'janedoe.com', [`${key}Url`]: override }), 'https://janedoe.com', `${key} ${override}`);
    }
  }
});

test('a real Link URL still wins, and no address at all is still no link', () => {
  assert.equal(contactHref('website', { website: 'janedoe.com', websiteUrl: 'https://jane.dev/cv' }), 'https://jane.dev/cv');
  assert.equal(contactHref('website', { website: 'My site', websiteUrl: 'https://' }), null);
  assert.equal(contactHref('website', { website: 'janedoe.com', websiteUrl: 'javascript:alert(1)' }), 'https://janedoe.com');
});

test('the PDF\'s contact line, the Markdown and the JSON Resume file agree', () => {
  const personal = { name: 'Jane', website: 'janedoe.com', websiteUrl: 'https://' };
  assert.deepEqual(contactItems(personal).map(({ value, href }) => [value, href]), [['janedoe.com', 'https://janedoe.com']]);
  const md = generateMarkdownResume({ personal, settings: {}, sections: [] });
  assert.ok(md.includes('](https://janedoe.com)'), md);
  const { basics } = cpwtResumeToJsonResume({
    id: 'r5h12l', name: 'Sample', template: 'classic', settings: {}, sections: [],
    personal: { title: '', summary: '', hiddenFields: [], ...personal },
  });
  assert.equal(basics.url, 'janedoe.com');
});
