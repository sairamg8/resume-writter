// R5-HUNT12-REVIEW-IMPORT-PHONE-EXTENSION: the import's phone test took digits, spaces and ( ) . - / only,
// so a phone with its extension ("+1 (555) 123-4567 ext. 890", "(555) 123-4567, x12") was no contact:
// pasted text, a PDF, a Word file or the app's own Markdown export brought the résumé back with no phone,
// the number and its extension gone. It is read as the phone, as typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const header = (line) => resumeFromText(`Pat Sample\n${line}\n\nEXPERIENCE\nEngineer, Acme\n`).personal;

test('a pasted header\'s phone with an extension is the phone', () => {
  assert.equal(header('pat@example.com | +1 (555) 123-4567 ext. 890').phone, '+1 (555) 123-4567 ext. 890');
  assert.equal(header('pat@example.com | 555-123-4567 x12').phone, '555-123-4567 x12');
  assert.equal(header('pat@example.com | +1 555 123 4567 (ext 12)').phone, '+1 555 123 4567 (ext 12)');
});

test('the app\'s own Markdown brings a phone with an extension back', () => {
  for (const phone of ['+1 (555) 123-4567 ext. 890', '(555) 123-4567, ext. 890', '+44 20 7946 0958 #22']) {
    const md = generateMarkdownResume({ personal: { name: 'Pat Sample', email: 'pat@example.com', phone }, settings: {}, sections: [] });
    assert.equal(resumeFromText(markdownLines(md)).personal.phone, phone, md);
  }
});

test('words with an x or a # in them are still no phone', () => {
  const p = header('pat@example.com | Box 12 x 3');
  assert.equal(p.phone || '', '');
});
