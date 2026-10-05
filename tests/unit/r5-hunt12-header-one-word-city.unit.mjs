// R5-HUNT12-HEADER-ONE-WORD-CITY-LOST: a header location with no region after a comma ("London",
// "Singapore", LinkedIn's "San Francisco Bay Area") was no location: it printed as an "Additional
// Information" section, so a résumé with such a location lost it on its own Markdown or ATS-text export
// and re-import. Beside a contact on its line (or "… Area" alone under the headline) it is the location.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information');

test('"London" on the contact line is the location, no "Additional Information"', () => {
  const r = resumeFromText('Jane Doe\njane@x.com | +44 20 7946 0958 | London\n\nEXPERIENCE\nAcme Ltd — Software Engineer\nJan 2020 – Present\n• Built things\n');
  assert.equal(r.personal.location, 'London');
  assert.equal(r.personal.phone, '+44 20 7946 0958');
  assert.equal(extra(r), undefined);
});

test('LinkedIn’s "San Francisco Bay Area" under the headline is the location', () => {
  const r = resumeFromText('Jane Doe\nSenior Engineer at Stripe\nSan Francisco Bay Area\n\nExperience\nStripe\nSenior Engineer\nJanuary 2020 - Present (4 years)\n');
  assert.equal(r.personal.title, 'Senior Engineer at Stripe');
  assert.equal(r.personal.location, 'San Francisco Bay Area');
  assert.equal(extra(r), undefined);
});

for (const location of ['London', 'Singapore', 'Frankfurt am Main']) {
  const resume = { personal: { name: 'Pat Sample', email: 'pat@example.com', phone: '(555) 123-4567', location }, sections: [] };
  test(`"${location}" comes back from the Markdown export`, () => {
    const md = generateMarkdownResume(resume);
    const r = resumeFromText(markdownLines(md));
    assert.equal(r.personal.location, location, md);
    assert.equal(extra(r), undefined, md);
  });
  test(`"${location}" comes back from the ATS text export`, () => {
    const txt = generateAtsPlainText(resume);
    const r = resumeFromText(txt);
    assert.equal(r.personal.location, location, txt);
    assert.equal(extra(r), undefined, txt);
  });
}

test('a work status on the contact line is still "Additional Information", not the location', () => {
  const r = resumeFromText('Jane Doe\njane@x.com | US Citizen\n\nEXPERIENCE\nAcme Ltd — Software Engineer\nJan 2020 – Present\n');
  assert.equal(r.personal.location || '', '');
  assert.match(extra(r)?.items[0].description || '', /US Citizen/);
});
