// The split view's resize handle (R2-144) was a mouse-only div: a tablet in split view (768 px and
// wider) could not drag it (mousedown / mousemove never come from a finger), a keyboard could not
// reach it, and a screen reader heard nothing. usePanelResize now hands the handle separatorProps:
// role="separator" with its orientation, value and range; focusable, moved by the arrow keys and
// Home / End; dragged with pointer events (a mouse, a pen or a finger), a cancelled touch ending
// the drag like a release. The width is remembered as before. Mounted with react-dom/client over
// tests/pdf/fake-dom.mjs, whose window keeps its listeners.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../pdf/fake-dom.mjs';
import { usePanelResize } from '../../src/hooks/usePanelResize.js';

const KEY = 'cpwtcv-panel-width';

let restore = null;
function memoryStorage(data = {}) {
  const store = new Map(Object.entries(data));
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    configurable: true, writable: true,
  });
  restore = () => { if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage; };
  return store;
}
afterEach(() => { restore?.(); restore = null; });

function mountHook() {
  let latest = null;
  function Probe() {
    latest = usePanelResize();
    return null;
  }
  const view = mount(Probe, {});
  return { view, hook: () => latest, props: () => latest.separatorProps };
}

const key = (view, props, k) => {
  const e = { key: k, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  view.act(() => props().onKeyDown(e));
  return e.defaultPrevented;
};

describe('the split view’s resize handle (R2-144)', () => {
  it('is a focusable vertical separator that says its width and range', async () => {
    memoryStorage({ [KEY]: '400' });
    const { view, props } = mountHook();
    try {
      const p = props();
      assert.equal(p.role, 'separator');
      assert.equal(p['aria-orientation'], 'vertical');
      assert.equal(p['aria-valuenow'], 400);
      assert.equal(p['aria-valuemin'], 240);
      assert.equal(p['aria-valuemax'], 640);
      assert.equal(p.tabIndex, 0);
      assert.ok(p['aria-label']);
    } finally { await view.unmount(); }
  });

  it('the arrow keys move it, Home and End take it to either end; each is remembered', async () => {
    const store = memoryStorage();
    const { view, hook, props } = mountHook();
    try {
      assert.equal(key(view, props, 'ArrowRight'), true);
      assert.equal(hook().panelWidth, 376);
      key(view, props, 'ArrowLeft');
      key(view, props, 'ArrowLeft');
      assert.equal(hook().panelWidth, 344);
      assert.equal(props()['aria-valuenow'], 344);
      assert.equal(store.get(KEY), '344');
      key(view, props, 'End');
      assert.equal(hook().panelWidth, 640);
      key(view, props, 'ArrowRight');
      assert.equal(hook().panelWidth, 640, 'clamped');
      key(view, props, 'Home');
      assert.equal(hook().panelWidth, 240);
      assert.equal(store.get(KEY), '240');
      assert.equal(key(view, props, 'a'), false, 'other keys are left alone');
    } finally { await view.unmount(); }
  });

  it('a finger drags it (pointer events), and a cancelled touch ends the drag', async () => {
    const store = memoryStorage();
    const { view, hook, props } = mountHook();
    try {
      view.act(() => props().onPointerDown({ preventDefault() {}, clientX: 500, pointerType: 'touch', button: 0, pointerId: 7 }));
      view.act(() => view.window.dispatchEvent({ type: 'pointermove', clientX: 560, pointerId: 7 }));
      assert.equal(hook().panelWidth, 420, 'before: a touch drag moved nothing');
      view.act(() => view.window.dispatchEvent({ type: 'pointercancel', clientX: 560, pointerId: 7 }));
      assert.equal(view.window.listeners('pointermove'), 0, 'the drag outlives a cancelled touch');
      assert.equal(view.document.body.style.userSelect, '');
      assert.equal(store.get(KEY), '420');
      view.act(() => view.window.dispatchEvent({ type: 'pointermove', clientX: 700, pointerId: 7 }));
      assert.equal(hook().panelWidth, 420);
    } finally { await view.unmount(); }
  });

  it('a mouse’s right button does not start a drag', async () => {
    memoryStorage();
    const { view, props } = mountHook();
    try {
      view.act(() => props().onPointerDown({ preventDefault() {}, clientX: 500, pointerType: 'mouse', button: 2, pointerId: 1 }));
      assert.equal(view.window.listeners('pointermove'), 0);
    } finally { await view.unmount(); }
  });
});
