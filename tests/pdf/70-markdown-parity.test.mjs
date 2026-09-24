// R2-009: every word the PDF and the Word export print for a section, the Markdown export (Export →
// Markdown (.md)) prints too. It used to print Interests as a heading over nothing, a reference as
// its name and company alone, a custom entry without its subtitle and location, an education entry
// without its field of study, and no legacy bullets at all. One entry of each of the 11 section types
// with every field its renderer prints, in every template (the Sidebar's side column has renderers of
// its own; Timeline and Banner have their own history and header) and in the Sidebar's ATS-safe
// single column. The same settings reach both, so the dates are formatted alike.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, renderDocx, loadModule, resume, section, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const LEAD = '<p>Owned the zephyr billing platform.</p>';
const LIST = '<ul><li>Cut quokka costs 30%<ul><li>Nested ibex child</li></ul></li><li>Led <b>five</b> engineers</li></ul><p>Closing wombat note.</p>';

/** One entry per section type, every field its PDF renderer prints filled with a word of its own. */
const SECTIONS = [
  ['experience', { role: 'Staffengineer', company: 'Acmecorp', location: 'Lisbonia', startDate: '01/2020', endDate: '12/2021', description: LEAD + LIST, bullets: ['Legacy walrus bullet'] }, { showLocation: true }],
  ['education', { degree: 'Bachelorx', fieldOfStudy: 'Physicsy', institution: 'Lakesidez', location: 'Springfieldq', startDate: '08/2013', endDate: '05/2017', gpa: '3.9', description: '<p>Dean list.</p>', bullets: ['Thesis narwhal'] }, { showLocation: true }],
  ['skills', { category: 'Languagesk', skills: 'Golang, Rustlang' }, {}],
  ['projects', { name: 'Flowengine', technologies: 'Reactx', url: 'flow.example/p', startDate: '02/2022', endDate: '03/2023', description: LEAD + LIST, bullets: ['Project okapi bullet'] }, {}],
  ['languages', { language: 'Frenchq', proficiency: 'Fluentq' }, {}],
  ['certifications', { name: 'Awssa', issuer: 'Amazonx', date: '04/2023', expiry: '04/2026', credentialId: 'ABC-123', url: 'cred.example/abc', urlLabel: 'Verifylabel' }, {}],
  ['awards', { title: 'Bestpaper', issuer: 'Acmorg', date: '05/2021', description: '<p>For the tapir parser.</p>' }, {}],
  ['volunteering', { role: 'Mentorx', org: 'Codeclub', location: 'Oaklandx', startDate: '01/2019', endDate: '12/2019', description: LEAD + LIST }, { showLocation: true }],
  ['references', { name: 'Bobstone', jobTitle: 'Ctox', company: 'Refco', relationship: 'Managerx', email: 'bob@refco.example', phone: '555 1234' }, {}],
  ['interests', { interests: 'Chess, Running, Photography' }, {}],
  ['custom', { title: 'Speakerx', subtitle: 'Jsconfx', location: 'Berlinx', date: '06/2023', description: LEAD + LIST, bullets: ['Custom yak bullet'] }, {}],
];

const words = (text) => new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
/**
 * The words of `printed` that `md` does not hold. The two-column Sidebar titles its summary "About
 * Me"; the Markdown prints "Professional Summary" there, a heading, not the user's words.
 */
const missing = (printed, md) => {
  const have = words(md);
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

describe('the Markdown prints every word the PDF prints (R2-009)', () => {
  for (const [template, settings] of LAYOUTS) {
    it(`${template}${settings.sidebarSingleColumn ? ' (Single · ATS-safe)' : ''}`, async () => {
      const r = fullResume(template, settings);
      const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
      const md = generateMarkdownResume(r);
      const pdf = allText(await read(await render(r)));
      assert.deepEqual(missing(pdf, md), [], `Markdown:\n${md}`);
    });
  }
});

describe('the Markdown prints every word the Word export prints (R2-009)', () => {
  it('classic', async () => {
    const r = fullResume('classic');
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const md = generateMarkdownResume(r);
    const { texts } = await renderDocx(r);
    assert.deepEqual(missing(texts.join('\n'), md), [], `Markdown:\n${md}`);
  });
});

describe('the Markdown keeps the PDF\'s order inside an entry, and its links absolute', () => {
  it('the paragraph before a list, the list and its nested item, the paragraph after it, then the legacy bullets', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const md = generateMarkdownResume(fullResume('classic'));
    const entry = md.slice(md.indexOf('### **Acmecorp**'), md.indexOf('## ', md.indexOf('### **Acmecorp**') + 4));
    const expected = 'Owned the zephyr billing platform.\n\n- Cut quokka costs 30%\n    - Nested ibex child\n- Led five engineers\n\nClosing wombat note.\n\n- Legacy walrus bullet';
    assert.ok(entry.includes(expected), `entry:\n${entry}`);
  });

  it('a project and a certificate link to the https:// address the PDF links', async () => {
    const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
    const md = generateMarkdownResume(fullResume('classic'));
    assert.ok(md.includes('[Flowengine](https://flow.example/p)'), md);
    assert.ok(md.includes('[Verifylabel](https://cred.example/abc)'), md);
  });
});
