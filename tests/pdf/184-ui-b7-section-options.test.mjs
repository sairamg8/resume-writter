// UI rebuild B7 (section-style): Section Options moved from grey/blue Tailwind colours to the cv-*
// tokens. The restyle must not drop an option: each section type shows a HARD-CODED list of rows and
// chips (so a dropped option fails here), and no element keeps an old (gray|blue|red|amber|slate) colour.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

async function htmlOf(type) {
  const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
  return renderToString(createElement(SectionCustomizer, {
    section: { id: `sec_${type}`, type, title: type, visible: true, settings: {}, items: [] },
    template: 'classic', settings: {}, updateSectionSettings: () => {},
  }));
}

const rowLabels = (html) => [...html.matchAll(/<span class="text-xs text-cv-muted[^"]*">([^<]*)<\/span>/g)].map((m) => m[1])
  .concat([...html.matchAll(/<label[^>]*>([^<]*)<\/label>/g)].map((m) => m[1]));
const chips = (html) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]*>/g, '').trim())
  .filter((t) => t !== '');

const SPACING_BOXES = ['Before', 'After', 'Item gap'];
const ALIGN = ['Left', 'Center'];
const SPACING = ['Tight', 'Normal', 'Spacious'];

const EXPECTED = {
  experience: {
    rows: ['Alignment', 'Spacing', 'Grids', 'Order', 'Title', 'Show dates', 'Show location', 'Group roles by company', ...SPACING_BOXES],
    chips: [...ALIGN, ...SPACING, '1', '2', 'Co. / Role', 'Role / Co.', 'Stacked', 'Inline', 'Side by side'],
  },
  skills: {
    rows: ['Alignment', 'Rows', 'Grids', 'Style', 'Separator', ...SPACING_BOXES],
    chips: [...ALIGN, ...SPACING, '1', '2', '3', '4', 'Inline', 'Stacked', 'Bullet', 'Tags', 'Bars', 'Colon  :', 'Dash  –', 'Pipe  |'],
  },
  languages: {
    rows: ['Alignment', 'Spacing', 'Grids', 'Level', ...SPACING_BOXES],
    chips: [...ALIGN, ...SPACING, '1', '2', 'Text', 'Dots', 'Bar'],
  },
  education: {
    rows: ['Alignment', 'Spacing', 'Grids', 'Title', 'Show dates', 'Show location', ...SPACING_BOXES],
    chips: [...ALIGN, ...SPACING, '1', '2', 'Stacked', 'Inline', 'Side by side'],
  },
};

describe('B7 Section Options keep every option on the tokens', () => {
  for (const [type, want] of Object.entries(EXPECTED)) {
    it(`${type}: shows exactly these rows and choices`, async () => {
      const html = await htmlOf(type);
      assert.match(html, />Section Options</);
      assert.match(html, />Spacing Override</);
      assert.deepEqual(rowLabels(html), want.rows);
      assert.deepEqual(chips(html), want.chips);
    });

    it(`${type}: no element carries an old gray/blue/red/amber/slate colour class`, async () => {
      const html = await htmlOf(type);
      const old = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))
        .filter((c) => /(^|:)(text|bg|border|ring|divide|from|to)-(gray|blue|red|amber|slate)-\d+$/.test(c));
      assert.deepEqual(old, []);
    });
  }

  it('the text fields keep pointer-coarse:text-base', async () => {
    const html = await htmlOf('experience');
    const inputs = [...html.matchAll(/<input[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(inputs.length, 3);
    for (const c of inputs) assert.match(c, /pointer-coarse:text-base/);
  });
});
