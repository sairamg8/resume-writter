// UI rebuild B4 (cluster stage): the stage toolbar and the resize handle in the canvas look. Every function of the live
// stage stays: the three layouts (hiding is display:none, never unmount, and a hidden stage builds nothing), the paper
// label, the zoom from 50 to 150 % in 25 % steps, the 4 px handle with its title, its range 240-640, its keys and its
// storage key, the Terms / Privacy footer. Each section below is named for the commit that built it.
// Mounted over tests/pdf/fake-dom.mjs, as tests/unit/panel-resize-separator.unit.mjs and tests/pdf/71-preview-hidden-builds mount.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from './fake-dom.mjs';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv-panel-width';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

before(setup);
after(teardown);

let restore = null;
/** localStorage over a Map for one test; the Map is returned. */
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

describe('the panel is held off the stage\'s floor while a dock is open (the resize handle)', () => {
  /** The hook mounted as the Editor calls it: `dockOpen` is a prop of the probe; the window is `width` px wide. */
  async function hook(width, dockOpen = false) {
    const { usePanelResize } = await loadModule('/src/hooks/usePanelResize.js');
    let latest = null;
    const Probe = ({ open }) => { latest = usePanelResize({ dockOpen: open }); return null; };
    const view = mount(Probe, { open: false });
    view.window.innerWidth = width;
    view.update({ open: dockOpen });
    return { view, now: () => latest };
  }

  it('a stored 640 at 1100 px with a dock open is drawn at 420 (window - 360 - 320); the stored width is untouched', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now } = await hook(1100, true);
    try {
      assert.equal(now().panelWidth, 420);
      assert.equal(now().storedWidth, 640);
      assert.equal(store.get(KEY), '640', 'the remembered width is not rewritten by the clamp');
    } finally { await view.unmount(); }
  });

  it('the same stored 640 with no dock is drawn at 640; the window\'s width is followed while a dock is open', async () => {
    memoryStorage({ [KEY]: '640' });
    const { view, now } = await hook(1180, false);
    try {
      assert.equal(now().panelWidth, 640, 'no dock: no clamp');
      view.update({ open: true });
      assert.equal(now().panelWidth, 500);
      view.window.innerWidth = 1280;
      view.act(() => view.window.dispatchEvent({ type: 'resize' }));
      assert.equal(now().panelWidth, 600, 'a wider window gives the width back');
      view.update({ open: false });
      assert.equal(now().panelWidth, 640);
      assert.equal(view.window.listeners('resize'), 0, 'the window is not followed without a dock');
    } finally { await view.unmount(); }
  });

  it('never under the panel\'s own 240 px floor, and a width already narrower is left as it is', async () => {
    memoryStorage({ [KEY]: '300' });
    const narrow = await hook(768, true);
    try { assert.equal(narrow.now().panelWidth, 240); } finally { await narrow.view.unmount(); }
    const wide = await hook(1280, true);
    try { assert.equal(wide.now().panelWidth, 300); } finally { await wide.view.unmount(); }
  });

  it('a key moves the width drawn, and remembers it', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now } = await hook(1100, true);
    try {
      const e = { key: 'ArrowRight', preventDefault() {} };
      view.act(() => now().separatorProps.onKeyDown(e));
      assert.equal(now().panelWidth, 436, 'one 16 px step from the 420 drawn');
      assert.equal(store.get(KEY), '436');
      assert.equal(now().separatorProps['aria-valuenow'], 436);
    } finally { await view.unmount(); }
    await sleep(0);
  });
});
