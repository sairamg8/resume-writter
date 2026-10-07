// UI rebuild B5a: a card's more menu is a lazy chunk (CardMenu, with the kit's Menu). When its code cannot be
// had (offline, or a deploy replaced the file) the card keeps plain Edit, Copy and Delete buttons: every card
// function still works, the tab is not reloaded, and Copy still keeps its once-per-visit guard.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { elements } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { cv, dashboard, text, until } from './182-ui-b5a-mount.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const plain = (card, label) => [...elements(card)].find((el) => el.tagName === 'BUTTON' && text(el) === label);

it('with the menu\'s code unreachable each card shows plain Edit, Copy and Delete, and they work', async () => {
  const user = { uid: 'uid_1', email: 'someone@example.com', displayName: 'Someone' };
  const page = await dashboard([cv('resume_a', 'A CV', 1000), cv('resume_b', 'B CV', 2000)], { fail: ['menu'], answer: true, user });
  try {
    await until(() => plain(page.cards()[0], 'Copy'), 'the plain buttons');
    for (const card of page.cards()) for (const label of ['Edit', 'Copy', 'Delete']) assert.ok(plain(card, label), label);
    page.press(plain(page.cards()[0], 'Copy'));
    await until(() => page.calls.duplicate.length === 1, 'a copy made');
    assert.deepEqual(page.calls.duplicate, ['resume_a']);
    page.press(plain(page.cards()[1], 'Copy'));
    await page.settle();
    assert.equal(page.calls.duplicate.length, 1, 'once per visit, as with the menu');
    page.press(plain(page.cards()[1], 'Delete'));
    await until(() => page.calls.deleted.length === 1, 'deleted');
    assert.deepEqual(page.calls.deleted, [['resume_b', 'uid_1']]);
    assert.deepEqual(page.calls.unpublished, [['uid_1', 'resume_b']]);
    assert.equal(page.calls.reloads, 0, 'the page was not reloaded');
  } finally { await page.close(); }
});

it('before the menu\'s code arrives the card shows its own ⋯ button; a press made meanwhile opens the menu on arrival', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const page = await dashboard([cv('resume_a', 'A CV', 1000)], {
    custom: { menu: async () => { await gate; const m = await import('../../src/components/CardMenu.jsx'); return { default: m.CardMenu }; } },
  });
  try {
    assert.ok(page.more(page.cards()[0]), 'the ⋯ button is there while the code is on its way');
    page.press(page.more(page.cards()[0]));
    assert.ok(!page.item('Edit'), 'not open yet');
    release();
    await until(() => page.item('Edit'), 'the menu opened once its code arrived');
  } finally { await page.close(); }
});
