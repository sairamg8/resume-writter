// R5-HUNT7-DESCRIPTION-UNTOUCHED-FOLLOWS-NEWER: an issue's Description editor, opened and left with
// nothing typed while a newer description was saved in another tab (or pulled from the cloud), kept
// showing the old text; its Save, or the first key typed, wrote that old text back over the newer
// one. R5-HUNT7-DESCRIPTION-CLOSE-OVERWRITES-NEWER stopped only the save on close. Now an untouched
// editor follows the newer description, as the rich-text editor itself takes in an outside value
// when nothing has been typed in it (R5-HUNT3).
// The outside change is made through the store's actions, as another tab's sync lands one.
// Run: node --test tests/pdf/106-r5-hunt7-description-untouched-follows-newer.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow, boardActions } from './issue-view-page.mjs';

useIssueViewPage();

it('an untouched editor shows the newer description, and its Save keeps it', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    await page.settle();
    assert.match(page.byLabel('Description').innerHTML, /White/);
    page.view.act(() => { boardActions().updateIssue('p1', 'i2', { description: 'Green' }); });
    await page.settle();
    assert.match(page.byLabel('Description').innerHTML, /Green/, 'the editor kept the old text');
    page.click(page.button('Save'));
    await page.settle();
    assert.equal(issueNow('i2').description, 'Green', 'Save wrote the old text over the newer one');
  } finally {
    await page.view.unmount();
  }
});

it('a typed draft does not follow a newer description; Save still keeps what was typed', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    await page.settle();
    page.typeDescription('Two coats of white');
    await page.settle();
    page.view.act(() => { boardActions().updateIssue('p1', 'i2', { description: 'Green' }); });
    await page.settle();
    assert.match(page.byLabel('Description').innerHTML, /Two coats of white/, 'the typed draft was replaced');
    page.click(page.button('Save'));
    await page.settle();
    assert.equal(issueNow('i2').description, 'Two coats of white');
  } finally {
    await page.view.unmount();
  }
});
