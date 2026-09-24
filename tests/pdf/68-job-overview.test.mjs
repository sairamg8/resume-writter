// A job page's Overview tab on the real components (tests/pdf/fake-dom.mjs, loaded through Vite).
// J-24: a Rejected or Withdrawn job's fields were "read-only" there while the Edit pencil and a board
// drag changed them freely, and only the pipeline's restart asked for a confirmation (window.confirm).
// One rule now: closed jobs stay editable, and a status change is the same everywhere — recorded in
// the history, no confirm. J-21: a résumé deleted after it was linked read 'Not linked yet' beside an
// Open button that bounced to the dashboard.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const rejected = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'rejected', location: 'Remote', salary: '', url: '', contact: '',
  appliedDate: '2026-09-01', deadline: '', resumeId: '', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }, { status: 'rejected', changedAt: 2 }],
};

async function render(component, props) {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(component, props);
  const all = () => [...dom.elements(view.container)];
  return {
    view,
    text: () => view.container.textContent,
    buttons: (match) => all().filter((el) => el.tagName === 'BUTTON' && (el.getAttribute('title') === match || el.textContent.trim() === match)),
    options: () => all().filter((el) => el.tagName === 'OPTION').map((el) => el.textContent),
    click: (el) => view.act(() => dom.reactProps(el).onClick({ stopPropagation() {}, preventDefault() {} })),
  };
}

it('J-24: a Rejected job\'s fields stay editable on Overview, and nothing claims they are read-only', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const page = await render(OverviewTab, { job: rejected, set: () => {}, resumes: [], navigate: () => {} });
  try {
    assert.doesNotMatch(page.text(), /read-only/i);
    // Every Field (company, role, location, salary, URL, applied date, contact) offers its pencil.
    assert.ok(page.buttons('Edit').length >= 7, `edit pencils: ${page.buttons('Edit').length}`);
  } finally {
    await page.view.unmount();
  }
});

it('J-24: restarting a closed job from the pipeline changes the status at once — no window.confirm, like every other path', async () => {
  const { Pipeline } = await loadModule('/src/components/job/Pipeline.jsx');
  const changes = [];
  const page = await render(Pipeline, { status: 'rejected', onChange: (s) => changes.push(s) });
  try {
    page.click(page.buttons('Applied')[0]); // the fake window has no confirm(): calling it throws
    assert.deepEqual(changes, ['applied']);
  } finally {
    await page.view.unmount();
  }
});

it('J-21: a linked résumé that was deleted reads "Résumé deleted", with no Open button', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const job = { ...rejected, status: 'applied', resumeId: 'gone' };
  const page = await render(OverviewTab, { job, set: () => {}, resumes: [{ id: 'r1', name: 'Frontend CV' }], navigate: () => {} });
  try {
    assert.ok(page.options().includes('Résumé deleted'), `options: ${page.options()}`);
    assert.equal(page.buttons('Open resume').length, 0);
    page.view.update({ job: { ...job, resumeId: 'r1' }, set: () => {}, resumes: [{ id: 'r1', name: 'Frontend CV' }], navigate: () => {} });
    assert.equal(page.buttons('Open resume').length, 1, 'a résumé that exists opens');
    assert.ok(!page.options().includes('Résumé deleted'));
  } finally {
    await page.view.unmount();
  }
});
