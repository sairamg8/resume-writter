// Cycle 4, touch: a job's task text was renamed by a DOUBLE CLICK on its <span> and nothing else. A touch screen has no double
// click for a plain span (iOS Safari sends no mouse events at all to an element with no click handler, and a double tap is
// the browser's own gesture), so on a phone or a tablet a task could not be renamed. On a screen where nothing hovers one
// tap on the text opens the same box now; a mouse keeps the double click, and a single click on a mouse still does nothing
// (a task's text is clicked and selected as before). On the real TodoItem (tests/pdf/fake-dom.mjs, loaded through Vite).
// Run: node --test tests/pdf/223-cyc4-touch-task-tap-to-edit.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

/** The task row over a window that hovers (a mouse) or does not (a touch screen). */
async function task(text, { hover }) {
  const dom = await import('./fake-dom.mjs');
  const { TodoItem } = await loadModule('/src/components/job/TodoItem.jsx');
  const renames = [];
  const props = { todo: { id: 't1', text, done: false }, onToggle() {}, onDelete() {}, onRename: (t) => renames.push(t) };
  const view = dom.mount(TodoItem, props);
  globalThis.window.matchMedia = (query) => ({ matches: query === '(hover: none)' ? !hover : false, media: query, addEventListener() {}, removeEventListener() {} });
  const all = () => [...dom.elements(view.container)];
  const span = () => all().find((el) => el.tagName === 'SPAN');
  const input = () => all().find((el) => el.tagName === 'INPUT');
  const fire = (el, name, e = ev()) => view.act(() => dom.reactProps(el)[name]?.(e));
  return {
    renames,
    tap: () => fire(span(), 'onClick'),
    doubleClick: () => fire(span(), 'onDoubleClick'),
    isEditing: () => Boolean(input()),
    type: (t) => fire(input(), 'onChange', ev({ target: { value: t } })),
    blur: () => fire(input(), 'onBlur'),
    close: () => view.unmount(),
  };
}

it('on a touch screen one tap on a task\'s text opens its box, and a changed text is saved', async () => {
  const t = await task('Send thank you email', { hover: false });
  try {
    assert.ok(!t.isEditing());
    t.tap();
    assert.ok(t.isEditing(), 'a tap opens the box');
    t.type('Email the recruiter');
    t.blur();
    assert.deepEqual(t.renames, ['Email the recruiter']);
  } finally {
    await t.close();
  }
});

it('with a mouse a single click opens nothing, and the double click still does', async () => {
  const t = await task('Send thank you email', { hover: true });
  try {
    t.tap();
    assert.ok(!t.isEditing(), 'a click on a mouse leaves the text alone');
    t.doubleClick();
    assert.ok(t.isEditing(), 'the double click opens the box');
  } finally {
    await t.close();
  }
});
