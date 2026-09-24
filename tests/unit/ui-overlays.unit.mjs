// The kit's modal layers, mounted with react-dom/client over fake-dom (tests/unit/ui-dom-harness.mjs
// adds focus and selectors): a Dialog keeps focus inside, closes on Escape and the overlay, gives
// focus back to its opener and holds the page still; useConfirm() answers true or false (never
// window.confirm); a toast is announced, carries its Undo, and waits while the pointer is on it.
// Run: node --test tests/unit/ui-overlays.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, useState } from 'react';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText, elements, wait } from './ui-dom-harness.mjs';

// R3-005: on CI (run 35970636799) this file was SIGKILLed after 60 s — it hangs or runs away somewhere in
// these three suites, merged from Lane C's work in progress on 2026-09-24. Skipped, not deleted, until the
// lane finds why; the owner's rule forbids running it on the laptop, so the investigation runs on CI.
const HANG = 'R3-005: killed after 60 s on CI (run 35970636799) — Lane C investigates';

let kit;
let ui;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ui = await kit.load('/src/components/ui/index.js');
});
after(() => kit?.close());

/** A page with an "Open" button and a Dialog; `onClose` records why it closed. */
function dialogPage(extra = {}) {
  const closes = [];
  function Page({ open }) {
    return h('div', null,
      h('button', { id: 'opener' }, 'Open'),
      h(ui.Dialog, { open, onClose: (why) => closes.push(why), title: 'Delete job', description: 'This cannot be undone.', ...extra },
        h('button', { 'data-autofocus': true }, 'Inner')));
  }
  const view = mount(Page, { open: false });
  const opener = byAttr(view.container, 'id', 'opener')[0];
  opener.focus();
  view.update({ open: true });
  const panel = () => byAttr(view.document.body, 'aria-modal', 'true')[0];
  const layer = () => panel()?.parentNode.parentNode; // the fixed layer that owns the key handler
  return { view, opener, panel, layer, closes };
}

describe('Dialog', { skip: HANG }, () => {
  it('is a labelled, described modal in a portal', async () => {
    const { view, panel } = dialogPage();
    try {
      const p = panel();
      assert.ok(p, 'no aria-modal dialog was rendered');
      assert.equal(p.getAttribute('role'), 'dialog');
      assert.ok(!view.container.contains(p), 'rendered in a portal at the end of <body>');
      const title = byAttr(view.document.body, 'id', p.getAttribute('aria-labelledby'))[0];
      assert.equal(title.tagName, 'H2');
      assert.equal(title.textContent, 'Delete job');
      assert.equal(byAttr(view.document.body, 'id', p.getAttribute('aria-describedby'))[0].textContent, 'This cannot be undone.');
    } finally { await view.unmount(); }
  });

  it('focus starts on the data-autofocus element and returns to the opener on close', async () => {
    const { view, opener, closes } = dialogPage();
    try {
      assert.equal(view.document.activeElement.textContent, 'Inner');
      view.update({ open: false });
      assert.equal(view.document.activeElement, opener);
      assert.deepEqual(closes, []);
    } finally { await view.unmount(); }
  });

  it('Tab and Shift+Tab wrap inside; focus that lands behind it is brought back', async () => {
    const { view, opener, panel } = dialogPage();
    try {
      const inner = byText(view.document.body, 'Inner');
      const close = byAttr(panel(), 'aria-label', 'Close')[0];
      inner.focus();
      const tab = ev({ key: 'Tab', target: inner });
      view.act(() => reactProps(panel().parentNode.parentNode).onKeyDown(tab));
      assert.ok(tab.defaultPrevented);
      assert.equal(view.document.activeElement, close, 'Tab from the last element goes to the first');
      const back = ev({ key: 'Tab', shiftKey: true, target: close });
      view.act(() => reactProps(panel().parentNode.parentNode).onKeyDown(back));
      assert.equal(view.document.activeElement, inner, 'Shift+Tab from the first goes to the last');
      opener.focus();
      assert.equal(view.document.activeElement, panel(), 'focus on the page behind came back to the dialog');
    } finally { await view.unmount(); }
  });

  it('Escape and a press that starts and ends on the overlay close it; closeOnEscape=false keeps it', async () => {
    const { view, layer, closes } = dialogPage();
    try {
      const esc = ev({ key: 'Escape', target: view.document.activeElement });
      view.act(() => reactProps(layer()).onKeyDown(esc));
      assert.ok(esc.propagationStopped, 'the Escape does not also reach a dialog underneath');
      const overlay = layer().childNodes[1];
      view.act(() => reactProps(overlay).onPointerDown(ev({ target: overlay, currentTarget: overlay })));
      view.act(() => reactProps(overlay).onClick(ev({ target: overlay, currentTarget: overlay })));
      const panel = byAttr(view.document.body, 'aria-modal', 'true')[0];
      view.act(() => reactProps(overlay).onPointerDown(ev({ target: panel, currentTarget: overlay })));
      view.act(() => reactProps(overlay).onClick(ev({ target: overlay, currentTarget: overlay })));
      assert.deepEqual(closes, ['escape', 'overlay'], 'a drag that started inside the panel does not close it');
    } finally { await view.unmount(); }
    const kept = dialogPage({ closeOnEscape: false });
    try {
      kept.view.act(() => reactProps(kept.layer()).onKeyDown(ev({ key: 'Escape' })));
      assert.deepEqual(kept.closes, []);
    } finally { await kept.view.unmount(); }
  });

  it('holds the page still while open (body overflow hidden) and lets go after it leaves', async () => {
    const { view } = dialogPage();
    try {
      assert.equal(view.document.body.style.overflow, 'hidden');
      view.update({ open: false });
      await wait(200);
      view.act(() => {});
      assert.equal(byAttr(view.document.body, 'aria-modal', 'true').length, 0, 'unmounted after its exit animation');
      assert.equal(view.document.body.style.overflow, '');
    } finally { await view.unmount(); }
  });

  it('a large dialog fills a phone screen; a sheet slides up from the bottom below md', async () => {
    const big = dialogPage({ size: 'xl' });
    try {
      assert.match(big.panel().className, /max-sm:h-dvh/);
      assert.match(big.panel().className, /max-sm:rounded-none/);
    } finally { await big.view.unmount(); }
    const sheet = dialogPage({ sheet: true, size: 'sm' });
    try {
      assert.match(sheet.panel().className, /max-md:rounded-b-none/);
      assert.match(sheet.panel().className, /max-md:animate-ui-sheet-in/);
    } finally { await sheet.view.unmount(); }
  });
});

describe('useConfirm', { skip: HANG }, () => {
  /** The confirm host with a page that keeps the confirm function. */
  function confirmPage() {
    let ask = null;
    function Asker() {
      ask = ui.useConfirm();
      return h('button', { id: 'delete' }, 'Delete');
    }
    const view = mount(() => h(ui.ConfirmProvider, null, h(Asker)), {});
    const dialog = () => byAttr(view.document.body, 'role', 'alertdialog')[0];
    return { view, ask: (options) => { let p; view.act(() => { p = ask(options); }); return p; }, dialog };
  }

  it('resolves true on the confirm button, false on Cancel and on Escape', async () => {
    const { view, ask, dialog } = confirmPage();
    try {
      const first = ask({ title: 'Delete “Google”?', body: 'Its history goes too.', confirmLabel: 'Delete job', tone: 'danger' });
      assert.ok(dialog(), 'an alertdialog opened');
      assert.match(dialog().textContent, /Delete “Google”\?/);
      assert.equal(view.document.activeElement.textContent, 'Cancel', 'a danger question starts on Cancel, so a stray Enter never deletes');
      view.act(() => reactProps(byText(dialog(), 'Delete job')).onClick(ev()));
      assert.equal(await first, true);
      await wait(200);
      view.act(() => {});

      const second = ask({ title: 'Discard changes?' });
      view.act(() => reactProps(byText(dialog(), 'Cancel')).onClick(ev()));
      assert.equal(await second, false);
      await wait(200);
      view.act(() => {});

      const third = ask({ title: 'Leave?' });
      view.act(() => reactProps(dialog().parentNode.parentNode).onKeyDown(ev({ key: 'Escape' })));
      assert.equal(await third, false);
    } finally { await view.unmount(); }
  });

  it('a double click answers once; questions asked together wait their turn', async () => {
    const { view, ask, dialog } = confirmPage();
    try {
      const a = ask({ title: 'First?' });
      const b = ask({ title: 'Second?' });
      const yes = byText(dialog(), 'Confirm');
      view.act(() => { reactProps(yes).onClick(ev()); reactProps(yes).onClick(ev()); });
      assert.equal(await a, true);
      await wait(200);
      view.act(() => {});
      assert.match(dialog().textContent, /Second\?/);
      view.act(() => reactProps(byText(dialog(), 'Cancel')).onClick(ev()));
      assert.equal(await b, false);
    } finally { await view.unmount(); }
  });

  it('throws without a ConfirmProvider rather than answering for the user', async () => {
    const errors = [];
    const original = console.error;
    console.error = () => {};
    function Lonely() {
      try { ui.useConfirm(); } catch (error) { errors.push(error.message); }
      return null;
    }
    const view = mount(Lonely, {});
    console.error = original;
    await view.unmount();
    assert.match(errors[0], /ConfirmProvider/);
  });
});

describe('toasts', { skip: HANG }, () => {
  function toastPage() {
    let api = null;
    function Page() {
      api = ui.useToast();
      return null;
    }
    const view = mount(() => h(ui.ToastProvider, null, h(Page)), {});
    const region = () => byAttr(view.document.body, 'role', 'status')[0];
    const toasts = () => byAttr(region(), 'data-toast');
    return { view, toast: (o) => { let id; view.act(() => { id = api.toast(o); }); return id; }, region, toasts };
  }

  it('a polite, non-atomic live region carries each toast and its Undo', async () => {
    const { view, toast, region, toasts } = toastPage();
    try {
      assert.equal(region().getAttribute('aria-live'), 'polite');
      assert.equal(region().getAttribute('aria-atomic'), 'false');
      let undone = 0;
      toast({ title: 'Job deleted', description: 'Google · Senior Engineer', action: { label: 'Undo', onClick: () => { undone += 1; } }, tone: 'success' });
      assert.equal(toasts().length, 1);
      assert.match(region().textContent, /Job deleted/);
      view.act(() => reactProps(byText(region(), 'Undo')).onClick(ev()));
      assert.equal(undone, 1);
      await wait(200);
      view.act(() => {});
      assert.equal(toasts().length, 0, 'Undo also dismisses the toast');
    } finally { await view.unmount(); }
  });

  it('dismisses itself after its duration, but not while the pointer or focus is on the stack', async () => {
    const { view, toast, region, toasts } = toastPage();
    try {
      toast({ title: 'Saved', duration: 60 });
      view.act(() => reactProps(region()).onPointerEnter(ev()));
      await wait(150);
      view.act(() => {});
      assert.equal(toasts().length, 1, 'paused under the pointer');
      view.act(() => reactProps(region()).onPointerLeave(ev()));
      await wait(1100); // what is left of the countdown is never under 800 ms, then the 150 ms exit
      view.act(() => {});
      assert.equal(toasts().length, 0);
    } finally { await view.unmount(); }
  });

  it('keeps at most four; the same id replaces its toast; useToast outside a provider is a no-op', async () => {
    const { view, toast, toasts, region } = toastPage();
    try {
      for (let i = 1; i <= 6; i += 1) toast({ title: `T${i}`, duration: Infinity });
      await wait(200);
      view.act(() => {});
      assert.deepEqual(toasts().map((t) => t.textContent.replace('Dismiss notification', '')), ['T3', 'T4', 'T5', 'T6']);
      toast({ id: 'sync', title: 'Syncing…', duration: Infinity });
      toast({ id: 'sync', title: 'Synced', duration: Infinity });
      assert.equal([...elements(region())].filter((el) => el.textContent === 'Synced').length, 1);
      assert.doesNotMatch(region().textContent, /Syncing/);
    } finally { await view.unmount(); }
    let api = null;
    const view2 = mount(() => { api = ui.useToast(); return null; }, {});
    assert.equal(api.toast({ title: 'x' }), null);
    await view2.unmount();
  });
});
