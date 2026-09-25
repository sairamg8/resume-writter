// A value set to what it holds already is not an edit (R2-142). The store's updateSetting,
// updatePersonal, updateCoverLetter, clearSettings and setActiveId made a new résumé (or store) for
// it anyway — an option clicked again, a colour picker or number box handing back the value it
// shows: a new updatedAt, a write of the whole store, a full preview build (PdfPreview builds on a
// new `input`) and a cloud sync, all for nothing. Now each hands back the résumé it had: the same
// object, so nothing is written, built or synced; a value that does change is an edit as before.
// The real useAppStore under StrictMode, effects included (react-dom/client over tests/pdf/fake-dom.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** A localStorage stand-in; `saves` counts the writes of the résumé store. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); this.saves = 0; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (k === KEY) this.saves += 1; this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const cv = (id) => ({
  id, name: id, template: 'classic', dataVersion: 11, updatedAt: 1, sections: [],
  settings: { accentColor: '#1a7f5a', fontSizeBase: 11, sidebarSingleColumn: false },
  personal: { name: 'Casey Example', title: 'Staff Engineer' },
  coverLetter: { recipientName: 'Morgan Blake', body: '<p>Dear Morgan,</p>' },
});

async function openStore() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [cv('resume_a'), cv('resume_b')], activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null })]]);
  globalThis.localStorage = storage;
  let current = null;
  function Probe() { current = useAppStore(); return null; }
  const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  await wait(400); // past the load's own save: any write from here on is one a change asked for
  await settle();
  return {
    view, storage, settle,
    store: () => current,
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('a value set to what it holds already is not an edit (R2-142)', () => {
  it('Design, Personal Info and Cover Letter values set again, the open résumé opened again: the same store, no write', async () => {
    const s = await openStore();
    try {
      const state = s.store().appState;
      const r = s.store().activeResume;
      const saves = s.storage.saves;
      const again = [
        ['updateSetting accentColor', (st) => st.updateSetting('accentColor', r.settings.accentColor)],
        ['updateSetting fontSizeBase', (st) => st.updateSetting('fontSizeBase', r.settings.fontSizeBase)],
        ['updateSetting sidebarSingleColumn', (st) => st.updateSetting('sidebarSingleColumn', r.settings.sidebarSingleColumn)],
        ['updatePersonal name', (st) => st.updatePersonal('name', r.personal.name)],
        ['updatePersonal title', (st) => st.updatePersonal('title', r.personal.title)],
        ['updateCoverLetter recipientName', (st) => st.updateCoverLetter('recipientName', r.coverLetter.recipientName)],
        ['updateCoverLetter body', (st) => st.updateCoverLetter('body', r.coverLetter.body)],
        ['clearSettings of keys it does not hold', (st) => st.clearSettings(['nameTitleGap', 'headerInlineGap'])],
        ['setActiveId of the open résumé', (st) => st.setActiveId(r.id)],
      ];
      const edits = [];
      for (const [label, call] of again) {
        s.view.act(() => call(s.store()));
        if (s.store().appState !== state) edits.push(label);
      }
      assert.deepEqual(edits, [], 'before: each made a new store, a new updatedAt');
      assert.equal(s.store().activeResume, r, 'the same résumé: the preview, handed the same input, builds nothing');
      assert.equal(s.store().activeResume.updatedAt, r.updatedAt);
      await wait(400);
      await s.settle();
      assert.equal(s.storage.saves, saves, `${s.storage.saves - saves} whole-store writes for nothing`);
    } finally { await s.close(); }
  });

  it('a value that does change is an edit, as before: a new résumé, a new updatedAt, written', async () => {
    const s = await openStore();
    try {
      const r = s.store().activeResume;
      s.view.act(() => s.store().updateSetting('accentColor', '#b4235a'));
      s.view.act(() => s.store().updatePersonal('name', 'Casey Q. Example'));
      s.view.act(() => s.store().updateCoverLetter('recipientName', 'Riley Chen'));
      s.view.act(() => s.store().clearSettings(['fontSizeBase']));
      s.view.act(() => s.store().setActiveId('resume_b'));
      await wait(400);
      await s.settle();
      const edited = s.store().appState.resumes.find((x) => x.id === r.id);
      assert.notEqual(edited, r);
      assert.ok(edited.updatedAt > r.updatedAt, 'stamped as an edit');
      assert.deepEqual(
        [edited.settings.accentColor, 'fontSizeBase' in edited.settings, edited.personal.name, edited.coverLetter.recipientName, s.store().appState.activeId],
        ['#b4235a', false, 'Casey Q. Example', 'Riley Chen', 'resume_b'],
      );
      const saved = JSON.parse(s.storage.getItem(KEY));
      assert.deepEqual([saved.activeId, saved.resumes.find((x) => x.id === r.id).personal.name], ['resume_b', 'Casey Q. Example'], 'written');
    } finally { await s.close(); }
  });
});
