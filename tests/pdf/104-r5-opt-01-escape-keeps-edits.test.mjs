// R5-OPT-01: since the STAR / Bullet Optimizer moved onto the kit's Dialog (R4-DVIS-07), Escape closed it
// even after the statement was rewritten — one key, pressed by reflex in a text field, and the rewrite was
// gone (the editor mounts the modal only while it is open). R4-DUX-09 already kept a rewrite from a click
// beside the box. Now Escape is ignored in the same case, while the statement differs from the one it
// opened with; an untouched (or restored) statement still closes on Escape, and Cancel and × still close
// a rewrite. The real modal is mounted over tests/pdf/fake-dom.mjs and searched from <body> (the kit
// Dialog's portal); Escape is sent to the Dialog's key layer, as tests/pdf/102-r4-dux-05-* does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const OPENED_WITH = 'Worked on the checkout page for a fictional shop';

async function opened() {
  const { default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx');
  let closes = 0;
  const view = mount(BulletOptimizerModal, {
    isOpen: true, initialText: OPENED_WITH, onApply() {}, onClose: () => { closes += 1; },
  });
  const all = () => [...elements(view.document.body)];
  const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const keyLayer = () => all().find((el) => typeof reactProps(el)?.onKeyDown === 'function' && /\bfixed\b/.test(el.getAttribute('class') || ''));
  const area = () => all().find((el) => el.tagName === 'TEXTAREA');
  assert.ok(keyLayer(), 'the Dialog\'s key layer');
  return {
    view,
    closed: () => closes,
    /** Escape pressed in the statement box: it bubbles to the Dialog's key layer. */
    escape: () => view.act(() => reactProps(keyLayer()).onKeyDown(ev({ key: 'Escape', target: area() }))),
    type: (value) => view.act(() => reactProps(area()).onChange({ target: { value } })),
    text: () => reactProps(area()).value,
    cancel: () => view.act(() => reactProps(all().find((el) => el.tagName === 'BUTTON' && label(el) === 'Cancel')).onClick()),
    cross: () => view.act(() => reactProps(all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Close')).onClick()),
  };
}

describe('the Bullet Optimizer keeps a rewritten statement on Escape (R5-OPT-01)', () => {
  it('Escape, once the statement is rewritten, keeps it open with the rewrite', async () => {
    const m = await opened();
    try {
      m.type('Rebuilt the checkout page, lifting conversion by 12%');
      m.escape();
      assert.equal(m.closed(), 0, 'not closed');
      assert.equal(m.text(), 'Rebuilt the checkout page, lifting conversion by 12%', 'the rewrite is still there');
    } finally { await m.view.unmount(); }
  });

  it('an untouched statement, or one typed back to how it opened, still closes on Escape', async () => {
    const m = await opened();
    try {
      m.escape();
      assert.equal(m.closed(), 1, 'untouched');
      m.type('Rebuilt the checkout page');
      m.type(OPENED_WITH);
      m.escape();
      assert.equal(m.closed(), 2, 'restored');
    } finally { await m.view.unmount(); }
  });

  it('Cancel and × still close a rewritten statement', async () => {
    const m = await opened();
    try {
      m.type('Rebuilt the checkout page');
      m.cancel();
      assert.equal(m.closed(), 1, 'Cancel');
      m.cross();
      assert.equal(m.closed(), 2, '×');
    } finally { await m.view.unmount(); }
  });
});
