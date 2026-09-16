// Design → Section Headings → Title case in the Word résumé (ONB-2, from VF2-1's new_bugs[0]).
// The .docx printed every section title in capitals whatever Title case said, so an Executive
// résumé — whose own default is "Abc" — or "Abc" on any template printed "Work History" in the PDF
// (= the preview) and "WORK HISTORY" in Word. Word now prints each title as the PDF prints it, in
// every template and both of the Sidebar's columns, for every Title case a résumé can store: none
// (older builds and imported files), '' (unset), 'upper', 'normal', and an imported 'title' or
// 'lower', which the PDF prints as typed (upperSectionTitles).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, allItems, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** One entry of every section type, under a mixed-case title short enough for the Sidebar's column. */
const TYPES = {
  experience: { title: 'Work History', items: [{ company: 'ExpCo', role: 'ExpRole', startDate: '01/2020', endDate: '12/2021', description: '<p>ExpText</p>' }] },
  education: { title: 'School Days', items: [{ institution: 'EduUni', degree: 'EduDeg', startDate: '2012', endDate: '2016' }] },
  skills: { title: 'Core Skills', items: [{ category: 'SkillCat', skills: 'SkillList' }] },
  projects: { title: 'Side Work', items: [{ name: 'ProjName', technologies: 'ProjTech', startDate: '2021' }] },
  languages: { title: 'Tongues', items: [{ language: 'LangName', proficiency: 'LangLevel' }] },
  certifications: { title: 'Cert Badges', items: [{ name: 'CertName', issuer: 'CertIssuer', date: '2020' }] },
  awards: { title: 'Prizes Won', items: [{ title: 'AwardName', issuer: 'AwardIssuer', date: '2019' }] },
  volunteering: { title: 'Giving Back', items: [{ role: 'VolRole', org: 'VolOrg', startDate: '2018' }] },
  references: { title: 'Referees', items: [{ name: 'RefName', jobTitle: 'RefJob', company: 'RefCo' }] },
  interests: { title: 'Pastimes', items: [{ interests: 'IntOne, IntTwo' }] },
  custom: { title: 'Extra Notes', items: [{ title: 'CustTitle', subtitle: 'CustSub', date: '2017' }] },
};
const TITLES = Object.values(TYPES).map((t) => t.title);
/** What a résumé can store as Title case; MISSING: no key at all, as older builds and imported files leave it. */
const MISSING = Symbol('missing');
const CASES = [MISSING, '', 'upper', 'normal', 'title', 'lower'];
const label = (c) => (c === MISSING ? 'no Title case stored' : `Title case ${JSON.stringify(c)}`);

/** A `template` résumé with a section of every type, storing Title case `titleCase`. */
function everyType(template, titleCase) {
  const r = resume({
    template,
    sections: Object.entries(TYPES).map(([type, { title, items }]) => section(type, items, {}, { title })),
  });
  if (titleCase === MISSING) delete r.settings.sectionTitleCase;
  else r.settings.sectionTitleCase = titleCase;
  return r;
}

/** Each title as `texts` print it: the one text equal to it but for case. */
function printed(texts, where) {
  return Object.fromEntries(TITLES.map((title) => {
    const hits = texts.filter((t) => t.toLowerCase() === title.toLowerCase());
    assert.equal(hits.length, 1, `${where}: "${title}" printed once: ${JSON.stringify(hits)}`);
    return [title, hits[0]];
  }));
}
const pdfTitles = async (r, where) => printed(allItems(await read(await render(r))).map((t) => t.str), `${where} PDF`);
const wordTitles = async (r, where) => printed((await renderDocx(r)).texts, `${where} Word`);

describe('Word prints section titles in the Title case the PDF prints them in (ONB-2)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: every section's title is cased as in its PDF, whatever Title case the résumé stores`, async () => {
      for (const titleCase of CASES) {
        const where = `${template}, ${label(titleCase)}`;
        const r = everyType(template, titleCase);
        const pdf = await pdfTitles(r, where);
        for (const title of TITLES) assert.ok([title, title.toUpperCase()].includes(pdf[title]), `${where}: the PDF prints "${pdf[title]}"`);
        assert.deepEqual(await wordTitles(r, where), pdf, where);
      }
    });
  }

  it('a new Executive résumé ("Abc" by default) prints "Work History" in Word as in its PDF; a new Classic one prints "WORK HISTORY"', async () => {
    const { createBlankResume } = await loadModule('/src/utils/defaultData.js');
    for (const [template, expected] of [['executive', 'Work History'], ['classic', 'WORK HISTORY']]) {
      const r = createBlankResume({ id: `r_new_${template}`, template });
      r.sections = [section('experience', TYPES.experience.items, {}, { title: 'Work History' })];
      const texts = (await renderDocx(r)).texts;
      const pdf = allItems(await read(await render(r))).map((t) => t.str);
      assert.ok(pdf.includes(expected), `${template} PDF: ${JSON.stringify(pdf)}`);
      assert.ok(texts.includes(expected) && !texts.includes(expected === 'Work History' ? 'WORK HISTORY' : 'Work History'), `${template} Word: ${JSON.stringify(texts)}`);
    }
  });

  it('an imported template id in another case (" Executive ") takes Executive\'s Title case in Word, as in its PDF', async () => {
    const r = everyType('executive', MISSING);
    r.template = ' Executive ';
    const where = 'template " Executive ", no Title case stored';
    const pdf = await pdfTitles(r, where);
    assert.equal(pdf['Work History'], 'Work History', `${where}: the PDF prints Executive's "Abc"`);
    assert.deepEqual(await wordTitles(r, where), pdf, where);
  });
});
