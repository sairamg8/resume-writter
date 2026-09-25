// Page pictures (R2-139). C1: a dashboard card showed a drawn mock page, the same shape for every résumé
// on a template; it now shows the résumé's own page 1, painted once and kept in a key of its own — never
// in the store, never synced — until the résumé prints differently. That key is a cache: a full storage
// drops it first, and a store write drops the pictures of résumés the browser no longer holds (an account
// signed out takes its list away, R2-005). A1 and F1: each picker card has a picture of its page and the
// panel shows the letterhead the cover letter takes; the real painting is a browser's (Playwright,
// tests/playwright/picker.spec.mjs) — here, what is kept, what is shown, and when a picture is stale.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_page_images';
const noop = () => {};

/** A localStorage stand-in; `quota` bytes, past which a write throws as a full storage does. */
class MemoryStorage {
  constructor(entries = [], quota = Infinity) { this.map = new Map(entries); this.quota = quota; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const size = [...this.map].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0) + k.length + String(v).length;
    if (size > this.quota) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

async function pictures(storage) {
  const m = await loadModule('/src/utils/pageImageStore.js');
  globalThis.localStorage = storage;
  m._forgetSavedForTest();
  return m;
}

describe('a résumé\'s dashboard picture (C1)', () => {
  after(() => { delete globalThis.localStorage; });

  it('is stale once what the résumé prints changes — its content, design or letter — and not when only its time does', async () => {
    const { printHash } = await pictures(new MemoryStorage());
    const r = resume({ personal: { name: 'Robin Sample' } });
    const h = printHash(r);
    assert.equal(printHash(JSON.parse(JSON.stringify(r))), h, 'a copy');
    assert.equal(printHash({ ...r, updatedAt: r.updatedAt + 5000 }), h, 'only saved again');
    assert.notEqual(printHash({ ...r, personal: { ...r.personal, name: 'Robin Q. Sample' } }), h);
    assert.notEqual(printHash({ ...r, settings: { ...r.settings, accentColor: '#9f1239' } }), h);
    assert.notEqual(printHash({ ...r, template: 'modern' }), h);
    assert.notEqual(printHash({ ...r, coverLetter: { ...r.coverLetter, body: 'Dear team' } }), h);
  });

  it('kept under its own key, for the print it was painted at; at most 24, the least recent going first', async () => {
    const storage = new MemoryStorage();
    const { savePicture, savedPicture } = await pictures(storage);
    savePicture('r1', 'h1', 'data:image/jpeg;base64,AAA');
    assert.equal(savedPicture('r1', 'h1'), 'data:image/jpeg;base64,AAA');
    assert.equal(savedPicture('r1', 'h2'), null, 'printed differently since');
    assert.ok(storage.getItem(KEY), 'its own key');
    assert.equal(storage.getItem('cpwtcv_v1'), null, 'not the store');
    for (let i = 0; i < 30; i += 1) savePicture(`x${i}`, 'h', `data:${i}`);
    assert.equal(Object.keys(JSON.parse(storage.getItem(KEY))).length, 24);
    assert.equal(savedPicture('x29', 'h'), 'data:29');
    assert.equal(savedPicture('r1', 'h1'), null, 'the oldest went');
  });

  it('a full storage drops the pictures before it refuses the résumés, and before any backup', async () => {
    const storage = new MemoryStorage([], 4000);
    const { savePicture } = await pictures(storage);
    const { setItemWithRoom } = await loadModule('/src/utils/storageBackup.js');
    storage.setItem('cpwtcv_v1_backup_1', 'b'.repeat(500));
    savePicture('r1', 'h', `data:${'x'.repeat(2400)}`);
    assert.ok(storage.getItem(KEY));
    setItemWithRoom('cpwtcv_v1', 's'.repeat(2000));
    assert.equal(storage.getItem('cpwtcv_v1').length, 2000, 'the résumés are written');
    assert.equal(storage.getItem(KEY), null, 'the pictures made room');
    assert.ok(storage.getItem('cpwtcv_v1_backup_1'), 'the backup is kept');
    // The next picture painted is saved alone: the ones dropped are not written back with it.
    savePicture('r2', 'h', 'data:r2');
    assert.deepEqual(Object.keys(JSON.parse(storage.getItem(KEY))), ['r2']);
  });

  it('a picture saved, or a prune, after another tab pruned the pictures never writes back the ones it pruned', async () => {
    const storage = new MemoryStorage();
    const { savePicture, keepPageImagesOf } = await pictures(storage);
    savePicture('resume_a', 'h', 'data:a');
    savePicture('resume_gone', 'h', 'data:gone');
    // Another tab's store write: its account signed out, and only resume_a's picture is left.
    storage.setItem(KEY, JSON.stringify({ resume_a: JSON.parse(storage.getItem(KEY)).resume_a }));
    savePicture('resume_b', 'h', 'data:b');
    assert.equal(JSON.parse(storage.getItem(KEY)).resume_gone, undefined, 'saving a picture');
    // A full storage dropped every picture since; this tab's own prune must not write them back.
    storage.removeItem(KEY);
    keepPageImagesOf([{ id: 'resume_a' }]);
    assert.equal(storage.getItem(KEY), null, 'pruning');
  });

  it('the store\'s writes keep only the pictures of the résumés it holds', async () => {
    const cv = { id: 'resume_a', name: 'A', template: 'classic', dataVersion: 11, updatedAt: 1, settings: {}, sections: [], personal: { name: '' }, coverLetter: {} };
    const storage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [cv], activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null })]]);
    const { savePicture, savedPicture } = await pictures(storage);
    savePicture('resume_a', 'h', 'data:a');
    savePicture('resume_gone', 'h', 'data:gone'); // another account's, signed out
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    let current = null;
    function Probe() { current = useAppStore(); return null; }
    const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
    try {
      for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
      view.act(() => current.renameResume('resume_a', 'A2'));
      for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
      await new Promise((r) => { setTimeout(r, 700); });
      view.act(() => {});
      assert.equal(JSON.parse(storage.getItem('cpwtcv_v1')).resumes[0].name, 'A2', 'the store wrote');
      assert.equal(savedPicture('resume_gone', 'h'), null, 'the picture of a résumé it does not hold went');
      assert.equal(JSON.parse(storage.getItem(KEY)).resume_gone, undefined);
      assert.equal(savedPicture('resume_a', 'h'), 'data:a');
    } finally { await view.unmount(); }
  });

  it('the card shows the kept picture while it is current, else the drawn page', async () => {
    const { savePicture, printHash } = await pictures(new MemoryStorage());
    const { ResumeCard } = await loadModule('/src/components/ResumeCard.jsx');
    const r = { ...resume({ template: 'modern', personal: { name: 'Robin Sample' } }), id: 'r1', name: 'Mine' };
    const card = (x) => renderToString(createElement(ResumeCard, { resume: x, onOpen: noop, onDuplicate: noop, onDelete: noop, onRename: noop }));
    assert.doesNotMatch(card(r), /data-page-image/);
    assert.match(card(r), /data-thumb="modern"/);
    savePicture('r1', printHash(r), 'data:image/jpeg;base64,PAGE');
    assert.match(card(r), /<img data-page-image="" src="data:image\/jpeg;base64,PAGE"/);
    const edited = { ...r, personal: { name: 'Robin Q. Sample' } };
    assert.doesNotMatch(card(edited), /data-page-image/, 'edited since: the drawn page until it is painted again');
  });
});

describe('the picker\'s pictures (A1) and the letterhead (F1)', () => {
  it('every card carries a picture of its page in its own look; the panel shows the letterhead of the look it is on', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const html = renderToString(createElement(DesignPanel, { resume: resume({ template: 'banner' }), updateSetting: noop, setTemplate: noop, resetSettings: noop }));
    const cardHtml = (id) => html.split(`data-testid="${id}"`)[1].split('</button>')[0];
    for (const id of ['classic', 'modern', 'sidebar', 'timeline', 'banner']) {
      assert.match(cardHtml(`template-${id}`), new RegExp(`data-look-thumb="page".*data-thumb="${id}"`), id);
    }
    assert.match(cardHtml('template-sidebar-single'), /data-thumb="classic"/, 'the single column prints Classic\'s page');
    assert.match(cardHtml('preset-midnight'), /background-color:#0f172a/, 'a design\'s picture takes its own accent');
    assert.match(html, /data-look-thumb="letter"[^>]*>.*?data-thumb="letter"/, 'the letterhead beside "The cover letter\'s header takes the template\'s look"');
  });
});
