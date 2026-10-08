// UI rebuild B12/B13: the Applications surface (Job Tracker board / list / detail / form, the tracker
// chips and charts, the career-history panel, the public résumé page) is drawn with the design tokens
// and still offers every control it had. The negative twin: no file of the surface, and no element the
// Overview draws, carries an old gray / blue / red / amber / indigo / emerald Tailwind colour class.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const OLD_COLOUR = /(^|\s)(?:[a-z-]+:)*(?:text|bg|border|ring|from|via|to)-(?:gray|blue|red|amber|indigo|emerald)-\d/;
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const surface = [
  'src/pages/JobTracker.jsx', 'src/pages/JobDetail.jsx', 'src/pages/JobForm.jsx', 'src/pages/PublicResume.jsx',
  'src/components/CareerHistoryPanel.jsx',
  ...readdirSync(new URL('../../src/components/job', import.meta.url)).filter((f) => f.endsWith('.jsx')).map((f) => `src/components/job/${f}`),
  ...readdirSync(new URL('../../src/components/tracker', import.meta.url)).filter((f) => f.endsWith('.jsx')).map((f) => `src/components/tracker/${f}`),
];

it('B12: the Job Tracker still offers its views, search, exports and the list / board controls', () => {
  const tracker = read('src/pages/JobTracker.jsx');
  for (const label of ['Job tracker views', 'Search applications', 'Export JSON', 'Export CSV', 'Career history']) {
    assert.ok(tracker.includes(label), `JobTracker offers "${label}"`);
  }
  for (const view of ['Summary', 'Board', 'List']) assert.ok(tracker.includes(view), `the ${view} view`);
  assert.ok(read('src/components/job/KanbanView.jsx').includes('Move to'), 'the board\'s "Move to"');
  assert.ok(read('src/components/job/ListView.jsx').includes('<table'), 'the list is a table');
  assert.ok(read('src/pages/JobDetail.jsx').includes('Details'), 'the detail page\'s Details box');
});

it('B12: no file of the Applications surface carries an old colour class (negative twin)', () => {
  for (const file of surface) {
    const bad = read(file).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => OLD_COLOUR.test(l));
    assert.deepEqual(bad.map(([n]) => `${file}:${n}`), [], `${file} still draws an old colour`);
  }
});

it('B12: the Overview still draws its fields and none of its elements wears an old colour', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const dom = await import('./fake-dom.mjs');
  const job = {
    id: 'a', company: 'Acme', role: 'Dev', status: 'applied', stage: 'Take-home', location: 'Remote', salary: '$150k',
    url: '', contact: 'Sam', appliedDate: '2026-09-01', deadline: '2000-12-01', followUpDate: '', resumeId: 'r1',
    workMode: 'remote', source: 'referral', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }],
  };
  const view = dom.mount(OverviewTab, { job, set() {}, navigate() {}, resumes: [{ id: 'r1', type: 'resume', name: 'Platform CV' }] });
  try {
    const all = [...dom.elements(view.container)];
    const texts = all.map((el) => el.textContent);
    for (const label of ['Company', 'Location', 'Work Mode', 'Deadline', 'Resume Used']) {
      assert.ok(texts.includes(label), `"${label}" is offered`);
    }
    const bad = all.filter((el) => OLD_COLOUR.test(el.getAttribute('class') || ''));
    assert.deepEqual(bad.map((el) => el.getAttribute('class')), [], 'no element wears an old colour class');
  } finally { await view.unmount(); }
});
