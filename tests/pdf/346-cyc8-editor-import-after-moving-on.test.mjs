// CYC8-S11: the editor's Import of a PDF or Word file reads for seconds. When the editor had moved to
// another résumé meanwhile (Back or Forward to another address), the file was still imported but nothing
// opened and nothing was said: a silent success. Now the imported résumé is kept as before and the editor
// still open says so (useEditorExports: the Export menu's message, "imported as a new résumé ... on the
// dashboard"). A read with no move still opens the new résumé. The real store and the real
// useEditorExports, mounted over tests/pdf/fake-dom.mjs; the file's bytes arrive when the test says.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';
import { useState } from 'react';

before(async () => {
  patchFakeDom();
  await setup();
  await loadModule('/src/utils/importFile.js');
});
after(teardown);

const KEY = 'cpwtcv_v1';
const TEXT = 'Wren Calloway\nHarbor Pilot\nwren@example.com\n\nExperience\nHarbor Pilot, Northern Coast Pilots\nJan 2018 - Present\nGuided vessels into port.\n';

async function editor() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
  const a = { ...resume({ personal: { name: 'Wren Calloway' } }), id: 'resume_a', name: 'Pilot CV', updatedAt: 1000 };
  const b = { ...resume({ personal: { name: 'Tove Marlow' } }), id: 'resume_b', name: 'Other CV', updatedAt: 1000 };
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [a, b], activeId: 'resume_a' })]]);
  const went = [];
  const box = { store: null, menu: null, moveOn: null };
  function Page() {
    box.store = useAppStore();
    const [shown, setShown] = useState(a);
    box.moveOn = () => setShown(b);
    box.menu = useEditorExports({
      resume: shown, activeTab: 'resume', authUser: null, importResume: box.store.importResume,
      navigate: (...args) => went.push(args),
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
    moveOn: async () => { view.act(() => box.moveOn()); await settle(); },
    arrive: async () => { arrive(); const id = await pending; await settle(); view.act(() => {}); await settle(); return id; },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('a read that ends after the editor moved to another résumé is imported, opens nothing and says so', async () => {
  const page = await editor();
  try {
    await page.pick();
    await page.moveOn();
    const id = await page.arrive();
    const { resumes } = page.box.store.appState;
    assert.equal(resumes.length, 3, 'the file was imported');
    assert.ok(resumes.some((r) => r.id === id), 'under the id the import answered');
    assert.deepEqual(page.went, [], 'the person is not taken away from the résumé they moved to');
    assert.match(page.box.menu.exportError || '', /wren\.txt was imported as a new résumé.*on the dashboard/);
  } finally { await page.close(); }
});

it('with no move, the import opens the new résumé with its notice, and no message', async () => {
  const page = await editor();
  try {
    await page.pick();
    const id = await page.arrive();
    assert.equal(page.went[0]?.[0], `/resume/${id}`);
    assert.equal(typeof page.went[0]?.[1]?.state?.importNotice, 'string');
    assert.equal(page.box.menu.exportError, null);
  } finally { await page.close(); }
});
