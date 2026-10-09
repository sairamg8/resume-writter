// useFloating measured the panel's offsetHeight under the maxHeight it had set on the last placement, so a panel that was cut short by
// little room kept measuring short: once the anchor scrolled to a spot with more room (but still too little for the whole panel)
// and the panel flipped above it, it was placed as if it were small and its taller box ended over the anchor. It now reads the whole
// height off the content (scrollHeight plus the panel's borders), never by clearing the cap: a panel that scrolls inside its cap
// jumps back to its top when the cap comes off. The fake DOM has no layout: the test gives the menu what a browser would report
// (900 px of items, a box cut to its inline maxHeight) and reads where the real ExportDropdown puts it, as tests/pdf/103 does.
// Window 1280 x 400, offset 4, padding 8. First the Export button sits at 100..128: 260 px below, 88 above, so the menu opens below,
// capped at 260. Then the anchor scrolls to 300..328: 60 px below, 288 above, so the menu flips above, capped at 288, and its top
// is anchor.top - 4 - 288 = 8 (it was 300 - 4 - 260 = 36, with its box 28 px over the button).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, fakeWindow, mount, reactProps } from './fake-dom.mjs';

globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

before(setup);
after(teardown);

const noop = () => {};
const HANDLERS = {
  onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onExportMarkdown: noop, onExportAtsText: noop,
  onExportJsonResume: noop, onExportLetterText: noop, onImportJSON: noop, onImportFile: noop, onImportError: noop,
};
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

// What a browser measures of the menu: 288 px wide, 900 px of items, cut to the maxHeight set on it.
const NATURAL = 900;
const proto = Object.getPrototypeOf(fakeWindow().document.body);
Object.defineProperty(proto, 'offsetWidth', { configurable: true, get() { return (this.getAttribute('class') ?? '').includes('w-72') ? 288 : 0; } });
Object.defineProperty(proto, 'offsetHeight', {
  configurable: true,
  get() {
    if (!(this.getAttribute('class') ?? '').includes('w-72')) return 0;
    const cap = Number.parseFloat(this.style.maxHeight);
    return Number.isFinite(cap) ? Math.min(NATURAL, cap) : NATURAL;
  },
});
// The panel scrolls inside its cap: its content is always the whole 900 px, its inner box is its (borderless) outer box.
Object.defineProperty(proto, 'scrollHeight', { configurable: true, get() { return (this.getAttribute('class') ?? '').includes('w-72') ? NATURAL : 0; } });
Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return this.offsetHeight; } });

/** Polls until `done()` holds, by what happened, not by a clock (bounded). */
async function until(done, what) {
  for (let i = 0; i < 300; i += 1) {
    if (done()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  assert.fail(`never happened: ${what}`);
}

describe('useFloating measures the panel without its own maxHeight', () => {
  it('an anchor that scrolls to more room re-places the panel by its whole height, not the height it was cut to', async () => {
    const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
    const view = mount(ExportDropdown, { exporting: false, letter: true, ...HANDLERS });
    try {
      Object.assign(view.window, { innerWidth: 1280, innerHeight: 400 });
      const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
      const toggle = buttons().find((el) => text(el) === 'Export');
      assert.ok(toggle, 'the Export button');
      toggle.getBoundingClientRect = () => ({ left: 1100, right: 1197, top: 100, bottom: 128, width: 97, height: 28 });
      view.act(() => reactProps(toggle).onClick());
      const first = buttons().find((el) => text(el) === 'Export Cover Letter PDF');
      assert.ok(first, 'the menu is open');
      const menu = first.parentNode;
      assert.equal(menu.style.top, '132px', 'below the button');
      assert.equal(menu.style.maxHeight, '260px', 'cut to the room below it');

      toggle.getBoundingClientRect = () => ({ left: 1100, right: 1197, top: 300, bottom: 328, width: 97, height: 28 });
      view.window.dispatchEvent({ type: 'scroll' });
      await until(() => menu.style.maxHeight === '288px', 'the menu is placed again, above the button');
      assert.equal(menu.style.maxHeight, '288px', 'cut to the room above it');
      assert.equal(menu.style.top, '8px', 'its top clears the button: 300 - 4 - 288, by its whole height');
    } finally {
      await view.unmount();
    }
  });
});
