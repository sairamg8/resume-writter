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
  function Probe({ active, onClose, onEscape }) {
    const ref = useRef(null);
    useOutsideClose(ref, active, onClose, onEscape);
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
