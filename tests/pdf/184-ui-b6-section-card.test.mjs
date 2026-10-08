// UI rebuild B6: the section card and its entry cards, drawn with the design tokens, keep every control the
// live editor has: title rename, hide / show with its state, the ⋯ menu, collapse, a grip for the section and
// one for each entry, per-entry hide / duplicate / delete, and Add <type>. A card drawn with a grey or blue
// Tailwind colour is a screen that was not moved onto the tokens (the negative twin of the restyle).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const press = { preventDefault() {}, stopPropagation() {}, detail: 1, nativeEvent: {} };
const OLD_COLOUR = /(^|\s)(?:[a-z-]+:)*(?:text|bg|border|ring)-(?:gray|blue|red|amber)-\d/;

async function card(sectionOverrides = {}, items = [{ role: 'First', company: 'Acme' }, { role: 'Second', company: 'Beta' }]) {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const r = resume({ sections: [section('experience', items, {}, sectionOverrides)] });
  const calls = { update: [], toggle: [], add: [], remove: [], duplicate: [] };
  const props = {
    section: r.sections[0], template: r.template, settings: r.settings,
    updateSection: (id, fn) => calls.update.push([id, fn]), updateSectionSettings() {},
    removeSection() {}, addItem: (...a) => calls.add.push(a), updateItem() {},
    removeItem: (...a) => calls.remove.push(a), reorderItems() {},
    toggleSectionVisibility: (id) => calls.toggle.push(id), duplicateSection() {},
    duplicateItem: (...a) => calls.duplicate.push(a),
  };
  const view = mount(SortableSection, props);
  const all = () => [...elements(view.container)];
  const button = (label) => all().find((el) => el.tagName === 'BUTTON'
    && [text(el), el.getAttribute('title'), el.getAttribute('aria-label')].includes(label));
  return { view, calls, section: r.sections[0], all, button };
}

describe('the section card keeps its controls (B6)', () => {
  it('title box, eye, ⋯ menu and one grip for the section plus one per entry', async () => {
    const c = await card();
    try {
      const title = c.all().find((el) => el.getAttribute('aria-label') === 'Section title');
      assert.ok(title, 'the title box');
      assert.equal(title.value, c.section.title);
      assert.ok(c.button('Hide section from resume'), 'the eye');
      assert.ok(c.button('Section options'), 'the ⋯ menu button');
      const grips = c.all().filter((el) => el.getAttribute?.('aria-roledescription') === 'sortable');
      assert.equal(grips.length, 3, 'the section grip and one for each of the two entries');
      assert.equal(c.all().filter((el) => el.getAttribute('aria-label') === 'Reorder entry').length, 2);
      for (const label of ['Hide entry', 'Duplicate entry', 'Delete entry']) {
        assert.equal(c.all().filter((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === label).length, 2, `${label} on each entry`);
      }
      assert.ok(c.all().some((el) => el.tagName === 'BUTTON' && /^Add /.test(text(el))), 'an Add <entry> button');
    } finally { await c.view.unmount(); }
  });

  it('renaming writes the new title; the eye asks to hide this section', async () => {
    const c = await card();
    try {
      const title = c.all().find((el) => el.getAttribute('aria-label') === 'Section title');
      reactProps(title).onChange({ target: { value: 'My jobs' } });
      assert.equal(c.calls.update.length, 1);
      assert.equal(c.calls.update[0][0], c.section.id);
      assert.equal(c.calls.update[0][1]({ title: 'old', items: [] }).title, 'My jobs');
      c.view.act(() => reactProps(c.button('Hide section from resume')).onClick(press));
      assert.deepEqual(c.calls.toggle, [c.section.id]);
    } finally { await c.view.unmount(); }
  });

  it('a hidden section says so: badge, struck title, "Show" on the eye, dimmed card', async () => {
    const c = await card({ visible: false });
    try {
      assert.ok(c.button('Show section on resume'), 'the eye offers Show');
      assert.ok(c.all().some((el) => el.tagName === 'SPAN' && text(el) === 'Hidden'), 'the Hidden badge');
      const title = c.all().find((el) => el.getAttribute('aria-label') === 'Section title');
      assert.match(title.getAttribute('class'), /line-through/);
      const outer = c.all().find((el) => (el.getAttribute('data-testid') ?? '').startsWith('section-card-'));
      assert.match(outer.getAttribute('class'), /opacity-60/);
    } finally { await c.view.unmount(); }
  });

  it('Add <entry> adds one entry to this section', async () => {
    const c = await card();
    try {
      const add = c.all().find((el) => el.tagName === 'BUTTON' && /^Add /.test(text(el)));
      c.view.act(() => reactProps(add).onClick(press));
      assert.equal(c.calls.add.length, 1);
      assert.equal(c.calls.add[0][0], c.section.id);
      assert.equal(typeof c.calls.add[0][1].id, 'string');
    } finally { await c.view.unmount(); }
  });

  it('an untouched new entry is deleted without asking; one with content asks first', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    const blank = NEW_ITEM.experience();
    const c = await card({}, [{ ...blank }, { role: 'Pilot', company: 'Harbor' }]);
    const saved = globalThis.confirm;
    const asked = [];
    globalThis.confirm = (q) => { asked.push(q); return false; };
    try {
      const deletes = c.all().filter((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Delete entry');
      assert.equal(deletes.length, 2);
      c.view.act(() => reactProps(deletes[0]).onClick(press));
      assert.deepEqual(asked, [], 'no question for an untouched entry');
      assert.equal(c.calls.remove.length, 1, 'and it is removed');
      c.view.act(() => reactProps(deletes[1]).onClick(press));
      assert.deepEqual(asked, ['Delete this entry?']);
      assert.equal(c.calls.remove.length, 1, 'a "no" removes nothing');
    } finally { globalThis.confirm = saved; await c.view.unmount(); }
  });

  it('negative twin: the card, its header and its entries use the design tokens, not grey or blue Tailwind colours', async () => {
    const c = await card();
    try {
      const old = c.all().filter((el) => OLD_COLOUR.test(el.getAttribute('class') ?? ''));
      assert.deepEqual(old.map((el) => `${el.tagName} ${el.getAttribute('class')}`), [], 'no element is drawn with an old colour');
      const outer = c.all().find((el) => (el.getAttribute('data-testid') ?? '').startsWith('section-card-'));
      assert.match(outer.getAttribute('class'), /\bcv-card\b/);
    } finally { await c.view.unmount(); }
  });
});
