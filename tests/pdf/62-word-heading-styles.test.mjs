// Section titles in the Word résumé are Word Heading 1 paragraphs (ATS-6, PENDING-ALL D3). Every
// title was a bold body paragraph drawn with direct formatting alone: no paragraph style, no outline
// level, so Word's Navigation pane, screen readers and parsers saw no headings (Microsoft's guidance
// for accessible, parseable documents). Now each title carries the Heading 1 style, and that style
// sets only the résumé's own font and outline level 1: every visible property is still the title's
// direct formatting, so the page looks as it did. The font is in the style on purpose — without one
// LibreOffice draws any Heading 1 in its own heading font (Liberation Sans), a measured change;
// and it is based on no style, since one based on the undefined "Normal" inherits LibreOffice's own
// "Heading", whose sans-serif class picks a sans stand-in for a font the reader lacks (Inter,
// Roboto…) where the body around it gets a serif one — also measured, 10 of the 13 Design fonts.
// The look itself stays guarded by 35-word-section-headings, 10-section-alignment-word and
// 34-word-section-title-case.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** One of every section type, each with an entry, so every builder's title is printed. */
const SECTIONS = () => [
  experience([{}]),
  section('skills', [{ category: 'Web', skills: 'React, Node' }]),
  section('education', [{ institution: 'University', degree: 'B.Tech', startDate: '2012', endDate: '2016' }]),
  section('projects', [{ name: 'Flow', technologies: 'Go' }]),
  section('languages', [{ language: 'Telugu', proficiency: 'Native' }]),
  section('certifications', [{ name: 'CKA', issuer: 'CNCF', date: '2021' }]),
  section('awards', [{ title: 'Best Paper', issuer: 'ACM', date: '2019' }]),
  section('volunteering', [{ org: 'Code Club', role: 'Mentor', startDate: '2018', endDate: '2019' }]),
  section('references', [{ name: 'Sam Lee', jobTitle: 'CTO', company: 'Acme' }]),
  section('interests', [{ interests: 'Chess, Running' }]),
  section('custom', [{ title: 'Talk', subtitle: 'JSConf', date: '2022' }]),
];

const cv = (template, settings = {}) => resume({
  template,
  settings: { accentColor: '#e11d48', sectionTitleCase: 'upper', ...settings },
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', summary: '<p>Summarising ten years</p>', hiddenFields: [] },
  sections: SECTIONS(),
});

const HEADING = /<w:pStyle w:val="(Heading\d|Title)"\/>/;

/** The Heading 1 style's XML, and the docDefaults run font, from styles.xml. */
function styles(stylesXml) {
  const heading1 = /<w:style [^>]*w:styleId="Heading1"[^>]*>.*?<\/w:style>/s.exec(stylesXml)?.[0] || '';
  const docFont = /<w:docDefaults>.*?<w:rFonts [^>]*w:ascii="([^"]*)"/s.exec(stylesXml)?.[1];
  return { heading1, docFont };
}

describe('the Word résumé\'s section titles are Word Heading 1 paragraphs, looking as before (ATS-6)', () => {
  it('every template: each section title, and only the titles, is a Heading 1', async () => {
    const runs = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];
    for (const [template, settings] of runs) {
      const at = `${template} ${JSON.stringify(settings)}`;
      const { paragraphs } = await renderDocx(cv(template, settings));
      const titles = SECTIONS().map((s) => s.title.toUpperCase());
      const expected = template === 'sidebar' && !settings.sidebarSingleColumn ? ['ABOUT ME', ...titles] : titles;
      const headings = paragraphs.filter((p) => HEADING.test(p.xml));
      assert.deepEqual(headings.map((p) => p.text), expected, `${at}: the Heading paragraphs`);
      for (const p of headings) assert.match(p.xml, /<w:pStyle w:val="Heading1"\/>/, `${at}: "${p.text}" is Heading 1`);
    }
  });

  it('the Heading 1 style carries the résumé font and an outline level, based on no style, and nothing Word would draw differently', async () => {
    for (const settings of [{}, { font: 'georgia' }, { customFont: 'Custom Sans' }]) {
      const at = JSON.stringify(settings);
      const { heading1, docFont } = styles((await renderDocx(cv('classic', settings))).stylesXml);
      assert.ok(heading1, `${at}: a Heading1 style in styles.xml`);
      assert.match(heading1, /<w:outlineLvl w:val="0"\/>/, `${at}: outline level 1`);
      assert.ok(docFont, `${at}: a document font`);
      assert.equal(/<w:rFonts [^>]*w:ascii="([^"]*)"/.exec(heading1)?.[1], docFont, `${at}: ascii font`);
      assert.equal(/<w:rFonts [^>]*w:hAnsi="([^"]*)"/.exec(heading1)?.[1], docFont, `${at}: hAnsi font`);
      assert.doesNotMatch(heading1, /<w:basedOn /, `${at}: based on no style (LibreOffice's font stand-in)`);
      for (const tag of ['color', 'sz', 'szCs', 'b', 'bCs', 'i', 'caps', 'numPr', 'spacing', 'ind', 'jc', 'pBdr', 'shd', 'keepLines', 'pageBreakBefore', 'rStyle']) {
        assert.doesNotMatch(heading1, new RegExp(`<w:${tag}[ />]`), `${at}: the style sets no w:${tag}`);
      }
    }
  });
});
