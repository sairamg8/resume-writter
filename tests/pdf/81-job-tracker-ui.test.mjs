// The Job Tracker's and a board's cards on the real components (tests/pdf/fake-dom.mjs, loaded through
// Vite for JSX and the `@/` aliases). R2-039: a focused kanban card or board card (role=button) did
// nothing on Enter or Space, list rows could not be focused at all, and the drag instructions read to a
// screen reader ("press the space bar… use the arrow keys") described a keyboard drag that does not
// exist. R2-038: the job kanban dragged with a PointerSensor on a card with no touch-action, so on a
// phone the page scrolled and the status never changed — it now drags on a press-and-hold (TouchSensor),
// like the boards. R2-099: the 'Open job posting' icon on a kanban card also sent the tracker to the
// job's page. R2-156: the tracker's UI — kanban, list, history, tasks, the job page's tabs — had no
// test but Cypress; these pin what they show and do.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const acme = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', url: 'https://jobs.acme.example/1', location: 'Remote',
  salary: '', contact: '', appliedDate: '2026-09-01', deadline: '', resumeId: '', notes: '<p>Call Ana</p>',
  todos: [{ id: 't1', text: 'Research', done: true }, { id: 't2', text: 'Prepare', done: false }],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};
const beta = { ...acme, id: 'b', company: 'Beta', role: 'QA', status: 'interview', url: '', todos: [] };

/** An event as a React handler reads it; records preventDefault / stopPropagation. */
function ev(props = {}) {
  return {
    defaultPrevented: false, propagationStopped: false, nativeEvent: {},
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...props,
  };
}

async function render(component, props) {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  return {
    view, dom, all,
    text: () => view.container.textContent,
    props: (el) => dom.reactProps(el),
    /** The draggable cards: dnd-kit gives each role=button and a roledescription. */
    cards: () => all().filter((el) => el.getAttribute('aria-roledescription') === 'draggable' || el.getAttribute('aria-roledescription') === 'sortable'),
    fire: (el, name, e = ev()) => { view.act(() => dom.reactProps(el)[name](e)); return e; },
  };
}

/** The props of the DndContext `el` is rendered in (read off React's fiber tree). */
function dndContextProps(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  for (let f = el[key]; f; f = f.return) {
    if (f.memoizedProps && 'sensors' in f.memoizedProps && 'onDragEnd' in f.memoizedProps) return f.memoizedProps;
  }
  return null;
}

/** What a screen reader hears on focusing a card: the context's instructions, or dnd-kit's own. */
function instructions(el) {
  return dndContextProps(el)?.accessibility?.screenReaderInstructions?.draggable
    ?? 'To pick up a draggable item, press the space bar. While dragging, use the arrow keys to move the item.';
}

// ── Job kanban ───────────────────────────────────────────────────────────────────────────────

async function kanban(extra = {}) {
  const { KanbanView } = await loadModule('/src/components/job/KanbanView.jsx');
  const calls = { navigate: [], update: [], remove: [] };
  const page = await render(KanbanView, {
    jobs: [acme, beta],
    updateJob: (id, u) => calls.update.push([id, u]),
    onNavigate: (id) => calls.navigate.push(id),
    onDelete: (id) => calls.remove.push(id),
    ...extra,
  });
  return { page, calls, card: (company) => page.cards().find((el) => el.textContent.includes(company)) };
}

it('R2-039: a focused kanban card opens its job on Enter and on Space', async () => {
  const { page, calls, card } = await kanban();
  try {
    const c = card('Acme');
    assert.equal(c.getAttribute('tabindex'), '0', 'the card takes focus');
    const enter = page.fire(c, 'onKeyDown', ev({ key: 'Enter', target: c, currentTarget: c }));
    const space = page.fire(c, 'onKeyDown', ev({ key: ' ', target: c, currentTarget: c }));
    assert.deepEqual(calls.navigate, ['a', 'a']);
    assert.ok(space.defaultPrevented, 'Space does not also scroll the page');
    assert.ok(enter.defaultPrevented);
  } finally {
    await page.view.unmount();
  }
});

it('R2-039: Enter on a control inside a kanban card is that control\'s, not the card\'s', async () => {
  const { page, calls, card } = await kanban();
  try {
    const c = card('Acme');
    const link = page.all().find((el) => el.tagName === 'A');
    page.fire(c, 'onKeyDown', ev({ key: 'Enter', target: link, currentTarget: c }));
    page.fire(c, 'onKeyDown', ev({ key: 'a', target: c, currentTarget: c }));
    assert.deepEqual(calls.navigate, []);
  } finally {
    await page.view.unmount();
  }
});

it('R2-039: the kanban\'s screen-reader instructions say what a key does — no keyboard drag is promised', async () => {
  const { page, card } = await kanban();
  try {
    const said = instructions(card('Acme'));
    assert.doesNotMatch(said, /space bar|arrow keys/i);
    assert.match(said, /Enter/);
  } finally {
    await page.view.unmount();
  }
});

it('R2-038: a kanban card drags on touch (TouchSensor) as well as with a mouse', async () => {
  const { page, card } = await kanban();
  try {
    const p = page.props(card('Acme'));
    assert.equal(typeof p.onTouchStart, 'function', 'a touch starts the (press-and-hold) drag');
    assert.equal(typeof p.onMouseDown, 'function', 'a mouse still drags');
    assert.equal(p.onPointerDown, undefined, 'no pointer sensor: it would take the touch first, and lose it to the scroll');
    // A press-and-hold, as on the boards: a plain swipe still scrolls the columns.
    const touch = dndContextProps(card('Acme')).sensors.find((s) => s.sensor.name === 'TouchSensor');
    assert.equal(touch?.options?.activationConstraint?.delay, 200);
  } finally {
    await page.view.unmount();
  }
});

it('R2-099: the "Open job posting" icon opens the posting only — its click does not reach the card', async () => {
  const { page } = await kanban();
  try {
    const link = page.all().find((el) => el.tagName === 'A');
    assert.equal(link.getAttribute('href'), 'https://jobs.acme.example/1');
    assert.equal(link.getAttribute('target'), '_blank');
    const click = page.fire(link, 'onClick');
    assert.ok(click.propagationStopped, 'the card\'s onClick (navigate) never runs');
    assert.ok(!click.defaultPrevented, 'the link still opens');
    // Pressing on it starts no drag either (the sensors listen on the card for mouse and touch).
    assert.ok(page.fire(link, 'onMouseDown').propagationStopped);
    assert.ok(page.fire(link, 'onTouchStart').propagationStopped);
    const del = page.all().find((el) => el.getAttribute('aria-label') === 'Delete application');
    assert.ok(page.fire(del, 'onMouseDown').propagationStopped, 'nor does pressing delete');
    assert.ok(page.fire(del, 'onTouchStart').propagationStopped);
    assert.match(del.parentNode.getAttribute('class'), /focus-within:opacity-100/, 'a focused delete is seen');
  } finally {
    await page.view.unmount();
  }
});

it('R2-156: the kanban shows each job in its status column with its tasks, and a click opens it', async () => {
  const { page, calls, card } = await kanban();
  try {
    const column = (id) => page.all().find((el) => el.getAttribute('id') === `kanban-col-${id}`);
    assert.match(column('applied').textContent, /Acme/);
    assert.match(column('interview').textContent, /Beta/);
    assert.doesNotMatch(column('saved').textContent, /Acme|Beta/);
    assert.match(card('Acme').textContent, /1\/2 tasks/);
    assert.match(card('Acme').textContent, /Call Ana/, 'the notes as text, not HTML');
    page.fire(card('Beta'), 'onClick');
    assert.deepEqual(calls.navigate, ['b']);
    const del = page.all().filter((el) => el.getAttribute('aria-label') === 'Delete application');
    page.fire(del[0], 'onClick');
    assert.deepEqual(calls.remove, ['a']);
    assert.deepEqual(calls.navigate, ['b'], 'delete does not open the job');
  } finally {
    await page.view.unmount();
  }
});

// ── Job list ─────────────────────────────────────────────────────────────────────────────────

async function list() {
  const { ListView } = await loadModule('/src/components/job/ListView.jsx');
  const calls = { navigate: [], remove: [] };
  const page = await render(ListView, {
    jobs: [acme, beta], resumes: [],
    onNavigate: (id) => calls.navigate.push(id), onDelete: (id) => calls.remove.push(id),
  });
  return { page, calls };
}

it('R2-039: every list row has a button, reachable by Tab, that opens its job', async () => {
  const { page, calls } = await list();
  try {
    const open = (company) => page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === company);
    assert.ok(open('Acme') && open('Beta'), 'a native button per row: Tab reaches it, Enter and Space press it');
    const click = page.fire(open('Beta'), 'onClick');
    assert.deepEqual(calls.navigate, ['b']);
    assert.ok(click.propagationStopped, 'the row\'s own click does not open the job a second time');
    // The row's other Tab stops, shown only on hover, show while focused too.
    const del = page.all().find((el) => el.getAttribute('aria-label') === 'Delete application');
    assert.match(del.parentNode.getAttribute('class'), /focus-within:opacity-100/);
    const posting = page.all().find((el) => el.tagName === 'A');
    assert.match(posting.getAttribute('class'), /focus-visible:opacity-100/);
  } finally {
    await page.view.unmount();
  }
});

it('R2-156: the list sorts by a column header, and a third click returns to the default order', async () => {
  const { page } = await list();
  try {
    const order = () => page.all().filter((el) => el.tagName === 'TR').map((el) => el.textContent).filter((t) => /Acme|Beta/.test(t)).map((t) => (t.includes('Acme') ? 'Acme' : 'Beta'));
    const header = page.all().find((el) => el.tagName === 'TH' && el.textContent.trim() === 'Company');
    page.fire(header, 'onClick');
    assert.deepEqual(order(), ['Acme', 'Beta']);
    page.fire(header, 'onClick');
    assert.deepEqual(order(), ['Beta', 'Acme']);
    assert.match(page.text(), /Applied/);
  } finally {
    await page.view.unmount();
  }
});

// ── Board cards ──────────────────────────────────────────────────────────────────────────────

it('R2-039: a focused board card opens on Enter and on Space; keys from inside it are left alone', async () => {
  const { SortableCard } = await loadModule('/src/components/board/BoardCard.jsx');
  const { DndContext } = await import('@dnd-kit/core');
  const { SortableContext } = await import('@dnd-kit/sortable');
  const { createElement: h } = await import('react');
  const opened = [];
  const card = { id: 'c1', title: 'Write the brief', labels: [], checklist: [] };
  function Harness() {
    return h(DndContext, { onDragEnd() {}, sensors: [] }, h(SortableContext, { items: ['c1'] },
      h(SortableCard, { card, listId: 'l1', onOpen: (...a) => opened.push(a) })));
  }
  const page = await render(Harness, {});
  try {
    const c = page.cards()[0];
    assert.equal(c.getAttribute('tabindex'), '0');
    page.fire(c, 'onKeyDown', ev({ key: 'Enter', target: c, currentTarget: c }));
    const space = page.fire(c, 'onKeyDown', ev({ key: ' ', target: c, currentTarget: c }));
    assert.ok(space.defaultPrevented);
    page.fire(c, 'onKeyDown', ev({ key: 'Enter', target: {}, currentTarget: c }));
    assert.deepEqual(opened, [['c1', 'l1'], ['c1', 'l1']]);
  } finally {
    await page.view.unmount();
  }
});

// The board page itself does not mount at this base: it reads a v1 board's `lists` from a store that
// now holds v2 boards (the boards cluster's rewrite). So its DndContext is checked in the source,
// and the text it passes is checked here.
it('R2-039: the board page tells a screen reader what Enter does, and promises no keyboard drag', async () => {
  const { readFile } = await import('node:fs/promises');
  const { BOARD_DRAG_INSTRUCTIONS } = await loadModule('/src/utils/cardKeys.js');
  const source = await readFile(new URL('../../src/pages/Board.jsx', import.meta.url), 'utf8');
  assert.match(source, /<DndContext[^>]*accessibility=\{\{ screenReaderInstructions: BOARD_DRAG_INSTRUCTIONS \}\}/);
  assert.doesNotMatch(source, /KeyboardSensor/, 'no keyboard drag: the text must not promise one');
  assert.doesNotMatch(BOARD_DRAG_INSTRUCTIONS.draggable, /space bar|arrow keys/i);
  assert.match(BOARD_DRAG_INSTRUCTIONS.draggable, /On a card, press Enter/, 'a list\'s drag handle hears it too, and Enter opens only a card');
});

// ── The job page ─────────────────────────────────────────────────────────────────────────────

it('R2-156: status history — On Hold then Rejected is not "reopened"; a closed job resumed is', async () => {
  const { StatusHistory } = await loadModule('/src/components/job/StatusHistory.jsx');
  const closed = await render(StatusHistory, { history: [{ status: 'applied', changedAt: 1 }, { status: 'on_hold', changedAt: 2 }, { status: 'rejected', changedAt: 3 }] });
  try {
    assert.doesNotMatch(closed.text(), /reopened/);
    assert.match(closed.text(), /Rejected 1×/);
    assert.match(closed.text(), /Current/);
  } finally {
    await closed.view.unmount();
  }
  const resumed = await render(StatusHistory, { history: [{ status: 'rejected', changedAt: 1 }, { status: 'interview', changedAt: 2 }] });
  try {
    assert.match(resumed.text(), /reopened/);
  } finally {
    await resumed.view.unmount();
  }
});

it('R2-156: the Tasks tab adds a task on Enter, ticks one, and shows the progress', async () => {
  const { TasksTab } = await loadModule('/src/components/job/TasksTab.jsx');
  const changes = [];
  const page = await render(TasksTab, { todos: acme.todos, onChange: (t) => changes.push(t) });
  try {
    assert.match(page.text(), /1 \/ 2 complete/);
    const input = page.all().find((el) => el.getAttribute('aria-label') === 'New task');
    page.fire(input, 'onChange', ev({ target: { value: '  Send thanks ' } }));
    page.fire(input, 'onKeyDown', ev({ key: 'Enter' }));
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0].map((t) => [t.text, t.done]), [['Research', true], ['Prepare', false], ['Send thanks', false]]);
  } finally {
    await page.view.unmount();
  }
});

it('R2-156: the job page opens on Tasks, and its tabs show Overview and Notes', async () => {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  const map = new Map([['cpwtcv_jobs_v1', JSON.stringify({ jobs: [acme], dataVersion: 2 })]]);
  globalThis.localStorage = {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
  _resetJobStoreForTest();
  function App() {
    return h(MemoryRouter, { initialEntries: ['/jobs/a'] }, h(Routes, null,
      h(Route, { path: '/jobs/:id', element: h(JobDetail, { store: { appState: { resumes: [] } } }) })));
  }
  const page = await render(App, {});
  const tab = (label) => page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  try {
    assert.match(page.text(), /Acme/);
    assert.match(page.text(), /Add Task/);
    page.fire(tab('Overview'), 'onClick');
    assert.match(page.text(), /Application Stage/);
    assert.match(page.text(), /Application History/);
    page.fire(tab('Notes'), 'onClick');
    assert.ok(page.all().some((el) => el.getAttribute('aria-label') === 'Notes'), 'the notes editor');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
