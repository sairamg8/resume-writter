// A job page on a phone (J-12): the Overview tab and the interview stages were fixed two-column grids,
// so on a phone every card and list got half the screen, and a long value (a posting's URL) ran out of
// its row. They are one column below sm now, two from sm up — a card that spans the row spans it only
// where there are two — and a field's value wraps. The fake DOM has no layout, so this reads the classes
// the browser lays out by, on the real components (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'interview', location: 'Remote', salary: '',
  url: 'https://jobs.example.com/postings/2026/senior-platform-engineer-remote-first-team-x1y2z3',
  contact: '', appliedDate: '2026-09-01', deadline: '', resumeId: '', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }, { status: 'interview', changedAt: 2 }],
};

async function mounted(component, props) {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  const classes = (el) => (el.getAttribute('class') || '').split(/\s+/);
  return { view, all, classes };
}

/** The grids that are two columns at every width, and the spans that need two columns at every width. */
function phoneFailures(page) {
  const out = [];
  for (const el of page.all()) {
    const c = page.classes(el);
    if (c.includes('grid') && c.includes('grid-cols-2')) out.push(`a grid of two columns on a phone: ${c.join(' ')}`);
    if (c.includes('col-span-2')) out.push(`a card spanning two columns on a phone: ${c.join(' ')}`);
  }
  return out;
}

it('J-12: the Overview tab is one column on a phone, and a long URL wraps in its field', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const page = await mounted(OverviewTab, { job, set: () => {}, resumes: [], navigate: () => {} });
  try {
    assert.ok(page.all().some((el) => page.classes(el).includes('sm:grid-cols-2')), 'two columns from sm up');
    assert.deepEqual(phoneFailures(page), []);
    const value = page.all().find((el) => el.tagName === 'SPAN' && el.textContent === job.url);
    assert.ok(value, 'the posting URL prints');
    assert.ok(page.classes(value).includes('break-words') && page.classes(value).includes('min-w-0'), `the URL wraps: ${page.classes(value).join(' ')}`);
  } finally {
    await page.view.unmount();
  }
});

it('J-12: the interview stages are one column on a phone', async () => {
  const { InterviewStageSelector } = await loadModule('/src/components/job/InterviewStageSelector.jsx');
  const page = await mounted(InterviewStageSelector, {
    stage: '', onStageChange: () => {}, customStages: ['Take-home'], addCustomStage: () => {}, removeCustomStage: () => {},
  });
  try {
    assert.ok(page.all().some((el) => page.classes(el).includes('sm:grid-cols-2')), 'two columns from sm up');
    assert.deepEqual(phoneFailures(page), []);
  } finally {
    await page.view.unmount();
  }
});
