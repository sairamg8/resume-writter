// Markdown and the ATS plain text follow Section Options and Design → Date format as the PDF and
// Word do (R2-064, with R2-054, R2-058, R2-060 and R2-122). Both printed every date and location
// that Show dates / Show location turned off, ignored the experience section's Order (Co. / Role or
// Role / Co.), and the ATS text printed every date as stored — "2021-01", a hardcoded "Present" —
// whatever the Date format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const DATED = [
  ['experience', { role: 'Rolex', company: 'Compy', location: 'Lisbonia', startDate: 'Jan 2021', endDate: 'Jun 2023' }],
  ['education', { degree: 'Degx', institution: 'Unix', location: 'Springq', startDate: 'Sep 2014', endDate: 'May 2018' }],
  ['volunteering', { role: 'Mentorx', org: 'Clubx', location: 'Oaklandx', startDate: 'Mar 2019', endDate: 'Dec 2019' }],
  ['projects', { name: 'Projx', startDate: 'Feb 2020', endDate: 'Apr 2020' }],
  ['certifications', { name: 'Certx', issuer: 'Issx', date: 'Jul 2022', expiry: 'Jul 2025' }],
  ['awards', { title: 'Prizex', issuer: 'Orgx', date: 'Aug 2017' }],
  ['custom', { title: 'Talkx', subtitle: 'Confx', location: 'Berlinx', date: 'Oct 2016' }],
];

const resumeWith = (sectionSettings, settings = {}) => ({
  settings,
  personal: { name: 'Pat Sample' },
  sections: DATED.map(([type, item], i) => ({ id: `s${i}`, type, title: type, settings: { ...sectionSettings }, items: [{ id: `i${i}`, ...item }] })),
});

const EXPORTS = [['Markdown', generateMarkdownResume], ['ATS text', generateAtsPlainText]];
const YEARS = ['2021', '2023', '2014', '2018', '2019', '2020', '2022', '2025', '2017', '2016'];

for (const [name, generate] of EXPORTS) {
  test(`${name}: Show dates off prints no date of any dated section`, () => {
    const out = generate(resumeWith({ showDates: false }));
    for (const y of YEARS) assert.ok(!out.includes(y), `${y} printed:\n${out}`);
    for (const word of ['Rolex', 'Degx', 'Mentorx', 'Projx', 'Certx', 'Prizex', 'Talkx', 'Lisbonia']) assert.ok(out.includes(word), word);
  });

  test(`${name}: Show location off hides the location of experience, education and volunteering, as the PDF does`, () => {
    const out = generate(resumeWith({ showLocation: false }));
    for (const loc of ['Lisbonia', 'Springq', 'Oaklandx']) assert.ok(!out.includes(loc), `${loc} printed:\n${out}`);
    // The PDF prints a custom entry's location whatever the option (it has no Show location).
    assert.ok(out.includes('Berlinx'));
    assert.ok(out.includes('2021'), 'dates still print');
  });

  test(`${name}: both options on (or never set) print every date and location`, () => {
    for (const s of [{ showDates: true, showLocation: true }, {}]) {
      const out = generate(resumeWith(s));
      for (const w of [...YEARS, 'Lisbonia', 'Springq', 'Oaklandx', 'Berlinx']) assert.ok(out.includes(w), `${w} missing:\n${out}`);
    }
  });

  test(`${name}: every date prints in Design → Date format; a current job ends in "Present"`, () => {
    const r = resumeWith({}, { dateFormat: 'MM/YYYY' });
    r.sections[0].items.push({ id: 'cur', role: 'Nowrole', company: 'Nowco', startDate: 'Jul 2023', current: true });
    const out = generate(r);
    for (const d of ['01/2021', '06/2023', '09/2014', '05/2018', '03/2019', '12/2019', '02/2020', '04/2020', '07/2022', '07/2025', '08/2017', '10/2016', '07/2023'])
      assert.ok(out.includes(d), `${d} missing:\n${out}`);
    for (const raw of ['Jan 2021', 'Sep 2014', 'Jul 2022', 'Jul 2025', 'Aug 2017', 'Oct 2016']) assert.ok(!out.includes(raw), `${raw} printed as stored`);
    assert.match(out, /07\/2023 [-–] Present/);
  });

  test(`${name}: an experience entry prints in the section's Order, company first by default as the PDF does`, () => {
    const at = (out) => [out.indexOf('Compy'), out.indexOf('Rolex')];
    const [c1, r1] = at(generate(resumeWith({})));
    assert.ok(c1 >= 0 && c1 < r1, 'Co. / Role (default): company first');
    const [c2, r2] = at(generate(resumeWith({ titleOrder: 'role' })));
    assert.ok(r2 >= 0 && r2 < c2, 'Role / Co.: role first');
  });
}

for (const [name, generate] of EXPORTS) {
  test(`${name}: an unset Order follows the template's default, as the PDF and Word resolve it (resolveSection)`, () => {
    const order = (template, sectionSettings) => {
      const r = { ...resumeWith(sectionSettings), template };
      const out = generate(r);
      return out.indexOf('Rolex') < out.indexOf('Compy') ? 'role' : 'company';
    };
    for (const t of ['executive', 'sidebar', 'timeline', 'banner', 'academic', 'compact']) {
      assert.equal(order(t, {}), 'role', `${t}: unset leads with the role`);
      assert.equal(order(t, { titleOrder: '' }), 'role', `${t}: a stored '' is no choice`);
      assert.equal(order(t, { titleOrder: 'company' }), 'company', `${t}: a chosen Co. / Role wins`);
    }
    for (const t of ['classic', 'modern', 'minimal', undefined]) assert.equal(order(t, {}), 'company', `${t}: company first`);
  });
}
