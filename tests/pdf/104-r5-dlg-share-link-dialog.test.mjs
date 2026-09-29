// R4-DVIS-07 (Share a public link's part), with R5-DLG-02 and its R4-DPH-37 part: Export → Share a public
// link opened a hand-built modal — a blurred gray backdrop, a rounded-2xl bordered box with a blue Globe
// badge, a body capped at max-h-[70vh] under a header outside the cap in a backdrop that did not scroll
// (a short landscape phone cut it off). Its only Escape handler sat on that backdrop and nothing moved
// focus into the modal as it opened — the Export menu item that had focus unmounts — so pressing Escape
// right after opening did nothing until the user clicked inside. It is the kit's Dialog at size md now:
// in a portal at the end of <body>, focus moved into it as it opens so Escape closes it at once, capped
// at calc(100dvh - 2rem) in an overlay that scrolls, its body the one scroller. The real modal is
// mounted over tests/pdf/fake-dom.mjs (104-r5-dlg-helpers.mjs) with a fake io: nothing is published.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume } from './harness.mjs';
import { openModal, classes, label, pressKey, until } from './104-r5-dlg-helpers.mjs';

before(setup);
after(teardown);

const share = () => openModal('/src/components/ShareLinkModal.jsx', {
  resume: resume({ personal: { name: 'Jordan Ellery', email: 'jordan@example.org' } }), uid: 'uid_owner', io: { readShare: async () => null },
});

it('R4-DVIS-07: Share a public link is the kit\'s Dialog, in a portal, drawn as the other dialogs are', async () => {
  const m = await share();
  try {
    await until(m.view, () => m.find('BUTTON', 'Publish'));
    const dialog = m.dialog();
    assert.ok(dialog, 'a role="dialog" panel');
    let layer = dialog;
    while (layer && !layer.hasAttribute?.('data-ui-portal')) layer = layer.parentNode;
    assert.ok(layer, 'in the kit\'s portal layer, at the end of <body>');
    assert.ok(!m.view.container.contains(dialog));
    assert.ok(classes(dialog).includes('rounded-lg') && classes(dialog).includes('md:max-w-lg'), classes(dialog).join(' '));
    for (const token of ['backdrop-blur-sm', 'rounded-2xl']) {
      assert.equal(m.all().find((el) => classes(el).includes(token)), undefined, `no element has ${token}`);
    }
    const title = m.find('H2', 'Share a public link');
    assert.ok(title && classes(title).includes('text-xl'), 'the kit\'s title');
    assert.ok(label(dialog).includes('What would be public:'), 'what publishing would show, as before');
    assert.ok(m.find('BUTTON', 'Publish'), 'and Publish');
  } finally { await m.unmount(); }
});

it('R5-DLG-02: Escape closes it right after it opens, with no click inside first', async () => {
  const m = await share();
  try {
    const doc = m.view.document;
    const focused = doc.activeElement ?? doc.body;
    assert.ok(m.dialog()?.contains(focused), 'focus moved into the dialog as it opened');
    pressKey(m.view, focused, 'Escape');
    assert.equal(m.closes(), 1, 'Escape, pressed wherever focus is, closes it');
  } finally { await m.unmount(); }
});

it('R4-DPH-37: it fits the screen that shows — no vh cap — with its body the one scroller', async () => {
  const m = await share();
  try {
    await until(m.view, () => m.find('BUTTON', 'Publish'));
    assert.equal(m.all().find((el) => classes(el).some((t) => /^max-h-\[\d+vh\]$/.test(t))), undefined, 'no box capped in vh');
    const dialog = m.dialog();
    assert.ok(classes(dialog).includes('max-h-[calc(100dvh-2rem)]'), classes(dialog).join(' '));
    assert.ok(classes(dialog.parentNode).includes('overflow-y-auto'), 'the layer around it scrolls');
    let body = m.find('BUTTON', 'Publish');
    while (body && body.parentNode !== dialog) body = body.parentNode;
    for (const token of ['overflow-y-auto', 'min-h-0', 'flex-1']) assert.ok(classes(body).includes(token), `the body scrolls (${token})`);
    assert.equal(m.all().filter((el) => dialog.contains(el) && classes(el).includes('overflow-y-auto')).length, 1, 'one scroll area');
  } finally { await m.unmount(); }
});
