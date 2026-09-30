// R5-HUNT12 review of R5-HUNT12-HEADER-ONE-WORD-CITY-LOST: any capitalised words beside a contact were
// taken for a town, so "Eagle Scout", "Spanish Speaker", "Green Card Holder", "Kaggle Grandmaster" or
// "Bilingual" on the contact line became the résumé's location (and left "Additional Information"), and a
// bare "Mumbai" on the contact line beat the full "New York, NY" under it. Of several words only a place's
// are the location now; a word a contact line prints for something else is not; a full place wins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information')?.items[0].description || '';
const exp = '\n\nEXPERIENCE\nAcme Ltd — Software Engineer\nJan 2020 – Present\n• Built things\n';

for (const words of ['Eagle Scout', 'Spanish Speaker', 'Green Card Holder', 'Kaggle Grandmaster', 'Open Source Enthusiast', 'Bilingual', 'New Grad']) {
  test(`"${words}" beside the email and phone is no location: "Additional Information" keeps it`, () => {
    const r = resumeFromText(`Jane Doe\njane@x.com | +44 20 7946 0958 | ${words}${exp}`);
    assert.equal(r.personal.location, '');
    assert.equal(extra(r), `<p>${words}</p>`);
  });
}

for (const town of ['Guildford', 'San Francisco', 'Hong Kong', 'Rio de Janeiro', 'Frankfurt am Main']) {
  test(`"${town}" beside the email and phone is still the location`, () => {
    const r = resumeFromText(`Jane Doe\njane@x.com | +44 20 7946 0958 | ${town}${exp}`);
    assert.equal(r.personal.location, town);
    assert.equal(extra(r), '');
  });
}

test('a full place on a later header line is the location, not a bare town above it', () => {
  const r = resumeFromText(`Jane Doe\njane@x.com | Mumbai\nNew York, NY${exp}`);
  assert.equal(r.personal.location, 'New York, NY');
  assert.equal(extra(r), '<p>Mumbai</p>');
});
