// A page's code after a deploy (the perf2 review, R2-142): the editor and the workspace pages load
// with their routes, from files named by the build. A deploy replaces them, so a tab opened before it
// failed to open the editor, and React.lazy kept the failure: Try Again and Back failed too, only a
// reload helped. loadPage now reloads the tab once on such a failure — never twice in a row, never
// offline, never where session storage cannot remember it did — and clears the mark once a page loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, RELOADED_KEY } from '../../src/utils/lazyPage.js';

/** A session storage, `online`, and a reload that counts. */
function env({ online = true, storage = new Map() } = {}) {
  const e = {
    reloads: 0,
    online,
    reload() { e.reloads += 1; },
    storage: storage && {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: (k) => { storage.delete(k); },
    },
    map: storage,
  };
  return e;
}
const gone = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Editor-old.js'));
const settled = (p) => Promise.race([p.then(() => 'resolved', () => 'rejected'), new Promise((r) => { setTimeout(() => r('pending'), 20); })]);

test('a page loads as React.lazy wants it, and clears the reload mark', async () => {
  const e = env();
  e.map.set(RELOADED_KEY, '1');
  const Editor = () => null;
  const m = await loadPage(async () => ({ Editor }), 'Editor', e);
  assert.equal(m.default, Editor);
  assert.equal(e.map.has(RELOADED_KEY), false, 'the next stale file may reload again');
  assert.equal(e.reloads, 0);
});

test("a page's file gone after a deploy: the tab reloads once, and the route waits for it", async () => {
  const e = env();
  const p = loadPage(gone, 'Editor', e);
  assert.equal(await settled(p), 'pending', 'no error shown while the page reloads');
  assert.equal(e.reloads, 1);
  assert.equal(e.map.get(RELOADED_KEY), '1');
});

test('a second failure in a row shows the error: no reload loop', async () => {
  const e = env();
  e.map.set(RELOADED_KEY, '1');
  await assert.rejects(loadPage(gone, 'Editor', e), /Failed to fetch dynamically imported module/);
  assert.equal(e.reloads, 0);
});

test('offline, or with no session storage, it fails as before: a reload would lose the page or loop', async () => {
  const off = env({ online: false });
  await assert.rejects(loadPage(gone, 'Editor', off), /Failed to fetch/);
  assert.equal(off.reloads, 0);
  const none = env({ storage: null });
  await assert.rejects(loadPage(gone, 'Editor', none), /Failed to fetch/);
  assert.equal(none.reloads, 0);
  const throwing = env();
  throwing.storage.getItem = () => { throw new Error('SecurityError'); };
  await assert.rejects(loadPage(gone, 'Editor', throwing), /Failed to fetch/);
  assert.equal(throwing.reloads, 0);
});

test('AppRoutes loads its lazy pages through loadPage', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/AppRoutes.jsx', import.meta.url), 'utf8');
  assert.match(src, /lazy\(\(\) => loadPage\(load, name\)\)/);
  assert.doesNotMatch(src, /lazy\(\(\) => load\(\)\.then/, 'no page loads around it');
});
