// R4-DPH-33: every field of the Design tab is 16 px on a touch screen. iOS Safari zooms the page into
// any field it focuses whose text is under 16 px, and the tab's fields were all 12-14 px with nothing for
// a touch screen: Typography's size boxes and Spacing's (SizeRow / NumberRow), Section Headings' Border
// thickness box, the Name Font / Heading Font and Date format pickers, the Add a Google Font box and
// Save my design's name box — so every tap on one zoomed the page. Each now carries
// pointer-coarse:text-base, as the kit's controlClass and the job tracker's fields do
// (tests/pdf/81-job-inputs-touch-text.test.mjs, J-38); with a mouse they keep their 12-14 px.
// The real panel is mounted (react-dom/client over tests/pdf/fake-dom.mjs) with every section open;
// fake-dom has no layout or media queries, so the fields' class tokens are checked.
// Run: node --test tests/pdf/103-r4-dph-33-design-fields-touch-text.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The Design sections closed at first (Template and Contact icons open on their own). */
const CLOSED_SECTIONS = ['Colors', 'Typography', 'Spacing', 'Section Headings', 'Dates', 'Lists', 'Links', 'Page numbers'];

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** The text fields under `root`: not colour swatches, ticks, radios, file or hidden inputs (as tests/pdf/81 reads them). */
function textFields(root) {
  // React sets an <input>'s type as a property, not an attribute, and the fake DOM keeps them apart.
  return [...elements(root)].filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
    && !['color', 'file', 'hidden', 'checkbox', 'radio'].includes(el.getAttribute('type') ?? el.type));
}

/**
 * The fields among `fields` that would be under 16 px on a phone or a tablet (tests/pdf/81's
 * under16OnTouch): a field passes with `pointer-coarse:text-base`, or an unprefixed `text-base`
 * that no breakpoint shrinks. Each is named by its label, so a failure says which box zooms.
 */
function under16OnTouch(fields, root) {
  const labelled = (el) => {
    const id = el.getAttribute('aria-labelledby');
    return id ? [...elements(root)].find((l) => l.getAttribute('id') === id)?.textContent.trim() : null;
  };
  return fields.filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)pointer-coarse:text-base(\s|$)/.test(cls)) return false;
    return !(/(^|\s)text-base(\s|$)/.test(cls) && !/(^|\s)(sm|md|lg|xl|2xl):text-(xs|sm|\[)/.test(cls));
  }).map((el) => el.getAttribute('aria-label') || labelled(el) || el.getAttribute('id') || el.getAttribute('placeholder') || el.tagName);
}

it('R4-DPH-33: every number box, picker and text box of the Design tab is 16 px on a touch screen', async () => {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const view = mount(DesignPanel, {
    resume: resume({ template: 'classic', personal: { name: 'Morgan Ashby', email: 'morgan@example.com' } }),
    updateSetting: () => {},
    setTemplate: () => {},
    resetSettings: () => {},
    saveDesign: () => {},
  });
  try {
    const all = () => [...elements(view.container)];
    const button = (text) => {
      const el = all().find((b) => b.tagName === 'BUTTON' && b.textContent.trim() === text);
      assert.ok(el, `the "${text}" button is on the Design tab`);
      return el;
    };
    for (const title of CLOSED_SECTIONS) view.act(() => reactProps(button(title)).onClick());
    view.act(() => reactProps(button('Save my design')).onClick());

    const fields = textFields(view.container);
    // What the row names, each on the tab now: the seven Typography size boxes and the five Spacing
    // boxes, Border thickness, the three pickers, the Google Font box and the design's name box.
    const byLabel = (label) => fields.find((el) => el.getAttribute('aria-label') === label);
    for (const [name, el] of [
      ['the Design name box', byLabel('Design name')],
      ['the Border thickness box', byLabel('Section border thickness (pt)')],
      ['the Add a Google Font box', fields.find((el) => el.getAttribute('id') === 'custom-font-input')],
    ]) {
      assert.ok(el, `${name} is open`);
      assert.ok(tokens(el).has('pointer-coarse:text-base'), `${name} is under 16 px on a touch screen: iOS zooms the page into it`);
    }
    assert.ok(fields.filter((el) => el.tagName === 'SELECT').length >= 3, 'Name Font, Heading Font and Date format are open');
    assert.ok(fields.filter((el) => el.getAttribute('aria-labelledby')).length >= 12, 'the Typography and Spacing size boxes are open');
    assert.deepEqual(under16OnTouch(fields, view.container), [], 'every field of the Design tab is 16 px on a touch screen');

    // With a mouse the boxes keep their size: the touch size is a variant, not the base.
    const size = fields.find((el) => el.getAttribute('aria-labelledby'));
    assert.ok(tokens(size).has('text-xs'), 'a size box keeps its 12 px with a mouse');
    assert.equal(tokens(size).has('text-base'), false, 'and is not 16 px with a mouse too');
  } finally {
    await view.unmount();
  }
});
