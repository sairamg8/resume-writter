// The cloud sync in the page, as the app runs it (V2VF1S-3): the other sync tests pass `hidden`
// and call sync.shown() themselves, so nothing failed when the page's side was taken away — the
// tab's hidden flag, the visibilitychange listener that runs a retry which came due while the tab
// was hidden, the online/offline listeners. Here src/utils/cloudSyncBrowser.js runs over a fake
// page (tests/pdf/fake-dom.mjs), a fake Firestore and timers fired by hand, and the real
// useCloudSync is mounted with react-dom/client to show it watches the page it runs in.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, fakeStore, manualTimers, recorder, syncModules, resumePath, settle } from './fake-firestore.mjs';
import { fakeWindow, mount } from './fake-dom.mjs';

// No Firebase in this test's build, whatever .env holds: useCloudSync's module then has no
// Firestore (a clone without the config), so mounting it never reaches a real project. Read when
// setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

let mods;
let browser;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  browser = await loadModule('/src/utils/cloudSyncBrowser.js');
});
after(teardown);

const cv = (id, updatedAt = 1) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, template: 'classic' });
const USER = { uid: 'u', email: 'someone@example.com' };
const unavailable = () => Object.assign(new Error('unavailable: refused'), { code: 'unavailable' });
const SECOND = 1000;

/** The page's event, as the browser fires it once it has set navigator.onLine or document.hidden. */
const fire = (target, type) => target.dispatchEvent(new Event(type));

/**
 * `win` running browserCloudSync over `cloud`, as useCloudSync sets it up, and watching: the sync,
 * what it reports (`seen`), its timers, and the online flags `watch` passed on (`onlines`).
 */
function pageSync(win, cloud) {
  const store = fakeStore({ resumes: [] }, mods);
  const timers = manualTimers();
  const { seen, report } = recorder();
  const { sync, watch } = browser.browserCloudSync(win, {
    io: mods.io.cloudIo(cloud.fs, cloud.db),
    store: mods.actions.liveStore(() => ({ appState: store.state, store })),
    report,
    timers,
  });
  const onlines = [];
  const unwatch = watch((v) => onlines.push(v));
  return { sync, seen, timers, onlines, unwatch };
}

describe('a retry that came due while the tab was hidden (browserCloudSync)', () => {
  it('is not tried while the page says the tab is hidden, and runs as soon as the page shows it', async () => {
    const win = fakeWindow();
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = pageSync(win, cloud);
    cloud.fail.read = unavailable();
    p.sync.start(USER);
    await settle();
    assert.deepEqual([p.seen.status, p.timers.delays], ['error', [30 * SECOND]]);

    win.document.hidden = true;
    fire(win.document, 'visibilitychange');
    const reads = cloud.reads.length;
    await p.timers.fire();
    await p.timers.fire();
    assert.equal(cloud.reads.length, reads, 'without the page\'s hidden flag: the account read again while nobody looked');
    cloud.fail.read = null;

    fire(win.document, 'visibilitychange'); // still hidden (another hide event): nothing runs
    await settle();
    assert.deepEqual([cloud.reads.length, p.seen.status], [reads, 'error']);

    win.document.hidden = false;
    fire(win.document, 'visibilitychange');
    await settle();
    assert.equal(p.seen.status, 'synced', 'without the visibilitychange listener: "Sync error — will retry" until an online/offline change or a reload');
    assert.equal(cloud.reads.length > reads, true);
  });

  it('shown again with no retry due: nothing is read', async () => {
    const win = fakeWindow();
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = pageSync(win, cloud);
    p.sync.start(USER);
    await settle();
    const reads = cloud.reads.length;
    win.document.hidden = true;
    fire(win.document, 'visibilitychange');
    win.document.hidden = false;
    fire(win.document, 'visibilitychange');
    await settle();
    assert.deepEqual([p.seen.status, cloud.reads.length], ['synced', reads]);
  });
});

describe('the page going offline and online (browserCloudSync)', () => {
  it('reaches the online flag useCloudSync restarts the sync on, and the sync reads the page\'s own navigator.onLine', async () => {
    const win = fakeWindow();
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = pageSync(win, cloud);
    win.navigator.onLine = false;
    fire(win, 'offline');
    assert.deepEqual(p.onlines, [false]);
    p.sync.start(USER); // useCloudSync's effect on the new flag
    await settle();
    assert.deepEqual([p.seen.status, cloud.reads.length], ['offline', 0], 'the page is offline: nothing is read');
    win.navigator.onLine = true;
    fire(win, 'online');
    assert.deepEqual(p.onlines, [false, true]);
    p.sync.start(USER);
    await settle();
    assert.equal(p.seen.status, 'synced');
  });

  it('unwatch: the page\'s events reach nothing any more, and no listener is left on it', async () => {
    const win = fakeWindow();
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = pageSync(win, cloud);
    assert.deepEqual([win.listeners('online'), win.listeners('offline'), win.document.listeners('visibilitychange')], [1, 1, 1]);
    cloud.fail.read = unavailable();
    p.sync.start(USER);
    await settle();
    win.document.hidden = true;
    await p.timers.fire(); // the retry comes due while hidden
    cloud.fail.read = null;
    p.unwatch();
    assert.deepEqual([win.listeners('online'), win.listeners('offline'), win.document.listeners('visibilitychange')], [0, 0, 0]);
    win.document.hidden = false;
    fire(win.document, 'visibilitychange');
    fire(win, 'offline');
    await settle();
    assert.deepEqual([p.seen.status, p.onlines], ['error', []]);
  });
});

describe('useCloudSync watches the page it runs in', () => {
  /** The hook's result after each render, in a component that shows nothing. */
  async function mountHook() {
    const { useCloudSync } = await loadModule('/src/hooks/useCloudSync.js');
    const out = { current: null };
    const store = { appState: { resumes: [cv('resume_a')], deletedIds: [] } };
    function Probe({ user }) {
      out.current = useCloudSync({ user, appState: store.appState, store });
      return null;
    }
    return { view: mount(Probe, { user: USER }), out };
  }

  it('online and offline reach isOnline while mounted; the tab\'s visibilitychange is listened to; none is left once unmounted', async () => {
    const { view, out } = await mountHook();
    const { window, document } = view;
    try {
      await settle(); // the render the sync's first report asked for
      assert.deepEqual([out.current.isOnline, out.current.syncStatus], [true, 'off'], 'this build has no cloud');
      assert.equal(document.listeners('visibilitychange'), 1, 'before: a retry due while the tab was hidden never ran when it was shown');
      window.navigator.onLine = false;
      view.act(() => fire(window, 'offline'));
      assert.equal(out.current.isOnline, false, 'the page went offline');
      window.navigator.onLine = true;
      view.act(() => fire(window, 'online'));
      assert.equal(out.current.isOnline, true);
    } finally { await view.unmount(); }
    assert.deepEqual([window.listeners('online'), window.listeners('offline'), document.listeners('visibilitychange')], [0, 0, 0]);
  });

  it('a page already offline when the hook mounts: isOnline starts false, from the page', async () => {
    const { useCloudSync } = await loadModule('/src/hooks/useCloudSync.js');
    const store = { appState: { resumes: [], deletedIds: [] } };
    const firsts = [];
    function Probe() {
      const sync = useCloudSync({ user: null, appState: store.appState, store });
      firsts.push(sync.isOnline);
      return null;
    }
    // Nothing mounted yet: the page goes offline, then the hook mounts in it.
    const view = mount(({ on }) => (on ? createElement(Probe) : null), { on: false });
    try {
      view.window.navigator.onLine = false;
      view.update({ on: true });
      assert.equal(firsts[0], false);
    } finally { await view.unmount(); }
  });
});
