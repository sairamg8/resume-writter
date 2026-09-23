// R2-001: every word the PDF and the Word export print for a section, the ATS plain-text export
// (Export → ATS Text, and the ATS tab's Copy / Download) prints too. It used to print Interests as a
// heading over nothing, an award, a reference and a custom entry as their title alone, a certificate
// without its expiry, ID and link, a project without its dates, and a description holding a list
// without the paragraphs around it. One entry of each of the 11 section types with every field its
// renderer prints, in every template (the Sidebar's side column has renderers of its own) and in
// the Sidebar's ATS-safe single column. Dates are As entered, so the words are the same in all three;
// a certificate's link has no label, as the text prints the address a label would hide.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, renderDocx, loadModule, resume, section, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const LEAD = '<p>Owned the zephyr billing platform.</p>';
const LIST = '<ul><li>Cut quokka costs 30%</li><li>Led <b>five</b> engineers</li></ul><p>Closing wombat note.</p>';

/** One entry per section type, every field its PDF renderer prints filled with a word of its own. */
const SECTIONS = [
  ['experience', { role: 'Staffengineer', company: 'Acmecorp', location: 'Lisbonia', startDate: '01/2020', endDate: '12/2021', description: LEAD + LIST, bullets: ['Legacy walrus bullet'] }, { showLocation: true }],
  ['education', { degree: 'Bachelorx', fieldOfStudy: 'Physicsy', institution: 'Lakesidez', location: 'Springfieldq', startDate: '08/2013', endDate: '05/2017', gpa: '3.9', description: '<p>Dean list.</p>' }, { showLocation: true }],
  ['skills', { category: 'Languagesk', skills: 'Golang, Rustlang' }, {}],
  ['projects', { name: 'Flowengine', technologies: 'Reactx', url: 'https://flow.example/p', startDate: '02/2022', endDate: '03/2023', description: LEAD + LIST }, {}],
  ['languages', { language: 'Frenchq', proficiency: 'Fluentq' }, {}],
  ['certifications', { name: 'Awssa', issuer: 'Amazonx', date: '04/2023', expiry: '04/2026', credentialId: 'ABC-123', url: 'https://cred.example/abc' }, {}],
  ['awards', { title: 'Bestpaper', issuer: 'Acmorg', date: '05/2021', description: '<p>For the tapir parser.</p>' }, {}],
  ['volunteering', { role: 'Mentorx', org: 'Codeclub', location: 'Oaklandx', startDate: '01/2019', endDate: '12/2019', description: LEAD + LIST }, { showLocation: true }],
  ['references', { name: 'Bobstone', jobTitle: 'Ctox', company: 'Refco', relationship: 'Managerx', email: 'bob@refco.example', phone: '555 1234' }, {}],
  ['interests', { interests: 'Chess, Running, Photography' }, {}],
  ['custom', { title: 'Speakerx', subtitle: 'Jsconfx', location: 'Berlinx', date: '06/2023', description: LEAD + LIST }, {}],
];

const words = (text) => new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
/**
 * The words of `printed` that `ats` does not hold. The two-column Sidebar titles its summary "About
 * Me"; the text prints the ATS-standard PROFESSIONAL SUMMARY there, a heading, not the user's words.
 */
const missing = (printed, ats) => {
  const have = words(ats);
  const heading = words('About Me');
  return [...words(printed)].filter((w) => !have.has(w) && !heading.has(w));
};

function fullResume(template, settings = {}) {
  return resume({
    template, settings,
    personal: { name: 'Ada Lovelace', title: 'Engineer', email: '', phone: '', location: '', linkedin: '', website: '', github: '', summary: '<p>Summary kiwi line.</p><ul><li>Summary emu item</li></ul>' },
    sections: SECTIONS.map(([type, item, options]) => section(type, [item], options)),
  });
}

const LAYOUTS = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];

describe('the ATS text prints every word the PDF prints (R2-001)', () => {
  for (const [template, settings] of LAYOUTS) {
    it(`${template}${settings.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}`, async () => {
      const r = fullResume(template, settings);
      const { generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
      const ats = generateAtsPlainText(r);
      const pdf = allText(await read(await render(r)));
      assert.deepEqual(missing(pdf, ats), [], `ATS text:\n${ats}`);
    });
  }
});

describe('the ATS text prints every word the Word export prints (R2-001)', () => {
  it('classic', async () => {
    const r = fullResume('classic');
    const { generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
    const ats = generateAtsPlainText(r);
    const { texts } = await renderDocx(r);
    assert.deepEqual(missing(texts.join('\n'), ats), [], `ATS text:\n${ats}`);
  });
});

describe('the ATS text keeps the PDF\'s order inside an entry', () => {
  it('the paragraph before a list, the list, the paragraph after it, then the legacy bullets', async () => {
    const { generateAtsPlainText } = await loadModule('/src/utils/atsChecker.js');
    const ats = generateAtsPlainText(fullResume('classic'));
    const order = ['Owned the zephyr billing platform.', '* Cut quokka costs 30%', '* Led five engineers', 'Closing wombat note.', '* Legacy walrus bullet'];
    const at = order.map((line) => ats.indexOf(`\n${line}\n`));
    assert.ok(at.every((i) => i >= 0), `ATS text:\n${ats}`);
    assert.deepEqual([...at].sort((a, b) => a - b), at);
  });
});
