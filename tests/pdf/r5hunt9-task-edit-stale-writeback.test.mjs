// R5-HUNT9-TASK-EDIT-STALE-WRITEBACK: a job task's text box, opened and left untouched, put its old
// text back when clicked away from if another tab (or a cloud-sync pull) had renamed the task in the
// meantime: commit() compared the draft with the task's current text, not with the text the box
// opened with, and so saved the stale draft over the newer rename. Now an untouched box writes
// nothing (as job/Field.jsx, R5-JOB-07); a real edit is still saved.
// On the real TodoItem (tests/pdf/fake-dom.mjs, loaded through Vite for the `@/` aliases).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

async function task(text) {
  const dom = await import('./fake-dom.mjs');
  const { TodoItem } = await loadModule('/src/components/job/TodoItem.jsx');
  const renames = [];
  const props = { todo: { id: 't1', text, done: false }, onToggle() {}, onDelete() {}, onRename: (t) => renames.push(t) };
  const view = dom.mount(TodoItem, props);
  const all = () => [...dom.elements(view.container)];
  const input = () => all().find((el) => el.tagName === 'INPUT');
  const fire = (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name](e));
  return {
    renames,
    open: () => fire(all().find((el) => el.tagName === 'SPAN'), 'onDoubleClick'),
    type: (t) => fire(input(), 'onChange', ev({ target: { value: t } })),
    blur: () => fire(input(), 'onBlur'),
    key: (key) => fire(input(), 'onKeyDown', ev({ key })),
    /** Another tab's rename reaching the store while the box is open. */
    changeTo: (next) => view.update({ ...props, todo: { ...props.todo, text: next } }),
    close: () => view.unmount(),
  };
}

it('an untouched open task box writes nothing on blur when another tab renamed the task', async () => {
  const t = await task('Send thank you email');
  try {
    t.open();
    t.changeTo('Send thank you email to Sarah');
    t.blur();
    assert.deepEqual(t.renames, [], "the other tab's newer text stays");
  } finally {
    await t.close();
  }
});

it('an untouched open task box writes nothing on Enter either', async () => {
  const t = await task('Send thank you email');
  try {
    t.open();
    t.changeTo('Send thank you email to Sarah');
    t.key('Enter');
    assert.deepEqual(t.renames, []);
  } finally {
    await t.close();
  }
});

it('a real edit is still saved on blur', async () => {
  const t = await task('Send thank you email');
  try {
    t.open();
    t.type('Email the recruiter');
    t.blur();
    assert.deepEqual(t.renames, ['Email the recruiter']);
  } finally {
    await t.close();
  }
});
