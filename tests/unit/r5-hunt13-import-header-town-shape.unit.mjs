// R5-HUNT13-HEADER-TOWN-SHAPE: a header town of several words that the importer's list of known places
// does not hold ("Walnut Creek", "Mount Pleasant Heights", "Walnut Creek CA", "Austin TX 78701",
// "10115 Berlin") was no location: it printed as an "Additional Information" section, so a résumé with
// such a location lost it on its own exports and re-import. A town is a place by its shape and context
// now — a place's own word at its end or a place's prefix, a state, country or postcode after it with
// no comma, the Sidebar's "Location" label over it, the same town named with its region in a job line —
// while "Eagle Scout", "Open To Work IN" and a headline stay out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information')?.items[0].description || '';
const exp = '\n\nEXPERIENCE\nAcme Ltd — Software Engineer\nJan 2020 – Present\n• Built things\n';
const read = (header, rest = exp) => resumeFromText(header + rest);

const TOWNS = [
  // A place's own word at its end, a place's prefix with one more word, LinkedIn's metros.
  'Walnut Creek', 'Mount Pleasant Heights', 'Rancho Santa Margarita', 'St. Louis Park', 'Mt. Pleasant', 'Spring Hill',
  'Pleasant Hill', 'Hilton Head Island', 'Santa Rosa', 'Fort Collins', 'Greater Boston', 'Dallas-Fort Worth Metroplex', 'WALNUT CREEK',
  // A state, a country or a postcode after it, with no comma; a postcode first; a street before it.
  'Walnut Creek CA', 'Walnut Creek CA 94596', 'Austin TX', 'Austin TX 78701', 'Guildford GU1 4AB', 'Austin Texas',
  'Guildford United Kingdom', 'Walnut Creek 94596', 'Walnut Creek - CA', '10115 Berlin', '75008 Paris',
  '123 Main St, Walnut Creek', '123 Main St, Walnut Creek CA',
];

for (const town of TOWNS) {
  test(`"${town}" at the end of the contact line is the location, not "Additional Information"`, () => {
    const r = read(`Jane Doe\njane@x.com | (925) 555-0100 | ${town}`);
    assert.equal(r.personal.location, town);
    assert.equal(r.personal.email, 'jane@x.com');
    assert.equal(r.personal.phone, '(925) 555-0100');
    assert.equal(extra(r), '');
  });
}

const LAYOUTS = {
  'first on the contact line': 'Jane Doe\nWalnut Creek | jane@x.com | (925) 555-0100',
  'between tabs (a PDF’s gaps)': 'Jane Doe\njane@x.com\t(925) 555-0100\tWalnut Creek',
  'in a bulleted list': 'Jane Doe\n• jane@x.com\n• (925) 555-0100\n• Walnut Creek',
  'after dashes': 'Jane Doe\njane@x.com — (925) 555-0100 — Walnut Creek',
  'after commas': 'Jane Doe\njane@x.com, (925) 555-0100, Walnut Creek',
  'after slashes': 'Jane Doe\njane@x.com / (925) 555-0100 / Walnut Creek',
  'under the email in a "Contact" list': 'Jane Doe\nSenior Engineer\nCONTACT\njane@x.com\nWalnut Creek',
  'alone on a line under the contacts': 'Jane Doe\nSenior Engineer\njane@x.com | (925) 555-0100\nWalnut Creek',
  'alone on a line under the headline': 'Jane Doe\nSenior Engineer\nWalnut Creek',
};
for (const [where, header] of Object.entries(LAYOUTS)) {
  test(`"Walnut Creek" ${where} is the location`, () => {
    const r = read(header);
    assert.equal(r.personal.location, 'Walnut Creek');
    assert.equal(r.personal.title, /Senior Engineer/.test(header) ? 'Senior Engineer' : '');
    assert.equal(r.personal.email, header.includes('jane@x.com') ? 'jane@x.com' : '');
    assert.equal(extra(r), '');
  });
}

test('an email and a town set apart by a dash or a comma are two contacts, not a job title', () => {
  for (const header of ['Jane Doe\njane@x.com — Walnut Creek', 'Jane Doe\njane@x.com, Walnut Creek']) {
    const r = read(header);
    assert.equal(r.personal.title, '', header);
    assert.equal(r.personal.email, 'jane@x.com', header);
    assert.equal(r.personal.location, 'Walnut Creek', header);
    assert.equal(extra(r), '', header);
  }
});

test('"Walnut Creek" right under the name, with no headline, is the location, not the job title', () => {
  const r = read('Jane Doe\nWalnut Creek\njane@x.com | (925) 555-0100');
  assert.equal(r.personal.title, '');
  assert.equal(r.personal.location, 'Walnut Creek');
  assert.equal(r.personal.phone, '(925) 555-0100');
});

for (const metro of ['Greater Boston', 'Greater Philadelphia', 'Dallas-Fort Worth Metroplex']) {
  test(`LinkedIn's "${metro}" under the headline is the location`, () => {
    const r = resumeFromText(`Jane Doe\nSenior Engineer at Stripe\n${metro}\n\nExperience\nStripe\nSenior Engineer\nJanuary 2020 - Present (4 years)\n`);
    assert.equal(r.personal.title, 'Senior Engineer at Stripe');
    assert.equal(r.personal.location, metro);
    assert.equal(extra(r), '');
  });
}

test('the Markdown contact line of the app’s own export gives "Walnut Creek" as the location', () => {
  const r = resumeFromText(markdownLines('# Jane Doe\n\n[jane@x.com](mailto:jane@x.com) • (925) 555-0100 • Walnut Creek\n\n## Experience\n\n### Acme Ltd\n**Software Engineer**\n*Jan 2020 – Present*\n\n- Built things\n'));
  assert.equal(r.personal.location, 'Walnut Creek');
  assert.equal(r.personal.phone, '(925) 555-0100');
  assert.equal(extra(r), '');
});

// The Sidebar template prints each contact's label over its value: EMAIL, PHONE, LOCATION.
for (const town of ['Walnut Creek', 'London']) {
  test(`the "LOCATION" label over "${town}": the value is the location`, () => {
    for (const header of [
      `Jane Doe\nSenior Engineer\nCONTACT\nEMAIL\njane@x.com\nPHONE\n(925) 555-0100\nLOCATION\n${town}`,
      `Jane Doe\nSenior Engineer\nEMAIL\njane@x.com\nPHONE\n(925) 555-0100\nLOCATION\n${town}`,
      `Jane Doe\nSenior Engineer\njane@x.com\nLOCATION\t${town}`,
    ]) {
      const r = read(header);
      assert.equal(r.personal.location, town, header);
      assert.equal(r.personal.title, 'Senior Engineer', header);
      assert.equal(r.personal.email, 'jane@x.com', header);
      assert.equal(extra(r), '', header);
    }
  });
}

test('a contact’s label over its value is no job title when there is no headline', () => {
  const r = read('Jane Doe\nEMAIL\njane@x.com\nPHONE\n(925) 555-0100\nLOCATION\nWalnut Creek');
  assert.equal(r.personal.title, '');
  assert.deepEqual([r.personal.email, r.personal.phone, r.personal.location], ['jane@x.com', '(925) 555-0100', 'Walnut Creek']);
});

test('what stands under "Location" with a digit in it is no place: it stays in "Additional Information"', () => {
  const r = read('Jane Doe\nSenior Engineer\nCONTACT\nLOCATION\n123 Main St\nEMAIL\njane@x.com');
  assert.equal(r.personal.location, '');
  assert.match(extra(r), /123 Main St/);
});

test('"Based in Walnut Creek", with no colon, is the location without the prefix', () => {
  assert.equal(read('Jane Doe\njane@x.com | Based in Walnut Creek').personal.location, 'Walnut Creek');
  assert.equal(read('Jane Doe\njane@x.com | Based in Walnut Creek, CA').personal.location, 'Walnut Creek, CA');
});

test('a sentence that starts "Based in" is no location', () => {
  const r = read('Jane Doe\njane@x.com | Based in Austin and open to relocation');
  assert.equal(r.personal.location, '');
  assert.match(extra(r), /Based in Austin and open to relocation/);
});

// What the app's own exports print: the contact line of the Markdown, the ATS text's.
for (const location of ['Walnut Creek', 'Walnut Creek CA', 'Mount Pleasant Heights', 'Austin TX 78701']) {
  for (const title of ['', 'Senior Engineer']) {
    const resume = { personal: { name: 'Pat Sample', title, email: 'pat@example.com', phone: '(555) 123-4567', location, website: 'pat.dev' }, sections: [] };
    test(`"${location}" comes back from the Markdown export${title ? ' under a job title' : ''}`, () => {
      const md = generateMarkdownResume(resume);
      const r = resumeFromText(markdownLines(md));
      assert.equal(r.personal.location, location, md);
      assert.equal(r.personal.title, title, md);
      assert.equal(r.personal.website, 'pat.dev', md);
      assert.equal(extra(r), '', md);
    });
    test(`"${location}" comes back from the ATS text export${title ? ' under a job title' : ''}`, () => {
      const txt = generateAtsPlainText(resume);
      const r = resumeFromText(txt);
      assert.equal(r.personal.location, location, txt);
      assert.equal(r.personal.title, title, txt);
      assert.equal(r.personal.website, 'pat.dev', txt);
      assert.equal(extra(r), '', txt);
    });
  }
}

// A list of towns cannot hold them all, and "Round Rock" says nothing by its words: the job lines do,
// where they name it with its region.
test('a bare town the job lines name with its region is the location ("Round Rock")', () => {
  const jobs = '\n\nEXPERIENCE\nDell Technologies — Software Engineer\tRound Rock, TX\nJan 2020 – Present\n• Built things\n';
  const r = read('Jane Doe\njane@x.com | (925) 555-0100 | Round Rock', jobs);
  assert.equal(r.personal.location, 'Round Rock');
  assert.equal(extra(r), '');
  const alone = read('Jane Doe\nSenior Engineer\nRound Rock', jobs);
  assert.equal(alone.personal.title, 'Senior Engineer');
  assert.equal(alone.personal.location, 'Round Rock');
  const dash = read('Jane Doe\njane@x.com — Round Rock', jobs);
  assert.equal(dash.personal.email, 'jane@x.com');
  assert.equal(dash.personal.location, 'Round Rock');
});

test('words a job line names with a region that is no state ("Eagle Scout, Boy Scouts of America") make no location', () => {
  const r = read('Jane Doe\njane@x.com | (925) 555-0100 | Eagle Scout', '\n\nEXPERIENCE\nScouts\tEagle Scout, Boy Scouts of America\nJan 2010 – Present\n• Led\n');
  assert.equal(r.personal.location, '');
  assert.equal(extra(r), '<p>Eagle Scout</p>');
});

test('two towns on one contact line tell nothing: both stay in "Additional Information"', () => {
  const r = read('Jane Doe\njane@x.com | (925) 555-0100 | Walnut Creek | Concord');
  assert.equal(r.personal.location, '');
  assert.match(extra(r), /Walnut Creek/);
  assert.match(extra(r), /Concord/);
});

test('a full place on a later header line is still the location, not a bare town above it', () => {
  const r = read('Jane Doe\njane@x.com | Walnut Creek\nAustin, TX');
  assert.equal(r.personal.location, 'Austin, TX');
  assert.equal(extra(r), '<p>Walnut Creek</p>');
  const nocomma = read('Jane Doe\njane@x.com | Walnut Creek\nAustin TX');
  assert.equal(nocomma.personal.location, 'Austin TX');
  assert.equal(extra(nocomma), '<p>Walnut Creek</p>');
});

// What the places with a comma did before: still the location.
for (const place of ['Walnut Creek, CA', 'Walnut Creek,CA', 'Walnut Creek, California', 'Walnut Creek, CA 94596', 'Walnut Creek, CA, USA', 'Walnut Creek, USA']) {
  test(`"${place}" is still the location`, () => {
    const r = read(`Jane Doe\njane@x.com | (925) 555-0100 | ${place}`);
    assert.equal(r.personal.location, place);
    assert.equal(extra(r), '');
  });
}

// What is not a place: its words look like one, a state's code or a place's word is in it, or it is a
// work status. Each stays in "Additional Information".
const NOT_PLACES = [
  'Eagle Scout', 'Spanish Speaker', 'Green Card Holder', 'Kaggle Grandmaster', 'Open Source Enthusiast', 'Bilingual', 'New Grad',
  'US Citizen', 'Open to Relocation', 'Certified Scrum Master', 'Walnut Creek Realtor', 'Creek Street', 'Available Immediately',
  'Open Source', 'Port Operations', 'Lake Guard', 'Greater Good Fellow', 'Los Angeles Native', 'Bay Area Native', 'Digital Marketing',
  'Data Science', 'OPEN TO WORK IN', 'Open To Work IN', 'Marketing Manager IN',
];
for (const words of NOT_PLACES) {
  test(`"${words}" beside the email and phone is no location: "Additional Information" keeps it`, () => {
    const r = read(`Jane Doe\njane@x.com | (925) 555-0100 | ${words}`);
    assert.equal(r.personal.location, '');
    assert.equal(extra(r), `<p>${words}</p>`);
  });
}

test('a headline stays the job title: nothing about it reads as a town', () => {
  for (const title of ['Senior Engineer — Payments', 'Product Manager, Payments', 'Eagle Scout', 'Certified Scrum Master', 'Digital Marketing']) {
    const r = read(`Jane Doe\n${title}\njane@x.com | (925) 555-0100`);
    assert.equal(r.personal.title, title);
    assert.equal(r.personal.location, '');
    assert.equal(extra(r), '');
  }
});
