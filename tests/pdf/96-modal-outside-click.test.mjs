// A click beside a modal's box closes it (the owner's ask, R3-010). The Bullet Optimizer, the Smart
// Cover Letter Generator and New Resume's starter picker had a full-screen backdrop with no handler, so
// only their × or Cancel closed them, while Share a public link, New Cover Letter and the icon picker
// closed on a click beside the box. Each is mounted open over the fake DOM and its backdrop pressed as a
// browser does (pointerdown, then click, each with its target): a press that starts and ends on the
// backdrop closes it; a click inside the box, or a press that starts inside (selecting text) and is
// released on the backdrop, does not — the kit's Dialog closes the same way.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const MODALS = {
  'Bullet Optimizer': ['/src/components/BulletOptimizerModal.jsx', () => ({ initialText: 'Led a team of five', onApply() {} })],
  'Smart Cover Letter Generator': ['/src/components/CoverLetterGeneratorModal.jsx', () => ({ resume: resume(), onApply() {} })],
  'New Resume starters': ['/src/components/StarterTemplateModal.jsx', () => ({ onSelectStarter() {}, onSelectBlank() {} })],
};

/** `name`'s modal mounted open; `closed()` counts its onClose calls, `backdrop` and `box` its two layers. */
async function opened(name) {
  const [path, props] = MODALS[name];
  const { default: Modal } = await loadModule(path);
  let closes = 0;
  const view = mount(Modal, { ...props(), isOpen: true, onClose: () => { closes += 1; } });
  const backdrop = [...elements(view.container)].find((el) => /\bfixed inset-0\b/.test(el.getAttribute('class') || ''));
  assert.ok(backdrop, `${name}: a full-screen backdrop`);
  const box = backdrop.firstChild;
  /** A press that goes down on `down` and is released on `up`, as the backdrop's handlers see it. */
  const press = (down, up) => view.act(() => {
    reactProps(backdrop).onPointerDown?.({ target: down, currentTarget: backdrop });
    reactProps(backdrop).onClick?.({ target: up, currentTarget: backdrop });
  });
  return { view, backdrop, box, press, closed: () => closes };
}

for (const name of Object.keys(MODALS)) {
  describe(name, () => {
    it('a click beside the box closes it', async () => {
      const m = await opened(name);
      try {
        m.press(m.backdrop, m.backdrop);
        assert.equal(m.closed(), 1, 'onClose once');
      } finally { await m.view.unmount(); }
    });

    it('a click inside the box, or a press begun inside and released beside it, keeps it open', async () => {
      const m = await opened(name);
      try {
        m.press(m.box, m.box);
        assert.equal(m.closed(), 0, 'a click inside');
        m.press(m.box, m.backdrop);
        assert.equal(m.closed(), 0, 'text selected inside, released outside');
        m.press(m.backdrop, m.backdrop);
        assert.equal(m.closed(), 1, 'then a click beside it still closes it');
      } finally { await m.view.unmount(); }
    });
  });
}
