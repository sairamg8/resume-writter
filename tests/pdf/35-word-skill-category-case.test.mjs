// A skill group's category in the Word résumé, cased as the PDF (= the preview) prints it
// (ONB-2-NB1, from ONB-2's new_bugs[0]). The PDF prints it in capitals in the Sidebar's side column
// (every Skills style) and in the main column's Tags and Bars — "FRONTEND" — and as typed in
// Inline, Bullet and Stacked; the .docx printed "Frontend: React, CSS" everywhere. Word now reads
// the same rule (src/utils/skills.js), for every template, Skills style and separator a résumé can
// store: none (older builds and imported files), an imported style the app does not offer, a
// group whose skills the editor's eye hid, and an imported template id in another case.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** What a résumé can store as Skills style; MISSING: no key, as older builds and imported files leave it. */
const MISSING = Symbol('missing');
const STYLES = [MISSING, 'inline', 'bullet', 'stacked', 'tags', 'bars', 'TAGS'];
const label = (s) => (s === MISSING ? 'no Skills style stored' : `Skills style ${JSON.stringify(s)}`);

const CATEGORIES = ['Front-end Tools', 'Data Stores'];
const GROUPS = [
  { category: 'Front-end Tools', skills: 'React, CSS' },
  { category: 'Data Stores', skills: 'SQL', hiddenFields: ['skills'] }, // the category alone
];

/** A `template` résumé whose skills section stores `skillsStyle` and `separator`. */
function skillsResume(template, skillsStyle, separator = 'colon') {
  const r = resume({ template, sections: [section('skills', GROUPS, { separator })] });
  if (skillsStyle === MISSING) delete r.sections[0].settings.skillsStyle;
  else r.sections[0].settings.skillsStyle = skillsStyle;
  return r;
}

/** Each category as `text` prints it: the one run equal to it but for case. */
function printed(text, where) {
  return Object.fromEntries(CATEGORIES.map((category) => {
    const hits = text.match(new RegExp(category.replace('-', '\\-'), 'gi')) || [];
    assert.equal(hits.length, 1, `${where}: "${category}" printed once: ${JSON.stringify(hits)} in ${text}`);
    return [category, hits[0]];
  }));
}
const pdfCategories = async (r, where) => printed(allText(await read(await render(r))), `${where} PDF`);
const wordCategories = async (r, where) => printed((await renderDocx(r)).texts.join(' | '), `${where} Word`);

describe('Word prints skill categories in the case the PDF prints them in (ONB-2-NB1)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: every Skills style prints each category as in its PDF`, async () => {
      for (const skillsStyle of STYLES) {
        for (const separator of ['colon', 'dash']) {
          const where = `${template}, ${label(skillsStyle)}, ${separator}`;
          const r = skillsResume(template, skillsStyle, separator);
          const pdf = await pdfCategories(r, where);
          for (const c of CATEGORIES) assert.ok([c, c.toUpperCase()].includes(pdf[c]), `${where}: the PDF prints "${pdf[c]}"`);
          assert.deepEqual(await wordCategories(r, where), pdf, where);
        }
      }
    });
  }

  it('capitals exactly where the PDF prints them: the Sidebar\'s side column, and Tags and Bars elsewhere', async () => {
    const upper = { inline: false, bullet: false, stacked: false, tags: true, bars: true };
    for (const template of TEMPLATES) {
      for (const [skillsStyle, main] of Object.entries(upper)) {
        const expected = template === 'sidebar' || main ? 'FRONT-END TOOLS' : 'Front-end Tools';
        const texts = (await renderDocx(skillsResume(template, skillsStyle))).texts;
        assert.ok(texts.includes(`${expected}: React, CSS`), `${template}, ${skillsStyle}: ${JSON.stringify(texts)}`);
      }
    }
  });

  it('an imported template id in another case (" Sidebar ") prints the side column\'s capitals in Word, as in its PDF', async () => {
    const r = skillsResume('sidebar', 'inline');
    r.template = ' Sidebar ';
    const where = 'template " Sidebar ", inline';
    const pdf = await pdfCategories(r, where);
    assert.equal(pdf['Front-end Tools'], 'FRONT-END TOOLS', `${where}: the PDF prints the side column`);
    assert.deepEqual(await wordCategories(r, where), pdf, where);
  });
});
