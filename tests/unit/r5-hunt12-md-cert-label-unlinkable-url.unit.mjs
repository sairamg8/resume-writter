// R5-HUNT12-MD-CERT-LABEL-LOST-UNLINKABLE-URL: a certificate whose URL cannot be linked ("Credly 12345",
// "ABC-123") and that carries a Link label prints the label, unlinked, in the PDF (`urlLabel || url`) and
// Word, but the Markdown printed the raw URL and dropped the label. It now prints the label as well.
//
// Run: node --test tests/unit/r5-hunt12-md-cert-label-unlinkable-url.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const md = (item) => generateMarkdownResume({
  personal: { name: 'Jane Doe' }, settings: {},
  sections: [{ id: 'c', type: 'certifications', title: 'Certifications', visible: true, items: [{ id: 'i', name: 'AWS Solutions Architect', ...item }] }],
});

test('an unlinkable URL with a Link label prints the label, as the PDF and Word do', () => {
  for (const url of ['Credly 12345', 'ABC-123']) {
    const out = md({ url, urlLabel: 'View badge' });
    assert.ok(out.includes('View badge'), out);
    assert.ok(!out.includes(url), out);
  }
});

test('with no label the unlinkable URL still prints; a linkable one still links under its label', () => {
  assert.ok(md({ url: 'ABC-123' }).includes('ABC-123'));
  assert.ok(md({ url: 'credly.com/b/1', urlLabel: 'View badge' }).includes('[View badge](https://credly.com/b/1)'));
});
