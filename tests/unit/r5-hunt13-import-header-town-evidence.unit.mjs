// R5-HUNT13-HEADER-TOWN-EVIDENCE: a header phrase is a place by its shape only with proof. A town with its
// state, country or postcode and no comma ("Walnut Creek CA", "10115 Berlin") was a location whatever its
// words were, so a headline that ends in a state's code or a country's name ("Family Medicine MD",
// "Orthopedic Surgery PA", "Licensed Electrician Texas", "Navy Veteran TX", "Machine Learning India"), a
// count ("12345 Followers") or a phrase with a place's word ("Smart City", "Random Forest", "Greater
// Good") lost its job title right under the name and was stored as the location. Now: a postcode, or a
// region after a town that says it is one by its words, proves a place anywhere; a region after one word
// ("Austin TX") only beside a contact; any other words with a region are a headline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information')?.items[0].description || '';
const exp = '\n\nEXPERIENCE\nAcme Ltd — Software Engineer\nJan 2020 – Present\n• Built things\n';
const read = (header) => resumeFromText(header + exp);

const HEADLINES = [
  'Family Medicine MD', 'Orthopedic Surgery PA', 'Licensed Electrician Texas', 'Dentist Ohio', 'Pharmacist Ontario', 'Navy Veteran TX',
  'Eagle Scout Texas', 'Cardiology MD', 'Machine Learning India', 'Data Science MD', 'Product Design CA', 'Smart City', 'Random Forest',
  'Decision Forest', 'Tech Park', 'Greater Good', 'Greater Impact',
];

for (const headline of HEADLINES) {
  test(`the headline "${headline}" right under the name stays the job title`, () => {
    const r = read(`Jane Doe\n${headline}\njane@x.com | (925) 555-0100`);
    assert.equal(r.personal.title, headline);
    assert.equal(r.personal.location, '');
    assert.equal(extra(r), '');
  });
  test(`"${headline}" beside the email and phone, or under a "Contact" heading, is no location`, () => {
    for (const header of [`Jane Doe\njane@x.com | (925) 555-0100 | ${headline}`, `Jane Doe\nCONTACT\njane@x.com\n${headline}`]) {
      const r = read(header);
      assert.equal(r.personal.location, '', header);
      assert.equal(extra(r), `<p>${headline}</p>`, header);
    }
  });
}

test('a count after five digits is no postcode ("12345 Followers", "50000 Hours")', () => {
  for (const count of ['12345 Followers', '50000 Hours', '10000 Steps']) {
    const beside = read(`Jane Doe\njane@x.com | ${count}`);
    assert.equal(beside.personal.location, '', count);
    assert.equal(extra(beside), `<p>${count}</p>`, count);
    const under = read(`Jane Doe\n${count}\njane@x.com | (925) 555-0100`);
    assert.equal(under.personal.title, count);
    assert.equal(under.personal.location, '', count);
  }
});

test('a trade alone beside the email is no town ("Dentist", "Photographer", "Cardiology")', () => {
  for (const word of ['Dentist', 'Photographer', 'Cardiology', 'Electrician']) {
    const r = read(`Jane Doe\njane@x.com | (925) 555-0100 | ${word}`);
    assert.equal(r.personal.location, '', word);
    assert.equal(extra(r), `<p>${word}</p>`, word);
  }
});

test('a postcode, or a region after a town that says it is one, is a place even right under the name', () => {
  for (const place of ['Walnut Creek CA', 'Austin TX 78701', 'Walnut Creek 94596', 'Guildford GU1 4AB', '10115 Berlin']) {
    const r = read(`Jane Doe\n${place}\njane@x.com | (925) 555-0100`);
    assert.equal(r.personal.title, '', place);
    assert.equal(r.personal.location, place, place);
  }
});

test('a region after one word is a place beside a contact, and only there: under the name it may be the headline', () => {
  for (const place of ['Austin TX', 'Austin Texas', 'Welder Ohio', 'Guildford United Kingdom']) {
    const beside = read(`Jane Doe\njane@x.com | (925) 555-0100 | ${place}`);
    assert.equal(beside.personal.location, place, place);
    const under = read(`Jane Doe\n${place}\njane@x.com | (925) 555-0100`);
    assert.equal(under.personal.title, place, place);
    assert.equal(under.personal.location, '', place);
  }
});

test('a town of several words, one that says it is a place and the region after it, are the location beside a contact', () => {
  for (const place of ['Walnut Creek CA', 'Mount Pleasant Heights Texas', 'Greater Boston', 'Greater Philadelphia']) {
    assert.equal(read(`Jane Doe\njane@x.com | (925) 555-0100 | ${place}`).personal.location, place, place);
  }
});
