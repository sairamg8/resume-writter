// With the browser's site data blocked, reading window.sessionStorage itself throws (SecurityError),
// not only getItem. lazyPage read it while building its default environment, outside any try, so
// loadPage threw before it loaded anything and every lazy route (the editor, the job tracker, the
// boards) showed the crash screen. A page now loads with blocked storage, and a failed load fails
// as before (no reload that could not tell it had happened).
// Run: node --test tests/pdf/290-cyc6-blocked-storage-page-load.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from '../../src/utils/lazyPage.js';

/** Run `fn` with globalThis.sessionStorage a property that throws on read, as in a browser that blocks site data. */
async function blocked(fn) {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new Error('SecurityError: Access is denied for this document'); },
  });
  try { return await fn(); } finally {
    if (was) Object.defineProperty(globalThis, 'sessionStorage', was); else delete globalThis.sessionStorage;
  }
}

it('a page loads when reading session storage throws', async () => {
  const Editor = () => null;
  await blocked(async () => {
    const m = await loadPage(async () => ({ Editor }), 'Editor');
    assert.equal(m.default, Editor);
  });
});

it('a page whose file is gone fails as before when session storage cannot be read: no reload', async () => {
  await blocked(async () => {
    await assert.rejects(
      loadPage(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), 'Editor'),
      /Failed to fetch dynamically imported module/,
    );
  });
});
