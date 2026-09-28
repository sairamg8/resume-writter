// R4-DPH-37 (the Bullet / STAR Optimizer's part): its box was capped at max-h-[90vh] and centred in a
// fixed backdrop that did not scroll. On iOS Safari vh is the viewport with the toolbars hidden, taller
// than what shows, and the optimizer's body reaches the cap on a phone: about 20 px of the header (the
// title and ×) and of the footer (Cancel and Apply) were cut off, with no way to scroll to them. It is
// the kit's Dialog at size lg now: the whole screen below sm (h-dvh, the height that shows), capped at
// calc(100dvh - 2rem) above it, in an overlay that scrolls, its body scrolling between the title and the
// action row. The fake DOM has no layout: the real modal is mounted (103-r4-optimizer-helpers.mjs) and
// the classes that size it are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { optimizer, classes } from './103-r4-optimizer-helpers.mjs';

before(setup);
after(teardown);

it('R4-DPH-37: the optimizer fits the screen that shows — dvh, not 90vh — and its body scrolls between the title and the actions', async () => {
  // A long statement and a weak phrase: the body at its tallest (the tip and the Auto-Fix bar show).
  const o = await optimizer('Responsible for the checkout page of a fictional shop, and for its payments, search and support pages');
  try {
    const stray = o.all().find((el) => classes(el).includes('max-h-[90vh]'));
    assert.equal(stray, undefined, 'no box is capped at 90vh');

    const dialog = o.all().find((el) => el.getAttribute('role') === 'dialog');
    assert.ok(dialog, 'the optimizer\'s panel');
    const panel = classes(dialog);
    for (const token of ['max-h-[calc(100dvh-2rem)]', 'max-sm:h-dvh', 'max-sm:max-h-dvh', 'flex-col']) {
      assert.ok(panel.includes(token), `the panel has ${token}: ${panel.join(' ')}`);
    }
    const overlay = classes(dialog.parentNode);
    assert.ok(overlay.includes('overflow-y-auto'), `the layer around it scrolls: ${overlay.join(' ')}`);
    assert.ok(overlay.includes('max-sm:p-0'), `and has no margin on a phone: ${overlay.join(' ')}`);

    // The body is the panel's child that holds the statement; the actions are outside it.
    let body = o.all().find((el) => el.tagName === 'TEXTAREA');
    while (body && body.parentNode !== dialog) body = body.parentNode;
    assert.ok(body, 'the statement is in the panel');
    for (const token of ['overflow-y-auto', 'min-h-0', 'flex-1']) {
      assert.ok(classes(body).includes(token), `the body scrolls inside the panel (${token}): ${classes(body).join(' ')}`);
    }
    const cancel = o.find('BUTTON', 'Cancel');
    const close = o.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Close');
    for (const [name, el] of [['Cancel', cancel], ['the close button', close]]) {
      assert.ok(el && dialog.contains(el) && !body.contains(el), `${name} stays in view, outside the scrolling body`);
    }
  } finally {
    await o.unmount();
  }
});
