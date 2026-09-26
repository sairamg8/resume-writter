// The issue view (IssueDialog over the board), Round 4:
//  - R4-BRD-02: opening another issue from the view (an epic's child row, the epic in the trail)
//    showed the new issue with the old one's state: a half-typed description (and Save wrote it into
//    the new issue), an open comment box, the checklist's new row, the Activity tab. Each issue now
//    starts from its own view.
// The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and store over
// fake-dom, in a router whose history the test reads).
// Run: node --test tests/pdf/82-issue-view-r4-02.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow } from './issue-view-page.mjs';

useIssueViewPage();

it('R4-BRD-02: a child opened from its epic shows its own description, not the epic\'s half-typed draft', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3');
  try {
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Plant the roses');
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap', 'the child row opened the child');
    assert.equal(page.byLabel('Description'), undefined, 'the child opened with the epic\'s description editor, its draft in it');
    assert.ok(page.byLabel('Edit description'), 'the child shows its own description, ready to edit');
    // Editing the child's description starts from the child's (empty) one.
    page.click(page.byLabel('Edit description'));
    page.click(page.button('Save'));
    assert.equal(issueNow('i1').description ?? '', '', 'Save wrote the epic\'s draft into the child');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-02: the comment box, the checklist\'s new row and the Activity tab stay with the issue they were opened on', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-1');
  try {
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    page.click(page.button('Add a comment…'));
    assert.ok(page.byLabel('Comment'), 'the comment box opened');
    page.click(page.button('Add checklist item'));
    assert.ok(page.byId('issue-checklist-heading'), 'the checklist opened');
    page.click(page.tab('History'));
    assert.equal(page.tab('History').getAttribute('aria-selected'), 'true');

    // The trail's epic link opens the epic.
    page.click(page.buttonWith('HOME-3'));
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    assert.equal(page.byLabel('Comment'), undefined, 'the epic opened with the child\'s comment box open');
    assert.ok(page.button('Add a comment…'));
    assert.equal(page.byId('issue-checklist-heading'), undefined, 'the epic (no checklist) opened with a checklist row to fill');
    assert.equal(page.tab('Comments').getAttribute('aria-selected'), 'true', 'the epic opened on the child\'s History tab');
  } finally {
    await page.view.unmount();
  }
});
