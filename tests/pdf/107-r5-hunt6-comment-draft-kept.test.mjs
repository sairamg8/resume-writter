// R5-HUNT6-COMMENT-DRAFT-LOST-ON-CLOSE: a comment typed in the issue view (not yet saved) vanished
// without a word when the view closed (X, Escape, the backdrop) or another issue opened from it (the
// epic in the trail, a child row): the comment box kept its text only in its own state, and the
// view unmounts. The same went for a comment being edited. The description's open draft is saved
// when the view goes; now the comment box's text is too, into the issue it was typed in. Cancel
// still throws it away, and Save saves it once.
// The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and store over
// fake-dom, in a router whose history the test reads). Fictional data only.
// Run: node --test tests/pdf/107-r5-hunt6-comment-draft-kept.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, issueNow, reactProps, ev } from './issue-view-page.mjs';

useIssueViewPage();

const texts = (id) => (issueNow(id).comments ?? []).map((c) => c.text);

/** Opens the comment box of the open issue and types `text` into it. */
function typeComment(page, text) {
  page.click(page.button('Add a comment…'));
  page.view.act(() => reactProps(page.byLabel('Comment')).onChange(ev({ target: { value: text } })));
}

it('a comment typed and left unsaved is saved when the view is closed with its X', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    typeComment(page, 'Two coats, not one');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.deepEqual(texts('i2'), ['Two coats, not one'], 'the typed comment was thrown away');
  } finally {
    await page.view.unmount();
  }
});

it('a comment typed and left unsaved is saved on Escape', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    typeComment(page, 'Buy a wider brush');
    page.escape();
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.deepEqual(texts('i2'), ['Buy a wider brush']);
  } finally {
    await page.view.unmount();
  }
});

it('a comment typed on a child goes into the child when its epic is opened from the trail', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-1');
  try {
    typeComment(page, 'The washer is worn');
    page.click(page.buttonWith('HOME-3'));
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    assert.deepEqual(texts('i1'), ['The washer is worn'], 'the child keeps the comment typed on it');
    assert.deepEqual(texts('i3'), [], 'nothing went into the epic');
    assert.ok(page.button('Add a comment…'), 'the epic opens with its own, empty comment box');
  } finally {
    await page.view.unmount();
  }
});

it('an edit of a comment left unsaved is saved when the view closes; Cancel and Save still do what they say', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    // Save saves it once; Cancel throws the text away, and closing then saves nothing.
    typeComment(page, 'First thought');
    page.click(page.button('Save'));
    assert.deepEqual(texts('i2'), ['First thought']);
    typeComment(page, 'Never mind');
    page.click(page.button('Cancel'));
    page.click(page.button('Edit'));
    page.view.act(() => reactProps(page.byLabel('Comment')).onChange(ev({ target: { value: 'Changed my mind' } })));
    page.click(page.button('Cancel'));
    assert.deepEqual(texts('i2'), ['First thought'], 'Cancel kept nothing');

    page.click(page.button('Edit'));
    page.view.act(() => reactProps(page.byLabel('Comment')).onChange(ev({ target: { value: 'First thought, second draft' } })));
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.deepEqual(texts('i2'), ['First thought, second draft'], 'the edit was thrown away');
    assert.equal(issueNow('i2').comments.length, 1, 'one comment, not a second one');
  } finally {
    await page.view.unmount();
  }
});

it('an open box with nothing typed saves nothing when the view closes', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.button('Add a comment…'));
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null);
    assert.deepEqual(texts('i2'), []);
  } finally {
    await page.view.unmount();
  }
});
