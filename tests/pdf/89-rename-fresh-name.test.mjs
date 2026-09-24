// Renaming a résumé — the pencil on a dashboard card (ResumeCard) or the name in the editor's header
// (Editor → EditorHeader) — started from the name the box first mounted with (R2-071, R2-084). Its
// draft was primed once, so after another tab renamed the résumé (the store takes that save, and the
// card or header shows the new name) opening the box showed the old name, and leaving it wrote the
// old name back over the new one, everywhere. And a rename to the same name still counted as an
// edit: a new updatedAt, a save and a sync for nothing.
// Now the box opens on the name the résumé has at that moment, and a name that does not change is
// not a rename (useRename; the store's renameResume ignores it too).
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs; handlers are called as React set them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const cv = (name) => ({ id: 'resume_x', name, updatedAt: 1, settings: {}, sections: [], personal: {} });
const input = (view) => [...elements(view.container)].find((el) => el.tagName === 'INPUT');
const byTitle = (view, title) => [...elements(view.container)].find((el) => el.getAttribute('title') === title);
const call = (view, el, name, event = {}) => {
  const handler = reactProps(el)?.[name];
  assert.ok(handler, `no ${name} handler on <${el?.tagName}>`);
  view.act(() => handler({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...event }));
};

describe('a dashboard card’s rename (R2-084)', () => {
  async function card(name) {
    const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
    const renames = [];
    const props = (r) => ({ resume: r, onOpen() {}, onDuplicate() {}, onDelete() {}, onRename: (id, n) => renames.push([id, n]) });
    const view = mount(ResumeCard, props(cv(name)));
    return { view, renames, show: (r) => view.update(props(r)) };
  }

  it('renamed in another tab: the box opens on the new name, and leaving it writes nothing back', async () => {
    const { view, renames, show } = await card('Old name');
    try {
      show(cv('Renamed elsewhere')); // the other tab's save, as the store takes it
      call(view, byTitle(view, 'Rename'), 'onClick');
      assert.equal(input(view).value, 'Renamed elsewhere', 'before: the box opened on "Old name"');
      call(view, input(view), 'onBlur');
      assert.deepEqual(renames, [], 'before: [["resume_x","Old name"]] — the other tab’s rename undone');
    } finally { await view.unmount(); }
  });

  it('renamed in another tab while the box is open: leaving it untouched writes nothing back', async () => {
    const { view, renames, show } = await card('Old name');
    try {
      call(view, byTitle(view, 'Rename'), 'onClick');
      show(cv('Renamed elsewhere'));
      call(view, input(view), 'onBlur');
      assert.deepEqual(renames, [], 'the other tab’s rename undone by a box nobody typed in');
    } finally { await view.unmount(); }
  });

  it('a real rename still reaches the store, trimmed; an empty one does not', async () => {
    const { view, renames } = await card('Old name');
    try {
      call(view, byTitle(view, 'Rename'), 'onClick');
      call(view, input(view), 'onChange', { target: { value: '  New name ' } });
      call(view, input(view), 'onKeyDown', { key: 'Enter' });
      assert.deepEqual(renames, [['resume_x', 'New name']]);
      call(view, byTitle(view, 'Rename'), 'onClick');
      call(view, input(view), 'onChange', { target: { value: '   ' } });
      call(view, input(view), 'onBlur');
      assert.deepEqual(renames, [['resume_x', 'New name']]);
    } finally { await view.unmount(); }
  });
});

describe('the editor header’s rename (R2-071)', () => {
  // The Editor's rename state (useRename) handed to its header, as the Editor does.
  async function header(name) {
    const { useRename } = await loadModule('/src/hooks/useRename.js');
    const { EditorHeader } = await loadModule('/src/components/EditorHeader.jsx');
    const { MemoryRouter } = await import('react-router-dom');
    const renames = [];
    function Page({ resume }) {
      const rename = useRename(resume, (n) => renames.push(n));
      return createElement(MemoryRouter, null, createElement(EditorHeader, {
        resume, rename, layoutMode: 'split', setLayoutMode() {}, exportMenu: {}, auth: { cloudAvailable: false }, sync: {},
      }));
    }
    const view = mount(Page, { resume: cv(name) });
    return { view, renames, show: (r) => view.update({ resume: r }) };
  }

  it('renamed in another tab: the box opens on the new name, and leaving it writes nothing back', async () => {
    const { view, renames, show } = await header('Old name');
    try {
      show(cv('Renamed elsewhere'));
      call(view, byTitle(view, 'Rename resume'), 'onClick');
      assert.equal(input(view).value, 'Renamed elsewhere', 'before: the box opened on "Old name"');
      call(view, input(view), 'onBlur');
      assert.deepEqual(renames, [], 'before: ["Old name"]');
    } finally { await view.unmount(); }
  });

  it('Enter renames; Escape keeps the name', async () => {
    const { view, renames } = await header('Old name');
    try {
      call(view, byTitle(view, 'Rename resume'), 'onClick');
      call(view, input(view), 'onChange', { target: { value: 'Typed' } });
      call(view, input(view), 'onKeyDown', { key: 'Escape' });
      assert.deepEqual(renames, []);
      call(view, byTitle(view, 'Rename resume'), 'onClick');
      assert.equal(input(view).value, 'Old name');
      call(view, input(view), 'onChange', { target: { value: 'Typed' } });
      call(view, input(view), 'onKeyDown', { key: 'Enter' });
      assert.deepEqual(renames, ['Typed']);
    } finally { await view.unmount(); }
  });
});

describe('the store’s renameResume (R2-084)', () => {
  it('the same name is not an edit: no new updatedAt, no save', async () => {
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    const writes = [];
    const map = new Map([['cpwtcv_v1', JSON.stringify({ resumes: [{ ...cv('Same'), template: 'classic', dataVersion: 11, coverLetter: {} }], activeId: 'resume_x' })]]);
    globalThis.localStorage = {
      get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
      getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { writes.push(k); map.set(k, String(v)); }, removeItem: (k) => map.delete(k),
    };
    let store = null;
    function Probe() { store = useAppStore(); return null; }
    const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
    try {
      const before = store.appState;
      const saves = writes.length;
      view.act(() => store.renameResume('resume_x', 'Same'));
      assert.equal(store.appState, before, 'before: a new state with a new updatedAt');
      assert.equal(writes.length, saves);
      view.act(() => store.renameResume('resume_x', 'Different'));
      assert.equal(store.appState.resumes[0].name, 'Different');
      assert.ok(store.appState.resumes[0].updatedAt > 1);
    } finally { await view.unmount(); delete globalThis.localStorage; }
  });
});
