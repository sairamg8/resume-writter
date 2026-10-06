// The editor's address deep link (R2-076; B3: ?tab=resume|coverletter is the document, ?dock=design|ats the dock):
// an unknown value was taken as the open tab, so #/resume/<id>?tab=foo showed a blank panel; and a view picked
// afterwards never reached the address, so a reload reopened the one the link named. Now the address is read
// and checked (anything else is the Résumé with no dock, and leaves the address), the old ?tab=design and
// ?tab=ats links still open their dock (and are rewritten to ?dock=), and picking a document or a dock replaces
// the address (no new history entry per click). useEditorTab in a MemoryRouter over tests/pdf/fake-dom.mjs.
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
    const view = useEditorTab();
    const loc = useLocation();
    current = { ...view, url: `${loc.pathname}${loc.search}`, how: useNavigationType() };
    return null;
  }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/resume/:id', element: createElement(Page) }))));
  // The router commits a navigation from an effect: let it run.
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    now: () => current,
    async setDoc(d) { view.act(() => current.setDoc(d)); await settle(); },
    async setDock(d) { view.act(() => current.setDock(d)); await settle(); },
    close: () => view.unmount(),
  };
}

describe('the editor’s ?tab= and ?dock= (R2-076)', () => {
  it('an unknown tab opens the Résumé with no dock, and the address says so', async () => {
    const page = await openAt('/resume/r1?tab=foo');
    try {
      assert.equal(page.now().doc, 'resume', 'before: "foo" — a blank panel');
      assert.equal(page.now().dock, null);
      assert.equal(page.now().url, '/resume/r1');
    } finally { await page.close(); }
  });

  it('an unknown dock is dropped the same way', async () => {
    const page = await openAt('/resume/r1?dock=foo');
    try {
      assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', null, '/resume/r1']);
    } finally { await page.close(); }
  });

  it('each known document and dock opens from the link, and the old ?tab=design and ?tab=ats open their dock', async () => {
    const cases = [
      ['?tab=resume', 'resume', null],
      ['?tab=coverletter', 'coverletter', null],
      ['?dock=design', 'resume', 'design'],
      ['?dock=ats', 'resume', 'ats'],
      ['?tab=design', 'resume', 'design'],
      ['?tab=ats', 'resume', 'ats'],
    ];
    for (const [search, doc, dock] of cases) {
      const page = await openAt(`/resume/r1${search}`);
      try { assert.deepEqual([page.now().doc, page.now().dock], [doc, dock], search); } finally { await page.close(); }
    }
  });

  it('an old ?tab=design link is rewritten to ?dock=design, replacing the entry', async () => {
    const page = await openAt('/resume/r1?tab=design');
    try {
      assert.equal(page.now().url, '/resume/r1?dock=design', 'before: the old link stayed in the address');
      assert.equal(page.now().how, 'REPLACE');
    } finally { await page.close(); }
  });

  it('a picked document or dock is kept in the address, replacing it, so a reload reopens it', async () => {
    const page = await openAt('/resume/r1?tab=coverletter');
    try {
      await page.setDock('design');
      assert.deepEqual([page.now().doc, page.now().dock], ['resume', 'design'], 'a dock is the résumé\'s: opened from the letter it shows the Résumé');
      assert.equal(page.now().url, '/resume/r1?dock=design', 'before: still ?tab=coverletter');
      assert.equal(page.now().how, 'REPLACE');
      await page.setDock((prev) => (prev === 'design' ? null : 'design')); // the Design button's toggle
      assert.deepEqual([page.now().doc, page.now().dock], ['resume', null]);
      assert.equal(page.now().url, '/resume/r1');
      await page.setDoc('coverletter');
      assert.deepEqual([page.now().doc, page.now().dock], ['coverletter', null]);
      assert.equal(page.now().url, '/resume/r1?tab=coverletter');
      assert.equal(page.now().how, 'REPLACE');
    } finally { await page.close(); }
  });
});
