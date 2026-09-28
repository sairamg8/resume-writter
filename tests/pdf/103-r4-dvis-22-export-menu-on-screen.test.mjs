// R4-DVIS-22: the editor's Export menu hung `absolute right-0` off the Export button, with no clamp.
// Signed in, in the default 360 px split panel, the button's right edge is ~222 px from the window's
// left, so the Cover Letter tab's 288 px menu (w-72) ran ~66 px off the screen, and the panel's
// overflow-hidden cut it too: every item lost its icon and first letters. The menu is now placed by
// the kit (useFloating, bottom-end): a fixed panel under the button that slides back inside the
// window and is capped to its height (it scrolls). It stays in the dropdown, after Export, so the Tab
// order is what it was. The fake DOM has no layout: the test gives the Export button a rectangle and
// the menu the width its Tailwind class makes, as a browser would measure them, and reads where the
// real ExportDropdown (mounted with react-dom/client over tests/pdf/fake-dom.mjs) puts its menu.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, fakeWindow, mount, reactProps } from './fake-dom.mjs';

// useFloating re-measures in an animation frame and cancels it on closing; Node has none
// (tests/unit/ui-dom-harness.mjs gives the kit's own tests the same two).
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

before(setup);
after(teardown);

const noop = () => {};
const HANDLERS = {
  onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onExportMarkdown: noop, onExportAtsText: noop,
  onExportJsonResume: noop, onExportLetterText: noop, onImportJSON: noop, onImportFile: noop, onImportError: noop,
};
const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

// What a browser measures of the menu: the width its w-72 / w-52 class gives it, and a height.
const WIDTHS = { 'w-72': 288, 'w-52': 208 };
const width = (el) => WIDTHS[tokens(el).find((t) => t in WIDTHS)] ?? 0;
const proto = Object.getPrototypeOf(fakeWindow().document.body);
Object.defineProperty(proto, 'offsetWidth', { configurable: true, get() { return width(this); } });
Object.defineProperty(proto, 'offsetHeight', { configurable: true, get() { return width(this) ? 420 : 0; } });

// The Export button in the signed-in 360 px split panel of a 1280 × 800 window (the row's numbers).
const WINDOW = { innerWidth: 1280, innerHeight: 800 };
const EXPORT_BUTTON = { left: 125, right: 222, top: 12, bottom: 40, width: 97, height: 28 };

/** The Export menu opened on the résumé tab or the Cover Letter tab (`letter`). */
async function openMenu(letter) {
  const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
  const view = mount(ExportDropdown, { exporting: false, letter, ...HANDLERS });
  Object.assign(view.window, WINDOW);
  const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
  const toggle = buttons().find((el) => text(el) === 'Export');
  assert.ok(toggle, 'the Export button');
  toggle.getBoundingClientRect = () => EXPORT_BUTTON;
  view.act(() => reactProps(toggle).onClick());
  const first = buttons().find((el) => text(el) === (letter ? 'Export Cover Letter PDF' : 'Export PDF'));
  assert.ok(first, 'the menu is open');
  return { view, menu: first.parentNode };
}

describe('R4-DVIS-22: the Export menu stays on the screen', () => {
  it('the Cover Letter tab\'s 288 px menu slides back inside the window instead of running 66 px off its left edge', async () => {
    const { view, menu } = await openMenu(true);
    try {
      assert.ok(tokens(menu).includes('w-72'), 'the letter tab\'s wide menu');
      for (const t of ['absolute', 'right-0', 'top-full']) assert.ok(!tokens(menu).includes(t), `not hung off the button (${t})`);
      assert.equal(menu.style.position, 'fixed', 'placed in the window, where the panel\'s overflow-hidden does not cut it');
      assert.equal(menu.style.left, '8px', 'at the window\'s 8 px margin, not at 222 − 288 = −66 px');
      assert.equal(menu.style.top, '44px', 'just under the button, as mt-1 put it');
      assert.ok(!menu.style.opacity && !menu.style.pointerEvents, 'measured and shown');
      assert.equal(menu.style.maxHeight, '748px', 'no taller than the room under the button');
      assert.ok(tokens(menu).includes('overflow-y-auto'), 'a menu taller than that scrolls instead of running off the bottom');
      assert.ok(view.container.firstChild.contains(menu), 'still in the dropdown, right after Export in the Tab order');
    } finally {
      await view.unmount();
    }
  });

  it('the résumé tab\'s 208 px menu, which fits, keeps its right edge under the button\'s', async () => {
    const { view, menu } = await openMenu(false);
    try {
      assert.ok(tokens(menu).includes('w-52'), 'the résumé tab\'s menu');
      assert.equal(menu.style.position, 'fixed');
      assert.equal(menu.style.left, `${EXPORT_BUTTON.right - 208}px`, 'ends where the button ends, as right-0 did');
      assert.equal(menu.style.top, '44px');
    } finally {
      await view.unmount();
    }
  });
});
