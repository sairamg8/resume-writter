// R5-HUNT2-IMPORT-NOTICE-LOST-ON-TAB-SWITCH: an import opens the editor with a notice ("Imported from
// your file as best we could read it…", or "This is a new résumé" after Import JSON) kept in the
// address's state (useImportNotice), until the user presses Dismiss. Picking another tab (Design,
// Cover Letter, ATS Check) replaced ?tab= with no state, so the notice went at the first click. A
// picked tab now keeps the state, as useUrlState does. useEditorTab and useImportNotice in a
// MemoryRouter over tests/pdf/fake-dom.mjs, as in 89-editor-tab-link.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const NOTICE = 'Imported from your file as best we could read it. Check every section.';

async function openAt(entry) {
  const { useEditorTab } = await loadModule('/src/hooks/useEditorTab.js');
  const { useImportNotice } = await loadModule('/src/hooks/useImportNotice.js');
  const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
  let current = null;
  function Page() {
    const [tab, setTab] = useEditorTab();
    const { notice, dismiss } = useImportNotice();
    const loc = useLocation();
    current = { tab, setTab, notice, dismiss, url: `${loc.pathname}${loc.search}` };
    return null;
  }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [entry] },
    createElement(Routes, null, createElement(Route, { path: '/resume/:id', element: createElement(Page) }))));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    now: () => current,
    async pick(t) { view.act(() => current.setTab(t)); await settle(); },
    async dismiss() { view.act(() => current.dismiss()); await settle(); },
    close: () => view.unmount(),
  };
}

it("an import's notice stays over every tab picked, until Dismiss", async () => {
  const page = await openAt({ pathname: '/resume/r1', state: { importNotice: NOTICE } });
  try {
    assert.equal(page.now().notice, NOTICE, 'the editor opens with the notice');
    await page.pick('design');
    assert.equal(page.now().url, '/resume/r1?tab=design');
    assert.equal(page.now().notice, NOTICE, 'before: gone at the first tab picked');
    await page.pick('ats');
    await page.pick('resume');
    assert.equal(page.now().url, '/resume/r1');
    assert.equal(page.now().notice, NOTICE, 'still there back on the Résumé tab');
    await page.dismiss();
    assert.equal(page.now().notice, null, 'Dismiss takes it away');
    await page.pick('coverletter');
    assert.equal(page.now().notice, null, 'and a tab picked after does not bring it back');
  } finally { await page.close(); }
});

it('a letter import, opened on ?tab=coverletter, keeps its notice when another tab is picked', async () => {
  const page = await openAt({ pathname: '/resume/r1', search: '?tab=coverletter', state: { importNotice: NOTICE } });
  try {
    assert.equal(page.now().tab, 'coverletter');
    await page.pick('design');
    assert.equal(page.now().notice, NOTICE);
  } finally { await page.close(); }
});
