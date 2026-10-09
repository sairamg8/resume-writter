// The Keyboard shortcuts sheet ("?" or the help button in the top bar) said "c = Create an issue" and listed an Issues group on the Job
// Tracker's pages, where c opens Add job (the Create button there says so) and there are no issues. On /jobs the sheet now reads
// "c = Add a job" in the Global group and has no Issues group; on the projects' pages it is what it was. The real TopBar over
// tests/pdf/fake-dom.mjs through Vite's SSR loader, as tests/pdf/319-cyc7-shortcuts-sheet-space-opens.test.mjs does.
// Run: node --test tests/pdf/360-cyc8-shortcuts-sheet-job-tracker.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, elements } from '../unit/ui-dom-harness.mjs';

let kit;
let TopBar;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
});
after(() => kit?.close());

/** The sheet opened by the help button at `path`: its group titles and every row's label. */
async function sheetAt(path) {
  const App = () => createElement(MemoryRouter, { initialEntries: [path] }, createElement(TopBar, { projects: [], search: () => [] }));
  const view = mount(App, {});
  const help = byAttr(view.container, 'aria-label', 'Keyboard shortcuts')[0];
  assert.ok(help, 'the top bar has its help button');
  view.act(() => reactProps(help).onClick(ev()));
  const sheet = [...elements(view.document.body)].find((el) => el.getAttribute('role') === 'dialog');
  assert.ok(sheet, 'the button opened the sheet');
  const all = [...elements(sheet)];
  return {
    view,
    groups: all.filter((el) => el.tagName === 'H3').map((el) => el.textContent.trim()),
    labels: all.filter((el) => el.tagName === 'DT').map((el) => el.textContent.trim()),
  };
}

it('on the Job Tracker, c is "Add a job" and there is no Issues group', async () => {
  const { view, groups, labels } = await sheetAt('/jobs');
  try {
    assert.ok(labels.includes('Add a job'), `c adds a job: ${labels.join(' | ')}`);
    assert.ok(!labels.includes('Create an issue'), 'no issue is created there');
    assert.ok(!groups.includes('Issues'), 'no Issues group');
    for (const kept of ['Search', 'Collapse or expand the sidebar', 'Show keyboard shortcuts']) assert.ok(labels.includes(kept), `${kept} is still listed`);
  } finally {
    await view.unmount();
  }
});

it('on a job\'s page too', async () => {
  const { view, labels } = await sheetAt('/jobs/j1');
  try {
    assert.ok(labels.includes('Add a job'));
    assert.ok(!labels.includes('Create an issue'));
  } finally {
    await view.unmount();
  }
});

it('on the projects\' pages it still says "Create an issue" and lists the Issues group', async () => {
  const { view, groups, labels } = await sheetAt('/boards');
  try {
    assert.ok(labels.includes('Create an issue'));
    assert.ok(!labels.includes('Add a job'));
    assert.deepEqual(groups, ['Global', 'Issues']);
  } finally {
    await view.unmount();
  }
});
