// R4-DVIS-30 (Section Options): each choice row (SegmentRow) is its label, then its chips in one
// `flex gap-1` line that could not wrap. With the editor panel dragged narrow (240 to about 305 px,
// within the allowed range) a row of one-word chips was wider than the card: Skills' Style lost 'Tags'
// and Rows lost 'Spacious' past the card's edge, which cut them off. The chips wrap now, kept to the
// right under the first line (`flex flex-wrap justify-end`). The fake DOM has no layout, so this reads
// the classes the browser lays out by, on the real SectionCustomizer (tests/pdf/fake-dom.mjs, loaded
// through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

/** Each choice row in `root`: its label and the element holding its chips. */
function segmentRows(root) {
  return [...elements(root)]
    .filter((el) => el.tagName === 'DIV' && classes(el).includes('justify-between') && el.childNodes.length === 2
      && el.childNodes[0].tagName === 'SPAN' && el.childNodes[1].childNodes.some((c) => c.tagName === 'BUTTON'))
    .map((row) => ({ label: row.childNodes[0].textContent.trim(), chips: row.childNodes[1] }));
}

const CASES = [
  ['skills', { skillsStyle: 'inline' }, ['Alignment', 'Rows', 'Grids', 'Style', 'Separator'], ['Tags', 'Spacious']],
  ['experience', {}, ['Alignment', 'Spacing', 'Grids', 'Order', 'Title'], ['Side by side', 'Spacious']],
];

for (const [type, settings, labels, chipsSeen] of CASES) {
  it(`R4-DVIS-30: a ${type} section's choice rows wrap their chips rather than run past the card`, async () => {
    const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
    const view = mount(SectionCustomizer, {
      section: { id: `sec_${type}`, type, title: type, visible: true, settings, items: [] },
      template: 'classic', settings: {}, updateSectionSettings: () => {},
    });
    try {
      const rows = segmentRows(view.container);
      assert.deepEqual(rows.map((r) => r.label), labels, 'the rows it offers');
      for (const { label, chips } of rows) {
        const cls = classes(chips);
        assert.ok(cls.includes('flex') && cls.includes('flex-wrap'), `${label}: its chips may wrap: ${cls.join(' ')}`);
        assert.ok(cls.includes('justify-end'), `${label}: kept to the right when they do: ${cls.join(' ')}`);
      }
      const text = rows.flatMap((r) => r.chips.childNodes.map((b) => b.textContent.trim()));
      for (const chip of chipsSeen) assert.ok(text.includes(chip), `${chip} is one of the chips: ${text.join(', ')}`);
    } finally {
      await view.unmount();
    }
  });
}
