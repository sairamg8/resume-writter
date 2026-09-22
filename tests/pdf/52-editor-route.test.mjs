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

  it('an address with no such résumé goes to the dashboard', async () => {
    const page = await openAt('/resume/resume_gone', storeOf(['resume_a'], 'resume_a'));
    try {
      assert.match(page.text(), /THE DASHBOARD/);
    } finally { await page.close(); }
  });
});
