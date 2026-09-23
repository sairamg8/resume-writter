// The sync with the timers the app gives it — none: useCloudSync passes no `timers`, so the engine
// falls back to its default. In a browser, setTimeout and clearTimeout throw "Illegal invocation"
// when they are called as a method of any object other than the window, and node's do not, so the
// other sync tests (which all pass fake timers) could never see it: the live site went blank on
// load, in useCloudSync's start(). Here the global timers are made to check their `this` as a
// browser does, for the length of each test.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, template: 'classic', ...extra });
const USER = { uid: 'u', email: 'someone@example.com' };
const failure = (code) => Object.assign(new Error(`${code}: refused`), { code });

/** setTimeout/clearTimeout that refuse any `this` but the global object, as a browser's do; returns the undo. */
function browserTimers() {
  const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  for (const name of Object.keys(real)) {
    globalThis[name] = function checked(...args) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return real[name].apply(globalThis, args);
    };
  }
  return () => Object.assign(globalThis, real);
}

describe('the sync with the browser\'s own timers (useCloudSync passes none)', () => {
  it('starts on page load, signed out, without an "Illegal invocation"', () => {
    const undo = browserTimers();
    try {
      const p = syncPage(mods, fakeFirestore({}), { resumes: [] }, { ownTimers: true });
      assert.doesNotThrow(() => p.sync.start(null), 'before: TypeError: Illegal invocation — the page went blank');
      p.sync.cancel();
    } finally { undo(); }
  });

  it('signs in, schedules and clears a retry, queues an edit and signs out — every timer call works', async () => {
    const undo = browserTimers();
    try {
      const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
      const p = syncPage(mods, cloud, { resumes: [] }, { ownTimers: true });
      cloud.fail.read = failure('unavailable');
      p.sync.start(USER);
      await settle();
      assert.equal(p.seen.status, 'error', 'the failed first sync schedules its retry (setTimeout)');
      cloud.fail.read = null;
      p.sync.start(USER); // e.g. back online: clears that retry (clearTimeout)
      await settle();
      assert.equal(p.seen.status, 'synced');
      await p.change({ resumes: p.store.state.resumes.map((r) => ({ ...r, name: 'Renamed', updatedAt: 5 })) });
      assert.equal(p.seen.status, 'syncing', 'the edit queued its flush (setTimeout) without throwing');
      p.sync.cancel(); // clears the flush (clearTimeout)
      p.sync.start(null);
    } finally { undo(); }
  });
});
