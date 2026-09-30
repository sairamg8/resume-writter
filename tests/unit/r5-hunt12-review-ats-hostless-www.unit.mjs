// R5-HUNT12-REVIEW-ATS-HOSTLESS-WWW-UNDER-LABEL: a website, LinkedIn or GitHub typed as "https://www" (a
// scheme and "www", no host) under a Display label prints the label, unlinked, in the PDF, Word, Markdown
// and the letter text — safeHref and linkOverride (R5-HUNT12-LINK-URL-OVERRIDE-BARE-SCHEME) count it as no
// address — but the ATS text still printed "https://www" in its place (its test read only an empty
// displayUrl, which "www" is not), and JSON Resume wrote basics.url "https://www", a link to nothing beside
// the label. Both now use the same test as linkOverride (namesAddress).
//
// Run: node --test tests/unit/r5-hunt12-review-ats-hostless-www.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { cpwtResumeToJsonResume, jsonResumeToCpwtResume } from '../../src/utils/jsonResume.js';
import { contactItems } from '../../src/utils/contacts.js';

const HOSTLESS = ['https://www', 'http://WWW', ' https://www/ '];
const resume = (personal) => ({ personal: { name: 'Jane Doe', email: 'jane@x.com', ...personal }, sections: [] });
const contactLine = (personal) => generateAtsPlainText(resume(personal)).split('\n')[1];

test('the ATS text prints the Display label over a hostless "https://www", as the PDF does', () => {
  for (const typed of HOSTLESS) {
    const personal = { website: typed, websiteLabel: 'Portfolio' };
    assert.deepEqual(contactItems(personal).map(({ value, href }) => [value, href]), [['Portfolio', null]], JSON.stringify(typed));
    assert.equal(contactLine(personal), 'jane@x.com | Portfolio', JSON.stringify(typed));
    assert.equal(contactLine({ github: typed, githubLabel: 'My code' }), 'jane@x.com | My code', JSON.stringify(typed));
  }
});

test('JSON Resume writes no url for a hostless "https://www" under a label, and a round trip keeps both', () => {
  for (const typed of HOSTLESS) {
    const file = cpwtResumeToJsonResume(resume({ website: typed, websiteLabel: 'Portfolio', linkedin: typed, linkedinLabel: 'Me' }));
    assert.equal(file.basics.url, '', JSON.stringify(typed));
    assert.deepEqual(file.basics.profiles, [], JSON.stringify(typed));
    const back = jsonResumeToCpwtResume(file).personal;
    assert.equal(back.website, typed);
    assert.equal(back.websiteLabel, 'Portfolio');
    assert.equal(back.linkedin, typed);
  }
});

test('a real address still prints as typed and still goes in the file', () => {
  assert.equal(contactLine({ website: 'https://www.jane.dev', websiteLabel: 'Portfolio' }), 'jane@x.com | https://www.jane.dev');
  assert.equal(contactLine({ website: 'www.com', websiteLabel: 'Portfolio' }), 'jane@x.com | www.com');
  assert.equal(cpwtResumeToJsonResume(resume({ website: 'https://www.jane.dev', websiteLabel: 'Portfolio' })).basics.url, 'https://www.jane.dev');
});
