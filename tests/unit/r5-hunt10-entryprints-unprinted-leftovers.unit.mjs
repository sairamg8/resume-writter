// R5-HUNT10-ENTRYPRINTS-COUNTS-UNPRINTED-LEFTOVERS: entryPrints counted any stored text as printed,
// so a section whose only entry held a certificate's leftover Link label (its Link URL cleared: the
// editor hides the label's box but keeps it) or interests that are only commas printed its heading
// alone over an empty entry in the PDF/preview and Word, while Markdown and the ATS text left it out
// and the ATS Check counted it present. Now entryPrints asks what the type's renderers draw.
//
// Run: node --test tests/unit/r5-hunt10-entryprints-unprinted-leftovers.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entryPrints, sectionPrints, printedEntries } from '../../src/utils/entryPrints.js';

const cert = (extra) => ({ id: 'c1', name: '', issuer: '', date: '', expiry: '', credentialId: '', url: '', ...extra });
const section = (type, items) => ({ id: 's', type, title: type, visible: true, settings: {}, items });

test('the renderers draw a certificate label only beside its URL, and interests as their comma parts (the premise)', () => {
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(src('src/templates/pdf/shared/PdfSectionsTwo.jsx'), /item\.url \? <Text[^\n]*item\.urlLabel \|\| item\.url/);
  assert.match(src('src/utils/wordExportBuilders.js'), /\.\.\.\(item\.url \? \[[\s\S]{0,200}linked\(item\.urlLabel \|\| item\.url/);
  assert.match(src('src/templates/pdf/shared/PdfSectionsThree.jsx'), /\.split\(','\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\)/);
});

test('a certificate holding only a Link label, its URL cleared, prints nothing', () => {
  const item = cert({ urlLabel: 'Verify' });
  assert.equal(entryPrints('certifications', item), false);
  assert.equal(sectionPrints(section('certifications', [item])), false);
  assert.deepEqual(printedEntries(section('certifications', [item])), []);
});

test('a certificate label whose URL is hidden with its eye prints nothing', () => {
  assert.equal(entryPrints('certifications', cert({ url: 'https://credly.com/x', urlLabel: 'Verify', hiddenFields: ['url'] })), false);
});

test('a certificate label beside a URL still prints, and so does a URL alone', () => {
  assert.equal(entryPrints('certifications', cert({ url: 'https://credly.com/x', urlLabel: 'Verify' })), true);
  assert.equal(entryPrints('certifications', cert({ url: 'https://credly.com/x' })), true);
  assert.equal(entryPrints('certifications', cert({ name: 'AWS Developer', urlLabel: 'Verify' })), true);
});

test('interests that are only commas and spaces print nothing', () => {
  for (const interests of [', ', ',', ' , ,, ']) {
    const item = { id: 'i1', interests };
    assert.equal(entryPrints('interests', item), false, JSON.stringify(interests));
    assert.equal(sectionPrints(section('interests', [item])), false, JSON.stringify(interests));
  }
  assert.equal(entryPrints('interests', { id: 'i1', interests: 'Chess, ' }), true);
});
