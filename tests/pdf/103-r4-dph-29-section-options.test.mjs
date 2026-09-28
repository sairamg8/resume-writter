// R4-DPH-29 (Section Options): a section's ⋯ → Customize layout → Spacing Override boxes (Before, After,
// Item gap) were 12 px (`text-xs`) on a touch screen too, and iOS Safari zooms the page into any field
// it focuses whose text is under 16 px, so tapping one on a phone zoomed the page. They are
// `pointer-coarse:text-base` now, as the section's other fields are (R4-DPH-28); a mouse keeps 12 px.
// Checked on the real SectionCustomizer over the fake DOM (tests/pdf/fake-dom.mjs, loaded through
// Vite), with the rule of tests/pdf/81-job-inputs-touch-text.test.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

/**
 * The text fields and pickers in `root` that would be under 16 px on a phone or a tablet: a field
 * passes with `pointer-coarse:text-base`, or with an unprefixed `text-base` that no breakpoint shrinks.
 */
function under16OnTouch(root) {
  // React sets an <input>'s type as a property, not an attribute, and the fake DOM keeps them apart: read both.
  const fields = [...elements(root)].filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    && !['file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
  assert.ok(fields.length > 0, 'there are fields to check');
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('title') || el.getAttribute('aria-label') || el.tagName);
}

for (const [type, settings] of [['experience', {}], ['skills', { spaceBefore: 12, itemGap: 4 }]]) {
  it(`R4-DPH-29: a ${type} section's Spacing Override boxes are 16 px on a touch screen`, async () => {
    const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
    const view = mount(SectionCustomizer, {
      section: { id: `sec_${type}`, type, title: type, visible: true, settings, items: [] },
      template: 'classic', settings: {}, updateSectionSettings: () => {},
    });
    try {
      const boxes = [...elements(view.container)].filter((el) => el.tagName === 'INPUT');
      assert.deepEqual(boxes.map((el) => el.getAttribute('title')), ['Space before section (px)', 'Space after section (px)', 'Gap between items (px)']);
      assert.deepEqual(under16OnTouch(view.container), []);
    } finally {
      await view.unmount();
    }
  });
}
