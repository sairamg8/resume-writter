// R5-HUNT2-ats-text-list-item-second-paragraph-unindented: the ATS plain text (Export → ATS Text, the
// ATS tab's Copy / Download) prints a paragraph inside a list item (an <li> holding two <p>) under that
// item's text, as the PDF and the Markdown do. It printed it flush left, so "second para" read as a line
// of its own after the bullet, not as part of it; a level-2 item's continuation did the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsChecker.js';

const text = (description) => generateAtsPlainText({ personal: { name: 'Ada Lovelace' }, sections: [
  { id: 's', type: 'experience', title: 'Experience', visible: true, items: [{ id: 'e', company: 'Acme', role: 'Dev', description }] },
] });

test('a second paragraph in a list item starts at the item\'s text', () => {
  const out = text('<ul><li><p>first para</p><p>second para</p></li><li>x</li></ul>');
  assert.ok(out.includes('* first para\n  second para\n* x'), out);
});

test('a nested item\'s second paragraph starts at that item\'s text', () => {
  const out = text('<ul><li>top<ul><li><p>inner one</p><p>inner two</p></li></ul></li></ul>');
  assert.ok(out.includes('* top\n  * inner one\n    inner two'), out);
});

test('a paragraph after the list still starts flush left', () => {
  const out = text('<ul><li>item</li></ul><p>after it</p>');
  assert.ok(out.includes('* item\nafter it'), out);
});
