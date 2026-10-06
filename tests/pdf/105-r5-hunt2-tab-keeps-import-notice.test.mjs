// R5-HUNT2-IMPORT-NOTICE-LOST-ON-TAB-SWITCH: an import opens the editor with a notice ("Imported from
// your file as best we could read it…", or "This is a new résumé" after Import JSON) kept in the
// address's state (useImportNotice), until the user presses Dismiss. Picking another view (the Design or
// ATS dock, the Cover Letter) replaced the address with no state, so the notice went at the first click. A
// picked view now keeps the state, as useUrlState does, and so does the rewrite of an old ?tab=design link.
// useEditorTab and useImportNotice in a MemoryRouter over tests/pdf/fake-dom.mjs, as in 89-editor-tab-link.
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
    const { doc, dock, setDoc, setDock } = useEditorTab();
    const { notice, dismiss } = useImportNotice();
    const loc = useLocation();
    current = { doc, dock, setDoc, setDock, notice, dismiss, url: `${loc.pathname}${loc.search}` };
    return null;
  }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [entry] },
    createElement(Routes, null, createElement(Route, { path: '/resume/:id', element: createElement(Page) }))));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    now: () => current,
    async setDoc(d) { view.act(() => current.setDoc(d)); await settle(); },
    async setDock(d) { view.act(() => current.setDock(d)); await settle(); },
    async dismiss() { view.act(() => current.dismiss()); await settle(); },
    close: () => view.unmount(),
  };
}

it("an import's notice stays over every view picked, until Dismiss", async () => {
  const page = await openAt({ pathname: '/resume/r1', state: { importNotice: NOTICE } });
  try {
    assert.equal(page.now().notice, NOTICE, 'the editor opens with the notice');
    await page.setDock('design');
    assert.equal(page.now().url, '/resume/r1?dock=design');
    assert.equal(page.now().notice, NOTICE, 'before: gone at the first view picked');
    await page.setDock('ats');
    await page.setDock(null);
    assert.equal(page.now().url, '/resume/r1');
    assert.equal(page.now().notice, NOTICE, 'still there with the dock closed');
    await page.setDoc('coverletter');
    assert.equal(page.now().url, '/resume/r1?tab=coverletter');
    assert.equal(page.now().notice, NOTICE, 'and over the Cover Letter');
    await page.dismiss();
    assert.equal(page.now().notice, null, 'Dismiss takes it away');
    await page.setDoc('resume');
    assert.equal(page.now().notice, null, 'and a view picked after does not bring it back');
  } finally { await page.close(); }
});

it('a letter import, opened on ?tab=coverletter, keeps its notice when a dock is opened', async () => {
  const page = await openAt({ pathname: '/resume/r1', search: '?tab=coverletter', state: { importNotice: NOTICE } });
  try {
    assert.equal(page.now().doc, 'coverletter');
    await page.setDock('design');
    assert.equal(page.now().dock, 'design');
    assert.equal(page.now().notice, NOTICE);
  } finally { await page.close(); }
});

it('an import opened on an old ?tab=design link keeps its notice as the link is rewritten to ?dock=design', async () => {
  const page = await openAt({ pathname: '/resume/r1', search: '?tab=design', state: { importNotice: NOTICE } });
  try {
    assert.equal(page.now().url, '/resume/r1?dock=design', 'the old link was rewritten');
    assert.equal(page.now().notice, NOTICE, 'the rewrite took the notice off the address\'s state');
  } finally { await page.close(); }
});
