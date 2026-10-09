// CYC8-S13: the recovery notice's "Download the copy" saves the whole raw store ({ resumes: [...],
// activeId, ... }), and the Dashboard's Import refused it as "Invalid resume file", so a recovered copy
// could not be brought back except by hand. Now the Import takes such a file: every résumé in it comes
// in as a NEW résumé through the store's importResume (the normalization a single file gets), the
// entries that are not a résumé are left out and counted, and the page says how many came in. The
// person stays on the Dashboard. A single résumé's file behaves as before.
// The real Dashboard over the real store in a MemoryRouter (tests/pdf/fake-dom.mjs); the FileReader hands
// its text over when the test says.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const KEY = 'cpwtcv_v1';

async function dashboard() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  const mine = { ...resume({ personal: { name: 'Wren Calloway' } }), id: 'resume_a', name: 'Pilot CV', updatedAt: 1000 };
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [mine], activeId: 'resume_a' })]]);
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { store: null, where: null };
  function Where() { box.where = useLocation().pathname; return null; }
  function Page() {
    box.store = useAppStore();
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Where), createElement(Dashboard, { store: box.store, auth, sync }));
  }
  const view = mount(Page, {});
  await settle();
  const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
  assert.ok(input, 'the Import file input');
  const saved = { FileReader: globalThis.FileReader };
  let reader = null;
  globalThis.FileReader = class { readAsText() { reader = this; } };
  return {
    box,
    text: () => view.container.textContent.replace(/\s+/g, ' '),
    pick: (name = 'cpwtcv_v1_backup_1.json') => view.act(() => reactProps(input).onChange({ target: { files: [{ name, size: 1000 }], value: '' } })),
    read: async (text) => { await reader.onload({ target: { result: text } }); await settle(); view.act(() => {}); await settle(); },
    async close() { Object.assign(globalThis, saved); await view.unmount(); delete globalThis.localStorage; },
  };
}

const person = (name, title) => ({ ...resume({ personal: { name, title } }), name: `${name} CV` });

it('a saved copy of the store brings in every résumé in it as a new one, and says how many', async () => {
  const page = await dashboard();
  try {
    page.pick();
    const copy = {
      resumes: [person('Tove Marlow', 'Cartographer'), person('Ines Harrow', 'Pilot'), { id: 'resume_broken', name: 'Half a file' }],
      activeId: 'resume_a', syncedUid: 'u', cloudVersions: {},
    };
    await page.read(JSON.stringify(copy));
    const { resumes } = page.box.store.appState;
    assert.equal(resumes.length, 3, 'the one already here and the two that came in');
    assert.deepEqual(resumes.slice(1).map((r) => r.personal.name), ['Tove Marlow', 'Ines Harrow']);
    assert.ok(resumes.slice(1).every((r) => r.id !== copy.resumes[0].id && r.id !== copy.resumes[1].id), 'new ids');
    assert.equal(page.box.where, '/', 'the person stays on the Dashboard');
    assert.match(page.text(), /Imported 2 résumés from the saved copy/);
    assert.match(page.text(), /1 entry could not be read and was left out/);
    assert.doesNotMatch(page.text(), /Invalid resume file/);
  } finally { await page.close(); }
});

it('a saved copy with no readable résumé imports nothing and says so', async () => {
  const page = await dashboard();
  try {
    page.pick();
    await page.read(JSON.stringify({ resumes: [{ id: 'x' }, null], activeId: 'x' }));
    assert.equal(page.box.store.appState.resumes.length, 1);
    assert.match(page.text(), /holds no résumé that could be read/);
  } finally { await page.close(); }
});

it('a single résumé\'s file still opens in the editor, with no count', async () => {
  const page = await dashboard();
  try {
    page.pick('wren.json');
    await page.read(JSON.stringify(person('Tove Marlow', 'Cartographer')));
    const made = page.box.store.appState.resumes.find((r) => r.id !== 'resume_a');
    assert.ok(made);
    assert.equal(page.box.where, `/resume/${made.id}`);
    assert.doesNotMatch(page.text(), /from the saved copy/);
  } finally { await page.close(); }
});
