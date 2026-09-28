// R4-DUX-09: a click beside the STAR / Bullet Optimizer's box closed it even after the statement had
// been rewritten, and the rewrite was gone (the editor mounts the modal only while it is open). Now a
// click beside the box is ignored while the statement differs from the one it opened with; Cancel and
// × still close it on purpose, and an untouched (or restored) statement still closes on a click beside
// it (R3-010). The real modal is mounted over tests/pdf/fake-dom.mjs and its backdrop pressed as a
// browser does (pointerdown, pointerup, click), as tests/pdf/96-modal-outside-click.test.mjs does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const OPENED_WITH = 'Worked on the checkout page for a fictional shop';

/** The optimizer open on OPENED_WITH; `closed()` counts its onClose calls. */
async function opened() {
  const { default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx');
  let closes = 0;
  const view = mount(BulletOptimizerModal, {
    isOpen: true, initialText: OPENED_WITH, onApply() {}, onClose: () => { closes += 1; },
  });
  const all = () => [...elements(view.container)];
  const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const backdrop = all().find((el) => /\bfixed inset-0\b/.test(el.getAttribute('class') || ''));
  assert.ok(backdrop, 'a full-screen backdrop');
  const buttons = () => all().filter((el) => el.tagName === 'BUTTON');
  return {
    view,
    closed: () => closes,
    /** A press that starts and ends on the backdrop: a click beside the box. */
    clickBeside: () => view.act(() => {
      reactProps(backdrop).onPointerDown({ target: backdrop, currentTarget: backdrop });
      reactProps(backdrop).onPointerUp({ target: backdrop, currentTarget: backdrop });
      reactProps(backdrop).onClick({ target: backdrop, currentTarget: backdrop });
    }),
    type: (value) => {
      const area = all().find((el) => el.tagName === 'TEXTAREA');
      view.act(() => reactProps(area).onChange({ target: { value } }));
    },
    text: () => reactProps(all().find((el) => el.tagName === 'TEXTAREA')).value,
    cancel: () => view.act(() => reactProps(buttons().find((el) => label(el) === 'Cancel')).onClick()),
    // The header's ×: the one button with no text (an icon only).
    cross: () => view.act(() => reactProps(buttons().find((el) => label(el) === '')).onClick()),
  };
}

describe('the Bullet Optimizer keeps a rewritten statement on a click beside the box (R4-DUX-09)', () => {
  it('a click beside the box, once the statement is rewritten, keeps it open with the rewrite', async () => {
    const m = await opened();
    try {
      m.type('Rebuilt the checkout page, lifting conversion by 12%');
      m.clickBeside();
      assert.equal(m.closed(), 0, 'not closed');
      assert.equal(m.text(), 'Rebuilt the checkout page, lifting conversion by 12%', 'the rewrite is still there');
    } finally { await m.view.unmount(); }
  });

  it('Cancel still closes a rewritten statement', async () => {
    const m = await opened();
    try {
      m.type('Rebuilt the checkout page');
      m.cancel();
      assert.equal(m.closed(), 1);
    } finally { await m.view.unmount(); }
  });

  it('the × still closes a rewritten statement', async () => {
    const m = await opened();
    try {
      m.type('Rebuilt the checkout page');
      m.cross();
      assert.equal(m.closed(), 1);
    } finally { await m.view.unmount(); }
  });

  it('an untouched statement, or one typed back to how it opened, still closes on a click beside the box', async () => {
    const m = await opened();
    try {
      m.clickBeside();
      assert.equal(m.closed(), 1, 'untouched');
      m.type('Rebuilt the checkout page');
      m.type(OPENED_WITH);
      m.clickBeside();
      assert.equal(m.closed(), 2, 'restored');
    } finally { await m.view.unmount(); }
  });
});
