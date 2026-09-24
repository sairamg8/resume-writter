// A job page's Pipeline and Tasks tab, and the Job Tracker's kanban drag, on the real components
// (R2-159: they had no test). Mounted with react-dom/client (tests/pdf/fake-dom.mjs, loaded through
// Vite), their buttons clicked through the handlers React rendered: every Pipeline state hands the
// status it names to onChange; the Tasks tab adds, ticks, renames and deletes a task, and lists the
// newest completed first (J-27); a kanban drop on another column changes the job's status.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let Pipeline;
let TasksTab;
before(async () => {
  await setup();
  ({ Pipeline } = await loadModule('/src/components/job/Pipeline.jsx'));
  ({ TasksTab } = await loadModule('/src/components/job/TasksTab.jsx'));
});
after(teardown);

async function render(component, props) {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  const ev = { stopPropagation() {}, preventDefault() {}, key: '' };
  return {
    view,
    text: () => view.container.textContent,
    all,
    buttons: () => all().filter((el) => el.tagName === 'BUTTON'),
    button: (text) => all().find((el) => el.tagName === 'BUTTON' && (el.textContent.trim() === text || el.getAttribute('title') === text)),
    byLabel: (label) => all().find((el) => el.getAttribute('aria-label') === label),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
    call: (el, handler, extra = {}) => view.act(() => dom.reactProps(el)[handler]({ ...ev, ...extra })),
  };
}

it('Pipeline, active: each step, the next step, On Hold, Rejected and Withdrawn hand their status over', async () => {
  const changes = [];
  const page = await render(Pipeline, { status: 'applied', onChange: (s) => changes.push(s) });
  try {
    page.click(page.button('Move to Phone Screen'));
    page.click(page.button('Saved'));
    page.click(page.button('Offer'));
    page.click(page.button('On Hold'));
    page.click(page.button('Rejected'));
    page.click(page.button('Withdrawn'));
    assert.deepEqual(changes, ['phone_screen', 'saved', 'offer', 'on_hold', 'rejected', 'withdrawn']);
    page.view.update({ status: 'offer', onChange: (s) => changes.push(s) });
    assert.doesNotMatch(page.text(), /Move to/, 'the last step has no next one');
  } finally {
    await page.view.unmount();
  }
});

it('Pipeline, on hold: resumes at any step, or closes', async () => {
  const changes = [];
  const page = await render(Pipeline, { status: 'on_hold', onChange: (s) => changes.push(s) });
  try {
    assert.match(page.text(), /Resume Application/);
    page.click(page.button('Interview'));
    page.click(page.button('Withdrawn'));
    assert.deepEqual(changes, ['interview', 'withdrawn']);
  } finally {
    await page.view.unmount();
  }
});

it('Tasks: add (Enter or the button; blank adds nothing), tick, rename, delete — each a new list for onChange', async () => {
  let todos = [];
  const lists = [];
  const onChange = (next) => { lists.push(next); todos = next; page.view.update({ todos, onChange }); };
  const page = await render(TasksTab, { todos, onChange });
  try {
    const input = () => page.byLabel('New task');
    const typeTask = (value) => page.call(input(), 'onChange', { target: { value } });
    typeTask('Send thank-you note');
    page.call(input(), 'onKeyDown', { key: 'Enter' });
    typeTask('   ');
    page.call(input(), 'onKeyDown', { key: 'Enter' });
    typeTask('Research the team');
    page.click(input().parentNode.childNodes.find((el) => el.tagName === 'BUTTON'));
    assert.deepEqual(todos.map((t) => [t.text, t.done]), [['Send thank-you note', false], ['Research the team', false]]);
    assert.equal(lists.length, 2, 'a blank task changes nothing');

    // Tick the first: it moves to Completed, stamped, and the progress counts it.
    const row = (text) => page.all().find((el) => el.tagName === 'SPAN' && el.textContent === text).parentNode;
    page.click(row('Send thank-you note').childNodes[0]);
    assert.equal(todos[0].done, true);
    assert.ok(todos[0].completedAt);
    assert.match(page.text(), /1 \/ 2 complete/);
    assert.match(page.text(), /Completed \(1\)/);

    // Rename the second by double-click, then Enter.
    page.call(row('Research the team').childNodes[1], 'onDoubleClick');
    page.call(page.byLabel('Task'), 'onChange', { target: { value: 'Research the hiring team' } });
    page.call(page.byLabel('Task'), 'onKeyDown', { key: 'Enter' });
    assert.equal(todos[1].text, 'Research the hiring team');

    // Delete it: only the ticked one is left.
    page.click(row('Research the hiring team').childNodes.at(-1));
    assert.deepEqual(todos.map((t) => t.text), ['Send thank-you note']);
    assert.match(page.text(), /All tasks complete!/);
  } finally {
    await page.view.unmount();
  }
});

it('Tasks: the newest completed first, five at a time, the rest behind "Show N more completed"', async () => {
  const todos = Array.from({ length: 7 }, (_, n) => ({ id: `t${n}`, text: `Task ${n}`, done: true, completedAt: 1000 + n }));
  const page = await render(TasksTab, { todos, onChange: () => {} });
  try {
    const shown = () => page.all().filter((el) => el.tagName === 'SPAN' && /^Task \d$/.test(el.textContent)).map((el) => el.textContent);
    assert.deepEqual(shown(), ['Task 6', 'Task 5', 'Task 4', 'Task 3', 'Task 2']);
    page.click(page.button('Show 2 more completed'));
    assert.deepEqual(shown(), ['Task 6', 'Task 5', 'Task 4', 'Task 3', 'Task 2', 'Task 1', 'Task 0']);
  } finally {
    await page.view.unmount();
  }
});

it('Kanban: a card dropped on another status column changes the job\'s status; on its own column or outside, nothing', async () => {
  const { KanbanView } = await loadModule('/src/components/job/KanbanView.jsx');
  const jobs = [
    { id: 'a', company: 'Acme', role: 'Dev', status: 'applied', todos: [] },
    { id: 'b', company: 'Globex', role: 'QA', status: 'interview', todos: [] },
  ];
  const updates = [];
  const page = await render(KanbanView, { jobs, updateJob: (id, patch) => updates.push([id, patch]), onNavigate: () => {}, onDelete: () => {} });
  try {
    // The DndContext's own onDragEnd, found from a rendered element up React's tree: dnd-kit calls
    // it with the dragged card and the column under it, which fake-dom has no pointer to drive.
    const key = Object.keys(page.view.container.childNodes[0]).find((k) => k.startsWith('__reactFiber$'));
    let fiber = page.view.container.childNodes[0][key];
    while (fiber && !fiber.memoizedProps?.onDragEnd) fiber = fiber.return;
    const { onDragEnd } = fiber.memoizedProps;
    const column = (status) => page.all().find((el) => el.getAttribute('id') === `kanban-col-${status}`).textContent;
    assert.match(column('applied'), /Acme/);
    assert.match(column('interview'), /Globex/);
    page.view.act(() => onDragEnd({ active: { id: 'a' }, over: { id: 'offer' } }));
    page.view.act(() => onDragEnd({ active: { id: 'b' }, over: { id: 'interview' } }));
    page.view.act(() => onDragEnd({ active: { id: 'b' }, over: null }));
    assert.deepEqual(updates, [['a', { status: 'offer' }]]);
  } finally {
    await page.view.unmount();
  }
});
