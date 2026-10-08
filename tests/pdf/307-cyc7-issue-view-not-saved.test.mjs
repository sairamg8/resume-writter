// Two-devices journey (cycle 7): the issue view says when its edits are not being saved. The projects'
// "Changes are not being saved" notice (BoardStorageNotice, R2-037) sits at the top of each board page,
// and the issue view opens over the page as a dialog: a summary, status or comment changed there while
// browser storage refused the write looked saved, with the notice under the dimmed page (a phone's view
// covers the whole screen). The view now carries the same words itself, and drops them once a write
// reaches storage again. The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and
// store over fake-dom); the storage is made to refuse by replacing its setItem.
// Run: node --test tests/pdf/307-cyc7-issue-view-not-saved.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, boardActions, issueNow } from './issue-view-page.mjs';

useIssueViewPage();

const FULL = 'Changes are not being saved: browser storage is full. Your latest edits may be lost on reload.';

it('an issue edited while storage is full shows the not-saved notice inside the view, and loses it once a write is saved', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-1');
  try {
    const notice = () => page.all(page.dialog()).find((el) => el.getAttribute('role') === 'alert');
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    assert.equal(notice(), undefined, 'nothing is wrong yet: no notice in the view');

    const { setItem } = globalThis.localStorage;
    globalThis.localStorage.setItem = () => { throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); };
    page.view.act(() => { boardActions().updateIssue('p1', 'i1', { title: 'Fix the kitchen tap' }); });
    assert.equal(issueNow('i1').title, 'Fix the kitchen tap', 'the edit is in the store (in memory)');
    assert.ok(notice(), 'the view says the edit was not saved');
    assert.equal(notice().textContent.replace(/\s+/g, ' ').trim(), FULL);

    globalThis.localStorage.setItem = setItem;
    page.view.act(() => { boardActions().updateIssue('p1', 'i1', { title: 'Fix the bathroom tap' }); });
    assert.equal(notice(), undefined, 'a write that reached storage takes the notice away');
  } finally {
    await page.view.unmount();
  }
});
