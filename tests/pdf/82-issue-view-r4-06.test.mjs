// The issue view (IssueDialog over the board), Round 4:
//  - R4-BRD-06: "Pro tip: press M to comment" never worked: the Activity's `m` slept, as a page's
//    shortcuts do under a modal dialog, and the issue view is one. It opens the comment box now,
//    and is still only a letter while typing in a field.
// The page is mounted by tests/pdf/issue-view-page.mjs (the real board page and store over
// fake-dom, in a router whose history the test reads).
// Run: node --test tests/pdf/82-issue-view-r4-06.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useIssueViewPage, mountBoard, press, elements, reactProps, ev } from './issue-view-page.mjs';

useIssueViewPage();

it('R4-BRD-06: M in the issue view opens the comment box; typed in a field it is only a letter', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    await page.settle(); // the shortcut's listener is added in an effect
    // The path the shortcut used to stop on: the issue view is a modal dialog.
    assert.ok(page.view.document.querySelector('[aria-modal="true"]'), 'the issue view is modal');
    assert.equal(page.byLabel('Comment'), undefined, 'the comment box starts closed');
    assert.ok(page.button('Add a comment…'));

    const field = page.view.document.createElement('input');
    const typed = press(page.view, 'm', field);
    assert.equal(typed.defaultPrevented, false, 'an m typed in a field is the letter');
    assert.equal(page.byLabel('Comment'), undefined, 'an m typed in a field opened the comment box');

    const pressed = press(page.view, 'm', page.view.document.body);
    assert.ok(page.byLabel('Comment'), 'M did not open the comment box');
    assert.equal(page.byLabel('Comment').tagName, 'TEXTAREA');
    assert.equal(pressed.defaultPrevented, true, 'the m is the shortcut\'s, not typed into the box it opens');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-06: M with a comment half typed (the focus on a button) goes back to the box and keeps the text', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    await page.settle();
    page.click(page.button('Add a comment…'));
    const box = () => page.byLabel('Comment');
    page.view.act(() => reactProps(box()).onChange(ev({ target: { value: 'Half a thought' } })));
    assert.equal(reactProps(box()).value, 'Half a thought');
    const before = box();
    page.view.document.body.focus(); // the focus left the box: M is the shortcut, not a letter
    press(page.view, 'm', page.view.document.body);
    await page.settle();
    assert.ok(box(), 'the comment box is still open');
    assert.equal(reactProps(box()).value, 'Half a thought', 'M threw away the comment being typed');
    assert.ok(box() === before, 'M replaced the comment box with a new one');
    assert.ok(page.view.document.activeElement === box(), 'M did not put the focus back in the box');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-06: M on the History tab goes to Comments and opens the comment box', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    await page.settle();
    page.click(page.tab('History'));
    assert.equal(page.tab('History').getAttribute('aria-selected'), 'true');
    const box = page.button('Add a comment…');
    assert.ok(!box || box.closest('.hidden'), 'the History tab shows no comment box');
    press(page.view, 'm', page.view.document.body);
    await page.settle();
    assert.equal(page.tab('Comments').getAttribute('aria-selected'), 'true', 'M left the History tab showing, and nothing happened');
    assert.ok(page.byLabel('Comment'), 'M did not open the comment box');
    assert.ok(page.view.document.activeElement === page.byLabel('Comment'), 'the focus is not in the box');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-06: under a dialog stacked on the issue view (Delete\'s question), M leaves the comment box shut', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2', { confirms: true });
  try {
    await page.settle();
    page.click(page.byLabel('Issue actions'));
    page.click(page.item('Delete'));
    await page.settle();
    const question = () => page.all().find((el) => el.getAttribute('role') === 'alertdialog');
    assert.ok(question(), 'Delete asks first, in the kit\'s dialog over the issue view');
    press(page.view, 'm', page.view.document.body);
    assert.equal(page.byLabel('Comment'), undefined, 'M opened the comment box behind the question');

    // Answered (and animated out), the issue view is on top again: M is its shortcut once more.
    page.click([...elements(question())].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Cancel'));
    await new Promise((r) => { setTimeout(r, 300); });
    await page.settle();
    assert.equal(question(), undefined, 'the question went');
    press(page.view, 'm', page.view.document.body);
    assert.ok(page.byLabel('Comment'), 'M did not open the comment box once the question had gone');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-06: an M used, then Cancel, History and back to Comments: the box stays shut; a comment being typed survives History', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    await page.settle();
    press(page.view, 'm', page.view.document.body);
    await page.settle();
    assert.ok(page.byLabel('Comment'));
    page.click(page.button('Cancel'));
    page.click(page.tab('History'));
    page.click(page.tab('Comments'));
    await page.settle();
    assert.equal(page.byLabel('Comment'), undefined, 'coming back to Comments counted the old M again and opened the box');

    page.click(page.button('Add a comment…'));
    page.view.act(() => reactProps(page.byLabel('Comment')).onChange(ev({ target: { value: 'Half a thought' } })));
    page.click(page.tab('History'));
    page.click(page.tab('Comments'));
    assert.equal(reactProps(page.byLabel('Comment')).value, 'Half a thought', 'a look at History threw the comment away');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-06: M on a popover over the issue view (the Labels picker) leaves the comment box shut', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    await page.settle();
    page.click(page.byLabel('Labels: none'));
    await page.settle();
    // The picker's panel (a non-modal role="dialog" in a portal layer of its own), focus on it.
    const inPopover = page.all().find((el) => el.getAttribute('role') === 'dialog' && el !== page.dialog());
    assert.ok(inPopover, 'the Labels picker opened');
    assert.ok(inPopover.closest('[data-ui-portal]') !== page.dialog().closest('[data-ui-portal]'), 'in a layer of its own');
    assert.equal(inPopover.getAttribute('aria-modal'), null, 'not modal: the top-dialog check alone lets M through');
    press(page.view, 'm', inPopover);
    assert.equal(page.byLabel('Comment'), undefined, 'M from the popover opened the comment box behind it');
  } finally {
    await page.view.unmount();
  }
});
