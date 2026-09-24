// Export → JSON Resume leaves out what the user hid (R2-007). It wrote everything: a phone hidden
// with its eye, a hidden photo or summary, a hidden section, a hidden entry and an entry's hidden
// fields all went into the file — and the import brought each one back visible, so the imported
// résumé printed them. Every other export (the PDF, Word, Markdown, the ATS text) leaves them out;
// the Backup JSON is the lossless copy that keeps them. What prints before the trip prints after it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { generateAtsPlainText } from '../../src/utils/atsChecker.js';
import { CONTACT_FIELDS, CONTACT_KEYS, contactItems } from '../../src/utils/contacts.js';

/** The file as the download writes it: JSON text. */
const fileOf = (resume) => JSON.stringify(cpwtResumeToJsonResume(resume));
const importOf = (text) => jsonResumeToCpwtResume(JSON.parse(text));
const LINK_KEYS = CONTACT_FIELDS.filter((f) => f.link).map((f) => f.key);

/** Every personal field filled with text naming it; the link fields with a display label and a link URL too. */
function fullPersonal(hiddenFields) {
  const p = { name: 'Ada Lovelace', title: 'Engineer', summary: '<p>Secret-summary text</p>', photo: 'data:image/png;base64,U2VjcmV0LXBob3Rv', hiddenFields };
  for (const key of CONTACT_KEYS) p[key] = `secret-${key}.example`;
  for (const key of LINK_KEYS) Object.assign(p, { [`${key}Label`]: `Secret-${key}-label`, [`${key}Url`]: `https://secret-${key}-url.example` });
  return p;
}

/** The text of each value a hidden personal field holds — none of it may be in the file. */
function valuesOf(p, key) {
  if (key === 'summary') return ['Secret-summary'];
  if (key === 'photo') return [p.photo];
  return [p[key], p[`${key}Label`], p[`${key}Url`]].filter(Boolean);
}

test('personal: a hidden contact, the hidden summary and the hidden photo are not in the file, and none prints after the import (R2-007)', () => {
  for (const key of [...CONTACT_KEYS, 'summary', 'photo']) {
    const personal = fullPersonal([key]);
    const resume = { personal, template: 'classic', settings: {}, sections: [] };
    const text = fileOf(resume);
    for (const v of valuesOf(personal, key)) assert.ok(!text.includes(v), `${key}: "${v}" is in the file`);
    for (const other of [...CONTACT_KEYS, 'summary', 'photo'].filter((k) => k !== key)) {
      assert.ok(text.includes(valuesOf(personal, other)[0]), `${key} hidden: ${other}, shown, is still in the file`);
    }
    const back = importOf(text);
    assert.deepEqual(contactItems(back.personal), contactItems(personal), `${key}: the contact lines print as before`);
    if (key === 'summary') assert.equal(back.personal.summary, '', 'the hidden summary does not print');
    if (key === 'photo') assert.equal(back.personal.photo, null, 'the hidden photo does not print');
    if (key !== 'photo') assert.ok(back.personal.photo, 'a shown photo still comes back');
  }
});

const section = (type, title, items, extra = {}) => ({ id: `sec-${title}`, type, title, visible: true, items, ...extra });

/** Hidden things of every kind, each holding text with "Secret" in it; dates as ISO, as the file writes them. */
function resumeWithHidden() {
  return {
    personal: { name: 'Ada Lovelace', hiddenFields: [] },
    template: 'classic',
    settings: {},
    sections: [
      section('experience', 'Work', [
        { id: 'e1', company: 'Acme', role: 'Lead', location: 'Secret Town', startDate: '2021-03', endDate: '2023-06', current: false,
          description: '<p>Secret description</p>', bullets: ['Kept bullet'], hiddenFields: ['location', 'description'] },
        { id: 'e2', company: 'Secret Employer', role: 'Secret Role', startDate: '2018-01', endDate: '2020-01', visible: false, description: '<p>Secret job</p>' },
        { id: 'e3', company: 'Beta', role: 'Dev', startDate: '2016-01', endDate: '2017-12', description: '<p>Built things</p>' },
      ]),
      section('skills', 'Skills', [
        { id: 's1', category: 'Secret Category', skills: 'React, SQL', hiddenFields: ['category'] },
        { id: 's2', category: 'Tools', skills: 'Secret Skill', hiddenFields: ['skills'] },
      ]),
      section('custom', 'Secret Section', [{ id: 'c1', title: 'Secret entry', description: '<p>Secret custom</p>' }], { visible: false }),
      section('languages', 'Secret Languages', [{ id: 'l1', language: 'Secret Tongue', proficiency: 'Native' }], { visible: false }),
      section('custom', 'Talks', [
        { id: 'c2', title: 'Shown talk', subtitle: 'Secret subtitle', date: '2022', hiddenFields: ['subtitle'] },
        { id: 'c3', title: 'Secret talk', visible: false },
      ]),
      section('experience', 'Earlier work', [{ id: 'e4', company: 'Gamma', role: 'Intern', startDate: '2015-06', endDate: '2015-09', description: '' }]),
    ],
  };
}

test('sections: a hidden section, a hidden entry and an entry\'s hidden fields are not in the file, and none prints after the import (R2-007)', () => {
  const resume = resumeWithHidden();
  const text = fileOf(resume);
  assert.deepEqual(text.match(/Secret[^"\\]*/g), null, 'nothing hidden is in the file');
  assert.ok(!text.includes('hiddenFields'), 'no list of hidden fields either');

  const back = importOf(text);
  assert.deepEqual(back.sections.map((s) => s.title), ['Work', 'Skills', 'Talks', 'Earlier work'], 'the hidden sections are not imported');
  assert.deepEqual(back.sections.map((s) => s.items.length), [2, 2, 1, 1], 'each shown entry lands in its own section; the hidden ones are gone');
  assert.equal(generateAtsPlainText(back), generateAtsPlainText(resume), 'the imported résumé prints what the exported one printed');
});

test('a current job whose end date is hidden prints no end date, before the trip and after it (R2-007)', () => {
  const resume = {
    personal: { name: 'Ada' },
    sections: [section('experience', 'Work', [{ id: 'e1', company: 'Acme', role: 'Lead', startDate: '2020-01', endDate: '', current: true, description: '', hiddenFields: ['endDate'] }])],
  };
  const printed = generateAtsPlainText(resume);
  assert.match(printed, /^2020-01$/m, 'the hidden end prints nothing, not "Present"');
  assert.equal(generateAtsPlainText(importOf(fileOf(resume))), printed);
});

test('the hidden data stays in the Backup JSON: the JSON Resume export does not change the résumé it reads', () => {
  const resume = resumeWithHidden();
  const before = JSON.stringify(resume);
  fileOf(resume);
  assert.equal(JSON.stringify(resume), before);
});
