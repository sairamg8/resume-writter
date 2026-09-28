// R4-DUX-20: a job's task (Tasks tab) and an issue's checklist item went at one click, with no
// confirm and no undo, while jobs, issues and projects all offer Undo. Each delete now shows a
// toast ('Task deleted' / 'Checklist item deleted') whose Undo puts the item back at its index,
// into the list as it is then: an edit made between the delete and the Undo is kept, not
// overwritten by the list as it was at the delete. The real components inside the kit's
// ToastProvider, over tests/pdf/fake-dom.mjs, the list held by a parent as the pages hold it.
// Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

let TasksTab;
let IssueChecklist;
let ToastProvider;
before(async () => {
  await setup();
  // The kit's tooltip and dialogs ask the DOM for a little more than fake-dom has.
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  ({ TasksTab } = await loadModule('/src/components/job/TasksTab.jsx'));
  ({ IssueChecklist } = await loadModule('/src/components/board/IssueChecklist.jsx'));
  ({ ToastProvider } = await loadModule('/src/components/ui/Toast.jsx'));
});
after(teardown);

const ev = (el, extra = {}) => ({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...extra });

/** `List` inside a ToastProvider, its list (`prop`) held in state as a page holds it; `now()` reads it. */
function host(List, prop, initial) {
  let current = initial;
  function Host() {
    const [items, setItems] = useState(initial);
    current = items;
    return createElement(ToastProvider, null, createElement(List, { [prop]: items, onChange: setItems }));
  }
  const view = mount(Host, {});
  // The toasts are portalled to <body>, outside the container.
  const all = () => [...elements(view.document.body)];
  return {
    view,
    now: () => current,
    all,
    fire: (el, handler, extra) => view.act(() => reactProps(el)[handler](ev(el, extra))),
    toasts: () => all().filter((el) => el.hasAttribute('data-toast')),
  };
}

/** The Undo of the toast titled `title`. */
function undoOf(page, title) {
  const toast = page.toasts().find((el) => el.textContent.includes(title));
  assert.ok(toast, `no '${title}' toast: the delete offered no Undo`);
  const undo = [...elements(toast)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
  assert.ok(undo, 'the toast has an Undo button');
  return undo;
}

it("a task's delete offers Undo, which puts it back at its place and keeps a tick made meanwhile", async () => {
  const page = host(TasksTab, 'todos', [
    { id: 't1', text: 'Email the recruiter', done: false },
    { id: 't2', text: 'Draft a portfolio case study', done: false },
    { id: 't3', text: 'Book a mock interview', done: false },
  ]);
  try {
    const row = (text) => page.all().find((el) => el.tagName === 'SPAN' && el.textContent === text).parentNode;
    page.fire(row('Draft a portfolio case study').childNodes.at(-1), 'onClick');
    assert.deepEqual(page.now().map((t) => t.id), ['t1', 't3'], 'the task goes at once');

    const undo = undoOf(page, 'Task deleted');
    // Meanwhile, the first task is ticked.
    page.fire(row('Email the recruiter').childNodes[0], 'onClick');
    assert.equal(page.now()[0].done, true);

    page.fire(undo, 'onClick');
    assert.deepEqual(page.now().map((t) => t.id), ['t1', 't2', 't3'], 'back at its index');
    assert.equal(page.now()[0].done, true, 'the tick made after the delete is kept');
    assert.deepEqual(page.now()[1], { id: 't2', text: 'Draft a portfolio case study', done: false }, 'the task as it was');
  } finally {
    await page.view.unmount();
  }
});

it("a checklist item's delete offers Undo, which puts it back at its place and keeps an item added meanwhile", async () => {
  const page = host(IssueChecklist, 'items', [
    { id: 'chk_a', text: 'Write the migration', done: false },
    { id: 'chk_b', text: 'Update the fixtures', done: true },
    { id: 'chk_c', text: 'Ask for review', done: false },
  ]);
  try {
    const byLabel = (label) => page.all().find((el) => el.getAttribute('aria-label') === label);
    page.fire(byLabel('Delete “Write the migration”'), 'onClick');
    assert.deepEqual(page.now().map((c) => c.id), ['chk_b', 'chk_c'], 'the item goes at once');

    const undo = undoOf(page, 'Checklist item deleted');
    // Meanwhile, an item is added and another ticked.
    const field = byLabel('Add a checklist item');
    page.fire(field, 'onChange', { target: { value: 'Tag the release' } });
    page.fire(byLabel('Add a checklist item'), 'onKeyDown', { key: 'Enter' });
    page.fire(byLabel('Done: Ask for review'), 'onChange', { target: { checked: true } });
    assert.deepEqual(page.now().map((c) => c.text), ['Update the fixtures', 'Ask for review', 'Tag the release']);

    page.fire(undo, 'onClick');
    assert.deepEqual(page.now().map((c) => c.text), ['Write the migration', 'Update the fixtures', 'Ask for review', 'Tag the release'],
      'back at its index, the added item kept');
    assert.equal(page.now()[2].done, true, 'the tick made after the delete is kept');
  } finally {
    await page.view.unmount();
  }
});
