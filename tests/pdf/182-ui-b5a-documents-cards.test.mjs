// UI rebuild B5a: the Documents page and its cards (Dashboard.jsx, ResumeCard.jsx, CardMenu.jsx). Every card
// function now lives behind the card's ⋯ menu (Edit, Rename, Copy, Delete): each still does what the row of
// buttons did, with the same guards. The real Dashboard over tests/pdf/fake-dom.mjs (182-ui-b5a-mount.mjs).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { elements } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { cv, letter, dashboard, text, until } from './182-ui-b5a-mount.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const list = () => [cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000), cv('resume_c', 'Middle CV', 2000)];
const nameOf = (card) => text([...elements(card)].find((el) => el.tagName === 'P' && el.getAttribute('title')));

it('the page is called Documents, lists the cards in the order the store holds, and each card reads "template · age"', async () => {
  const page = await dashboard(list());
  try {
    assert.ok(page.all().some((el) => el.tagName === 'H1' && text(el) === 'Documents'));
    assert.deepEqual(page.cards().map(nameOf), ['Older CV', 'Newest CV', 'Middle CV'], 'creation order, not recently edited (SHEL-048)');
    for (const card of page.cards()) assert.match(text(card), /Classic · .+/, 'the template and the age, as the live card says it (MOBI-027)');
  } finally { await page.close(); }
});

it('a card name keeps two lines; the more button is a plain button (no hover-only reveal), so a touch screen reaches it', async () => {
  const page = await dashboard(list());
  try {
    const card = page.cards()[0];
    const name = [...elements(card)].find((el) => el.tagName === 'P' && el.getAttribute('title'));
    assert.match(String(name.className ?? name.getAttribute('class')), /line-clamp-2/);
    const more = page.more(card);
    assert.ok(more, 'a ⋯ button on the card');
    const cls = String(more.getAttribute('class') ?? more.className);
    assert.doesNotMatch(cls, /opacity-0|\bhidden\b|group-hover/, 'drawn without a hover');
  } finally { await page.close(); }
});

it('the menu offers Edit, Rename, Copy and Delete; Copy copies the card once per visit', async () => {
  const page = await dashboard(list());
  try {
    await page.openMenu(page.cards()[1]);
    for (const label of ['Edit', 'Rename', 'Copy', 'Delete']) assert.ok(page.item(label), label);
    page.press(page.item('Copy'));
    await until(() => page.calls.duplicate.length === 1, 'a copy made');
    assert.deepEqual(page.calls.duplicate, ['resume_b']);
    // The second Copy must really be pressed: a menu that did not open, or no Copy in it, would leave the count at 1 and pass.
    await page.openMenu(page.cards()[1]);
    assert.ok(page.item('Copy'), 'the menu opened again with its Copy');
    page.press(page.item('Copy'));
    await page.settle();
    assert.equal(page.calls.duplicate.length, 1, 'the guard: the editor is still opening, so no second copy');
  } finally { await page.close(); }
});

it('Rename in the menu opens the inline name box on that card', async () => {
  const page = await dashboard(list());
  try {
    await page.openMenu(page.cards()[0]);
    page.press(page.item('Rename'));
    await until(() => page.all().some((el) => el.getAttribute('aria-label') === 'Résumé name'), 'the name box');
  } finally { await page.close(); }
});

it('Delete asks the question with the live text; a no changes nothing, a yes deletes and takes the public copy down for a résumé only', async () => {
  const user = { uid: 'uid_1', email: 'someone@example.com', displayName: 'Someone' };
  const no = await dashboard(list(), { answer: false, user });
  try {
    await no.openMenu(no.cards()[0]);
    no.press(no.item('Delete'));
    await no.settle();
    assert.deepEqual(no.calls.asked, ['Delete "Older CV"? This cannot be undone.']);
    assert.deepEqual(no.calls.deleted, []);
    assert.deepEqual(no.calls.unpublished, []);
  } finally { await no.close(); }
  const yes = await dashboard([...list(), letter('letter_1', 'My Letter', 500)], { answer: true, user });
  try {
    await yes.openMenu(yes.cards()[0]);
    yes.press(yes.item('Delete'));
    await until(() => yes.calls.deleted.length === 1, 'deleted');
    assert.deepEqual(yes.calls.deleted, [['resume_a', 'uid_1']]);
    assert.deepEqual(yes.calls.unpublished, [['uid_1', 'resume_a']], 'SHEL-047: the public copy goes with the résumé');
    const letterCard = yes.cards().find((c) => nameOf(c) === 'My Letter');
    await yes.openMenu(letterCard);
    yes.press(yes.item('Delete'));
    await until(() => yes.calls.deleted.length === 2, 'the letter deleted');
    assert.equal(yes.calls.unpublished.length, 1, 'a letter has no public copy: nothing taken down');
  } finally { await yes.close(); }
});
