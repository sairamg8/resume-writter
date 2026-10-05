// A burst of keystrokes must not make React give up and drop one (R2-142). React 19 counts a commit as
// a "nested update" when the lanes it rendered include a discrete (sync) one and the root still has a
// Sync, InputContinuous or Default update waiting (react-dom's commitRoot); 50 such commits in a row, and
// the next setState throws error #185 ("Maximum update depth exceeded") - from the input's own onChange,
// so that key is lost. Keys that arrive faster than React can render its Default-lane work between them
// (a held key during a stall, dictation, a script: 100 presses at ~9 ms each) did exactly that, from 50
// on. Two effects asked for a state on every keystroke, and asking for the value a state is already being
// set to is an update React cannot skip while the first waits to render: the store's save effect
// (`setSaving(true)`) and the preview's change of `input` (`setStatus('rendering')`). Each now asks only
// for a change.
// The commits here are flushSync's, as a discrete event's are, in a loop that never yields (react-dom/client
// over tests/pdf/fake-dom.mjs): React's Default-lane work cannot run between them, as in the browser.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { setupPreview, teardownPreview, versions, opened, settle, wait } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

const KEYS = 80; // past React's limit of 50 nested updates
const GAVE_UP = 'React gave up on the burst: error #185, and the key that threw is lost';

describe('a burst of keystrokes with no time to render between them (R2-142)', () => {
  it('the preview: 80 changes of its input, each a sync commit, throw nothing', async () => {
    const [v0, ...typed] = versions(KEYS + 1);
    const p = await opened(v0);
    try {
      assert.doesNotThrow(() => {
        for (const v of typed) p.set({ render: p.build, input: v });
      }, GAVE_UP);
      await settle(); // React renders what the burst left waiting
      assert.equal(p.status(), 'rendering', 'the last change is waiting for its pause');
    } finally { await p.view.unmount(); }
  });

  it('the résumé store: 80 edits of Full Name, each a sync commit, throw nothing; the save indicator still follows', async () => {
    const KEY = 'cpwtcv_v1';
    class MemoryStorage {
      constructor(entries) { this.map = new Map(entries); }
      get length() { return this.map.size; }
      key(i) { return [...this.map.keys()][i] ?? null; }
      getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
      setItem(k, v) { this.map.set(k, String(v)); }
      removeItem(k) { this.map.delete(k); }
    }
    const cv = {
      id: 'resume_a', name: 'resume_a', template: 'classic', dataVersion: 11, updatedAt: 1, sections: [],
      settings: { accentColor: '#1a7f5a', fontSizeBase: 11, sidebarSingleColumn: false },
      personal: { name: 'Casey', title: 'Staff Engineer' },
      coverLetter: { recipientName: 'Morgan Blake', body: '<p>Dear Morgan,</p>' },
    };
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    const storage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [cv], activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {} })]]);
    globalThis.localStorage = storage;
    let current = null;
    function Probe() { current = useAppStore(); return null; }
    const view = mount(() => createElement(Probe));
    try {
      await wait(400); // past the load's own save: what is held from here on is the burst's
      view.act(() => {});
      assert.doesNotThrow(() => {
        for (let i = 1; i <= KEYS; i += 1) view.act(() => current.updatePersonal('name', 'K'.repeat(i)));
      }, GAVE_UP);
      assert.equal(current.activeResume.personal.name, 'K'.repeat(KEYS), 'every key arrived');
      await settle(); // React renders what the burst left waiting
      view.act(() => {});
      assert.equal(current.saving, true, 'the change is held for its coalesced write');
      await wait(700); // past SAVE_WAIT_MS (300 ms): the write happens
      view.act(() => {});
      assert.equal(current.saving, false, 'written: the indicator went back');
      assert.equal(JSON.parse(storage.getItem(KEY)).resumes[0].personal.name, 'K'.repeat(KEYS), 'and storage holds the last key');
    } finally {
      await view.unmount();
      delete globalThis.localStorage;
    }
  });
});
