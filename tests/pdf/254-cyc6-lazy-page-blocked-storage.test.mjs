// Storage hunt (cycle 6): a browser that blocks site data (Chrome's "Block all cookies", a sandboxed frame) throws
// SecurityError from the read of `sessionStorage` itself. loadPage read it while building its default environment,
// before any of its try blocks, so every lazy page (the editor, the job tracker, the boards) threw at once and showed
// the crash screen, in a browser the rest of the app is written to work in (it says "not saved" and carries on).
// It reads the storage where it uses it now: the page loads, and a stale file still fails as it did with no storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from '../../src/utils/lazyPage.js';

/** Runs `body` with `globalThis.sessionStorage` throwing what a blocking browser throws, then puts it back. */
async function withBlockedSessionStorage(body) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw Object.assign(new Error("Failed to read the 'sessionStorage' property from 'Window': Access is denied for this document."), { name: 'SecurityError' }); },
  });
  try {
    await body();
  } finally {
    if (had) Object.defineProperty(globalThis, 'sessionStorage', had);
    else delete globalThis.sessionStorage;
  }
}

test('with session storage blocked, a page still loads as React.lazy wants it', async () => {
  await withBlockedSessionStorage(async () => {
    const Editor = () => null;
    const m = await loadPage(async () => ({ Editor }), 'Editor');
    assert.equal(m.default, Editor);
  });
});

test('with session storage blocked, a file gone after a deploy fails as before: no reload, no loop', async () => {
  await withBlockedSessionStorage(async () => {
    const gone = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Editor-old.js'));
    await assert.rejects(loadPage(gone, 'Editor'), /Failed to fetch dynamically imported module/);
  });
});
