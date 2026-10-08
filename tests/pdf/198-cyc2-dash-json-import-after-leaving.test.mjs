// Navigation hunt (cycle 2): Dashboard → Import of a JSON file read after the person has left the Dashboard. A PDF or
// Word read already imported without opening when the Dashboard was gone (R5-HUNT6); the two JSON paths did not: a JSON
// Resume file waits for its reader's code (a lazy chunk, slow on a poor connection) and, when it came, added the résumé
// and called navigate() from the Dashboard that had been left — dragging the person from the Job Tracker they had gone
// to into the editor. Now the résumé is still imported, and nothing opens. A stay on the Dashboard opens it as before.
// The real Dashboard over the real store in a MemoryRouter (tests/pdf/fake-dom.mjs); the FileReader hands its text
// over when the test says.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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
const JSON_RESUME = JSON.stringify({ basics: { name: 'Wren Calloway', label: 'Harbor Pilot', email: 'wren@example.com' }, work: [], education: [] });

async function dashboard() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  const mine = { ...resume({ personal: { name: 'Wren Calloway' } }), id: 'resume_a', name: 'Pilot CV', updatedAt: 1000 };
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [mine], activeId: 'resume_a' })]]);
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { store: null, where: null, away: null };
  function Where() {
    box.where = useLocation().pathname;
    const navigate = useNavigate();
    // Leaving the Dashboard for another page: the address changes and the Dashboard is unmounted with its page.
    box.leave = () => { navigate('/jobs'); box.hide(); };
    return null;
  }
  function Page() {
    box.store = useAppStore();
    const [shown, setShown] = useState(true);
    box.hide = () => setShown(false);
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Where), shown ? createElement(Dashboard, { store: box.store, auth, sync }) : null);
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
    pick: () => view.act(() => reactProps(input).onChange({ target: { files: [{ name: 'wren.json' }], value: '' } })),
    /** The reader hands its text over; what the page does with it is left to run (not awaited). */
    read: (text) => reader.onload({ target: { result: text } }),
    leave: () => view.act(() => box.leave()),
    /** Whatever the page set going after the read has run, and is drawn. */
    flush: async () => { await settle(); view.act(() => {}); await settle(); },
    async close() { Object.assign(globalThis, saved); await view.unmount(); delete globalThis.localStorage; },
  };
}

it('a JSON Resume file whose reader arrives after the Dashboard was left is imported, and opens nothing', async () => {
  const page = await dashboard();
  try {
    page.pick();
    const reading = page.read(JSON_RESUME); // parsed; now waiting for the JSON Resume reader's code
    page.leave();
    assert.equal(page.box.where, '/jobs');
    await reading;
    await page.flush();
    assert.equal(page.box.store.appState.resumes.length, 2, 'the file was imported');
    assert.equal(page.box.where, '/jobs', 'the person is still where they went, not dragged into the editor');
  } finally { await page.close(); }
});

it('a CPWT-CV backup read after the Dashboard was left is imported, and opens nothing', async () => {
  const page = await dashboard();
  try {
    page.pick();
    page.leave();
    const backup = { ...resume({ personal: { name: 'Wren Calloway' } }), name: 'Backup' };
    await page.read(JSON.stringify(backup));
    await page.flush();
    assert.equal(page.box.store.appState.resumes.length, 2, 'the file was imported');
    assert.equal(page.box.where, '/jobs', 'not dragged into the editor');
  } finally { await page.close(); }
});

it('with the Dashboard still open the file opens in the editor, as before', async () => {
  const page = await dashboard();
  try {
    page.pick();
    await page.read(JSON_RESUME);
    await page.flush();
    const made = page.box.store.appState.resumes.find((r) => r.id !== 'resume_a');
    assert.ok(made, 'the file was imported');
    assert.equal(page.box.where, `/resume/${made.id}`);
  } finally { await page.close(); }
});
