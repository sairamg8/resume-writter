// UI rebuild B6: each entry card keeps its four actions on the design tokens — a grip that is in the tab
// order and visible without hover on a touch screen, the eye (hide / show the entry), duplicate and delete
// (an untouched entry goes without asking) — and Add <entry> opens the entry it just added, and only that
// one. Entry cards are found by their header's test id, never by their classes. A card drawn with an old
// grey / blue / red / amber Tailwind colour is a screen that was not moved onto the tokens (negative twin).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const OLD_COLOUR = /(^|\s)(?:[a-z-]+:)*(?:text|bg|border|ring)-(?:gray|blue|red|amber)-\d/;
const noop = () => {};

/** A click as a button's handler reads it; records whether the card behind it was told. */
const click = () => ({ stoppedPropagation: false, preventDefault() {}, stopPropagation() { this.stoppedPropagation = true; }, detail: 1, nativeEvent: {} });

/** An entry card is the box around its header, whatever classes it is drawn with. */
const cardsOf = (root) => [...elements(root)].filter((e) => e.getAttribute('data-testid') === 'entry-header').map((h) => h.parentNode);
const textBoxes = (el) => [...elements(el)].filter((e) => e.tagName === 'INPUT' && e.getAttribute('aria-label') !== 'Section title');
const cardInfo = (root) => cardsOf(root).map((card) => ({
  title: text([...elements(card)].find((e) => e.getAttribute('data-testid') === 'entry-title')),
  fields: textBoxes(card).length,
}));

/** SortableSection over `items`; `calls` collects what the entry actions hand to the store's functions. */
async function editor(items, { duplicate = true, type = 'experience', justAdded = false } = {}) {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const r = resume({ sections: [section(type, items)] });
  const calls = { update: [], remove: [], duplicate: [], add: [] };
  const props = (s) => ({
    section: s, template: r.template, settings: r.settings, justAdded,
    updateSection: noop, updateSectionSettings: noop, removeSection: noop, reorderItems: noop,
    addItem: (...a) => calls.add.push(a),
    updateItem: (sid, iid, fn) => calls.update.push([sid, iid, fn]),
    removeItem: (...a) => calls.remove.push(a),
    ...(duplicate ? { duplicateItem: (...a) => calls.duplicate.push(a) } : {}),
  });
  const view = mount(SortableSection, props(r.sections[0]));
  const all = () => [...elements(view.container)];
  const buttons = (label) => all().filter((el) => el.tagName === 'BUTTON'
    && (el.getAttribute('title') === label || el.getAttribute('aria-label') === label));
  return { view, calls, section: r.sections[0], all, buttons, show: (s) => view.update(props(s)) };
}

const JOBS = [{ role: 'First', company: 'Acme' }, { role: 'Second', company: 'Beta' }];

describe('the entry grip (B6)', () => {
  it('is a button named "Reorder entry", in the tab order, one per entry', async () => {
    const t = await editor(JOBS);
    try {
      const grips = t.buttons('Reorder entry');
      assert.equal(grips.length, 2);
      for (const grip of grips) {
        const index = reactProps(grip).tabIndex ?? grip.getAttribute('tabindex');
        assert.equal(Number(index), 0, 'reachable with Tab, so Space and the arrow keys can move the entry');
        assert.equal(grip.getAttribute('aria-roledescription'), 'sortable');
      }
    } finally { await t.view.unmount(); }
  });

  it('shows without hover on a touch screen (no-hover:opacity-100), and on hover and focus elsewhere', async () => {
    const t = await editor(JOBS);
    try {
      for (const grip of t.buttons('Reorder entry')) {
        const cls = grip.getAttribute('class');
        assert.match(cls, /(^|\s)opacity-0(\s|$)/, 'hidden at rest on a mouse screen');
        assert.match(cls, /(^|\s)no-hover:opacity-100(\s|$)/, 'a touch screen has no hover to reveal it');
        assert.match(cls, /(^|\s)group-hover\/item:opacity-100(\s|$)/);
        assert.match(cls, /(^|\s)focus-visible:opacity-100(\s|$)/);
      }
    } finally { await t.view.unmount(); }
  });
});

describe('the entry eye (B6)', () => {
  it('"Hide entry" hides it through onUpdate; the click does not also toggle the card', async () => {
    const t = await editor(JOBS);
    try {
      const [eye] = t.buttons('Hide entry');
      const e = click();
      t.view.act(() => reactProps(eye).onClick(e));
      assert.equal(e.stoppedPropagation, true, 'the card stays as it was');
      assert.deepEqual(cardInfo(t.view.container).map((c) => c.fields), [0, 0], 'and still collapsed');
      assert.equal(t.calls.update.length, 1);
      const [sid, iid, fn] = t.calls.update[0];
      assert.equal(sid, t.section.id);
      assert.equal(iid, t.section.items[0].id);
      const next = fn();
      assert.equal(next.visible, false);
      assert.equal(next.role, 'First', 'the rest of the entry is kept');
    } finally { await t.view.unmount(); }
  });

  it('a hidden entry offers "Show entry", is dimmed and struck, and the click shows it again', async () => {
    const t = await editor([{ role: 'First', company: 'Acme', visible: false }, JOBS[1]]);
    try {
      assert.equal(t.buttons('Show entry').length, 1);
      assert.equal(t.buttons('Hide entry').length, 1, 'the other entry still offers Hide');
      const [card] = cardsOf(t.view.container);
      assert.match(card.getAttribute('class'), /opacity-60/);
      const title = [...elements(card)].find((e) => e.getAttribute('data-testid') === 'entry-title');
      assert.match(title.getAttribute('class'), /line-through/);
      t.view.act(() => reactProps(t.buttons('Show entry')[0]).onClick(click()));
      assert.equal(t.calls.update[0][2]().visible, true);
    } finally { await t.view.unmount(); }
  });

  it('a one-line row (a language, an interest) has its eye too', async () => {
    for (const [type, item] of [['languages', { language: 'Spanish', proficiency: 'Fluent' }], ['interests', { interests: 'Chess' }]]) {
      const t = await editor([item], { type });
      try {
        t.view.act(() => reactProps(t.buttons('Hide entry')[0]).onClick(click()));
        assert.equal(t.calls.update[0][2]().visible, false, type);
      } finally { await t.view.unmount(); }
    }
  });
});

describe('the entry duplicate and delete (B6)', () => {
  it('"Duplicate entry" duplicates this entry of this section', async () => {
    const t = await editor(JOBS);
    try {
      const dups = t.buttons('Duplicate entry');
      assert.equal(dups.length, 2);
      const e = click();
      t.view.act(() => reactProps(dups[1]).onClick(e));
      assert.deepEqual(t.calls.duplicate, [[t.section.id, t.section.items[1].id]]);
      assert.equal(e.stoppedPropagation, true);
    } finally { await t.view.unmount(); }
  });

  it('with no duplicate action given there is no Duplicate button', async () => {
    const t = await editor(JOBS, { duplicate: false });
    try { assert.equal(t.buttons('Duplicate entry').length, 0); } finally { await t.view.unmount(); }
  });

  it('an untouched entry is deleted without asking; one with content asks "Delete this entry?" and a yes removes it', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    const t = await editor([NEW_ITEM.experience(), JOBS[0]]);
    const saved = globalThis.confirm;
    const asked = [];
    let answer = false;
    globalThis.confirm = (q) => { asked.push(q); return answer; };
    try {
      const dels = t.buttons('Delete entry');
      assert.equal(dels.length, 2);
      t.view.act(() => reactProps(dels[0]).onClick(click()));
      assert.deepEqual(asked, [], 'no question for the untouched one');
      assert.deepEqual(t.calls.remove, [[t.section.id, t.section.items[0].id]]);

      t.view.act(() => reactProps(dels[1]).onClick(click()));
      assert.deepEqual(asked, ['Delete this entry?']);
      assert.equal(t.calls.remove.length, 1, 'a "no" removes nothing');
      answer = true;
      t.view.act(() => reactProps(dels[1]).onClick(click()));
      assert.deepEqual(t.calls.remove[1], [t.section.id, t.section.items[1].id]);
    } finally { globalThis.confirm = saved; await t.view.unmount(); }
  });
});

describe('Add <entry> opens the entry it just added (B6, R4-ED-07, R4-LO-20)', () => {
  it('the new card opens with its fields; older cards, blank or filled, stay collapsed', async () => {
    const t = await editor([{ role: 'Lamplighter', company: 'Harbor Lights' }, {}]);
    try {
      assert.deepEqual(cardInfo(t.view.container).map((c) => c.fields), [0, 0], 'on load nothing is open');
      const add = t.all().find((el) => el.tagName === 'BUTTON' && text(el) === 'Add Experience');
      assert.ok(add, 'the Add Experience button');
      t.view.act(() => reactProps(add).onClick(click()));
      assert.equal(t.calls.add.length, 1);
      assert.equal(t.calls.add[0][0], t.section.id);
      t.show({ ...t.section, items: [...t.section.items, t.calls.add[0][1]] });
      const cards = cardInfo(t.view.container);
      assert.equal(cards.length, 3);
      assert.deepEqual(cards.slice(0, 2).map((c) => c.fields), [0, 0], 'the blank one from before stays shut');
      assert.equal(cards[2].title, 'New Entry');
      assert.ok(cards[2].fields >= 3, `the new card shows its fields (${cards[2].fields})`);
    } finally { await t.view.unmount(); }
  });

  it('a second Add opens the second new card; the first new one stays open as the user left it', async () => {
    const t = await editor([{ role: 'Lamplighter', company: 'Harbor Lights' }]);
    try {
      const add = () => t.all().find((el) => el.tagName === 'BUTTON' && text(el) === 'Add Experience');
      t.view.act(() => reactProps(add()).onClick(click()));
      t.show({ ...t.section, items: [...t.section.items, t.calls.add[0][1]] });
      t.view.act(() => reactProps(add()).onClick(click()));
      t.show({ ...t.section, items: [...t.section.items, t.calls.add[0][1], t.calls.add[1][1]] });
      const cards = cardInfo(t.view.container);
      assert.equal(cards.length, 3);
      assert.equal(cards[0].fields, 0, 'the filled entry from before stays shut');
      assert.ok(cards[1].fields >= 3, 'the first new card stays open, as the user left it');
      assert.ok(cards[2].fields >= 3, 'the one just added is open');
    } finally { await t.view.unmount(); }
  });

  it('a click on a header opens and closes its card', async () => {
    const t = await editor(JOBS);
    try {
      const header = () => t.all().filter((e) => e.getAttribute('data-testid') === 'entry-header')[0];
      t.view.act(() => reactProps(header()).onClick(click()));
      assert.deepEqual(cardInfo(t.view.container).map((c) => c.fields > 0), [true, false]);
      t.view.act(() => reactProps(header()).onClick(click()));
      assert.deepEqual(cardInfo(t.view.container).map((c) => c.fields), [0, 0]);
    } finally { await t.view.unmount(); }
  });
});

describe('negative twin: the entry cards use the design tokens (B6)', () => {
  it('no element of an open section card carries a grey, blue, red or amber Tailwind colour', async () => {
    const t = await editor([{ role: 'Hidden one', company: 'Acme', visible: false }, ...JOBS], { justAdded: true });
    try {
      const old = t.all().filter((el) => OLD_COLOUR.test(el.getAttribute('class') ?? ''));
      assert.deepEqual(old.map((el) => `${el.tagName} ${el.getAttribute('class')}`), []);
      const [header] = t.all().filter((e) => e.getAttribute('data-testid') === 'entry-header');
      assert.match(header.getAttribute('class'), /\bbg-cv-ground\b/);
    } finally { await t.view.unmount(); }
  });
});
