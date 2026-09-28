// R4-DPH-03: a job task holding a URL or a long word pushed its delete X off a phone's screen. The
// task's text was a flex item with no min-w-0 and no break-words, so it was as wide as the unbroken
// URL and the X after it was clipped by the page: the task could not be deleted. The text now shrinks
// to the row and wraps (min-w-0 break-words, as job/Field.jsx has since J-12), and the X keeps its
// size. The fake DOM has no layout, so this reads the classes the browser lays the row out by, on the
// real Tasks tab (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const URL_TASK = `https://jobs.example.com/${'x'.repeat(120)}`;

it('R4-DPH-03: a task with a long URL wraps inside its row, so its delete X stays on screen', async () => {
  const { TasksTab } = await loadModule('/src/components/job/TasksTab.jsx');
  const dom = await import('./fake-dom.mjs');
  const todos = [
    { id: 'a', text: URL_TASK, done: false },
    { id: 'b', text: `Read ${'y'.repeat(90)}`, done: true, completedAt: 1 },
  ];
  const view = dom.mount(TasksTab, { todos, onChange: () => {} });
  try {
    const all = [...dom.elements(view.container)];
    const classes = (el) => (el.getAttribute('class') || '').split(/\s+/);
    for (const { text } of todos) {
      const label = all.find((el) => el.tagName === 'SPAN' && el.textContent === text);
      assert.ok(label, `the task "${text.slice(0, 20)}…" is listed`);
      const c = classes(label);
      assert.ok(c.includes('min-w-0') && c.includes('break-words'), `the text shrinks to the row and wraps: ${c.join(' ')}`);
      assert.ok(c.includes('flex-1'), 'and still fills the row');
      const row = label.parentNode;
      const del = row.childNodes.filter((el) => el.tagName === 'BUTTON').at(-1);
      assert.ok(del && del !== row.childNodes[0], 'the row ends in its delete button');
      assert.ok(classes(del).includes('shrink-0'), 'the delete X keeps its size');
    }
  } finally {
    await view.unmount();
  }
});
