// R4-DVIS-10: the Job Tracker's Delete buttons. A kanban card's was a hand-rolled `rounded p-1` box
// (22 px) in the same footer as the kit's 28 px "Move to" IconButton, so the two hover backgrounds
// differed in size and the icons did not line up; a list row's was `p-1.5` (25 px) where the boards'
// row menus use the kit's IconButton. Both are the kit's IconButton now (sm, size-7, the danger
// variant — the same red hover), still titled and named "Delete application", still inside the row's
// reveal-on-hover box (shown on touch screens), and still deleting without opening the job. The fake
// DOM has no layout, so this reads the classes the browser lays out by, on the real KanbanView and
// ListView (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', url: '', location: 'Remote', salary: '',
  contact: '', appliedDate: '2026-09-01', deadline: '', resumeId: '', notes: '', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const ev = () => ({ preventDefault() {}, stopPropagation() { this.stopped = true; }, stopped: false });

async function render(path, name, props) {
  const mod = await loadModule(path);
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(mod[name], props);
  const all = () => [...dom.elements(view.container)];
  const labelled = (label) => all().filter((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === label);
  return { view, dom, all, labelled };
}

/** The kit's small danger IconButton, not the hand-rolled box; in the reveal-on-hover row. */
function assertKitDelete(del, where) {
  const own = classes(del);
  for (const token of ['size-7', 'hover:bg-red-50', 'hover:text-red-700']) assert.ok(own.includes(token), `${where}: ${token} in ${own.join(' ')}`);
  for (const token of ['p-1', 'p-1.5']) assert.ok(!own.includes(token), `${where}: the hand-rolled ${token} is gone: ${own.join(' ')}`);
  assert.equal(del.getAttribute('title'), 'Delete application', `${where}: the title the browser specs click by`);
  assert.ok(classes(del.parentNode).includes('no-hover:opacity-100'), `${where}: still in the row that shows on a touch screen`);
}

it('R4-DVIS-10: a kanban card\'s Delete is the kit\'s small IconButton, the size of the Move-to button beside it', async () => {
  const deleted = [];
  const opened = [];
  const page = await render('/src/components/job/KanbanView.jsx', 'KanbanView', {
    jobs: [job], updateJob: () => {}, onNavigate: (id) => opened.push(id), onDelete: (id) => deleted.push(id),
  });
  try {
    const [del] = page.labelled('Delete application');
    assert.ok(del, 'the card has its Delete button');
    assertKitDelete(del, 'kanban');
    const footer = del.parentNode;
    const move = [...page.dom.elements(footer)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Move to another status');
    assert.ok(move, 'the Move-to button is in the same footer');
    assert.ok(classes(move).includes('size-7'), `the Move-to button is size-7 too: ${classes(move).join(' ')}`);

    // A press on it starts no drag, and its click deletes without opening the job.
    const props = page.dom.reactProps(del);
    const down = ev();
    props.onMouseDown(down);
    assert.ok(down.stopped, 'a press does not reach the card\'s drag');
    const click = ev();
    page.view.act(() => props.onClick(click));
    assert.ok(click.stopped);
    assert.deepEqual(deleted, ['a']);
    assert.deepEqual(opened, []);
  } finally {
    await page.view.unmount();
  }
});

it('R4-DVIS-10: a list row\'s Delete is the kit\'s small IconButton, as the boards\' row menus are', async () => {
  const deleted = [];
  const opened = [];
  const page = await render('/src/components/job/ListView.jsx', 'ListView', {
    jobs: [job], resumes: [], onNavigate: (id) => opened.push(id), onDelete: (id) => deleted.push(id),
  });
  try {
    const [del] = page.labelled('Delete application');
    assert.ok(del, 'the row has its Delete button');
    assertKitDelete(del, 'list');
    const click = ev();
    page.view.act(() => page.dom.reactProps(del).onClick(click));
    assert.ok(click.stopped, 'the row\'s own click does not open the job');
    assert.deepEqual(deleted, ['a']);
    assert.deepEqual(opened, []);
  } finally {
    await page.view.unmount();
  }
});
