// The issue view (IssueDialog over the board), Round 4:
//  - R4-BRD-03: a description being edited was thrown away without a word when the view closed
//    (the X, Escape) or another issue opened. The product call: autosave, as every other field of
//    the view does — the draft is saved into the issue it was typed in; Cancel still discards it.
// The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and store over
// fake-dom, in a router whose history the test reads).
// Run: node --test tests/pdf/82-issue-view-r4-03.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow } from './issue-view-page.mjs';

useIssueViewPage();

it('R4-BRD-03: a description left open is saved when the view closes with its X', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Two coats of white');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(issueNow('i2').description, 'Two coats of white', 'the typed description was thrown away');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: a description left open is saved when the view closes with Escape', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Sand it first');
    page.escape();
    await page.settle();
    assert.equal(page.open(), null, 'Escape closed the view');
    assert.equal(issueNow('i2').description, 'Sand it first', 'the typed description was thrown away');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: a draft left open when a child opens is saved into the epic it was typed in, not the child', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3');
  try {
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Plant the roses');
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    assert.equal(issueNow('i3').description, 'Plant the roses', 'the epic\'s draft was thrown away');
    assert.equal(issueNow('i1').description ?? '', '', 'the epic\'s draft went into the child');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: Cancel still discards the draft, and an editor opened and left untouched saves nothing', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    const before = issueNow('i2');
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Not this');
    page.click(page.button('Cancel'));
    page.click(page.byLabel('Edit description'));
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(issueNow('i2').description, 'White', 'Cancel kept the old description');
    assert.equal(issueNow('i2').updatedAt, before.updatedAt, 'the untouched editor saved a change');
    assert.equal((issueNow('i2').activity ?? []).length, (before.activity ?? []).length, 'the untouched editor logged a change');
  } finally {
    await page.view.unmount();
  }
});
