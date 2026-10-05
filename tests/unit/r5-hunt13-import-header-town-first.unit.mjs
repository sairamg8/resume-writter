// R5-HUNT13-HEADER-TOWN-FIRST: a header line that begins with a town and goes on with a contact, set apart
// by a dash, a comma or a slash ("Walnut Creek — jane@x.com"). The town counts as one of the line's
// contacts, so the line is split — but a line led by a field that is no contact gives that field the job
// title, so the town became the headline: "Walnut Creek" as the title, the location empty, and in
// "Walnut Creek — Senior Engineer — jane@x.com" the real title sent to "Additional Information". A town
// first is the location, and the field after it that is neither a contact nor a town is the title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const extra = (r) => r.sections.find((s) => s.title === 'Additional Information')?.items[0].description || '';
const exp = '\n\nEXPERIENCE\nAcme Ltd — Software Engineer\nJan 2020 – Present\n• Built things\n';
const read = (header) => resumeFromText(header + exp);

for (const [town, sep] of [['Walnut Creek', ' — '], ['Walnut Creek', ', '], ['Walnut Creek', ' / '], ['Walnut Creek', ' – '], ['Frankfurt am Main', ', '], ['Mount Pleasant Heights', ' — '], ['Greater Boston', ' — '], ['Austin TX', ' — ']]) {
  test(`"${town}" first on a line with the email, set apart by "${sep.trim()}", is the location and no job title`, () => {
    const r = read(`Jane Doe\n${town}${sep}jane@x.com`);
    assert.equal(r.personal.title, '');
    assert.equal(r.personal.location, town);
    assert.equal(r.personal.email, 'jane@x.com');
    assert.equal(extra(r), '');
  });
}

test('a town first with a LinkedIn address after it is the location and no job title', () => {
  const r = read('Jane Doe\nGreater Boston — linkedin.com/in/jane');
  assert.equal(r.personal.title, '');
  assert.equal(r.personal.location, 'Greater Boston');
  assert.equal(r.personal.linkedin, 'linkedin.com/in/jane');
});

test('a town first in a bulleted line is the location too', () => {
  const r = read('Jane Doe\n• Walnut Creek — jane@x.com');
  assert.equal(r.personal.title, '');
  assert.equal(r.personal.location, 'Walnut Creek');
  assert.equal(r.personal.email, 'jane@x.com');
});

for (const sep of [' — ', ' / ']) {
  test(`"Walnut Creek${sep}Senior Engineer${sep}jane@x.com": the town is the location and the field between is the title`, () => {
    const r = read(`Jane Doe\nWalnut Creek${sep}Senior Engineer${sep}jane@x.com`);
    assert.equal(r.personal.title, 'Senior Engineer');
    assert.equal(r.personal.location, 'Walnut Creek');
    assert.equal(r.personal.email, 'jane@x.com');
    assert.equal(extra(r), '');
  });
}

test('with the phone after the email too, the town first and the title after it are read the same', () => {
  const r = read('Jane Doe\nWalnut Creek — Senior Engineer — jane@x.com — (925) 555-0100');
  assert.equal(r.personal.title, 'Senior Engineer');
  assert.equal(r.personal.location, 'Walnut Creek');
  assert.equal(r.personal.email, 'jane@x.com');
  assert.equal(r.personal.phone, '(925) 555-0100');
  assert.equal(extra(r), '');
});

test('the title first still gives the title, wherever the town is', () => {
  for (const header of ['Senior Engineer — Walnut Creek — jane@x.com', 'Senior Engineer — jane@x.com — Walnut Creek']) {
    const r = read(`Jane Doe\n${header}`);
    assert.equal(r.personal.title, 'Senior Engineer', header);
    assert.equal(r.personal.location, 'Walnut Creek', header);
    assert.equal(r.personal.email, 'jane@x.com', header);
    assert.equal(extra(r), '', header);
  }
});

test('two towns first tell nothing: neither is the title nor the location', () => {
  const r = read('Jane Doe\nWalnut Creek — Concord Hills — jane@x.com');
  assert.equal(r.personal.title, '');
  assert.equal(r.personal.location, '');
  assert.equal(r.personal.email, 'jane@x.com');
  assert.match(extra(r), /Walnut Creek/);
  assert.match(extra(r), /Concord Hills/);
});
