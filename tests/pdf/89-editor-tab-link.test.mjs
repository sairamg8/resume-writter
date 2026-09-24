// The editor's ?tab= deep link (R2-076): an unknown value was taken as the open tab, so
// #/resume/<id>?tab=foo showed a blank panel under the tab bar; and a tab picked afterwards never
// reached the address, so a reload reopened the tab the link named. Now the tab is read from the
// address and checked (anything else is the Résumé tab), and picking a tab replaces ?tab= in the
// address (no new history entry per click). useEditorTab in a MemoryRouter over tests/pdf/fake-dom.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

async function openAt(path) {
  const { useEditorTab } = await loadModule('/src/hooks/useEditorTab.js');
  const { MemoryRouter, Routes, Route, useLocation, useNavigationType } = await import('react-router-dom');
  let current = null;
  function Page() {
    const [tab, setTab] = useEditorTab();
    const loc = useLocation();
    current = { tab, setTab, url: `${loc.pathname}${loc.search}`, how: useNavigationType() };
    return null;
  }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/resume/:id', element: createElement(Page) }))));
  // The router commits a navigation from an effect: let it run.
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return { now: () => current, async pick(t) { view.act(() => current.setTab(t)); await settle(); }, close: () => view.unmount() };
}

describe('the editor’s ?tab= (R2-076)', () => {
  it('an unknown tab opens the Résumé tab, and the address says so', async () => {
    const page = await openAt('/resume/r1?tab=foo');
    try {
      assert.equal(page.now().tab, 'resume', 'before: "foo" — a blank panel under the tab bar');
      assert.equal(page.now().url, '/resume/r1');
    } finally { await page.close(); }
  });

  it('each known tab opens from the link', async () => {
    for (const tab of ['resume', 'design', 'coverletter', 'ats']) {
      const page = await openAt(`/resume/r1?tab=${tab}`);
      try { assert.equal(page.now().tab, tab); } finally { await page.close(); }
    }
  });

  it('a picked tab is kept in the address, replacing it, so a reload reopens it', async () => {
    const page = await openAt('/resume/r1?tab=coverletter');
    try {
      await page.pick('design');
      assert.equal(page.now().tab, 'design');
      assert.equal(page.now().url, '/resume/r1?tab=design', 'before: still ?tab=coverletter');
      assert.equal(page.now().how, 'REPLACE');
      await page.pick((prev) => (prev === 'design' ? 'resume' : 'design')); // the Design button's toggle
      assert.equal(page.now().tab, 'resume');
      assert.equal(page.now().url, '/resume/r1');
    } finally { await page.close(); }
  });
});
