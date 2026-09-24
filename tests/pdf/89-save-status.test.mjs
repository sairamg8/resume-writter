// The editor's "Saved just now" under the preview (SaveStatus) was stamped whenever the résumé
// changed, which was right while every change was written at once. Since saves are coalesced
// (R2-077) a keystroke's write can wait up to 2 s, and the label said "Saved" before storage held
// the change. Now the store says when a save is held (`saving`) and when the last write landed
// (`savedAt`): the label reads "Saving…" while one waits and "Saved …" only once it is written.
// The real useAppStore and SaveStatus under StrictMode (react-dom/client over tests/pdf/fake-dom.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const cv = { id: 'resume_a', name: 'A', template: 'classic', dataVersion: 11, updatedAt: 1, settings: {}, sections: [], personal: { name: '' }, coverLetter: {} };

async function open() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { SaveStatus } = await loadModule('/src/components/EditorPreviewPane.jsx');
  const map = new Map([[KEY, JSON.stringify({ resumes: [cv], activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null })]]);
  globalThis.localStorage = {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
  let store = null;
  function Page() {
    store = useAppStore();
    return createElement(SaveStatus, { resume: store.activeResume, persistError: store.persistError, saving: store.saving, savedAt: store.savedAt });
  }
  const view = mount(() => createElement(StrictMode, null, createElement(Page)));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  return {
    view, settle,
    text: () => view.container.textContent,
    storedName: () => JSON.parse(map.get(KEY)).resumes[0].personal.name,
    async type(text) {
      for (let i = 1; i <= text.length; i += 1) view.act(() => store.updatePersonal('name', text.slice(0, i)));
      await settle();
    },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('the editor’s save status (R2-077 follow-up)', () => {
  it('reads "Saving…" while a keystroke’s write waits, and "Saved" once storage holds it', async () => {
    const s = await open();
    try {
      await wait(400);
      await s.type('Sam Example');
      assert.notEqual(s.storedName(), 'Sam Example', 'the write is still held');
      assert.equal(s.text(), 'Saving…', `before: "${s.text()}" while storage did not hold the change`);
      await wait(700);
      await s.settle();
      assert.equal(s.storedName(), 'Sam Example');
      assert.equal(s.text(), 'Saved Just now');
    } finally { await s.close(); }
  });

  it('a write storage refuses still reads "Not saved"', async () => {
    const s = await open();
    try {
      localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
      await wait(400);
      await s.type('X');
      assert.equal(s.text(), 'Not saved');
    } finally { await s.close(); }
  });
});
