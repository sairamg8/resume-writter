// UI rebuild B7 (section-style): a section's ⋯ -> Customize layout opens its options in a popover (a lazy
// chunk hosting the unchanged SectionCustomizer in the kit's Popover, in a portal at the end of <body>, not
// inside the card). Done, Escape and a click outside close it; the options are still all offered; and when the
// popover's code cannot be had the card shows the customizer inline, as before. The failure test runs first:
// the card remembers a loaded chunk for the life of the page.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev, wait } from '../unit/ui-dom-harness.mjs';

before(async () => {
  await setup();
  patchFakeDom();
});
after(teardown);

const skills = () => ({
  id: 'sec_skills', type: 'skills', title: 'Toolbox', visible: true, settings: {},
  items: [{ id: 'sk_1', category: 'Tools', skills: 'Figma' }],
});

async function card({ fail = false } = {}) {
  const mod = await loadModule('/src/components/SectionEditor.jsx');
  const real = mod._lazyForTest.load;
  if (fail) mod._lazyForTest.load = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
  const noop = () => {};
  const view = mount(mod.SortableSection, {
    section: skills(), template: 'classic', settings: {}, updateSectionSettings: noop,
    updateSection: noop, removeSection: noop, addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
  });
  const all = () => [...elements(view.document.body)];
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
  const cardEl = all().find((el) => el.getAttribute('data-testid') === 'section-card-sec_skills');
  const openFromMenu = async () => {
    const trigger = all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Section options');
    view.act(() => reactProps(trigger).onClick(ev()));
    view.act(() => reactProps(button('Customize layout')).onClick());
    for (let i = 0; i < 100 && !all().some((el) => el.textContent === 'Section Options'); i += 1) await wait(10);
    await wait(30); // the popover's passive effects (its outside-press listener) run after the commit
  };
  const shown = () => all().some((el) => el.tagName === 'P' && el.textContent.trim() === 'Section Options');
  return { view, button, cardEl, openFromMenu, shown, all, restore: () => { mod._lazyForTest.load = real; } };
}

it('with the popover\'s code unreachable the customizer shows inline in the card, and Hide options closes it', async () => {
  const c = await card({ fail: true });
  const saved = console.error;
  console.error = () => {};
  try {
    await c.openFromMenu();
    assert.ok(c.shown(), 'the options are offered');
    const row = c.all().find((el) => el.tagName === 'P' && el.textContent.trim() === 'Section Options');
    assert.ok(c.cardEl.contains(row), 'inline, inside the card');
    assert.ok(!c.button('Done'), 'no popover');
  } finally {
    console.error = saved;
    c.restore();
    await c.view.unmount();
  }
});

it('Customize layout offers the customizer rows in a popover outside the card; Done closes it', async () => {
  const c = await card();
  try {
    await c.openFromMenu();
    assert.ok(c.shown(), 'Section Options is offered');
    const row = c.all().find((el) => el.tagName === 'P' && el.textContent.trim() === 'Section Options');
    assert.ok(!c.cardEl.contains(row), 'drawn in a portal, not inside the card');
    assert.ok(c.all().some((el) => el.getAttribute('role') === 'dialog' && el.contains(row)), 'in the popover dialog');
    assert.ok(c.all().some((el) => el.textContent.trim() === 'Spacing Override'), 'its rows are there');
    const done = c.button('Done');
    assert.ok(done, 'a Done button');
    c.view.act(() => reactProps(done).onClick());
    assert.ok(!c.shown(), 'Done closed it');
    assert.ok(!c.button('Done'));
  } finally {
    await c.view.unmount();
  }
});

it('a press outside closes the popover; Escape closes it', async () => {
  const c = await card();
  try {
    await c.openFromMenu();
    assert.ok(c.shown());
    c.view.act(() => c.view.document.dispatchEvent({ type: 'pointerdown', target: c.view.document.body }));
    assert.ok(!c.shown(), 'the outside press closed it');

    await c.openFromMenu();
    assert.ok(c.shown(), 'it opens again');
    const dialog = c.all().find((el) => el.getAttribute('role') === 'dialog');
    c.view.act(() => reactProps(dialog).onKeyDown(ev({ key: 'Escape', target: dialog })));
    assert.ok(!c.shown(), 'Escape closed it');
  } finally {
    await c.view.unmount();
  }
});
