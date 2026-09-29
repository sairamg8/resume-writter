// The editor's résumé (useOpenResume, src/pages/Editor.jsx): the one in the address is opened, and
// the page goes back to the dashboard once it is gone. It looked only when the address changed, so
// now that the store takes another tab's saves (16-saved-data-two-tabs), a résumé deleted in another
// tab while open here left this tab showing the next résumé — taking the edits — under the deleted
// one's address (bug audit 2026-09-22).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A store as useAppStore returns it, over the ids `ids` with `activeId` open; `opened` logs setActiveId. */
function storeOf(ids, activeId, opened = []) {
  return { appState: { resumes: ids.map((id) => ({ id })), activeId }, setActiveId: (id) => opened.push(id) };
}

/** A page at `path` whose /resume/:id runs the editor's hook over `store`; '/' is the dashboard. */
async function openAt(path, store) {
  const { useOpenResume } = await loadModule('/src/hooks/useOpenResume.js');
  const { useParams } = await import('react-router-dom');
  function EditorStandIn({ store: s }) {
    const { id } = useParams();
    useOpenResume(s, id);
    return createElement('p', null, `EDITING ${id}`);
  }
  function App({ store: s }) {
    return createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null,
        createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') }),
        createElement(Route, { path: '/resume/:id', element: createElement(EditorStandIn, { store: s }) })));
  }
  const view = mount(App, { store });
  // The hook navigates from an effect: let React run it and render the route it lands on.
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    text: () => view.container.textContent,
    async show(next) { view.update({ store: next }); await settle(); },
    close: () => view.unmount(),
  };
}

describe('the editor’s résumé', () => {
  it('the one in the address is opened in the store', async () => {
    const opened = [];
    const page = await openAt('/resume/resume_b', storeOf(['resume_a', 'resume_b'], 'resume_a', opened));
    try {
      assert.match(page.text(), /EDITING resume_b/);
      assert.deepEqual(opened, ['resume_b']);
    } finally { await page.close(); }
  });

  it('deleted in another tab while open here: back to the dashboard, not the next résumé under its address', async () => {
    const page = await openAt('/resume/resume_a', storeOf(['resume_a', 'resume_b'], 'resume_a'));
    try {
      assert.match(page.text(), /EDITING resume_a/);
      await page.show(storeOf(['resume_b'], 'resume_b')); // the other tab's save, as the store takes it
      assert.match(page.text(), /THE DASHBOARD/, 'before: it stayed, showing résumé B as A');
    } finally { await page.close(); }
  });

  it('an import that finishes after another résumé was opened does not take over its editor (R5-HUNT1)', async () => {
    const opened = [];
    const page = await openAt('/resume/resume_b', storeOf(['resume_a', 'resume_b'], 'resume_b', opened));
    try {
      assert.deepEqual(opened, []);
      // The late import: importResume adds its résumé as the store's open one; the address stays /resume/resume_b.
      await page.show(storeOf(['resume_a', 'resume_b', 'resume_new'], 'resume_new', opened));
      assert.match(page.text(), /EDITING resume_b/);
      assert.deepEqual(opened, ['resume_b'], 'before: the editor went on showing and editing the imported résumé under B’s address');
    } finally { await page.close(); }
  });

  it('an address with no such résumé goes to the dashboard', async () => {
    const page = await openAt('/resume/resume_gone', storeOf(['resume_a'], 'resume_a'));
    try {
      assert.match(page.text(), /THE DASHBOARD/);
    } finally { await page.close(); }
  });
});

// The same with the app's own store (useAppStore): an import adds its résumé without opening it
// (importResume); going to /resume/:id opens it. It used to open it itself, and with the editor now
// putting the address's résumé back (above), every import from the editor showed the imported résumé,
// then the old one again, then the imported one — the address changes a render later (a router
// transition) — and a late import showed the imported one under the open one's address (R5-HUNT1 review).
class MemoryStorage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
const cv = (id) => ({ id, name: id, template: 'classic', dataVersion: 11, updatedAt: 1, settings: {}, sections: [], personal: { name: id }, coverLetter: {} });

/** The editor at `path` over the app's store holding `ids` (`activeId` open): what each commit showed. */
async function editorWithStore(path, ids, activeId) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { useOpenResume } = await loadModule('/src/hooks/useOpenResume.js');
  const { useParams, useNavigate } = await import('react-router-dom');
  const { useLayoutEffect } = await import('react');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({
    resumes: ids.map(cv), activeId, dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null,
  })]]);
  const shown = [];
  const live = {};
  function EditorStandIn() {
    const { id } = useParams();
    const store = useAppStore();
    live.store = store;
    live.navigate = useNavigate();
    useOpenResume(store, id);
    const showing = store.activeResume?.id; // what Editor.jsx shows and edits
    useLayoutEffect(() => { shown.push(showing); });
    return createElement('p', null, `SHOWING ${showing}`);
  }
  function App() {
    return createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: '/resume/:id', element: createElement(EditorStandIn) })));
  }
  const view = mount(App, {});
  const settle = async () => { for (let i = 0; i < 20; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    shown, live, settle,
    act: async (fn) => { let out; view.act(() => { out = fn(); }); await settle(); return out; },
    text: () => view.container.textContent,
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('an import, with the app’s store (R5-HUNT1 review)', () => {
  it('imported from the editor: it opens once, and the old résumé does not flash back', async () => {
    const page = await editorWithStore('/resume/resume_a', ['resume_a'], 'resume_a');
    try {
      page.shown.length = 0;
      const id = await page.act(() => {
        const newId = page.live.store.importResume(cv('from_file'));
        page.live.navigate(`/resume/${newId}`);
        return newId;
      });
      assert.equal(page.live.store.appState.activeId, id);
      assert.match(page.text(), new RegExp(`SHOWING ${id}`));
      const first = page.shown.indexOf(id);
      assert.ok(first >= 0);
      assert.deepEqual(page.shown.slice(first).filter((s) => s !== id), [],
        `before: it showed the imported résumé, then résumé A again, then the imported one (${page.shown.join(' → ')})`);
    } finally { await page.close(); }
  });

  it('an import that finishes after another résumé was opened is added, and never shown in its editor', async () => {
    const page = await editorWithStore('/resume/resume_b', ['resume_a', 'resume_b'], 'resume_b');
    try {
      page.shown.length = 0;
      const id = await page.act(() => page.live.store.importResume(cv('from_file')));
      assert.ok(page.live.store.appState.resumes.some((r) => r.id === id), 'the imported résumé is added');
      assert.equal(page.live.store.appState.activeId, 'resume_b');
      assert.match(page.text(), /SHOWING resume_b/);
      assert.ok(!page.shown.includes(id), `before: the editor at B showed the imported résumé (${page.shown.join(' → ')})`);
    } finally { await page.close(); }
  });

  it('into an empty list the imported résumé is the open one', async () => {
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    globalThis.localStorage = new MemoryStorage();
    let store = null;
    const view = mount(() => { store = useAppStore(); return null; }, {});
    try {
      await new Promise((r) => { setImmediate(r); });
      let id;
      view.act(() => { id = store.importResume(cv('from_file')); });
      assert.equal(store.appState.activeId, id);
    } finally { await view.unmount(); delete globalThis.localStorage; }
  });
});
