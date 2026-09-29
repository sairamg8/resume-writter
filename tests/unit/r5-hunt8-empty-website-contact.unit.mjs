// R5-HUNT8-EMPTY-WEBSITE-CONTACT: a Website, LinkedIn or GitHub typed as just "https://", "http://"
// or "www." passed contactItems' filter (its raw text is not empty) but printed as '' once
// displayUrl took the scheme and "www." off — a bare icon, or an empty slot between separators, in
// the PDF, Word, Markdown and the cover letter. A contact whose printed value is empty is left out.
// The letter's plain text loads through the harness: tests/pdf/r5hunt8-empty-website-contact.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactItems } from '../../src/utils/contacts.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const personal = {
  name: 'Jane Doe', email: 'jane@x.com', phone: '555-0100',
  website: 'https://', linkedin: 'www.', github: 'http://',
};

test('a link field holding only a scheme or "www." is no contact', () => {
  assert.deepEqual(contactItems(personal).map(({ key }) => key), ['email', 'phone']);
  for (const website of ['https://', 'http://', 'www.', 'https://www.', ' HTTPS:// ', 'https:///']) {
    assert.deepEqual(contactItems({ website }), [], website);
  }
});

test('a Display label still prints over an empty address, and a real domain still prints', () => {
  assert.deepEqual(contactItems({ website: 'https://', websiteLabel: 'My site' }).map(({ value }) => value), ['My site']);
  assert.deepEqual(contactItems({ website: 'https://www.jane.dev/' }).map(({ value }) => value), ['jane.dev']);
});

test('Markdown prints no empty slot between separators', () => {
  const md = generateMarkdownResume({ personal, settings: {}, sections: [] });
  const line = md.split('\n').find((l) => l.includes('jane@x.com'));
  assert.ok(line, md);
  assert.equal(line.split('•').length, 2, line);
  assert.match(line, /555-0100/);
});
