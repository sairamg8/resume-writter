// The Résumé tab (EditorResumeTab) over the real store (useAppStore on an in-memory localStorage),
// wired as the Editor wires it, for tests that use its controls and read what the store then holds
// (R2-158). Mounted with react-dom/client over fake-dom.mjs: a control's handler is called as React
// set it, and a drop ends in the DndContext's own onDragEnd, found in the tree React has on screen.
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

const KEY = 'cpwtcv_v1';

/** A localStorage stand-in. */
export class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/**
 * Let React run what a change set off — effects, and the renders their updates ask for (dnd-kit
 * measures and picks what is under a drag from those) — and dnd-kit's own timers.
 */
export const settle = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => { setTimeout(r, 0); });
};

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/**
 * The onDragEnd of the innermost DndContext on screen that holds `el`: what dnd-kit calls when a
 * drag there ends. Found from the root down, in the tree React has on screen: a node keeps the
 * fiber it was created with, whose props (and return path) are an older render's every other update.
 */
function dragEndOf(view, el) {
  const rootKey = Object.keys(view.container).find((k) => k.startsWith('__reactContainer$'));
  let found = null;
  (function walk(fiber, onDragEnd) {
    for (let f = fiber; f && !found; f = f.sibling) {
      const own = typeof f.memoizedProps?.onDragEnd === 'function' ? f.memoizedProps.onDragEnd : onDragEnd;
      if (f.stateNode === el) { found = own; return; }
      walk(f.child, own);
    }
  })(view.container[rootKey].stateNode.current, null);
  assert.ok(found, 'no DndContext holds it');
  return found;
}

/**
 * The Résumé tab over a saved résumé `r`, as the Editor mounts it (Personal Info closed, sections
 * expanded, the Add Section picker's open state its own). Returns:
 * - `view`, `store()` (the store now), `saved()` (the résumé it holds now), `storage`;
 * - `all(within)`, `button(label, within)` (a button by its text, title or aria-label), `click(el)`;
 * - `card(title)` (a section's card, found by its title box), `titles()` (the section titles, top to
 *   bottom), `entries(card)` (its entries' names, as their cards show them);
 * - `drop(el, active, over)`: the drag that holds `el` ends with `active` over `over` (ids, or null);
 * - `close()`.
 */
export async function resumeTab(r) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { EditorResumeTab } = await loadModule('/src/components/EditorResumeTab.jsx');
  const storage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  globalThis.localStorage = storage;
  let store = null;
  function Tab() {
    store = useAppStore();
    const [addSectionOpen, setAddSectionOpen] = useState(false);
    return createElement(EditorResumeTab, {
      resume: store.activeResume, store,
      personalOpen: false, setPersonalOpen() {}, allExpanded: true, forceOpenKey: 0, toggleAllSections() {},
      addSectionOpen, setAddSectionOpen,
    });
  }
  const view = mount(Tab, {});
  await settle();
  const all = (within = view.container) => [...elements(within)];
  const titleBoxes = () => all().filter((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Section title');
  const tab = {
    view,
    storage,
    store: () => store,
    saved: () => store.activeResume,
    all,
    button(label, within) {
      const found = all(within).find((el) => el.tagName === 'BUTTON'
        && [text(el), el.getAttribute('title'), el.getAttribute('aria-label')].includes(label));
      assert.ok(found, `no button "${label}"`);
      return found;
    },
    click(el) {
      view.act(() => reactProps(el).onClick({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el }));
    },
    card(title) {
      const box = titleBoxes().find((el) => el.value === title);
      assert.ok(box, `no section titled "${title}": the tab shows ${tab.titles().join(' | ')}`);
      return box.parentNode.parentNode; // title box → header row → the section's card
    },
    titles: () => titleBoxes().map((el) => el.value),
    entries: (card) => all(card).filter((el) => el.tagName === 'SPAN' && /\btruncate\b/.test(el.className)).map(text),
    drop(el, active, over) {
      const onDragEnd = dragEndOf(view, el);
      view.act(() => onDragEnd({ active: { id: active }, over: over == null ? null : { id: over } }));
    },
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
  return tab;
}
