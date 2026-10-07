// UI rebuild B5a: the Cover Letters group stays a group of its own (R2-135), with its own New cover letter
// (three cases: no résumé, one, several -> the picker) and the once-per-visit guard; a letter's card has
// the same menu. The real Dashboard (182-ui-b5a-mount.mjs).
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

const group = (page) => page.all().find((el) => el.tagName === 'SECTION' && el.getAttribute('aria-labelledby') === 'dashboard-letters');
const dialog = (page) => page.all().find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed');

it('letters are listed in their own group, never among the résumés, and counted there', async () => {
  const page = await dashboard([cv('resume_a', 'A CV', 1000), letter('letter_a', 'A Letter', 2000)]);
  try {
    const g = group(page);
    assert.ok(g, 'the Cover Letters group');
    assert.match(text(g), /Cover Letters/);
    assert.match(text(g), /1 letter/);
    const inGroup = [...elements(g)].filter((el) => el.getAttribute('data-testid') === 'resume-card');
    assert.equal(inGroup.length, 1);
    assert.equal(page.cards().length, 2, 'one résumé card above, one letter card in the group');
  } finally { await page.close(); }
});

it('New Cover Letter: no résumé makes a blank letter, one résumé makes it from that one, once per visit', async () => {
  const none = await dashboard([letter('letter_a', 'A Letter', 2000)]);
  try {
    none.press(none.button('New Cover Letter'));
    await until(() => none.calls.made.length === 1, 'a letter made');
    assert.deepEqual(none.calls.made, [null]);
  } finally { await none.close(); }
  const one = await dashboard([cv('resume_a', 'A CV', 1000)]);
  try {
    one.press(one.button('New Cover Letter'));
    await until(() => one.calls.made.length === 1, 'a letter made');
    assert.deepEqual(one.calls.made, ['resume_a']);
    one.press(one.button('New Cover Letter'));
    await one.settle();
    assert.equal(one.calls.made.length, 1, 'the second press of the same visit makes no second letter');
  } finally { await one.close(); }
});

it('New Cover with several résumés opens the picker; picking one makes the letter from it', async () => {
  const page = await dashboard([cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)]);
  try {
    page.press(page.button('New Cover'));
    await until(() => dialog(page), 'the picker');
    assert.deepEqual(page.calls.made, [], 'nothing made before a pick');
    const pick = [...elements(dialog(page))].find((el) => el.tagName === 'BUTTON' && /Older CV/.test(text(el)));
    assert.ok(pick, 'a choice for each résumé');
    page.press(pick);
    await until(() => page.calls.made.length === 1, 'a letter made');
    assert.deepEqual(page.calls.made, ['resume_a']);
  } finally { await page.close(); }
});

it('a letter card has the same menu, and deleting a résumé does not delete a letter (a letter is its own record)', async () => {
  const page = await dashboard([cv('resume_a', 'A CV', 1000), letter('letter_a', 'A Letter', 2000)], { answer: true });
  try {
    const letterCard = [...page.cards()].find((c) => /A Letter/.test(text(c)));
    await page.openMenu(letterCard);
    for (const label of ['Edit', 'Rename', 'Copy', 'Delete']) assert.ok(page.item(label), label);
    page.press(page.item('Edit'));
    await page.settle();
    const resumeCard = [...page.cards()].find((c) => /A CV/.test(text(c)));
    await page.openMenu(resumeCard);
    page.press(page.item('Delete'));
    await until(() => page.calls.deleted.length === 1, 'deleted');
    assert.deepEqual(page.calls.deleted.map(([id]) => id), ['resume_a'], 'only the résumé');
  } finally { await page.close(); }
});
