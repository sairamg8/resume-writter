// Editor hunt (cycle 1): the Export menu closed on a `mousedown` outside it. A phone sends no mouse events for a tap on
// a part of the page that has no click handler of its own (iOS Safari: the preview, the bar's empty stretch), so the menu
// stayed open over the page until an item was picked. Every other menu of the app closes on the pointer (useOutsideClose:
// "a tap counts"); the Export menu does now: a pointer pressed outside it closes it, one inside does not.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

// The menu is placed by the kit's useFloating, which cancels its animation frame when it closes.
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

before(setup);
after(teardown);

const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); }); };

async function page() {
  const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
  const noop = () => {};
  const view = mount(() => createElement(ExportDropdown, {
    exporting: null, onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onImportJSON: noop,
  }), {});
  const all = () => [...elements(view.container)];
  const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el).startsWith(label));
  const open = async () => {
    view.act(() => reactProps(button('Export')).onClick({ preventDefault() {}, stopPropagation() {} }));
    await settle();
  };
  const press = (target) => view.act(() => { view.document.dispatchEvent({ type: 'pointerdown', target }); });
  return { view, button, open, press };
}

describe('the Export menu', () => {
  it('closes on a pointer pressed outside it, and stays open on one pressed inside', async () => {
    const p = await page();
    try {
      await p.open();
      assert.ok(p.button('Export PDF'), 'the menu is open');
      p.press(p.button('Export PDF'));
      assert.ok(p.button('Export PDF'), 'a press inside closed it');
      const elsewhere = p.view.document.body.appendChild(p.view.document.createElement('div'));
      p.press(elsewhere);
      assert.equal(p.button('Export PDF'), undefined, 'a press outside left it open');
    } finally { await p.view.unmount(); }
  });

  it('leaves no pointer listener on the page once it is closed', async () => {
    const p = await page();
    try {
      assert.equal(p.view.document.listeners('pointerdown'), 0, 'closed: a listener on the page');
      await p.open();
      assert.equal(p.view.document.listeners('pointerdown'), 1, 'open: the one listener');
      const elsewhere = p.view.document.body.appendChild(p.view.document.createElement('div'));
      p.press(elsewhere);
      await settle();
      assert.equal(p.view.document.listeners('pointerdown'), 0, 'closed again: the listener stayed');
    } finally { await p.view.unmount(); }
  });
});
