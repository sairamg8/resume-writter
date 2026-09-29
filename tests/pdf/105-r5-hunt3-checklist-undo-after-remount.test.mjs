// R5-HUNT3-checklist-undo-overwrites-after-remount: Undo on "Checklist item deleted" wrote back the
// checklist as the IssueChecklist that did the delete last rendered it. That checklist unmounts
// when its last item goes (and when the issue view closes), so an item added afterwards in the new
// checklist was lost when Undo was clicked. Pinned: Undo puts the item back into the checklist as
// the store has it at the click. The real board page, issue view and store over fake-dom
// (tests/pdf/issue-view-page.mjs). Fictional data only.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, boardActions, issueNow, reactProps, ev, elements } from './issue-view-page.mjs';

useIssueViewPage();

it('Undo after the last item went and a new one was added keeps the new one', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-1', { toasts: true });
  try {
    await page.settle();
    page.view.act(() => { boardActions().updateIssue('p1', 'i1', { checklist: [{ id: 'chk_a', text: 'Buy paint', done: false }] }); });
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');

    const del = page.byLabel('Delete “Buy paint”');
    assert.ok(del, 'the checklist item has its delete');
    page.click(del);
    await page.settle();
    assert.deepEqual(issueNow('i1').checklist, [], 'the item goes at once');
    assert.equal(page.byLabel('Add a checklist item'), undefined, 'the empty checklist is gone from the view');

    // A new checklist is opened and an item added to it.
    page.click(page.button('Add checklist item'));
    await page.settle();
    const field = page.byLabel('Add a checklist item');
    assert.ok(field, 'Add checklist item opens the checklist again');
    page.view.act(() => reactProps(field).onChange(ev({ target: { value: 'Rinse the brushes' } })));
    page.view.act(() => reactProps(page.byLabel('Add a checklist item')).onKeyDown(ev({ key: 'Enter' })));
    await page.settle();
    assert.deepEqual(issueNow('i1').checklist.map((c) => c.text), ['Rinse the brushes']);

    const toast = page.all().find((el) => el.hasAttribute?.('data-toast') && el.textContent.includes('Checklist item deleted'));
    assert.ok(toast, 'the delete offered Undo');
    const undo = [...elements(toast)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
    page.click(undo);
    await page.settle();
    assert.deepEqual(issueNow('i1').checklist.map((c) => c.text), ['Buy paint', 'Rinse the brushes'],
      'the deleted item is back and the one added since is kept');
  } finally {
    await page.view.unmount();
  }
});
