// A menu (or popover) open inside a dialog is dismissed by a press anywhere outside it, as it should be. When that press landed on the
// dialog's dimmed overlay, the same press also began and ended on the overlay, so the dialog closed with it: opening the issue
// view's "Issue actions" menu and clicking beside the box to put the menu away closed the whole issue. The layer on top takes the
// press first (as it does Escape): a press that dismissed a menu is not the dialog's overlay press. The next press, with no menu
// open, closes the dialog as before.
// Mounted over tests/pdf/fake-dom.mjs, through Vite's loader. Events: the native pointerdown fired on the fake document (the menu's
// capture listener), then React's handlers on the overlay called with that same native event, as a browser delivers it.
// Run: node --test tests/pdf/280-cyc6-dialog-press-that-closes-a-menu.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';

let dom;
let harness;
let ui;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  ui = await loadModule('/src/components/ui/index.js');
});
after(teardown);

it('a press on the overlay that closes a menu inside the dialog leaves the dialog open; the next press closes it', async () => {
  const closes = [];
  function Page() {
    return h(ui.Dialog, { open: true, onClose: (why) => closes.push(why), title: 'Issue' },
      h(ui.Menu, { label: 'Actions', items: [{ id: 'x', label: 'Duplicate', onSelect() {} }], trigger: h('button', { id: 'trigger' }, 'More') }));
  }
  const view = dom.mount(Page, {});
  try {
    const doc = view.document;
    const find = (pred) => [...dom.elements(doc.body)].find(pred);
    const trigger = find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'More');
    const panel = find((el) => el.getAttribute('aria-modal') === 'true');
    const overlay = panel.parentNode;
    const menuOpen = () => Boolean(find((el) => el.getAttribute('role') === 'menu'));

    view.act(() => dom.reactProps(trigger).onClick(harness.ev()));
    assert.ok(menuOpen(), 'the menu is open over the dialog');

    // One press on the overlay: the document sees it first (the menu closes), then the overlay's own handlers.
    const press = () => {
      const native = { type: 'pointerdown', target: overlay };
      view.act(() => { doc.dispatchEvent(native); });
      view.act(() => dom.reactProps(overlay).onPointerDown(harness.ev({ target: overlay, currentTarget: overlay, nativeEvent: native })));
      view.act(() => dom.reactProps(overlay).onPointerUp?.(harness.ev({ target: overlay, currentTarget: overlay })));
      view.act(() => dom.reactProps(overlay).onClick(harness.ev({ target: overlay, currentTarget: overlay })));
    };

    press();
    assert.ok(!menuOpen(), 'the press put the menu away');
    assert.deepEqual(closes, [], 'and was the menu\'s press alone: the dialog stays');

    press();
    assert.deepEqual(closes, ['overlay'], 'with no menu open, a press on the overlay closes the dialog');
  } finally {
    await view.unmount();
  }
});
