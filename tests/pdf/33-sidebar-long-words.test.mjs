// The Sidebar's dark column is 38 % of the paper less its padding — 103 pt on A4 at 40 mm, 146 pt at
// 18 mm. textkit breaks a line only at a space, and inside a token only at the marks breakLongWords
// puts in one past 48 characters, so an ordinary long word wider than the column ran out of it, over
// the main column: a degree "Informationstechnologie" to x 236.5, a certificate
// "Cloudinfrastrukturzertifizierung" to 255.9, a skill "Kubernetesadministrationsverfahren," to
// 269.1 and a language level pushed out beside its language to 232.9, against a column ending at
// 216.2 (NB-3-NB1-NB1). 209e02c broke those fields; every other free text in the column still ran
// out — a section title, Bars' and Tags' letter-spaced categories, an education's location, GPA,
// description and bullets, an interest chip, a reference's name, job title, company and
// relationship. Each now breaks inside the column (sideBreaks, measured in its own type).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, loadModule, MM } from './harness.mjs';
import { buildTestState } from '../helpers.js';

before(setup);
after(teardown);

/** The dark column's text box on `page` at `marginH` mm: the page margin to its 10 pt right padding. */
const columnOf = (page, marginH) => ({ left: marginH * MM, right: page.W * 0.38 - 10 });

/** The runs printed in the dark column (the main column starts 14 pt past its edge). */
const inColumn = (page) => page.items.filter((t) => t.x < page.W * 0.38);

/** The dark column's runs that print past either side of its text box. */
function outside(page, marginH) {
  const { left, right } = columnOf(page, marginH);
  return inColumn(page)
    .filter((t) => t.x < left - 0.5 || t.x + t.w > right + 0.5)
    .map((t) => `${t.str} (x ${t.x.toFixed(1)}…${(t.x + t.w).toFixed(1)}, right bound ${right.toFixed(1)})`);
}

const W = 'Donaudampfschifffahrtsgesellschaft'; // 34 characters: under breakLongWords' 48
/** Each field's long word, told apart by its last letter; they must all print, whole. */
const WORDS = {
  title: `${W}T`, degree: `${W}D`, institution: `${W}I`, fieldOfStudy: `${W}F`, location: `${W}L`, gpa: `${W}G`,
  bold: `${W}B`, italic: `${W}E`, nested: `${W}N`, numbered: `${W}O`, bullet: `${W}U`,
  language: `${W}X`, proficiency: `${W}P`, certificate: `${W}C`, issuer: `${W}S`, credentialId: `${W}Z`,
  interest: `${W}Q`, reference: `${W}R`, jobTitle: `${W}J`, company: `${W}K`, relationship: `${W}H`,
  category: `${W}A`, skill: `${W}V`,
};

const longWords = (pageSize, marginH, skillsStyle) => resume({
  template: 'sidebar',
  settings: { pageSize, marginH },
  sections: [
    {
      ...section('education', [{
        degree: WORDS.degree, institution: WORDS.institution, fieldOfStudy: WORDS.fieldOfStudy, location: WORDS.location, gpa: WORDS.gpa,
        description: `<p><strong>${WORDS.bold}</strong> und <em>${WORDS.italic}</em></p><ul><li>Kurs<ul><li>${WORDS.nested}</li></ul></li></ul><ol><li>${WORDS.numbered}</li></ol>`,
        bullets: [WORDS.bullet],
      }]),
      title: WORDS.title,
    },
    section('languages', [{ language: WORDS.language, proficiency: WORDS.proficiency }]),
    section('certifications', [{ name: WORDS.certificate, issuer: WORDS.issuer, credentialId: WORDS.credentialId }]),
    section('interests', [{ interests: `${WORDS.interest}, Go` }]),
    section('references', [{ name: WORDS.reference, jobTitle: WORDS.jobTitle, company: WORDS.company, relationship: WORDS.relationship }]),
    section('skills', [{ category: WORDS.category, skills: `${WORDS.skill}, Go` }], { skillsStyle }),
  ],
});

describe('Sidebar: an ordinary long word in any dark-column field stays inside the column (NB-3-NB1-NB1)', () => {
  it('every field, every skills style, A4 and US Letter at 18 and 40 mm: inside, whole, no hyphen', async () => {
    for (const pageSize of ['A4', 'letter']) {
      for (const marginH of [18, 40]) {
        for (const skillsStyle of ['inline', 'bullet', 'tags', 'bars', 'stacked']) {
          const at = `${pageSize} ${marginH} mm ${skillsStyle}`;
          const pages = await read(await render(longWords(pageSize, marginH, skillsStyle)));
          assert.deepEqual(pages.flatMap((page) => outside(page, marginH)), [], `${at}: every run inside the column`);
          const runs = pages.flatMap(inColumn);
          const printed = runs.map((t) => t.str).join('').replace(/\s/g, '').toLowerCase();
          const missing = Object.entries(WORDS).filter(([, word]) => !printed.includes(word.toLowerCase())).map(([field]) => field);
          assert.deepEqual(missing, [], `${at}: every word prints, its pieces in order`);
          const hyphens = runs.filter((t) => t.str.includes('-')).map((t) => t.str);
          assert.deepEqual(hyphens, [], `${at}: no hyphen that is not in the text`);
        }
      }
    }
  });

  it('a word that fits the column gets no break (guard)', async () => {
    const sample = buildTestState('sidebar').resumes[0];
    await render(sample); // loads the fonts the measures read
    const { sideBreaks } = await loadModule('/src/templates/pdf/shared/PdfSidebarColumn.jsx');
    // Every word the sample's column prints, as textkit hands it over (split at spaces)…
    const side = sample.sections.filter((sec) => ['skills', 'education', 'languages', 'certifications', 'interests', 'references'].includes(sec.type));
    const words = [...new Set([JSON.stringify(side), 'CONTACT'].join(' ').split(/[ "]+/).filter((w) => /\p{L}/u.test(w) && w.length < 30))];
    assert.ok(words.length > 40, `the sample's column words (${words.length})`);
    // …in each type the column measures, at the widest margin (the narrowest column).
    const types = [
      [{ fontSize: 9 }], [{ fontSize: 9, fontWeight: 'bold' }], [{ fontSize: 10, fontWeight: 'bold' }], [{ fontSize: 8.5 }, 10],
      [{ fontSize: 8.5, fontWeight: 'bold', letterSpacing: 0.5 }], [{ fontSize: 8.5, fontWeight: 'bold', letterSpacing: 1.2 }],
    ];
    const settings = { ...sample.settings, marginH: 40 };
    for (const [type, inset] of types) {
      const breaks = sideBreaks(settings, type, inset);
      const split = words.filter((w) => JSON.stringify(breaks(w)) !== JSON.stringify([w])); // breakLongWords(48) leaves them whole
      assert.deepEqual(split, [], `${JSON.stringify(type)} inset ${inset ?? 0}: left whole`);
    }
  });
});
