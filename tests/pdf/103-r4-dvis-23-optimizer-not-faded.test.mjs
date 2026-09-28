// R4-DVIS-23: the STAR Optimizer (BulletOptimizerModal, a `fixed inset-0 z-50` overlay) was drawn in
// place, inside the description's RichTextEditor. Opened from a hidden entry (ItemCard `opacity-60`), a
// hidden section (SortableSection `opacity-60`) or a hidden Description field (FieldRow `opacity-50`), it
// was faded with it — opacity below 1 groups every descendant, fixed ones too — and, that ancestor being
// its own stacking context, controls placed later on the page (the panel's resize handle, the phone's
// Edit | Preview pill) painted over it and took its clicks. It is the kit's Dialog now (R4-DVIS-07),
// which opens in a portal at the end of <body>, outside anything faded. The fake DOM has no layout, so
// this reads where the optimizer is drawn and the classes of everything around it, on the real
// components (tests/pdf/fake-dom.mjs, loaded through Vite). The Dialog's focus trap looks its first
// focus up with querySelector, which the bare fake DOM lacks: patchFakeDom first.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => { await setup(); patchFakeDom(); });
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const noop = () => {};
const FADED = /^opacity-(\d+)$/;

/** Opens the optimizer from the editor's toolbar in `view`; returns its heading, found in the page. */
function openOptimizer(view) {
  const button = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Bullet Optimizer & STAR Formula Helper');
  assert.ok(button, 'the description\'s toolbar offers the optimizer');
  view.act(() => reactProps(button).onMouseDown({ preventDefault() {} }));
  const heading = [...elements(view.document.body)].find((el) => el.tagName === 'H2' && el.textContent.trim() === 'Bullet Optimizer & STAR Formula');
  assert.ok(heading, 'the optimizer opened');
  return heading;
}

/** Nothing around `el`, up to <body>, fades it; and it is not inside the component's own tree. */
function assertNotFaded(view, el, what) {
  assert.ok(!view.container.contains(el), `${what}: the optimizer is drawn outside the editor, not inside what is hidden`);
  for (let n = el.parentNode; n && n !== view.document.body; n = n.parentNode) {
    const faded = classes(n).filter((c) => FADED.test(c) && Number(c.match(FADED)[1]) < 100);
    assert.deepEqual(faded, [], `${what}: an element around the optimizer fades it: ${classes(n).join(' ')}`);
  }
}

it('R4-DVIS-23: opened from a hidden entry whose Description field is hidden too, the optimizer is not faded with them', async () => {
  const { ExperienceItem } = await loadModule('/src/components/SectionEditorEntryItems.jsx');
  const view = mount(ExperienceItem, {
    item: { id: 'e1', company: 'Acme', role: 'Dev', startDate: 'Jan 2020', endDate: '', current: true, description: '', visible: false, hiddenFields: ['description'] },
    onUpdate: noop, onRemove: noop, onDuplicate: noop, defaultOpen: true,
  });
  try {
    const all = [...elements(view.container)];
    assert.ok(all.some((el) => classes(el).includes('opacity-60')), 'the hidden entry\'s card is faded');
    assert.ok(all.some((el) => classes(el).includes('opacity-50')), 'the hidden Description field is faded');
    assertNotFaded(view, openOptimizer(view), 'hidden entry and field');
  } finally {
    await view.unmount();
  }
});

it('R4-DVIS-23: opened from an entry of a hidden section, the optimizer is not faded with the section', async () => {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const view = mount(SortableSection, {
    section: {
      id: 'sec_exp', type: 'experience', title: 'Experience', visible: false, settings: {},
      items: [{ id: 'e1', company: 'Acme', role: 'Dev', startDate: 'Jan 2020', endDate: '', current: true, description: '' }],
    },
    // justAdded opens the first entry, so its description's toolbar shows.
    justAdded: true,
    template: 'classic', settings: {}, updateSection: noop, updateSectionSettings: noop, removeSection: noop,
    addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
  });
  try {
    assert.ok([...elements(view.container)].some((el) => classes(el).includes('opacity-60')), 'the hidden section\'s card is faded');
    assertNotFaded(view, openOptimizer(view), 'hidden section');
  } finally {
    await view.unmount();
  }
});
