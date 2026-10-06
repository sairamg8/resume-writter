// UI rebuild B1 (start-up headroom): the start-up path had about 0 kB to spare (71-startup-chunks), and
// every later batch adds bars and pages to it. The Dashboard imported two pieces it only shows on demand:
// New Cover's picker (NewLetterModal and the kit's Dialog with its focus trap, placement, scroll lock,
// presence and portal) and the Career History panel (with careerHistory.js). Both load apart from the
// start-up path now, each in its own boundary (Dashboard.jsx, Lazy), and are fetched ahead of use, once:
// in idle time after the first paint, and when New Cover or the Career History sidebar is hovered or
// focused. The start-up path is walked from the source (startup-modules.mjs); the lazy boundaries are
// checked on the real Dashboard over tests/pdf/fake-dom.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage } from './resume-tab.mjs';
import { startupModules } from './startup-modules.mjs';

before(async () => {
  patchFakeDom(); // the picker is the kit's Dialog: a focus trap
  await setup();
});
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
/** Waits (real time: a module is loaded through Vite) until `check()` holds. */
async function until(check, what) {
  for (let i = 0; i < 500; i += 1) {
    if (check()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  assert.fail(`never: ${what}`);
}

describe('the picker and Career History are off the start-up path', () => {
  const OFF = [
    'src/components/NewLetterModal.jsx', 'src/components/CareerHistoryPanel.jsx', 'src/utils/careerHistory.js',
    'src/components/ui/Dialog.jsx', 'src/components/ui/useFocusTrap.js', 'src/components/ui/placement.js',
    'src/components/ui/useScrollLock.js', 'src/components/ui/usePresence.js', 'src/components/ui/Portal.jsx',
  ];
  it('the Dashboard is on it; the picker, the panel and the Dialog\'s closure are not (no other start-up module imports them)', () => {
    const startup = startupModules();
    assert.ok(startup.has('src/pages/Dashboard.jsx'), 'the Dashboard is on the start-up path');
    assert.deepEqual(OFF.filter((m) => startup.has(m)), [], 'reached by a static import from the start-up path');
  });
});

/** The Dashboard over `resumes`, `createLetter` the store's; the pieces' import()s counted in `calls`. */
async function dashboard(resumes, createLetter = () => 'letter_new') {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  // Both pieces loaded once here, so what the tests wait for is React's boundary, not Vite's first transform.
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  const { loaders, warmed } = _lazyForTest;
  const real = { ...loaders };
  const calls = { letter: 0, career: 0 };
  warmed.clear();
  for (const key of Object.keys(real)) loaders[key] = () => { calls[key] += 1; return real[key](); };
  globalThis.localStorage = new MemoryStorage([]);
  const noop = () => {};
  const store = {
    appState: { resumes, activeId: resumes[0]?.id }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop, createLetter,
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  // The Career History sidebar is on screen from the first render, so its own boundary asks for its code at
  // once (React.lazy); only the prefetch's fetches are counted below, so that first ask is set aside.
  calls.career = 0;
  const all = () => [...elements(view.document.body)];
  let unmounted = false;
  return {
    view, calls, all,
    /** Unmounts now, keeping the counting loaders: close() then skips the unmount. */
    async unmountNow() { unmounted = true; await view.unmount(); },
    button: (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label),
    sidebar: () => all().find((el) => tokens(el).includes('lg:sticky')),
    dialog: () => all().find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed'),
    async close() {
      if (!unmounted) await view.unmount();
      Object.assign(loaders, real);
      delete globalThis.localStorage;
    },
  };
}

const cv = (id, name, updatedAt) => ({ ...resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), id, name, updatedAt });
const two = () => [cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)];

describe('the pieces open through their lazy boundaries', () => {
  it('Career History appears in the sidebar once its code has loaded, and New Cover opens the picker', async () => {
    const page = await dashboard(two());
    try {
      await until(() => page.all().some((el) => el.tagName === 'BUTTON' && text(el) === 'Open Job Tracker →'), 'the Career History panel');
      assert.ok(text(page.sidebar()).includes('Career History'), 'under its heading');
      assert.equal(page.dialog(), undefined, 'the picker is not opened (nor asked for) before New Cover');
      page.view.act(() => reactProps(page.button('New Cover')).onClick({}));
      await until(() => page.dialog(), 'the picker');
      assert.ok(text(page.dialog()).includes('New Cover Letter'));
      const choices = page.all().filter((el) => el.tagName === 'BUTTON' && /^(Newest CV|Older CV|Blank letter)/.test(text(el)));
      assert.equal(choices.length, 3, choices.map(text).join(' | '));
    } finally { await page.close(); }
  });
});

describe('the prefetch', () => {
  it('nothing is fetched at mount; hovering or focusing New Cover fetches the picker once, the sidebar the panel once', async () => {
    const page = await dashboard(two());
    try {
      assert.deepEqual(page.calls, { letter: 0, career: 0 }, 'nothing at first paint (idle time comes later)');
      const card = page.all().find((el) => el.tagName === 'BUTTON' && text(el) === 'New Cover Letter');
      const buttons = [page.button('New Cover'), card];
      for (const el of buttons) {
        page.view.act(() => reactProps(el).onMouseEnter({}));
        page.view.act(() => reactProps(el).onFocus({}));
      }
      assert.equal(page.calls.letter, 1, 'hover and focus on both buttons: one fetch');
      assert.equal(page.calls.career, 0, 'the other piece is not fetched by them');
      const sidebar = page.sidebar();
      for (let i = 0; i < 3; i += 1) {
        page.view.act(() => reactProps(sidebar).onMouseEnter({}));
        page.view.act(() => reactProps(sidebar).onFocus({}));
      }
      assert.deepEqual(page.calls, { letter: 1, career: 1 }, 'once each');
    } finally { await page.close(); }
  });

  it('after the first paint, in idle time, both are fetched, once; a timer stands in where there is no requestIdleCallback', async () => {
    const saved = { idle: globalThis.requestIdleCallback, cancel: globalThis.cancelIdleCallback };
    const queued = [];
    globalThis.requestIdleCallback = (fn) => queued.push(fn);
    globalThis.cancelIdleCallback = () => {};
    const page = await dashboard(two());
    try {
      assert.equal(queued.length, 1, 'one idle callback asked for');
      assert.deepEqual(page.calls, { letter: 0, career: 0 }, 'not before the browser is idle');
      queued[0]();
      assert.deepEqual(page.calls, { letter: 1, career: 1 }, 'both, when it is');
      page.view.act(() => reactProps(page.button('New Cover')).onMouseEnter({}));
      assert.deepEqual(page.calls, { letter: 1, career: 1 }, 'a hover after it adds none');
    } finally {
      await page.close();
      for (const [key, value] of [['requestIdleCallback', saved.idle], ['cancelIdleCallback', saved.cancel]]) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
    // No requestIdleCallback: setTimeout (cancelled with the page).
    const timers = [];
    const realSet = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...rest) => (ms === 1500 ? timers.push(fn) : realSet(fn, ms, ...rest));
    const plain = await dashboard(two());
    try {
      assert.equal(timers.length, 1, 'a timer where there is no idle callback');
      timers[0]();
      assert.deepEqual(plain.calls, { letter: 1, career: 1 });
    } finally {
      globalThis.setTimeout = realSet;
      await plain.close();
    }
  });

  it('leaving the page before idle cancels the pending callback or timer (the one asked for), and a late run fetches nothing', async () => {
    const saved = {
      idle: globalThis.requestIdleCallback, cancel: globalThis.cancelIdleCallback,
      set: globalThis.setTimeout, clear: globalThis.clearTimeout,
    };
    const restore = () => {
      for (const [key, value] of [['requestIdleCallback', saved.idle], ['cancelIdleCallback', saved.cancel]]) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
      globalThis.setTimeout = saved.set;
      globalThis.clearTimeout = saved.clear;
    };
    const asked = { fns: [], ids: [], cancelled: [], cleared: [] };
    // requestIdleCallback branch: the id it hands out is the one cancelIdleCallback gets.
    globalThis.requestIdleCallback = (fn) => { asked.fns.push(fn); asked.ids.push(7001); return 7001; };
    globalThis.cancelIdleCallback = (id) => { asked.cancelled.push(id); };
    const idle = await dashboard(two());
    try {
      assert.equal(asked.fns.length, 1, 'one idle callback asked for');
      await idle.unmountNow();
      assert.deepEqual(asked.cancelled, asked.ids, 'the id asked for is the one cancelled');
      asked.fns[0]();
      assert.deepEqual(idle.calls, { letter: 0, career: 0 }, 'a callback run after leaving fetches nothing');
    } finally {
      restore();
      await idle.close();
    }
    // setTimeout branch: no requestIdleCallback; the 1500 ms timer's handle is the one clearTimeout gets.
    const timers = { fns: [], handles: [] };
    globalThis.setTimeout = (fn, ms, ...rest) => {
      if (ms !== 1500) return saved.set(fn, ms, ...rest);
      const handle = { timer: timers.fns.length + 1 };
      timers.fns.push(fn);
      timers.handles.push(handle);
      return handle;
    };
    globalThis.clearTimeout = (handle) => {
      if (timers.handles.includes(handle)) asked.cleared.push(handle);
      else saved.clear(handle);
    };
    const plain = await dashboard(two());
    try {
      assert.equal(timers.fns.length, 1, 'a timer where there is no idle callback');
      await plain.unmountNow();
      assert.deepEqual(asked.cleared, timers.handles, 'the timer asked for is the one cleared');
      timers.fns[0]();
      assert.deepEqual(plain.calls, { letter: 0, career: 0 }, 'a timer run after leaving fetches nothing');
    } finally {
      restore();
      await plain.close();
    }
  });
});
