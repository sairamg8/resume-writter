// UI redesign B2 (cluster account): useOutsideClose, the small start-up hook behind the avatar menu (and,
// in B5a, the card menu). A pointer pressed outside the element closes; one inside does not; Escape is
// listened for only when a handler is passed (the live avatar menu has none); every listener is gone
// when the control closes and on unmount. Mounted over fake-dom.mjs, events fired on the fake document.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useRef } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

async function probe(props) {
  const { useOutsideClose } = await loadModule('/src/hooks/useOutsideClose.js');
  function Probe({ active, onClose, onEscape, swallowClick }) {
    const ref = useRef(null);
    useOutsideClose(ref, active, onClose, onEscape, { swallowClick });
    return createElement('div', { ref, 'data-testid': 'box' }, createElement('span', { 'data-testid': 'inner' }, 'in'));
  }
  const view = mount(Probe, props);
  const by = (id) => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === id);
  const press = (target) => view.act(() => { view.document.dispatchEvent({ type: 'pointerdown', target }); });
  const key = (k) => view.act(() => { view.document.dispatchEvent({ type: 'keydown', key: k }); });
  return { view, by, press, key };
}

describe('useOutsideClose', () => {
  it('a pointer outside closes; one on the element or inside it does not', async () => {
    let closed = 0;
    const p = await probe({ active: true, onClose: () => { closed += 1; } });
    try {
      p.press(p.by('box'));
      p.press(p.by('inner'));
      assert.equal(closed, 0, 'a press inside closed it');
      const elsewhere = p.view.document.body.appendChild(p.view.document.createElement('div'));
      p.press(elsewhere);
      assert.equal(closed, 1, 'a press outside did not close it');
    } finally { await p.view.unmount(); }
  });

  it('listens for the pointer in the capture phase (a press on an element that stops pointerdown still closes), and removes it the same way', async () => {
    const p = await probe({ active: false, onClose() {} });
    try {
      const seen = [];
      const doc = p.view.document;
      const add = doc.addEventListener;
      const remove = doc.removeEventListener;
      doc.addEventListener = (type, fn, opts) => { seen.push(['add', type, opts]); return add.call(doc, type, fn, opts); };
      doc.removeEventListener = (type, fn, opts) => { seen.push(['remove', type, opts]); return remove.call(doc, type, fn, opts); };
      p.view.update({ active: true, onClose() {} });
      p.view.update({ active: false, onClose() {} });
      assert.deepEqual(seen.filter(([, type]) => type === 'pointerdown'), [['add', 'pointerdown', true], ['remove', 'pointerdown', true]]);
    } finally { await p.view.unmount(); }
  });

  it('Escape is listened for only when a handler is passed', async () => {
    let closed = 0;
    let escaped = 0;
    const none = await probe({ active: true, onClose: () => { closed += 1; } });
    try {
      assert.equal(none.view.document.listeners('keydown'), 0, 'no Escape handler: no keydown listener');
      none.key('Escape');
      assert.equal(closed, 0, 'Escape closed a control that has no Escape handler');
    } finally { await none.view.unmount(); }
    const some = await probe({ active: true, onClose: () => { closed += 1; }, onEscape: () => { escaped += 1; } });
    try {
      some.key('Enter');
      assert.equal(escaped, 0, 'another key ran the Escape handler');
      some.key('Escape');
      assert.equal(escaped, 1, 'Escape did not run its handler');
      assert.equal(closed, 0, 'Escape is the handler\'s to act on, not onClose');
    } finally { await some.view.unmount(); }
  });

  it('listens only while active, and leaves nothing behind when it turns off or unmounts', async () => {
    const p = await probe({ active: false, onClose() {}, onEscape() {} });
    try {
      assert.equal(p.view.document.listeners('pointerdown'), 0, 'inactive: a listener on the page');
      assert.equal(p.view.document.listeners('keydown'), 0);
      p.view.update({ active: true, onClose() {}, onEscape() {} });
      assert.equal(p.view.document.listeners('pointerdown'), 1);
      assert.equal(p.view.document.listeners('keydown'), 1);
      p.view.update({ active: false, onClose() {}, onEscape() {} });
      assert.equal(p.view.document.listeners('pointerdown'), 0, 'closed: the pointer listener stayed');
      assert.equal(p.view.document.listeners('keydown'), 0, 'closed: the key listener stayed');
      p.view.update({ active: true, onClose() {}, onEscape() {} });
    } finally {
      const { document } = p.view;
      await p.view.unmount();
      assert.equal(document.listeners('pointerdown'), 0, 'unmount left the pointer listener');
      assert.equal(document.listeners('keydown'), 0, 'unmount left the key listener');
    }
  });
});

// UI rebuild B4 re-verification (parity P-2, test strength T7). The avatar menu used to close behind a full-screen
// backdrop, so the press outside only closed it; the hook let the click through to what was under the pointer (a
// card's Delete). `swallowClick` ends that for the one click of the closing press. An input method's Escape is
// not the menu's: the hook guards it itself (isImeKey) now that no allow-list entry excuses the file.
describe('useOutsideClose: the closing press\'s click, and an input method\'s Escape', () => {
  const click = (p, target) => {
    const seen = { prevented: 0, stopped: 0 };
    p.view.act(() => { p.view.document.dispatchEvent({ type: 'click', target, preventDefault() { seen.prevented += 1; }, stopPropagation() { seen.stopped += 1; } }); });
    return seen;
  };
  const outside = (p) => p.view.document.body.appendChild(p.view.document.createElement('div'));

  it('with swallowClick the click that follows the closing press is stopped, once; the next one is not', async () => {
    const p = await probe({ active: true, onClose() {}, swallowClick: true });
    try {
      const away = outside(p);
      p.press(away);
      const first = click(p, away);
      assert.deepEqual(first, { prevented: 1, stopped: 1 }, 'the click under the closing press reached the page');
      assert.deepEqual(click(p, away), { prevented: 0, stopped: 0 }, 'a later click is the page\'s');
    } finally { await p.view.unmount(); }
  });

  it('the swallowing click outlives the close (the effect is gone when it arrives) and a press inside swallows nothing', async () => {
    const p = await probe({ active: true, onClose() {}, swallowClick: true });
    try {
      p.press(p.by('inner'));
      assert.deepEqual(click(p, p.by('inner')), { prevented: 0, stopped: 0 }, 'a press inside is no closing press');
      const away = outside(p);
      p.press(away);
      p.view.update({ active: false, onClose() {}, swallowClick: true });
      assert.deepEqual(click(p, away), { prevented: 1, stopped: 1 }, 'closed already, the click is still the closing press\'s');
    } finally { await p.view.unmount(); }
  });

  it('a press or a key that comes before the click ends the swallowing (a drag has no click; a key\'s click is the page\'s)', async () => {
    for (const next of [{ type: 'pointerdown' }, { type: 'keydown', key: 'Enter' }]) {
      const p = await probe({ active: true, onClose() {}, swallowClick: true });
      try {
        const away = outside(p);
        p.press(away);
        p.view.update({ active: false, onClose() {}, swallowClick: true }); // the menu is closed now: a second press is no closing press
        p.view.act(() => { p.view.document.dispatchEvent({ ...next, target: away }); });
        assert.deepEqual(click(p, away), { prevented: 0, stopped: 0 }, `a click after a ${next.type} is the page's`);
      } finally { await p.view.unmount(); }
    }
  });

  it('without swallowClick no click is touched', async () => {
    const p = await probe({ active: true, onClose() {} });
    try {
      const away = outside(p);
      p.press(away);
      assert.deepEqual(click(p, away), { prevented: 0, stopped: 0 });
    } finally { await p.view.unmount(); }
  });

  it('an input method\'s Escape (isComposing, or keyCode 229) does not call onEscape; a plain one does', async () => {
    let escaped = 0;
    const p = await probe({ active: true, onClose() {}, onEscape: () => { escaped += 1; } });
    try {
      for (const flag of [{ isComposing: true }, { keyCode: 229 }]) {
        p.view.act(() => { p.view.document.dispatchEvent({ type: 'keydown', key: 'Escape', ...flag }); });
      }
      assert.equal(escaped, 0, 'a composing Escape closed the control');
      p.key('Escape');
      assert.equal(escaped, 1, 'a plain Escape did not');
    } finally { await p.view.unmount(); }
  });
});
