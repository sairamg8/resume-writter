// R5-HUNT6-DASH-IMPORT-AFTER-SIGN-OUT, the editor's Import: Export menu → Import of a PDF or Word file
// reads for seconds, as the Dashboard's does. When the account signed out meanwhile (its list leaves
// the browser, leaveAccount), the read still added the résumé to the list that was left — this
// browser's own, signed out, which joins whoever signs in next — and opened it. The Dashboard's Import
// was fixed alone; the editor's went on doing it. Now a read that ends after the list left the account
// it was started for keeps the résumé aside for that account (`stashed`; its next sign-in brings it),
// opens nothing and says so; an import with no sign-out is unchanged. The real store (useAppStore on an
// in-memory localStorage) and the real useEditorExports, as Editor.jsx wires them, mounted with
// react-dom/client over tests/pdf/fake-dom.mjs; the file's bytes arrive when the test says.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
  // The document reader, loaded now, as the editor loads it when a file comes.
  await loadModule('/src/utils/importFile.js');
});
after(teardown);

const KEY = 'cpwtcv_v1';
const TEXT = 'Wren Calloway\nHarbor Pilot\nwren@example.com\n\nExperience\nHarbor Pilot, Northern Coast Pilots\nJan 2018 - Present\nGuided vessels into port.\n';

async function editor() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
  const mine = { ...resume({ personal: { name: 'Wren Calloway' } }), id: 'resume_a', name: 'Pilot CV', updatedAt: 1000 };
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [mine], activeId: 'resume_a', syncedUid: 'u', cloudVersions: { resume_a: 1000 } })]]);
  const went = [];
  const box = { store: null, menu: null };
  function Page() {
    box.store = useAppStore();
    // As Editor.jsx wires it; the résumé on screen stays the one the file was picked over.
    box.menu = useEditorExports({
      resume: mine, activeTab: 'resume', authUser: null, importResume: box.store.importResume,
      navigate: (...args) => went.push(args), account: box.store.appState.syncedUid ?? null,
    });
    return null;
  }
  const view = mount(Page, {});
  await settle();
  let arrive;
  const bytes = new Promise((resolve) => { arrive = () => resolve(new TextEncoder().encode(TEXT).buffer); });
  const file = { name: 'wren.txt', size: TEXT.length, arrayBuffer: () => bytes };
  let pending;
  return {
    box,
    went,
    pick: async () => { view.act(() => { pending = box.menu.handleImportFile(file); }); await settle(); },
    signOut: async () => { view.act(() => box.store.leaveAccount('u')); await settle(); },
    arrive: async () => { arrive(); const id = await pending; await settle(); view.act(() => {}); await settle(); return id; },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('a read that ends after the sign-out keeps the résumé for that account, off the signed-out list', async () => {
  const page = await editor();
  try {
    await page.pick();
    await page.signOut();
    assert.equal(page.box.store.appState.syncedUid, null);
    const id = await page.arrive();
    const { appState } = page.box.store;
    assert.deepEqual(appState.resumes.map((r) => r.name), [], 'added to the signed-out list');
    assert.deepEqual(page.went, [], 'opened in the editor after the sign-out');
    assert.equal(id, null);
    const kept = appState.stashed?.u?.resumes ?? [];
    assert.equal(kept.length, 1, 'kept aside for the account it was imported for');
    assert.equal(kept[0].personal?.name, 'Wren Calloway', 'the imported one');
    assert.match(page.box.menu.exportError || '', /kept for that account/);
  } finally { await page.close(); }
});

it('with no sign-out, the import is added and opened as before', async () => {
  const page = await editor();
  try {
    await page.pick();
    const id = await page.arrive();
    const { appState } = page.box.store;
    assert.equal(appState.resumes.length, 2);
    const made = appState.resumes.find((r) => r.id !== 'resume_a');
    assert.equal(id, made.id);
    assert.equal(page.went[0]?.[0], `/resume/${made.id}`);
    assert.equal(appState.stashed?.u, undefined);
    assert.equal(page.box.menu.exportError, null);
  } finally { await page.close(); }
});
