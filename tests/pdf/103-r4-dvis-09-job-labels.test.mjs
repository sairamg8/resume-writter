// R4-DVIS-09 (the rest of it; the Tasks tab's add row is 103-r4-dvis-09-task-add-row): a job page's
// labels and headings were all 10 px bold capitals (text-[10px] font-bold uppercase tracking-widest,
// text-ink-subtlest), a look no other label on the page had: the kit's Field label, the job form's
// labels and the Details box's rows are 12–13 px semibold, and the Details box's heading is text-sm
// font-semibold text-ink. Now a field's name (Company, Location, Work Mode, Deadline, Resume Used,
// Stage…, and the Pipeline's "Mark as:" and "Resume Application") is drawn as the kit's Field label,
// and a card's heading (Application Stage, Role Info, Timeline & Contact, Application History, Notes,
// Add Task, To Do, Completed) as the Details box's. The Overview's always-live controls — the Work
// Mode, Source and Resume Used selects and the deadline's date box — are the kit's box now
// (controlClass, 36 px, 44 on a touch screen, still 16 px text on touch and still able to shrink), with
// the Open-resume button still beside its select, the deadline still red when past, and each still
// saving what is picked. The fake DOM has no layout, so this reads the classes the browser draws by, on
// the real components (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, ...props });

const KIT_LABEL = ['text-[12px]', 'font-semibold', 'leading-5', 'text-ink-subtle'];
const HEADING = ['text-sm', 'font-semibold', 'text-ink'];
const EYEBROW = ['text-[10px]', 'font-bold', 'uppercase', 'tracking-widest', 'text-ink-subtlest'];

const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', stage: 'Take-home', location: 'Remote', salary: '$150k',
  url: '', contact: 'Sam', appliedDate: '2026-09-01', deadline: '2099-12-01', followUpDate: '', resumeId: 'r1',
  workMode: 'remote', source: 'referral', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }],
};

/** The <p> or <span> that reads exactly `text`. */
const textEl = (all, text) => all.find((el) => ['P', 'SPAN'].includes(el.tagName) && el.textContent === text);

function assertLook(el, text, want, what) {
  assert.ok(el, `"${text}" is drawn`);
  const c = classes(el);
  for (const token of want) assert.ok(c.includes(token), `"${text}" is ${what} (${token}): ${c.join(' ')}`);
  for (const token of EYEBROW) assert.ok(!c.includes(token), `"${text}" is no 10 px capital any more (${token}): ${c.join(' ')}`);
}

it('R4-DVIS-09: the Overview\'s field names are the kit\'s labels, its card headings the page\'s, and its selects and deadline the kit\'s box', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const { controlClass } = await loadModule('/src/components/ui/index.js');
  const dom = await import('./fake-dom.mjs');
  const saved = [];
  const view = dom.mount(OverviewTab, {
    job, set: (key, value) => saved.push([key, value]), navigate: () => {},
    resumes: [{ id: 'r1', type: 'resume', name: 'Platform CV' }, { id: 'r2', type: 'resume', name: 'Backend CV' }],
  });
  try {
    const all = () => [...dom.elements(view.container)];

    for (const text of ['Company', 'Role / Position', 'Location', 'Salary / Comp', 'Job Posting URL', 'Work Mode', 'Source',
      'Applied Date', 'Deadline', 'Follow-up Date', 'Contact Person', 'Resume Used', 'Stage', 'Mark as:']) {
      assertLook(textEl(all(), text), text, KIT_LABEL, 'the kit\'s field label');
    }
    for (const text of ['Application Stage', 'Role Info', 'Timeline & Contact', 'Application History']) {
      const heading = textEl(all(), text);
      assert.equal(heading?.tagName, 'P', `"${text}" is still a <p>`);
      assertLook(heading, text, HEADING, 'the page\'s card heading');
    }

    const control = (label) => all().find((el) => ['SELECT', 'INPUT'].includes(el.tagName) && el.getAttribute('aria-label') === label);
    for (const label of ['Work Mode', 'Source', 'Deadline', 'Resume used']) {
      const box = control(label);
      assert.ok(box, `the ${label} control is on the tab`);
      const c = classes(box);
      for (const token of controlClass().split(/\s+/)) assert.ok(c.includes(token), `${label}: the kit's control class ${token}: ${c.join(' ')}`);
      for (const token of ['h-9', 'pointer-coarse:h-11', 'min-w-0', 'flex-1', 'px-3', 'pointer-coarse:text-base']) {
        assert.ok(c.includes(token), `${label} has ${token}: ${c.join(' ')}`);
      }
      assert.ok(!c.includes('bg-transparent'), `${label} is no bare text in its row: ${c.join(' ')}`);
      // Its row no longer draws a box of its own around the kit's.
      const row = classes(box.parentNode);
      assert.ok(row.includes('flex') && row.includes('items-center'), `${label}'s row: ${row.join(' ')}`);
      for (const token of ['border-transparent', 'hover:border-cv-hairline', 'hover:bg-sunken', 'py-2']) {
        assert.ok(!row.includes(token), `${label}'s row has no ${token}: ${row.join(' ')}`);
      }
    }
    const open = control('Resume used').parentNode.childNodes.find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Open resume');
    assert.ok(open && classes(open).includes('shrink-0'), 'the Open-resume button is still beside the résumé select');

    // Each still saves what is picked.
    view.act(() => dom.reactProps(control('Work Mode')).onChange(ev({ target: { value: 'hybrid' } })));
    view.act(() => dom.reactProps(control('Resume used')).onChange(ev({ target: { value: 'r2' } })));
    view.act(() => dom.reactProps(control('Deadline')).onChange(ev({ target: { value: '2099-11-30' } })));
    assert.deepEqual(saved, [['workMode', 'hybrid'], ['resumeId', 'r2'], ['deadline', '2099-11-30']]);

    // A passed deadline is red in the kit's box, with no second text colour for the stylesheet to pick from.
    view.update({ job: { ...job, deadline: '2020-01-01' }, set: () => {}, navigate: () => {}, resumes: [] });
    const late = classes(control('Deadline'));
    assert.ok(late.includes('text-cv-bad') && late.includes('border') && late.includes('rounded'), `the passed deadline: ${late.join(' ')}`);
    assert.ok(!late.includes('text-ink'), `one text colour: ${late.join(' ')}`);
  } finally {
    await view.unmount();
  }
});

it('R4-DVIS-09: the Pipeline\'s choice names on a closed or held job are the kit\'s labels', async () => {
  const { Pipeline } = await loadModule('/src/components/job/Pipeline.jsx');
  const dom = await import('./fake-dom.mjs');
  for (const [status, texts] of [['rejected', ['Restart Application As']], ['on_hold', ['Resume Application', 'Close as:']]]) {
    const view = dom.mount(Pipeline, { status, onChange: () => {} });
    try {
      for (const text of texts) assertLook(textEl([...dom.elements(view.container)], text), text, KIT_LABEL, 'the kit\'s field label');
    } finally {
      await view.unmount();
    }
  }
});

it('R4-DVIS-09: the Tasks and Notes tabs\' headings are the page\'s card heading', async () => {
  const { TasksTab } = await loadModule('/src/components/job/TasksTab.jsx');
  const { NotesTab } = await loadModule('/src/components/job/NotesTab.jsx');
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom(); // the rich-text editor in the Notes tab

  const tasks = dom.mount(TasksTab, {
    todos: [{ id: 't1', text: 'Research', done: false }, { id: 't2', text: 'Prepare', done: true }], onChange: () => {},
  });
  try {
    for (const text of ['Add Task', 'To Do', 'Completed (1)']) {
      assertLook(textEl([...dom.elements(tasks.container)], text), text, HEADING, 'the page\'s card heading');
    }
  } finally {
    await tasks.unmount();
  }

  const notes = dom.mount(NotesTab, { job: { id: 'a', company: 'Acme', notes: '' }, set: () => {} });
  try {
    assertLook(textEl([...dom.elements(notes.container)], 'Notes'), 'Notes', HEADING, 'the page\'s card heading');
  } finally {
    await notes.unmount();
  }
});
