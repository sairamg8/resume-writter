// The editor panel's width (usePanelResize) is remembered in localStorage, and storage can refuse
// (R2-015). Every other store in the app runs on in memory when it does; this hook did not:
//  (a) a browser that blocks site data throws SecurityError from getItem — the hook read it while
//      rendering, so every résumé opened straight onto "Something went wrong";
//  (b) a full storage throws QuotaExceededError from setItem — the hook wrote before letting go of
//      the drag, so after the mouse was released the panel kept following it and text selection
//      stayed off page-wide until a reload;
//  (c) a stored value that is not a number gave the panel a width of NaN.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs, whose window keeps its listeners.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Component, createElement } from 'react';
import { mount } from '../pdf/fake-dom.mjs';
import { usePanelResize } from '../../src/hooks/usePanelResize.js';

const KEY = 'cpwtcv-panel-width';

/** A localStorage over `data`; `fail` names the methods that throw `error` instead. */
function fakeStorage(data = {}, { fail = [], error = null } = {}) {
  const store = new Map(Object.entries(data));
  const guard = (name) => { if (fail.includes(name)) throw error; };
  return {
    store,
    getItem: (k) => { guard('getItem'); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { guard('setItem'); store.set(k, String(v)); },
    removeItem: (k) => { guard('removeItem'); store.delete(k); },
  };
}
const domError = (name, message) => Object.assign(new Error(message), { name });

let restoreStorage = null;
function useStorage(storage) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  restoreStorage = () => {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
    else delete globalThis.localStorage;
  };
}
afterEach(() => { restoreStorage?.(); restoreStorage = null; });

/** What an ErrorBoundary would show: the error's message instead of the editor. */
class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? createElement('p', null, `crashed: ${this.state.error.message}`) : this.props.children; }
}

/** The hook in a component, as the Editor uses it; `hook()` → its latest { panelWidth, onDragHandleMouseDown }. */
function mountHook() {
  let latest = null;
  function Probe() {
    latest = usePanelResize();
    return createElement('div', null, `width ${latest.panelWidth}`);
  }
  const quiet = console.error;
  console.error = () => {};
  try {
    const view = mount(() => createElement(Boundary, null, createElement(Probe)), {});
    return { view, hook: () => latest };
  } finally { console.error = quiet; }
}

/** Fire a mouse event at the window as a browser does: a listener that throws is reported, not rethrown. */
function fire(view, type, clientX) {
  view.act(() => {
    try { view.window.dispatchEvent({ type, clientX }); } catch { /* the browser logs it and moves on */ }
  });
}

/** Drag the handle from x=500 by `dx`, then release there; returns the page's state after release. */
function drag(view, hook, dx) {
  view.act(() => hook().onDragHandleMouseDown({ preventDefault() {}, clientX: 500 }));
  fire(view, 'mousemove', 500 + dx);
  fire(view, 'mouseup', 500 + dx);
  const { style } = view.document.body;
  return {
    width: hook().panelWidth,
    listeners: `mousemove ${view.window.listeners('mousemove')} · mouseup ${view.window.listeners('mouseup')}`,
    body: `cursor "${style.cursor}" · userSelect "${style.userSelect}"`,
  };
}

describe('the editor panel width survives a browser that refuses storage (R2-015)', () => {
  it('(a) site data blocked — getItem throws SecurityError: the editor opens at the default 360 px', async () => {
    useStorage(fakeStorage({}, { fail: ['getItem', 'setItem'], error: domError('SecurityError', 'Access is denied for this document.') }));
    const { view, hook } = mountHook();
    try {
      assert.equal(view.container.textContent, 'width 360');
      // …and a drag still works, just unremembered.
      assert.equal(drag(view, hook, 100).width, 460);
    } finally { await view.unmount(); }
  });

  it('(b) storage full — setItem throws QuotaExceededError: releasing the mouse ends the drag all the same', async () => {
    useStorage(fakeStorage({}, { fail: ['setItem'], error: domError('QuotaExceededError', 'The quota has been exceeded.') }));
    const { view, hook } = mountHook();
    try {
      const after = drag(view, hook, -120);
      assert.equal(after.width, 240);
      assert.equal(after.listeners, 'mousemove 0 · mouseup 0', 'the drag\'s listeners outlive the release');
      assert.equal(after.body, 'cursor "" · userSelect ""', 'the page stays in drag mode (no text selection)');
      fire(view, 'mousemove', 900);
      assert.equal(hook().panelWidth, 240, 'a plain mouse move after the drag still resizes the panel');
    } finally { await view.unmount(); }
  });

  it('(c) a stored width that is not a number opens at 360 px, never NaN; numbers are clamped to 240–640', async () => {
    for (const [stored, width] of [['wide', 360], ['', 360], ['NaN', 360], ['Infinity', 360], ['500', 500], ['100', 240], ['900', 640], ['300.6', 300]]) {
      useStorage(fakeStorage({ [KEY]: stored }));
      const { view } = mountHook();
      try {
        assert.equal(view.container.textContent, `width ${width}`, `stored ${JSON.stringify(stored)}`);
      } finally { await view.unmount(); restoreStorage(); restoreStorage = null; }
    }
  });

  it('with working storage the released width is remembered and read back on the next visit', async () => {
    const storage = fakeStorage();
    useStorage(storage);
    const first = mountHook();
    try {
      assert.equal(first.view.container.textContent, 'width 360');
      assert.equal(drag(first.view, first.hook, 80).width, 440);
      assert.equal(storage.store.get(KEY), '440');
    } finally { await first.view.unmount(); }
    const second = mountHook();
    try {
      assert.equal(second.view.container.textContent, 'width 440');
    } finally { await second.view.unmount(); }
  });
});
