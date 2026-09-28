// R4-DUX-08: the board with filters set.
//  (a) Group by None and a search that matches nothing left every column just empty: the
//      "No issues match these filters." line was only in the swimlane view. Now the columns view
//      says it too, with "Clear filters".
//  (b) "+ Create issue" in a column, with a summary the filters don't match, added the issue but it
//      never showed and nothing said so. Now a toast says "HOME-4 created — hidden by your filters",
//      and its "Open" opens the issue.
// The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and store over
// fake-dom, in a router whose history the test reads).
// Run: node --test tests/pdf/102-r4-dux-08-board-filtered.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, reactProps, ev } from './issue-view-page.mjs';

useIssueViewPage();

const MESSAGE = 'No issues match these filters.';

/** Types `text` into the toolbar's search. */
function search(page, text) {
  const input = page.all().find((el) => el.getAttribute('aria-label') === 'Search this project');
  assert.ok(input, 'the board has its search');
  page.view.act(() => reactProps(input).onChange(ev({ target: { value: text } })));
}

/** The column `title`'s section on the board. */
const column = (page, title) => page.all().find((el) => el.tagName === 'SECTION' && el.getAttribute('aria-label') === `${title} column`);
/** A button with text `text` under `node`. */
const buttonIn = (page, node, text) => page.all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);

/** "+ Create issue" in column `title`, `summary` typed, then Create. */
async function createIn(page, title, summary) {
  const open = buttonIn(page, column(page, title), 'Create issue');
  if (open) page.click(open); // the composer stays open after a create
  const field = page.all(column(page, title)).find((el) => el.getAttribute('aria-label') === 'Summary of the new issue');
  assert.ok(field, 'the column\'s composer opened');
  page.view.act(() => reactProps(field).onChange(ev({ target: { value: summary } })));
  page.click(buttonIn(page, column(page, title), 'Create'));
  await page.settle();
}

it('R4-DUX-08 (a): with Group by None, a search matching nothing says so over the columns, and Clear filters brings the cards back', async () => {
  const page = mountBoard('/boards/p1');
  try {
    assert.ok(page.card('HOME-2 Paint the fence'), 'the card shows before any filter');
    assert.ok(!page.view.document.body.textContent.includes(MESSAGE), 'no message without filters');
    search(page, 'zebra crossing');
    await page.settle();
    assert.equal(page.card('HOME-2 Paint the fence'), undefined, 'the search hides the card');
    assert.ok(page.view.document.body.textContent.includes(MESSAGE), 'the columns view says no issue matches');
    const clear = page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Clear filters' && el.parentNode.tagName === 'P');
    assert.ok(clear, 'the message offers Clear filters');
    page.click(clear);
    await page.settle();
    assert.ok(page.card('HOME-2 Paint the fence'), 'Clear filters shows the cards again');
    assert.ok(!page.view.document.body.textContent.includes(MESSAGE), 'and the message goes');
  } finally {
    await page.view.unmount();
  }
});

it('R4-DUX-08 (b): an issue created in a column but hidden by the filters gets a toast whose Open opens it; a matching one gets none', async () => {
  const page = mountBoard('/boards/p1', { toasts: true });
  try {
    search(page, 'fence');
    await page.settle();
    assert.ok(page.card('HOME-2 Paint the fence'), 'the search keeps HOME-2');

    await createIn(page, 'To Do', 'Water the plants');
    const text = () => page.view.document.body.textContent;
    assert.ok(text().includes('HOME-4 created — hidden by your filters'), 'a toast says the hidden issue was made');
    assert.equal(page.card('HOME-4 Water the plants'), undefined, 'the filters still hide it');

    await createIn(page, 'To Do', 'Sand the fence');
    assert.ok(page.card('HOME-5 Sand the fence'), 'a matching issue shows on the board');
    assert.ok(!text().includes('HOME-5 created'), 'and needs no toast');

    const open = page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Open');
    assert.ok(open, 'the toast offers to open the hidden issue');
    page.click(open);
    await page.settle();
    assert.equal(page.path(), '/boards/p1?issue=HOME-4');
    assert.equal(page.open(), 'HOME-4 Water the plants');
  } finally {
    await page.view.unmount();
  }
});
