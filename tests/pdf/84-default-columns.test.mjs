// R2-109: Languages and References that store no Grids (imported data) printed in two columns while
// Section Options → Grids highlighted "1", and clicking "1" then changed the PDF. What the control
// shows (SectionEditorCustomizer: the resolved value, else 1) is what prints, whatever is stored.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, itemsWith, loadModule } from './harness.mjs';

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

// resolveSection reads the Grids a section's type is created with: an imported type named like an
// Object member is a custom section's, not that member (it threw, and the PDF, Word and the section's
// options with it).
it('a section whose imported type is named like an Object member resolves, prints and exports as a custom one', async () => {
  const { resolveSection } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
  for (const type of ['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__']) {
    const s = { id: `odd_${type}`, type, title: `Odd ${type}`, visible: true, settings: {}, items: [{ id: 'i1', title: `Oddentry ${type}` }] };
    assert.equal(resolveSection(s, 'classic').settings.columns, 1, type);
    const pages = await read(await render(resume({ template: 'classic', sections: [s] })));
    assert.ok(itemsWith(pages, `Oddentry ${type}`).length, `${type}: the PDF prints the entry`);
    const doc = await renderDocx(resume({ template: 'classic', sections: [s] }));
    assert.ok(doc.texts.some((t) => t.includes(`Oddentry ${type}`)), `${type}: Word prints the entry`);
  }
});
