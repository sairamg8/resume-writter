// The header's sync icon is the only place that says a résumé is not reaching the cloud ("“My CV”
// not synced (a large photo?)"), that sync is off, or that it failed (R2-019). Its words showed on
// mouse hover only: a div with no role, label or focus, so on a phone a tap did nothing, and a
// keyboard or screen-reader user could not reach it at all. Now it is a button named by its status
// (aria-label); a tap or click-free keyboard press opens the words and a second tap closes them;
// keyboard focus shows them; Escape, or a tap anywhere else, closes them; mouse hover works as before.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs; events are fired through the handlers
// React set on the button, in the order a browser fires them (a touch tap: pointerdown, the
// emulated mouseenter, focus, click).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const HELD = '“My CV” not synced (a large photo?) — saved in this browser';
const user = { uid: 'u1', displayName: 'Pat Doe', email: 'pat@example.com', photoURL: null };

async function header(props = {}) {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  const base = {
    user, authLoading: false, cloudAvailable: true, signInWithGoogle: async () => {}, signOut: () => {},
    syncStatus: 'stopped', lastSynced: null, isOnline: true, heldResumes: [{ id: 'r1', name: 'My CV' }], compact: true, ...props,
  };
  const view = mount(AuthBar, base);
  const dot = () => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'sync-status');
  const shown = () => view.container.textContent.includes(dot()?.getAttribute('aria-label') || HELD);
  /** Fire `name` (onClick, onFocus, …) on the icon with `event`, and commit what it set. */
  const fire = (name, event = {}) => {
    const handler = reactProps(dot())?.[name];
    assert.ok(handler, `the sync icon has no ${name} handler`);
    view.act(() => handler({ preventDefault() {}, stopPropagation() {}, currentTarget: dot(), target: dot(), ...event }));
  };
  const tap = () => {
    fire('onPointerDown', { pointerType: 'touch' });
    if (reactProps(dot()).onMouseEnter) fire('onMouseEnter'); // the browser's emulated hover
    fire('onFocus');
    fire('onClick', { detail: 1 });
  };
  return { view, dot, shown, fire, tap, set: (next) => view.update({ ...base, ...next }) };
}

describe('the sync status can be read without a mouse (R2-019)', () => {
  it('the icon is a button named by its status, for screen readers and keyboards', async () => {
    const { view, dot, set } = await header();
    try {
      assert.equal(dot()?.tagName, 'BUTTON', 'the sync icon is not a button');
      assert.equal(dot().getAttribute('type'), 'button');
      assert.equal(dot().getAttribute('aria-label'), HELD);
      set({ syncStatus: 'off', heldResumes: [] });
      assert.equal(dot().getAttribute('aria-label'), 'Sync is off — changes are saved in this browser');
      set({ syncStatus: 'error', heldResumes: [] });
      assert.equal(dot().getAttribute('aria-label'), 'Sync error — will retry');
      set({ isOnline: false });
      assert.equal(dot().getAttribute('aria-label'), 'Offline — changes saved locally');
    } finally { await view.unmount(); }
  });

  it('a tap on a phone opens the words; a second tap closes them', async () => {
    const { view, shown, tap, fire } = await header();
    try {
      assert.equal(shown(), false, 'shown before any tap');
      tap();
      assert.equal(shown(), true, 'a tap showed nothing');
      fire('onPointerDown', { pointerType: 'touch' });
      fire('onClick', { detail: 1 });
      assert.equal(shown(), false, 'a second tap left the words open');
    } finally { await view.unmount(); }
  });

  it('a tap anywhere else closes them', async () => {
    const { view, shown, tap } = await header();
    try {
      tap();
      assert.equal(shown(), true);
      const elsewhere = view.document.body.appendChild(view.document.createElement('div'));
      view.act(() => { view.document.dispatchEvent({ type: 'pointerdown', target: elsewhere }); });
      assert.equal(shown(), false, 'a tap elsewhere left the words open');
    } finally { await view.unmount(); }
  });

  it('keyboard: focus shows the words, Escape closes them, Enter toggles them', async () => {
    const { view, shown, fire } = await header();
    try {
      fire('onFocus');
      assert.equal(shown(), true, 'keyboard focus showed nothing');
      fire('onKeyDown', { key: 'Escape' });
      assert.equal(shown(), false, 'Escape left the words open');
      fire('onClick', { detail: 0 }); // Enter or Space on a focused button
      assert.equal(shown(), true, 'Enter showed nothing');
      fire('onBlur');
      assert.equal(shown(), false, 'leaving the icon left the words open');
    } finally { await view.unmount(); }
  });

  it('mouse: hover shows the words, a click keeps them, leaving hides them — as before', async () => {
    const { view, shown, fire } = await header();
    try {
      fire('onPointerEnter', { pointerType: 'mouse' });
      fire('onMouseEnter');
      assert.equal(shown(), true, 'hover showed nothing');
      fire('onPointerDown', { pointerType: 'mouse' });
      fire('onFocus');
      fire('onClick', { detail: 1 });
      assert.equal(shown(), true, 'a mouse click hid the words it was hovering');
      fire('onMouseLeave');
      fire('onBlur');
      assert.equal(shown(), false, 'leaving left the words open');
    } finally { await view.unmount(); }
  });

  it('the open words follow the status as it changes', async () => {
    const { view, shown, tap, set } = await header({ syncStatus: 'error', heldResumes: [] });
    try {
      tap();
      assert.ok(view.container.textContent.includes('Sync error — will retry'));
      set({ syncStatus: 'stopped', heldResumes: [{ id: 'r1', name: 'My CV' }] });
      assert.ok(view.container.textContent.includes(HELD), 'the open words kept the old status');
      assert.equal(shown(), true);
    } finally { await view.unmount(); }
  });
});
