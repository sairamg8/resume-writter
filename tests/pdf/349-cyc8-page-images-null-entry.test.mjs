// CYC8-S14: savePicture sorts the saved pictures by each entry's `t`, and an entry of cpwtcv_page_images
// that is null (a hand edit, another build) made `next[b].t` throw a TypeError, so no picture was ever kept
// again on that browser. Now an entry that is not an object is no picture: it is left out when the key is
// read, the other entries are kept, and saving works. The real pageImageStore over an in-memory localStorage.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_page_images';

class MemoryStorage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let store;
before(async () => {
  await setup();
  store = await loadModule('/src/utils/pageImageStore.js');
});
afterEach(() => { delete globalThis.localStorage; store._forgetSavedForTest(); });
after(teardown);

it('a null entry in the saved pictures does not stop a picture being kept; the good entries stay', () => {
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({
    gone: null, text: 'x', num: 3, kept: { h: 'h1', url: 'data:image/png;base64,AAA', t: 5 },
  })]]);
  store._forgetSavedForTest();
  assert.doesNotThrow(() => store.savePicture('fresh', 'h2', 'data:image/png;base64,BBB'));
  const saved = JSON.parse(localStorage.getItem(KEY));
  assert.deepEqual(Object.keys(saved).sort(), ['fresh', 'kept']);
  assert.equal(store.savedPicture('fresh', 'h2'), 'data:image/png;base64,BBB');
  assert.equal(store.savedPicture('kept', 'h1'), 'data:image/png;base64,AAA');
  assert.equal(store.savedPicture('gone', 'h'), null);
});
