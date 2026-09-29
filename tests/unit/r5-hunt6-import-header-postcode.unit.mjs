// R5-HUNT6-HEADER-POSTCODE: a header place with a postcode ("Chicago, IL 60601") or a street before it
// ("123 Main St, Chicago, IL 60601") was no place: its digits failed the test. The location stayed
// empty and the place printed as an "Additional Information" section. It is now the location.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

const read = (r) => [r.personal.location, r.sections.map((s) => s.title)];

test('a place with a ZIP code on the contact line is the location', () => {
  const r = resumeFromText('JOHN SMITH\nRegistered Nurse\nChicago, IL 60601 | (312) 555-0199 | john.smith@gmail.com\n\nEXPERIENCE\nNorthwestern Memorial\t2019 – Present\nRegistered Nurse');
  assert.deepEqual(read(r), ['Chicago, IL 60601', ['Experience']]);
  assert.equal(r.personal.phone, '(312) 555-0199');
  assert.equal(r.personal.title, 'Registered Nurse');
});

test('a street address, a ZIP+4 and a Canadian postcode are places too', () => {
  const at = (line) => resumeFromText(`Al Bo\n${line}\n\nEXPERIENCE\nAcme\t2020 – 2021\nEngineer`);
  assert.deepEqual(read(at('al@bo.com | 123 Main St, Chicago, IL 60601')), ['123 Main St, Chicago, IL 60601', ['Experience']]);
  assert.deepEqual(read(at('al@bo.com | Austin, TX 78701-1234')), ['Austin, TX 78701-1234', ['Experience']]);
  assert.deepEqual(read(at('al@bo.com | Toronto, ON M5V 2T6')), ['Toronto, ON M5V 2T6', ['Experience']]);
});

test('the Markdown import reads it the same way', () => {
  const r = resumeFromText(markdownLines('# John Smith\n\nChicago, IL 60601 | john.smith@gmail.com\n\n## Experience\n### Acme — Engineer\n*2020 – 2021*\n'));
  assert.equal(r.personal.location, 'Chicago, IL 60601');
  assert.ok(!r.sections.some((s) => s.title === 'Additional Information'));
});
