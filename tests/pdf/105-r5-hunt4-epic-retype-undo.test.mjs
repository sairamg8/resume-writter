// R5-HUNT4-epic-retype-unlinks-children-no-undo: setting an epic's Issue type to Task, Story or Bug
// in its Details let every child issue go (boardIssueOps.updateIssue) with no word and no Undo, and
// setting it back to Epic did not bring them back. Deleting the same epic warns and offers Undo.
// Pinned: the retype shows a toast whose Undo makes the issue an epic again with its children
// relinked (a child moved to another epic meanwhile is left there). The real board page, issue view
// and store over fake-dom (tests/pdf/issue-view-page.mjs). Fictional data only.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow, elements } from './issue-view-page.mjs';

useIssueViewPage();

it('Undo on the retype makes the issue an epic again and relinks its children', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3', { toasts: true });
  try {
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    assert.equal(issueNow('i1').epicId, 'i3', 'HOME-1 starts as the epic\'s child');

    page.click(page.byLabel('Issue type: Epic'));
    page.click(page.item('Task'));
    await page.settle();
    assert.equal(issueNow('i3').type, 'task');
    assert.equal(issueNow('i1').epicId, null, 'a task has no children: HOME-1 leaves it');

    const toast = page.all().find((el) => el.hasAttribute?.('data-toast') && el.textContent.includes('HOME-3'));
    assert.ok(toast, 'the retype says the children left and offers Undo');
    assert.match(toast.textContent, /1 child issue/);
    const undo = [...elements(toast)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
    assert.ok(undo, 'the toast has Undo');
    page.click(undo);
    await page.settle();
    assert.equal(issueNow('i3').type, 'epic', 'Undo makes it an epic again');
    assert.equal(issueNow('i1').epicId, 'i3', 'and HOME-1 is its child again');
  } finally {
    await page.view.unmount();
  }
});

it('a type change that is not an epic with children shows no toast', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2', { toasts: true });
  try {
    await page.settle();
    page.click(page.byLabel('Issue type: Task'));
    page.click(page.item('Bug'));
    await page.settle();
    assert.equal(issueNow('i2').type, 'bug');
    assert.equal(page.all().find((el) => el.hasAttribute?.('data-toast')), undefined);
  } finally {
    await page.view.unmount();
  }
});
