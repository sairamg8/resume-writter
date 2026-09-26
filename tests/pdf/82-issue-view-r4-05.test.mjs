// The issue view (IssueDialog over the board), Round 4:
//  - R4-BRD-05: closing the view pushed one more history entry, so Back reopened the issue. Closing
//    now undoes the opening (an epic and the child opened from it, too), and Back after it leaves
//    the board for the page before; an issue named by a shared link closes in place. Deleting the
//    issue from its view and the trail's project link (on the board) close the same way.
// The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and store over
// fake-dom, in a router whose history the test reads).
// Run: node --test tests/pdf/82-issue-view-r4-05.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow, elements, reactProps, ev } from './issue-view-page.mjs';

useIssueViewPage();

it('R4-BRD-05: closing an issue opened from its card undoes the opening: Back then leaves the board', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    assert.equal(page.open(), 'HOME-2 Paint the fence');
    assert.equal(page.path(), '/boards/p1?issue=HOME-2');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after closing the issue opened it again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: Back with the issue open still closes it', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    page.back();
    await page.settle();
    assert.equal(page.open(), null, 'Back closed the view');
    assert.equal(page.path(), '/boards/p1');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: an issue, then its epic opened from it, close together; Back from the epic goes back to the issue', async () => {
  // The board shows no card for an epic: the child's card opens the child, its trail the epic.
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-1 Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    page.click(page.buttonWith('HOME-3'));
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover', 'the trail opened the epic');
    page.back();
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap', 'Back from the epic shows the issue it was opened from');
    page.click(page.buttonWith('HOME-3'));
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    page.escape();
    await page.settle();
    assert.equal(page.open(), null, 'closing the epic closed the view, not only the epic');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after closing opened an issue again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: an issue named by a shared link closes in place; Back then leaves the board', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    assert.equal(page.open(), 'HOME-2 Paint the fence');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after closing the shared issue opened it again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: a child opened from a shared epic, then closed, closes the view — not back to the epic', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3');
  try {
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'closing the child showed the epic again');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: deleting the issue from its view closes it the same way', async () => {
  const page = mountBoard('/boards/p1');
  page.view.window.confirm = () => true;
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    page.click(page.byLabel('Issue actions'));
    page.click(page.item('Delete'));
    await page.settle();
    assert.equal(issueNow('i2'), undefined, 'the issue was deleted');
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after deleting went to the deleted issue\'s address');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: on the board, the trail\'s project link closes the view the same way', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    const link = page.dialog() && [...elements(page.dialog())].find((el) => el.tagName === 'A' && el.textContent.trim() === 'Home jobs');
    assert.ok(link, 'the trail links the project');
    page.clickLink(link);
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after the project link opened the issue again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: a second close before the first has landed (a double-clicked X, Escape held down) closes once, not off the board', async () => {
  for (const how of ['X', 'Escape']) {
    const page = mountBoard('/boards/p1');
    try {
      page.click(page.card('HOME-2 Paint the fence'));
      await page.settle();
      assert.equal(page.path(), '/boards/p1?issue=HOME-2');
      // Both in one batch: a browser's Back lands a while after it is asked for.
      const [el, handler, props] = how === 'X'
        ? [page.byLabel('Close'), 'onClick', {}]
        : [page.dialog().parentNode.parentNode, 'onKeyDown', { key: 'Escape', repeat: true }];
      page.view.act(() => {
        reactProps(el)[handler](ev(props));
        reactProps(el)[handler](ev(props));
      });
      await page.settle();
      assert.equal(page.open(), null, `${how}: the view closed`);
      assert.equal(page.path(), '/boards/p1', `${how}: the second close stepped back off the board`);
    } finally {
      await page.view.unmount();
    }
  }
});

it('R4-BRD-05: a duplicate opened from its toast after the view closed closes back to the board, not off it', async () => {
  const page = mountBoard('/boards/p1', { toasts: true });
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    page.click(page.byLabel('Issue actions'));
    page.click(page.item('Duplicate'));
    await page.settle();
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.path(), '/boards/p1');
    // The toast's "Open" was handed out while HOME-2 was open, one entry deep.
    const open = page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Open');
    assert.ok(open, 'the Duplicate toast offers to open the copy');
    page.click(open);
    await page.settle();
    assert.equal(page.path(), '/boards/p1?issue=HOME-4');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.path(), '/boards/p1', 'closing the copy stepped back past the board');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere');
  } finally {
    await page.view.unmount();
  }
});
