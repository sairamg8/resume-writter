// UI rebuild B3 (cluster frame): the editor's address names a document and a dock. ?tab=resume|coverletter is the
// document, ?dock=design|ats the dock beside it. The links written before the docks (?tab=design, ?tab=ats) still
// open the dock and are rewritten to ?dock= with replace, the address's state kept (an import's notice lives
// there, R5-HUNT2); a value that is none of them is dropped, as an unknown ?tab= always was. Picking the Cover
// letter closes an open dock; opening a dock from the letter switches to the Résumé (EDIT-171); picking the
// Résumé leaves a dock open. The Dashboard's letter links land on the letter. useEditorTab in a MemoryRouter
// over tests/pdf/fake-dom.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const NOTICE = { importNotice: 'This résumé was read from a document, best-effort.' };

/** The hook at `entry` (an address, or { pathname, search, state }). `pick` runs a setter and lets the router commit. */
async function openAt(entry) {
  const { useEditorTab } = await loadModule('/src/hooks/useEditorTab.js');
  const { MemoryRouter, Routes, Route, useLocation, useNavigationType } = await import('react-router-dom');
  let current = null;
  const trail = [];
  function Page() {
    const tab = useEditorTab();
    const loc = useLocation();
    current = { ...tab, url: `${loc.pathname}${loc.search}`, state: loc.state, how: useNavigationType() };
    trail.push(current.url);
    return null;
  }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [entry] },
    createElement(Routes, null, createElement(Route, { path: '/resume/:id', element: createElement(Page) }))));
  // The router commits a navigation from an effect: let it run.
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    now: () => current,
    trail,
    async pick(fn) { view.act(() => fn(current)); await settle(); },
    close: () => view.unmount(),
  };
}

const at = (search, state) => ({ pathname: '/resume/r1', search, state });

describe('the address names a document and a dock', () => {
  it('?tab=coverletter is the letter with no dock; no ?tab= is the Résumé with no dock', async () => {
    let page = await openAt('/resume/r1?tab=coverletter');
    try { assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['coverletter', null, '/resume/r1?tab=coverletter']); } finally { await page.close(); }
    page = await openAt('/resume/r1');
    try { assert.deepEqual([page.now().doc, page.now().dock], ['resume', null]); } finally { await page.close(); }
  });

  it('?tab=resume is the Résumé and stays in the address', async () => {
    const page = await openAt('/resume/r1?tab=resume');
    try { assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', null, '/resume/r1?tab=resume']); } finally { await page.close(); }
  });

  it('?dock=design and ?dock=ats open the dock over the Résumé', async () => {
    for (const dock of ['design', 'ats']) {
      const page = await openAt(`/resume/r1?dock=${dock}`);
      try { assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', dock, `/resume/r1?dock=${dock}`]); } finally { await page.close(); }
    }
  });

  it('a link with a letter and a dock opens the dock, over the Résumé (a dock is the résumé\'s)', async () => {
    const page = await openAt('/resume/r1?tab=coverletter&dock=design');
    try { assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', 'design', '/resume/r1?dock=design']); } finally { await page.close(); }
  });

  it('the Dashboard\'s letter link (editorPath) lands on the letter, and a résumé\'s link on the Résumé', async () => {
    const { editorPath } = await loadModule('/src/utils/letters.js');
    const letterLink = editorPath('r1', { kind: 'letter' });
    assert.equal(letterLink, '/resume/r1?tab=coverletter');
    const page = await openAt(letterLink);
    try { assert.deepEqual([page.now().doc, page.now().dock], ['coverletter', null]); } finally { await page.close(); }
    assert.equal(editorPath('r1', {}), '/resume/r1');
  });
});

describe('the old ?tab=design and ?tab=ats links', () => {
  it('open the dock and are rewritten to ?dock= with replace', async () => {
    for (const dock of ['design', 'ats']) {
      const page = await openAt(`/resume/r1?tab=${dock}`);
      try {
        assert.equal(page.now().dock, dock, 'the dock opens');
        assert.equal(page.now().doc, 'resume');
        assert.equal(page.now().url, `/resume/r1?dock=${dock}`, 'before: still the old ?tab=');
        assert.equal(page.now().how, 'REPLACE', 'no history entry');
      } finally { await page.close(); }
    }
  });

  it('keep the address\'s state: an import notice survives the rewrite', async () => {
    const page = await openAt(at('?tab=design', NOTICE));
    try {
      assert.equal(page.now().url, '/resume/r1?dock=design');
      assert.deepEqual(page.now().state, NOTICE, 'before: the rewrite took the notice away');
    } finally { await page.close(); }
  });
});

describe('a value that is neither is dropped, as an unknown tab always was', () => {
  it('?tab=foo and ?dock=foo leave the address, and the Résumé opens with no dock', async () => {
    for (const search of ['?tab=foo', '?dock=foo', '?tab=foo&dock=bar']) {
      const page = await openAt(`/resume/r1${search}`);
      try {
        assert.deepEqual([page.now().doc, page.now().dock], ['resume', null], search);
        assert.equal(page.now().url, '/resume/r1', `${search}: the address says so`);
      } finally { await page.close(); }
    }
  });

  it('a good dock beside a bad tab stays, the bad tab goes; a good tab beside a bad dock stays', async () => {
    let page = await openAt('/resume/r1?tab=foo&dock=ats');
    try { assert.deepEqual([page.now().dock, page.now().url], ['ats', '/resume/r1?dock=ats']); } finally { await page.close(); }
    page = await openAt('/resume/r1?tab=coverletter&dock=foo');
    try { assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['coverletter', null, '/resume/r1?tab=coverletter']); } finally { await page.close(); }
  });

  it('an unknown value keeps the address\'s state too', async () => {
    const page = await openAt(at('?tab=foo', NOTICE));
    try {
      assert.equal(page.now().url, '/resume/r1');
      assert.deepEqual(page.now().state, NOTICE);
    } finally { await page.close(); }
  });
});

describe('picking a document or a dock', () => {
  it('the Cover letter closes an open dock; the address says only the letter', async () => {
    const page = await openAt('/resume/r1?dock=ats');
    try {
      await page.pick((t) => t.setDoc('coverletter'));
      assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['coverletter', null, '/resume/r1?tab=coverletter']);
      assert.equal(page.now().how, 'REPLACE');
    } finally { await page.close(); }
  });

  it('the Résumé leaves an open dock open, and a letter with none becomes the Résumé (negative twin of the letter pick)', async () => {
    let page = await openAt('/resume/r1?dock=design');
    try {
      await page.pick((t) => t.setDoc('resume'));
      assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', 'design', '/resume/r1?dock=design']);
    } finally { await page.close(); }
    page = await openAt('/resume/r1?tab=coverletter');
    try {
      await page.pick((t) => t.setDoc('resume'));
      assert.deepEqual([page.now().doc, page.now().url], ['resume', '/resume/r1']);
    } finally { await page.close(); }
  });

  it('a dock opened from the letter switches to the Résumé (EDIT-171)', async () => {
    const page = await openAt('/resume/r1?tab=coverletter');
    try {
      await page.pick((t) => t.setDock('design'));
      assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', 'design', '/resume/r1?dock=design']);
    } finally { await page.close(); }
  });

  it('one dock at a time, and the toggle closes it without changing the document', async () => {
    const page = await openAt('/resume/r1?dock=design');
    try {
      await page.pick((t) => t.setDock('ats'));
      assert.equal(page.now().dock, 'ats');
      assert.equal(page.now().url, '/resume/r1?dock=ats');
      await page.pick((t) => t.setDock((prev) => (prev === 'ats' ? null : 'ats'))); // the chip's toggle
      assert.deepEqual([page.now().doc, page.now().dock, page.now().url], ['resume', null, '/resume/r1']);
      await page.pick((t) => t.setDock((prev) => (prev === 'ats' ? null : 'ats')));
      assert.equal(page.now().dock, 'ats');
      await page.pick((t) => t.setDock(null));
      assert.equal(page.now().dock, null);
    } finally { await page.close(); }
  });

  it('every pick keeps the address\'s state (an import notice)', async () => {
    const page = await openAt(at('', NOTICE));
    try {
      for (const pick of [(t) => t.setDock('design'), (t) => t.setDoc('coverletter'), (t) => t.setDock('ats'), (t) => t.setDock(null), (t) => t.setDoc('resume')]) {
        await page.pick(pick);
        assert.deepEqual(page.now().state, NOTICE);
      }
    } finally { await page.close(); }
  });
});
