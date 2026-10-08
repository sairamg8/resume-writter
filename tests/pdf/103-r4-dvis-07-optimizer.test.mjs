// R4-DVIS-07 (the Bullet / STAR Optimizer's part): the optimizer was a hand-built modal — a blurred
// gray backdrop, a rounded-2xl bordered box, a tinted header with a bold small title, animation
// classes defined nowhere (animate-in, zoom-in-95), no portal and no scroll lock — so it looked and
// behaved apart from the template gallery opened from the same editor and from the workspace dialogs.
// It is the kit's Dialog now: a role="dialog" panel in a [data-ui-portal] layer at the end of <body>,
// rounded-lg with a ring, the kit's title, close button and buttons. The real modal is mounted over
// tests/pdf/fake-dom.mjs (103-r4-optimizer-helpers.mjs) and the classes it is drawn with are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { optimizer, classes } from './103-r4-optimizer-helpers.mjs';

before(setup);
after(teardown);

it('R4-DVIS-07: the Bullet Optimizer is the kit\'s Dialog, in a portal, drawn as the other dialogs are', async () => {
  const o = await optimizer('Worked on the checkout page for a fictional shop');
  try {
    const dialog = o.all().find((el) => el.getAttribute('role') === 'dialog');
    assert.ok(dialog, 'a role="dialog" panel');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    let layer = dialog;
    while (layer && !layer.hasAttribute?.('data-ui-portal')) layer = layer.parentNode;
    assert.ok(layer, 'the dialog sits in the kit\'s portal layer');
    assert.ok(!o.view.container.contains(dialog), 'at the end of <body>, outside the editor that opened it');

    const panel = classes(dialog);
    for (const token of ['rounded-lg', 'ring-1', 'shadow-pop']) assert.ok(panel.includes(token), `the panel has ${token}: ${panel.join(' ')}`);
    for (const token of ['rounded-2xl', 'border-gray-200']) assert.ok(!panel.includes(token), `and not ${token}: ${panel.join(' ')}`);

    const title = o.find('H2', 'Bullet Optimizer & STAR Formula');
    assert.ok(title && dialog.contains(title), 'the title is the dialog\'s h2');
    const t = classes(title);
    assert.ok(t.includes('text-xl') && t.includes('font-medium'), `the kit's title: ${t.join(' ')}`);
    assert.ok(!t.includes('font-bold'), `not the old bold small title: ${t.join(' ')}`);

    // Nothing is left of the hand-built modal: its blur, and animation classes no stylesheet defines.
    for (const token of ['backdrop-blur-sm', 'animate-in', 'fade-in', 'zoom-in-95']) {
      const stray = o.all().find((el) => classes(el).includes(token));
      assert.equal(stray, undefined, `no element has ${token}`);
    }

    const close = o.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Close');
    assert.ok(close && dialog.contains(close), 'the kit\'s close button in the header');
    const apply = o.find('BUTTON', 'Apply to Resume');
    assert.ok(apply, 'Apply to Resume');
    assert.ok(classes(apply).includes('bg-brand') && !classes(apply).includes('bg-blue-600'), `Apply is the kit's primary button: ${classes(apply).join(' ')}`);
  } finally {
    await o.unmount();
  }
});
