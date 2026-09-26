// The kit's modal layers, mounted with react-dom/client over fake-dom (tests/unit/ui-dom-harness.mjs
// adds focus and selectors): a Dialog keeps focus inside, closes on Escape and the overlay, gives
// focus back to its opener and holds the page still; useConfirm() answers true or false (never
// window.confirm); a toast is announced, carries its Undo, and waits while the pointer is on it.
// Run: node --test tests/unit/ui-overlays.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText, wait, assertSame } from './ui-dom-harness.mjs';

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

describe('Dialog', () => {
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
      assertSame(view.document.activeElement, opener, 'focus went back to the opener');
      assert.deepEqual(closes, []);
    } finally { await view.unmount(); }
  });

  it('a field that takes focus as the dialog closes keeps it (not pulled back to the opener)', async () => {
    function Page({ open, next }) {
      return h('div', null,
        h('button', { id: 'opener' }, 'Open'),
        next && h('input', { id: 'next', autoFocus: true }),
        h(ui.Dialog, { open, onClose: () => {}, title: 'Add' }, h('button', { 'data-autofocus': true }, 'Inner')));
    }
    const view = mount(Page, { open: false, next: false });
    try {
      byAttr(view.container, 'id', 'opener')[0].focus();
      view.update({ open: true, next: false });
      assert.equal(view.document.activeElement.textContent, 'Inner');
      view.update({ open: false, next: true }); // closed, and the field it added appears with autoFocus
      assertSame(view.document.activeElement, byAttr(view.container, 'id', 'next')[0], 'the new field keeps focus');
    } finally { await view.unmount(); }
  });

  it('a dialog opened from another, both closing at once: focus goes to the first opener', async () => {
    function Page({ outer, inner }) {
      return h('div', null,
        h('button', { id: 'opener' }, 'Open'),
        h(ui.Dialog, { open: outer, onClose: () => {}, title: 'Outer' }, h('button', { 'data-autofocus': true }, 'Ask')),
        h(ui.Dialog, { open: inner, onClose: () => {}, title: 'Inner' }, h('button', { 'data-autofocus': true }, 'Yes')));
    }
    const view = mount(Page, { outer: false, inner: false });
    try {
      const opener = byAttr(view.container, 'id', 'opener')[0];
      opener.focus();
      view.update({ outer: true, inner: false });
      view.update({ outer: true, inner: true });
      assert.equal(view.document.activeElement.textContent, 'Yes');
      view.update({ outer: false, inner: false }); // "Yes" answered, and the outer dialog closes with it
      assertSame(view.document.activeElement, opener, 'not the closing outer dialog\'s Ask button');
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
      assertSame(view.document.activeElement, close, 'Tab from the last element goes to the first');
      const back = ev({ key: 'Tab', shiftKey: true, target: close });
      view.act(() => reactProps(panel().parentNode.parentNode).onKeyDown(back));
      assertSame(view.document.activeElement, inner, 'Shift+Tab from the first goes to the last');
      opener.focus();
      assertSame(view.document.activeElement, panel(), 'focus on the page behind came back to the dialog');
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
      // Begun on the overlay and released inside the panel (selecting its text): the browser sends the click
      // to the overlay, the two ends' common ancestor.
      view.act(() => reactProps(overlay).onPointerDown(ev({ target: overlay, currentTarget: overlay })));
      view.act(() => reactProps(overlay).onPointerUp?.(ev({ target: panel, currentTarget: overlay })));
      view.act(() => reactProps(overlay).onClick(ev({ target: overlay, currentTarget: overlay })));
      assert.deepEqual(closes, ['escape', 'overlay'], 'nor a drag begun on the overlay and released inside the panel');
    } finally { await view.unmount(); }
    // An input method's Escape (Chinese, Japanese, Korean) drops the word being composed in the dialog's
    // field; the dialog stays (B-20c).
    const typing = dialogPage();
    try {
      typing.view.act(() => reactProps(typing.layer()).onKeyDown(ev({ key: 'Escape', nativeEvent: { isComposing: true } })));
      typing.view.act(() => reactProps(typing.layer()).onKeyDown(ev({ key: 'Escape', keyCode: 229 })));
      assert.deepEqual(typing.closes, [], 'an input method\'s Escape closed the dialog');
    } finally { await typing.view.unmount(); }
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
      // fake-dom reads an unset style as undefined where a browser reads '': either way, the body's own.
      assert.equal(view.document.body.style.overflow ?? '', '');
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

describe('useConfirm', () => {
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

  it('unmounted while an answered question animates out: nothing of it runs afterwards', async () => {
    const { view, ask, dialog } = confirmPage();
    const answered = ask({ title: 'Delete?' });
    view.act(() => reactProps(byText(dialog(), 'Confirm')).onClick(ev()));
    assert.equal(await answered, true);
    await view.unmount(); // the page left (a route change) inside the 160 ms hand-off to the next question
    await wait(200);      // a timer left behind would fire here, into a page that is gone, and fail this test
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

describe('toasts', () => {
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

  // R4-APP-02: a toast that replaced one with the same id (the editor's 'template-switch', 8 s with
  // its Undo) kept the first one's countdown and went when the first one's time was up; and one
  // shown within the 150 ms exit of a dismissed toast with its id was removed with it.
  it('a toast that replaces one with its id counts its own full duration', async () => {
    const { view, toast, toasts, region } = toastPage();
    try {
      toast({ id: 'template-switch', title: 'Template: Classic', duration: 2000 });
      await wait(1200);
      toast({ id: 'template-switch', title: 'Template: Modern', duration: 2000 });
      await wait(1400); // 2600 ms: the first toast's time (2000) and its exit are over
      view.act(() => {});
      assert.equal(toasts().length, 1, 'the replacement went with the first toast’s time');
      assert.match(region().textContent, /Template: Modern/);
      await wait(1400); // 4000 ms: its own 2000 ms from 1200, and the exit
      view.act(() => {});
      assert.equal(toasts().length, 0, 'and goes when its own time is up');
    } finally { await view.unmount(); }
  });

  it('a toast shown with the id of one on its way out stays', async () => {
    const { view, toast, toasts, region } = toastPage();
    try {
      toast({ id: 'saved', title: 'Saved', duration: Infinity });
      view.act(() => reactProps(byAttr(region(), 'aria-label', 'Dismiss notification')[0]).onClick(ev()));
      toast({ id: 'saved', title: 'Saved again', duration: Infinity });
      await wait(300);
      view.act(() => {});
      assert.equal(toasts().length, 1, 'the new toast was removed with the dismissed one');
      assert.match(region().textContent, /Saved again/);
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
      assert.equal(toasts().filter((t) => t.textContent === 'Synced').length, 1, 'one toast for the id, now saying Synced');
      assert.doesNotMatch(region().textContent, /Syncing/);
    } finally { await view.unmount(); }
    let api = null;
    const view2 = mount(() => { api = ui.useToast(); return null; }, {});
    assert.equal(api.toast({ title: 'x' }), null);
    await view2.unmount();
  });
});

/**
 * Runs `fn` with focus() refused, as browsers refuse it, on an element that is visibility: hidden
 * (its own inline style or an ancestor's): fake-dom has no CSS, so without this the kit's focus on
 * open passed here and failed in every browser.
 */
async function withBrowserFocusRules(view, fn) {
  const proto = Object.getPrototypeOf(view.document.body);
  const focus = proto.focus;
  proto.focus = function focusIfShown(...args) {
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.style?.visibility === 'hidden') return;
    focus.apply(this, args);
  };
  try { await fn(); } finally { proto.focus = focus; }
}

// R4-APP-01: a panel's position is measured in a layout effect and rendered after it; until then
// useFloating styled it visibility: hidden. Popover and MenuList move focus into it in that same
// commit, so browsers refused it: a label picker's search box took no typing, a menu's arrows did
// nothing, and Escape went to the dialog around them (closing the issue view).
describe('R4-APP-01: focus goes into a popover or menu when it opens', () => {
  it('a Popover’s data-autofocus search box has focus', async () => {
    function Page({ open }) {
      return h(ui.Popover, { open, onOpenChange: () => {}, label: 'Labels', trigger: h('button', null, 'Labels') },
        h('input', { 'aria-label': 'Search labels', 'data-autofocus': true }));
    }
    const view = mount(Page, { open: false });
    try {
      await withBrowserFocusRules(view, async () => {
        view.update({ open: true });
        const search = byAttr(view.document.body, 'aria-label', 'Search labels')[0];
        assert.ok(search, 'the panel is open');
        assertSame(view.document.activeElement, search, 'the search box did not get focus');
      });
    } finally { await view.unmount(); }
  });

  it('a Menu opened from its trigger with ArrowDown focuses its first item', async () => {
    function Page() {
      return h(ui.Menu, { trigger: h('button', { id: 'more' }, 'More'), items: [{ label: 'Edit' }, { label: 'Delete', danger: true }] });
    }
    const view = mount(Page, {});
    try {
      await withBrowserFocusRules(view, async () => {
        const trigger = byAttr(view.container, 'id', 'more')[0];
        trigger.focus();
        view.act(() => reactProps(trigger).onKeyDown(ev({ key: 'ArrowDown' })));
        const first = byText(view.document.body, 'Edit');
        assert.ok(first, 'the menu is open');
        const item = first.closest('[role="menuitem"]') ?? first;
        assertSame(view.document.activeElement, item, 'focus stayed on the trigger');
      });
    } finally { await view.unmount(); }
  });
});

describe('Popover', () => {
  // An input method's Escape (Chinese, Japanese, Korean) drops the word being composed in a field of the
  // panel — the label search, a name — and leaves the panel open; a plain Escape closes it (B-20c).
  it('closes on Escape, but not on an input method\'s', async () => {
    const changes = [];
    function Page() {
      return h(ui.Popover, { open: true, onOpenChange: (o) => changes.push(o), label: 'Labels', trigger: h('button', null, 'Labels') },
        h('input', { 'aria-label': 'Search labels' }));
    }
    const view = mount(Page, {});
    try {
      const panel = byAttr(view.document.body, 'role', 'dialog').find((el) => el.getAttribute('aria-label') === 'Labels');
      assert.ok(panel, 'the panel is open');
      view.act(() => reactProps(panel).onKeyDown(ev({ key: 'Escape', nativeEvent: { isComposing: true } })));
      view.act(() => reactProps(panel).onKeyDown(ev({ key: 'Escape', keyCode: 229 })));
      assert.deepEqual(changes, [], 'an input method\'s Escape closed the panel');
      view.act(() => reactProps(panel).onKeyDown(ev({ key: 'Escape' })));
      assert.deepEqual(changes, [false], 'a plain Escape closes it');
    } finally { await view.unmount(); }
  });
});
