// R4-DVIS-09: the job page's Tasks tab, its Add Task row. The new-task box and its + button were
// hand-sized — `px-4 py-2.5`, about 42 px tall, a 2 px ring — beside the kit's 32–36 px controls on
// the same page. The box is the kit's now, as TextField draws it (controlClass, h-9, 44 px on a touch
// screen, still 16 px text on touch — J-38), and the button is the kit's IconButton (primary, lg:
// size-9), level with the box on a touch screen too; both still add the task. The fake DOM has no
// layout, so this reads the classes the browser lays out by, on the real TasksTab (tests/pdf/fake-dom.mjs,
// loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

it('R4-DVIS-09: the new-task box and its add button are the kit\'s, 36 px, and still add a task', async () => {
  const { TasksTab } = await loadModule('/src/components/job/TasksTab.jsx');
  const { controlClass } = await loadModule('/src/components/ui/index.js');
  const dom = await import('./fake-dom.mjs');
  const changes = [];
  const view = dom.mount(TasksTab, { todos: [], onChange: (t) => changes.push(t) });
  try {
    const all = () => [...dom.elements(view.container)];
    const input = () => all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'New task');
    const button = () => all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Add task');

    assert.ok(input(), 'the new-task box is on the tab');
    const box = classes(input());
    for (const token of controlClass().split(/\s+/)) assert.ok(box.includes(token), `the kit's control class ${token}: ${box.join(' ')}`);
    for (const token of ['h-9', 'pointer-coarse:h-11', 'min-w-0', 'flex-1', 'px-3', 'pointer-coarse:text-base']) {
      assert.ok(box.includes(token), `the box has ${token}: ${box.join(' ')}`);
    }
    for (const token of ['py-2.5', 'px-4', 'focus:ring-2']) assert.ok(!box.includes(token), `the hand-sized ${token} is gone: ${box.join(' ')}`);

    assert.ok(button(), 'the add button is the kit\'s IconButton, named "Add task"');
    assert.equal(button().parentNode, input().parentNode, 'it sits beside the box');
    const add = classes(button());
    for (const token of ['size-9', 'pointer-coarse:size-11', 'bg-brand']) assert.ok(add.includes(token), `the button has ${token}: ${add.join(' ')}`);
    for (const token of ['py-2.5', 'px-4']) assert.ok(!add.includes(token), `the hand-sized ${token} is gone: ${add.join(' ')}`);

    // It still adds what was typed.
    view.act(() => dom.reactProps(input()).onChange(ev({ target: { value: 'Send thanks' } })));
    view.act(() => dom.reactProps(button()).onClick(ev()));
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].map((t) => [t.text, t.done]), [['Send thanks', false]]);
  } finally {
    await view.unmount();
  }
});
