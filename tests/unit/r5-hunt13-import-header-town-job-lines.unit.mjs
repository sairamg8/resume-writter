// R5-HUNT13-HEADER-TOWN-JOB-LINES: a header word or two that the job lines happen to print before a region
// is no town. The importer takes a town of several words that is not in its list ("Round Rock") as the
// location when a job line names it with its region ("Dell, Round Rock, TX"); it took EVERY comma segment
// before the region, so the role and the company of "Photographer, Studio X, Austin, TX" counted as towns
// too, and a one-word headline ("Photographer", "Chef", "Pharmacist") lost its job title and was stored as
// the location. Only the segment next to the region names a town now, only a town of more words, and only
// beside a contact — never the title's line nor a line alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information')?.items[0].description || '';
const jobs = (line) => `\n\nEXPERIENCE\n${line}\nJan 2020 – Present\n• Did the work\n`;

// A headline with no role word of the importer's, and a job line of "Role, Company, City, ST" in each order.
const HEADLINES = ['Photographer', 'Chef', 'Pharmacist', 'Electrician', 'Carpenter', 'Wedding Photographer'];
const JOB_LINES = (h) => [`${h}, Studio X, Austin, TX`, `Studio X, ${h}, Austin, TX`, `${h}, Austin, Texas, USA`, `${h}, TX`];

for (const headline of HEADLINES) {
  test(`the headline "${headline}" stays the job title when a job line prints it before its region`, () => {
    for (const line of JOB_LINES(headline)) {
      const r = resumeFromText(`Jane Doe\n${headline}\njane@x.com | (925) 555-0100${jobs(line)}`);
      assert.equal(r.personal.title, headline, line);
      assert.equal(r.personal.location, '', line);
      assert.equal(r.personal.email, 'jane@x.com', line);
      assert.equal(extra(r), '', line);
    }
  });
  test(`"${headline}" under a "Contact" heading is no location when a job line prints it before its region`, () => {
    const r = resumeFromText(`Jane Doe\nCONTACT\njane@x.com\n${headline}${jobs(`${headline}, Studio X, Austin, TX`)}`);
    assert.equal(r.personal.location, '');
    assert.match(extra(r), new RegExp(headline));
  });
}

test('the town next to the region is still the location: "Dell, Round Rock, TX", "Round Rock, Texas, USA", with a postcode', () => {
  for (const line of ['Dell, Round Rock, TX', 'Software Engineer, Dell, Round Rock, Texas, USA', 'Dell, Round Rock, TX 78664', 'Dell\tRound Rock, TX']) {
    const r = resumeFromText(`Jane Doe\njane@x.com | (925) 555-0100 | Round Rock${jobs(line)}`);
    assert.equal(r.personal.location, 'Round Rock', line);
    assert.equal(extra(r), '', line);
  }
});

test('a town of several words that is alone on a line is the location only if its words say it is one', () => {
  // The job lines naming "Round Rock" are no proof for a line of its own: it may be a headline.
  const r = resumeFromText(`Jane Doe\nSenior Engineer\nRound Rock${jobs('Dell, Round Rock, TX')}`);
  assert.equal(r.personal.title, 'Senior Engineer');
  assert.equal(r.personal.location, '');
  assert.equal(extra(r), '<p>Round Rock</p>');
  const named = resumeFromText(`Jane Doe\nSenior Engineer\nWalnut Creek${jobs('Dell, Round Rock, TX')}`);
  assert.equal(named.personal.location, 'Walnut Creek');
});

test('a line right under the name that a job line names with its region stays the job title', () => {
  const r = resumeFromText(`Jane Doe\nPixel Studio\njane@x.com | (925) 555-0100${jobs('Pixel Studio, TX')}`);
  assert.equal(r.personal.title, 'Pixel Studio');
  assert.equal(r.personal.location, '');
});
