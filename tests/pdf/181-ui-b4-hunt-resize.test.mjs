// UI rebuild B4 (hunt H1-1, H1-2, H1-3): with a dock open the panel is DRAWN narrower than the width remembered (a stored 640
// at 1280 px is drawn at 600). A drag and the keys start from the width drawn, and the release / the key wrote that width
// down even when nothing moved: a plain click on the handle, or ArrowRight at the limit, replaced the remembered 640 with 600
// or 616, and closing the dock then drew the smaller panel. A drag to the right past the limit also let the remembered width
// run ahead of the drawn one, so the handle stayed pinned while the pointer came back. Now a press that changes nothing
// remembers nothing, and a drag is held to the same limit as the drawing.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { mount } from './fake-dom.mjs';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv-panel-width';

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

/** The hook as the Editor calls it, in a window `width` px wide, with a dock open or not. */
async function probe(width, dockOpen) {
  const { usePanelResize } = await loadModule('/src/hooks/usePanelResize.js');
  let latest = null;
  const Probe = ({ open }) => { latest = usePanelResize({ dockOpen: open }); return null; };
  const view = mount(Probe, { open: false });
  view.window.innerWidth = width;
  view.update({ open: dockOpen });
  const now = () => latest;
  const down = (x) => view.act(() => now().separatorProps.onPointerDown({ preventDefault() {}, clientX: x, pointerType: 'mouse', button: 0, pointerId: 1 }));
  const fire = (type, x) => view.act(() => view.window.dispatchEvent({ type, clientX: x, pointerId: 1 }));
  const key = (name) => view.act(() => now().separatorProps.onKeyDown({ key: name, preventDefault() {} }));
  return { view, now, down, fire, key };
}

describe('a press on the handle with a dock open keeps the remembered width unless it changes what is drawn', () => {
  it('a click with no move remembers nothing: the stored 640 stays, the drawn 600 stays', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now, down, fire } = await probe(1280, true);
    try {
      assert.equal(now().panelWidth, 600);
      down(500);
      fire('pointerup', 500);
      assert.equal(store.get(KEY), '640');
      assert.equal(now().panelWidth, 600);
      assert.equal(now().storedWidth, 640);
    } finally { await view.unmount(); }
  });

  it('a drag to the right past the limit leaves the handle at the limit and remembers nothing; one to the left follows and remembers', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now, down, fire } = await probe(1280, true);
    try {
      down(500);
      fire('pointermove', 650);
      assert.equal(now().panelWidth, 600, 'held to the limit while the pointer runs on');
      assert.equal(now().storedWidth, 600, 'the remembered width does not run ahead of the drawn one');
      fire('pointerup', 650);
      assert.equal(store.get(KEY), '640', 'a drag that changed nothing on screen writes nothing');
      assert.equal(now().storedWidth, 640, 'and the width held in the page is the remembered one again, so closing the dock draws 640');
      down(500);
      fire('pointermove', 460);
      fire('pointerup', 460);
      assert.equal(now().panelWidth, 560);
      assert.equal(store.get(KEY), '560', 'a real change is remembered');
    } finally { await view.unmount(); }
  });

  it('ArrowRight at the limit changes nothing and remembers nothing; ArrowLeft steps from it; End takes the remembered width to 640 again', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now, key } = await probe(1280, true);
    try {
      key('ArrowRight');
      key('ArrowUp');
      assert.equal(store.get(KEY), '640');
      assert.equal(now().panelWidth, 600);
      key('ArrowLeft');
      assert.equal(now().panelWidth, 584);
      assert.equal(store.get(KEY), '584');
      key('End');
      assert.equal(store.get(KEY), '640');
      assert.equal(now().panelWidth, 600, 'drawn at the limit, remembered at the top of the range');
    } finally { await view.unmount(); }
  });

  it('an arrow that steps past the limit remembers the limit it drew, so closing the dock draws what was seen (hunt R1)', async () => {
    const store = memoryStorage({ [KEY]: '500' });
    const { view, now, key } = await probe(1200, true); // 1200 - 680: the dock allows 520
    try {
      assert.equal(now().panelWidth, 500);
      key('ArrowRight');
      assert.equal(now().panelWidth, 516);
      assert.equal(store.get(KEY), '516');
      key('ArrowRight'); // asks for 532, draws 520
      assert.equal(now().panelWidth, 520);
      assert.equal(store.get(KEY), '520', 'the width drawn, not the 532 asked for');
      key('ArrowRight');
      assert.equal(store.get(KEY), '520');
      view.update({ open: false });
      assert.equal(now().panelWidth, 520, 'the dock closed: the panel is as wide as it was seen, no 12 px jump');
    } finally { await view.unmount(); }
  });

  it('with no dock a click remembers nothing either, and a key or a drag still does as before', async () => {
    const store = memoryStorage({});
    const { view, now, down, fire, key } = await probe(1280, false);
    try {
      down(500);
      fire('pointerup', 500);
      assert.equal(store.has(KEY), false, 'a click writes nothing');
      key('ArrowRight');
      assert.equal(now().panelWidth, 376);
      assert.equal(store.get(KEY), '376');
    } finally { await view.unmount(); }
  });
});
