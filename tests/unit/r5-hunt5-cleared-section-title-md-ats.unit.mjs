// R5-HUNT5-CLEARED-SECTION-TITLE-PRINTS-TYPE-ID-MD-ATS: a section whose title box the user emptied
// prints no heading text on the PDF or in Word, but the Markdown export printed its internal type
// key ('## custom', '## experience') and the ATS text 'CUSTOM' over the rule. Both now print what the
// PDF prints: no title text (the ATS text keeps the rule the PDF draws).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const resume = (title) => ({
  personal: { name: 'Pat Sample' }, template: 'classic', settings: {},
  sections: [
    { id: 'w', type: 'experience', title, items: [{ id: 'i', company: 'Acme', role: 'Dev', description: '<p>Built things</p>' }] },
    { id: 'c', type: 'custom', title, items: [{ id: 's', title: 'On engines', description: '<p>A talk</p>' }] },
  ],
});

for (const cleared of ['', '   ']) {
  test(`Markdown: a cleared title (${JSON.stringify(cleared)}) prints no heading, never the type key`, () => {
    const out = generateMarkdownResume(resume(cleared));
    assert.doesNotMatch(out, /^## /m, out);
    assert.doesNotMatch(out, /\bcustom\b|\bexperience\b/i, out);
    assert.match(out, /Acme/);
    assert.match(out, /On engines/);
  });

  test(`ATS text: a cleared title (${JSON.stringify(cleared)}) prints only the rule, never the type key`, () => {
    const out = generateAtsPlainText(resume(cleared));
    assert.doesNotMatch(out, /CUSTOM|EXPERIENCE/, out);
    assert.match(out, /Acme/);
    assert.match(out, /On engines/);
  });
}

test('a title the user typed still prints as the heading', () => {
  assert.match(generateMarkdownResume(resume('Talks')), /^## Talks$/m);
  assert.match(generateAtsPlainText(resume('Talks')), /^TALKS$/m);
});
