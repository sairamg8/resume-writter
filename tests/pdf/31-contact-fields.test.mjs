// The contact fields' names: one table (CONTACT_FIELDS, src/utils/contacts.js) that every place
// naming a field reads — Personal info's labels, the cover letter's toggles, the Design panel's
// icon previews and the Sidebar's printed labels. Each place used to write out its own copy
// (PersonalInfoEditor FIELDS, CoverLetterPanel CONTACT_FIELDS, contactIcons CONTACT_ICON_FIELDS,
// contacts CONTACT_LABELS), and the Design previews named the fields by their keys ("linkedin")
// where everywhere else said "LinkedIn" (R1-3, R9-6).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, read, allItems, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

/** The fields as the user sees them named, in the order every export prints them. */
const NAMES = [
  ['email', 'Email'], ['phone', 'Phone'], ['location', 'Location'],
  ['website', 'Website'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'],
];
const LABELS = NAMES.map(([, label]) => label);

const PERSONAL = {
  name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100', location: 'Berlin',
  website: 'example.com', linkedin: 'linkedin.com/in/pat', github: 'github.com/pat', hiddenFields: [],
};
const noop = () => {};
/** A rendered component's text: tags and React's text separators dropped. */
const text = (html) => html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, '').trim();

async function html(file, props) {
  const { default: Component } = await loadModule(file);
  return renderToString(createElement(Component, props));
}

describe('every place that names a contact field names it from the one table (R1-3, R9-6)', () => {
  it('Personal info: each field\'s label, in the table\'s order; the link fields offer a display label and a link URL', async () => {
    const out = await html('/src/components/PersonalInfoEditor.jsx', {
      personal: PERSONAL, updatePersonal: noop, toggleFieldVisibility: noop, settings: {}, updateSetting: noop, template: 'classic', coverLetter: {},
    });
    const labels = [...out.matchAll(/<label for="[^"]*"[^>]*>([\s\S]*?)<\/label>/g)].map((m) => text(m[1]));
    assert.deepEqual(labels, ['Full Name', 'Job Title', ...LABELS]);
    const overrides = [...out.matchAll(/aria-label="([^"]+) display label"/g)].map((m) => m[1]);
    assert.deepEqual(overrides, ['Website', 'LinkedIn', 'GitHub']);
  });

  it('Cover letter → Visible Contact Fields: each toggle names its field', async () => {
    const out = await html('/src/components/CoverLetterPanel.jsx', {
      coverLetter: { hiddenFields: ['phone'] }, personal: PERSONAL, settings: {}, template: 'classic', updateCoverLetter: noop,
    });
    const toggles = [...out.matchAll(/title="(Hide|Show) (.+?) (?:from|on) the cover letter"/g)].map((m) => `${m[1]} ${m[2]}`);
    assert.deepEqual(toggles, LABELS.map((l) => `${l === 'Phone' ? 'Show' : 'Hide'} ${l}`));
  });

  it('Design → Contact icons: every pack\'s preview names its six icons as the editor does, not by their keys', async () => {
    const r = resume({ template: 'classic', personal: PERSONAL });
    const out = await html('/src/components/DesignPanel.jsx', { resume: r, updateSetting: noop, setTemplate: noop, resetSettings: noop });
    const previews = [...out.matchAll(/<span[^>]*title="([^"]*)"[^>]*><svg/g)].map((m) => m[1]);
    assert.equal(previews.length, 5 * 6, `${previews.length} icon previews`);
    for (let pack = 0; pack < 5; pack += 1) assert.deepEqual(previews.slice(pack * 6, pack * 6 + 6), LABELS, `pack ${pack + 1}`);
  });

  it('Sidebar PDF: the contact labels it prints, in the table\'s order', async () => {
    const items = allItems(await read(await render(resume({ template: 'sidebar', personal: PERSONAL }))));
    const upper = new Set(LABELS.map((l) => l.toUpperCase()));
    assert.deepEqual(items.map((t) => t.str.trim()).filter((s) => upper.has(s)), LABELS.map((l) => l.toUpperCase()));
  });
});

describe('one contact-field table (R1-3, R9-6)', () => {
  it('src/utils/contacts.js holds it; CONTACT_KEYS, CONTACT_LABELS and the link fields come from it', async () => {
    const contacts = await loadModule('/src/utils/contacts.js');
    assert.deepEqual(contacts.CONTACT_FIELDS?.map(({ key, label }) => [key, label]), NAMES);
    assert.deepEqual(contacts.CONTACT_KEYS, NAMES.map(([key]) => key));
    assert.deepEqual(contacts.CONTACT_LABELS, Object.fromEntries(NAMES));
    // A link field prints its URL without the scheme; the others print as typed.
    const printed = Object.fromEntries(contacts.contactItems({
      ...PERSONAL, email: 'https://pat@example.com', location: 'https://berlin', website: 'https://www.example.com/',
    }).map((c) => [c.key, c.value]));
    assert.deepEqual(contacts.CONTACT_FIELDS.filter((f) => f.link).map((f) => f.key), ['website', 'linkedin', 'github']);
    assert.deepEqual([printed.email, printed.location, printed.website], ['https://pat@example.com', 'https://berlin', 'example.com']);
  });

  // A deliberate structural guard: the four copies drifting apart is the bug R1-3/R9-6 report,
  // and only a source scan can catch a fifth copy being added.
  it('no other file in src/ writes out the contacts\' names or their list of keys', () => {
    // The Job Tracker names LinkedIn as a place a job was found (JOB_SOURCES, source: 'linkedin') — a job
    // board, not a contact field — so its three source files are not contact tables.
    const JOB_SOURCE_FILES = [['constants', 'jobs.js'], ['utils', 'jobFields.js'], ['utils', 'normalizeJob.js']].map((p) => path.join(...p));
    const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => /\.jsx?$/.test(f)
      && f !== path.join('utils', 'contacts.js') && !JOB_SOURCE_FILES.includes(f));
    // Elsewhere "LinkedIn" and "GitHub" name nothing but contact fields, so any second table spells them;
    // a list of the keys starts 'email', 'phone'.
    const copy = /(['"`])(?:LinkedIn|GitHub)\1|(['"])email\2\s*,\s*(['"])phone\3/;
    // A reference entry has an email and a phone of its own, beside its job title and relationship: a
    // list that also names 'relationship' (no contact field) lists an entry's fields, not the contacts'
    // — the ATS job match's PRINTED_FIELDS (R2-022).
    const entryFields = /(['"])relationship\1/;
    const offenders = files.flatMap((f) => fs.readFileSync(path.join(SRC, f), 'utf8').split('\n')
      .map((line, i) => ({ where: `src/${f}:${i + 1}`, line }))
      .filter(({ line }) => copy.test(line) && !entryFields.test(line)));
    assert.deepEqual(offenders.map((o) => o.where), [], offenders.map((o) => o.line.trim()).join('\n'));
  });
});
