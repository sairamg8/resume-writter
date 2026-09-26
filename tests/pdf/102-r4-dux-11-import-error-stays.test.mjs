// R4-DUX-11: Dashboard → Import's error went on a timer (4 s, 8 s for a document) with no way to
// close it, so the longer ones — a scanned PDF's steps — were gone before they could be read. The
// editor's import errors stay until dismissed. Now the Dashboard's does too: it stays however long
// the user takes, goes with its Dismiss button, and a new import clears it. The real Dashboard is
// mounted with react-dom/client (tests/pdf/fake-dom.mjs); every long timer the page sets is held
// here and run by hand, the way the time running out would.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let Dashboard;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
  // The document reader, loaded now so no loader timer is held with the page's own below.
  await loadModule('/src/utils/importFile.js');
});
after(teardown);

function Page({ store }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync }));
}

const store = () => ({
  appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
  persistError: null,
  recovery: null,
  importResume: () => 'resume_new',
});

/** A FileReader whose read fails (a removed drive, say), or with `never`, one that never ends. */
const readers = (saved, never) => class {
  readAsText() { if (!never.on) saved.setTimeout(() => this.onerror?.({ target: { error: new Error('NotReadableError') } }), 0); }
};

/**
 * The Dashboard mounted, its file input's pick(file), and its long timers (4 s and over) held:
 * `runTimers()` runs every one, as if the user had left the message up that long.
 */
function dashboard() {
  const saved = { FileReader: globalThis.FileReader, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const held = new Map();
  let next = 1e6;
  globalThis.setTimeout = (fn, ms, ...rest) => {
    if (!(ms >= 4000)) return saved.setTimeout(fn, ms, ...rest);
    next += 1;
    held.set(next, fn);
    return next;
  };
  globalThis.clearTimeout = (id) => (held.has(id) ? held.delete(id) : saved.clearTimeout(id));
  const never = { on: false };
  globalThis.FileReader = readers(saved, never);
  const view = mount(Page, { store: store() });
  const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
  assert.ok(input, 'the Import file input');
  return {
    view,
    never,
    text: () => view.container.textContent,
    pick: (file) => view.act(() => reactProps(input).onChange({ target: { files: [file], value: '' } })),
    wait: (ms = 50) => new Promise((resolve) => { saved.setTimeout(resolve, ms); }),
    runTimers: () => view.act(() => { const fns = [...held.values()]; held.clear(); fns.forEach((fn) => fn()); }),
    dismiss: () => {
      const button = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent === 'Dismiss');
      assert.ok(button, 'a Dismiss button on the import error');
      view.act(() => reactProps(button).onClick());
    },
    async done() {
      Object.assign(globalThis, saved);
      await view.unmount();
    },
  };
}

const quietly = async (fn) => {
  const quiet = console.error;
  console.error = () => {};
  try { await fn(); } finally { console.error = quiet; }
};

describe('Dashboard → Import, an error (R4-DUX-11)', () => {
  it('stays however long it is up, and goes with its Dismiss button', async () => {
    const page = dashboard();
    try {
      page.pick({ name: 'resume.json' });
      await page.wait();
      assert.match(page.text(), /could not be read/i);
      page.runTimers();
      assert.match(page.text(), /could not be read/i, 'the error went on a timer, before it could be read');
      page.dismiss();
      assert.doesNotMatch(page.text(), /could not be read/i, 'Dismiss takes it away');
    } finally {
      await page.done();
    }
  });

  it('a document’s error (the long ones: a scanned PDF’s steps) stays too', async () => {
    const page = dashboard();
    try {
      await quietly(async () => {
        page.pick({ name: 'empty.md', arrayBuffer: async () => new TextEncoder().encode('  \n ').buffer });
        for (const end = Date.now() + 20_000; !/No text could be read/.test(page.text()) && Date.now() < end;) await page.wait(10);
      });
      assert.match(page.text(), /No text could be read from that file/);
      page.runTimers();
      assert.match(page.text(), /No text could be read from that file/, 'the document’s error went on a timer');
      page.dismiss();
      assert.doesNotMatch(page.text(), /No text could be read/);
    } finally {
      await page.done();
    }
  });

  it('goes when another import starts: the last one’s error no longer applies', async () => {
    const page = dashboard();
    try {
      page.pick({ name: 'resume.json' });
      await page.wait();
      assert.match(page.text(), /could not be read/i);
      page.never.on = true; // the next read is still going
      page.pick({ name: 'other.json' });
      await page.wait();
      assert.doesNotMatch(page.text(), /could not be read/i, 'the first import’s error still showed over the second');
    } finally {
      await page.done();
    }
  });
});
