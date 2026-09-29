// R5-HUNT8-REV-UNREADABLE-TEXT-STAYS: a number field (Story points; Project settings → Columns →
// WIP) whose text the browser cannot read ('2,5' in Firefox or Safari, 'e' in Chrome) reports its
// value as '' with validity.badInput set. Leaving the field kept the saved value, but when that value
// was blank React had nothing to write over the text (the field already read ''), so '2,5' stayed on
// screen as if it were saved; a reload showed no points and no limit. The text is now wiped on Tab,
// Enter and Escape, so the field shows what is saved.
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let PointsInput;
let BoardSettings;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ PointsInput } = await loadModule('/src/components/board/IssueFields.jsx'));
  ({ BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);

/** A number field as the browser keeps it: the text on screen, read back as '' while unreadable. */
function numberField(text) {
  const unreadable = (t) => t !== '' && !Number.isFinite(Number(t));
  const field = {
    shown: text,
    get value() { return unreadable(this.shown) ? '' : this.shown; },
    set value(v) { this.shown = String(v); },
    get validity() { return { badInput: unreadable(field.shown) }; },
  };
  return field;
}

function driver(view, input) {
  const fire = (name, t, extra = {}) => view.act(() => reactProps(input())[name](ev({ target: t, currentTarget: t, ...extra })));
  return {
    type: (t) => fire('onChange', t),
    blur: (t) => fire('onBlur', t),
    key: (t, key) => fire('onKeyDown', t, { key }),
  };
}

function points(value) {
  const saved = [];
  const view = mount(PointsInput, { value, onChange: (n) => saved.push(n) });
  const input = () => [...elements(view.container)].find((el) => el.tagName === 'INPUT');
  return { saved, view, ...driver(view, input) };
}

describe('Story points: unreadable text leaves the screen (R5-HUNT8-REV-UNREADABLE-TEXT-STAYS)', () => {
  it('2,5 typed into a field with no points is wiped on leaving it', async () => {
    const p = points(null);
    try {
      const t = numberField('2,5');
      p.type(t);
      p.blur(t);
      assert.deepEqual(p.saved, []);
      assert.equal(t.shown, '', 'the unreadable text stayed on screen though no points were saved');
    } finally { await p.view.unmount(); }
  });

  it('e typed into a blank field (the browser sends no change) is wiped on Enter', async () => {
    const p = points(null);
    try {
      const t = numberField('e');
      p.key(t, 'Enter');
      assert.deepEqual(p.saved, []);
      assert.equal(t.shown, '', 'Enter left the unreadable text on screen');
    } finally { await p.view.unmount(); }
  });

  it('Escape wipes unreadable text too; readable text is left alone', async () => {
    const p = points(null);
    try {
      const t = numberField('1e');
      p.type(t);
      p.key(t, 'Escape');
      assert.equal(t.shown, '', 'Escape left the unreadable text on screen');
      const ok = numberField('2');
      p.type(ok);
      p.blur(ok);
      assert.deepEqual(p.saved, [2]);
      assert.equal(ok.shown, '2');
    } finally { await p.view.unmount(); }
  });
});

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

describe('Project settings WIP: unreadable text leaves the screen (R5-HUNT8-REV-UNREADABLE-TEXT-STAYS)', () => {
  beforeEach(() => { store._resetBoardStoreForTest(); });
  afterEach(() => { delete globalThis.localStorage; });

  function settings() {
    const project = {
      id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
      columns: [{ id: 'c1', title: 'To Do', category: 'todo', wipLimit: null }, { id: 'c2', title: 'Done', category: 'done', wipLimit: null }],
      labels: [], sprints: [], issues: [], nextNumber: 1, hideDoneAfterDays: 14,
    };
    globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project], dataVersion: 2 })]]);
    store.subscribe(() => {});
    const Page = () => h(MemoryRouter, { initialEntries: ['/boards/p1/settings'] },
      h(Routes, null, h(Route, { path: '/boards/:id/settings', element: h(BoardSettings) })));
    const view = mount(Page, {});
    const input = () => [...elements(view.document.body)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'WIP limit');
    const limit = () => store.snapshot().boards.find((b) => b.id === 'p1').columns[0].wipLimit;
    return { view, input, limit, ...driver(view, input) };
  }

  it('2,5 typed into a column with no limit is wiped on Tab, Enter and Escape', async () => {
    const s = settings();
    try {
      assert.ok(s.input(), 'the settings page shows the WIP field');
      const t = numberField('2,5');
      s.type(t);
      s.blur(t);
      assert.equal(s.limit(), null);
      assert.equal(t.shown, '', 'the unreadable text stayed on screen though no limit was saved');
      const u = numberField('3e');
      s.type(u);
      s.key(u, 'Enter');
      assert.equal(u.shown, '', 'Enter left the unreadable text on screen');
      const w = numberField('4,');
      s.type(w);
      s.key(w, 'Escape');
      assert.equal(w.shown, '', 'Escape left the unreadable text on screen');
      assert.equal(s.limit(), null);
    } finally { await s.view.unmount(); }
  });
});
