// R2-109: Languages and References that store no Grids (imported data) printed in two columns while
// Section Options → Grids highlighted "1", and clicking "1" then changed the PDF. What the control
// shows (SectionEditorCustomizer: the resolved value, else 1) is what prints, whatever is stored.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, itemsWith, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ITEMS = {
  languages: [{ language: 'Englishword', proficiency: 'Native' }, { language: 'Germanword', proficiency: 'Fluent' }],
  references: [{ name: 'Alexname Doe', company: 'Acme' }, { name: 'Samname Roe', company: 'Globex' }],
};
const NEEDLES = { languages: ['Englishword', 'Germanword'], references: ['Alexname', 'Samname'] };

it('Languages and References with no stored Grids print in the columns the Grids control shows', async () => {
  const { resolveSection } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
  const wrong = [];
  for (const template of ['classic', 'modern', 'compact']) {
    for (const type of ['languages', 'references']) {
      for (const columns of [undefined, null, '']) {
        const s = section(type, ITEMS[type]);
        if (columns === undefined) delete s.settings.columns;
        else s.settings.columns = columns;
        const pages = await read(await render(resume({ template, sections: [s] })));
        const [a, b] = NEEDLES[type].map((n) => itemsWith(pages, n)[0]);
        const printed = Math.abs(a.y - b.y) < 1 ? 2 : 1;
        const shown = resolveSection(s, template).settings.columns || 1;
        if (printed !== shown) wrong.push(`${template} ${type} columns=${JSON.stringify(columns)}: prints ${printed}, Grids shows ${shown}`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});
