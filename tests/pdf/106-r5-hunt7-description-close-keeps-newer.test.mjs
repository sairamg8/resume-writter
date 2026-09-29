// R5-HUNT7-DESCRIPTION-CLOSE-OVERWRITES-NEWER: closing an issue with its Description editor open, even
// with nothing typed, wrote the old text back over a newer description saved meanwhile in another tab
// (or pulled from the cloud). The save-on-close (R4-BRD-03) compared the draft with the issue's current
// value, so an untouched draft of the old text looked changed once the value moved on. Now it saves
// only a draft changed from the text the editor opened on.
// The outside change is made through the store's actions, as another tab's sync lands one.
// Run: node --test tests/pdf/106-r5-hunt7-description-close-keeps-newer.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow, boardActions } from './issue-view-page.mjs';

useIssueViewPage();

it('an untouched editor left open does not write the old description over a newer one on close', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    await page.settle();
    page.view.act(() => { boardActions().updateIssue('p1', 'i2', { description: 'Green' }); });
    await page.settle();
    assert.equal(issueNow('i2').description, 'Green');
    const activity = (issueNow('i2').activity ?? []).length;
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(issueNow('i2').description, 'Green', 'the other tab\'s description was written over');
    assert.equal((issueNow('i2').activity ?? []).length, activity, 'closing logged a change');
  } finally {
    await page.view.unmount();
  }
});

it('a draft typed in the editor is still saved on close, over the newer value', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    page.view.act(() => { boardActions().updateIssue('p1', 'i2', { description: 'Green' }); });
    await page.settle();
    page.typeDescription('Two coats of white');
    page.escape();
    await page.settle();
    assert.equal(page.open(), null, 'Escape closed the view');
    assert.equal(issueNow('i2').description, 'Two coats of white', 'the typed draft was thrown away');
  } finally {
    await page.view.unmount();
  }
});
