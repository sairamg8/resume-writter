// R4-DPH-14: the job page's Overview, Resume Used. The select was `flex-1` in a flex row with no
// min-w-0, so as a flex item it could not shrink below its own width — its longest option, a résumé
// name the user typed, with no length limit. On a 375 px phone the card leaves about 237 px for it, so
// a long name pushed the select and the Open-resume button past the card, where <main> clips them (and
// the two-column card from sm up, beside the aside at lg, is narrower still). The select may shrink now
// (min-w-0) and cuts the name in its box; the Work Mode and Source selects and the deadline box, in the
// same kind of row, may too. The fake DOM has no layout, so this reads the classes the browser lays
// out by, on the real OverviewTab (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const LONG = 'Senior Platform Engineer – a very long résumé name for the Acme application 2026';
const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', location: 'Remote', salary: '', url: '',
  contact: '', appliedDate: '2026-09-01', deadline: '2026-12-01', followUpDate: '', resumeId: 'r1',
  workMode: '', source: '', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }],
};

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

it('R4-DPH-14: a long résumé name no longer pushes the Resume Used select and its Open button out of the card', async () => {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(OverviewTab, {
    job, set: () => {}, navigate: () => {},
    resumes: [{ id: 'r1', type: 'resume', name: LONG }],
  });
  try {
    const all = [...dom.elements(view.container)];
    const labelled = (label) => all.find((el) => ['SELECT', 'INPUT'].includes(el.tagName) && el.getAttribute('aria-label') === label);

    const select = labelled('Resume used');
    assert.ok(select, 'the Resume Used select is on the tab');
    assert.equal(select.tagName, 'SELECT');
    assert.ok([...dom.elements(select)].some((el) => el.tagName === 'OPTION' && el.textContent === LONG), 'the long name is one of its options');
    const own = classes(select);
    assert.ok(own.includes('flex-1'), `it still fills the row: ${own.join(' ')}`);
    assert.ok(own.includes('min-w-0'), `it may shrink below its longest option: ${own.join(' ')}`);

    // The row it sits in, and the Open button beside it, stay as they were.
    const row = select.parentNode;
    assert.ok(classes(row).includes('flex'), `its row is a flex row: ${classes(row).join(' ')}`);
    const open = row.childNodes.find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Open resume');
    assert.ok(open, 'the linked résumé has its Open button in the same row');
    assert.ok(classes(open).includes('shrink-0'), 'the Open button keeps its size');

    // The other controls in the same kind of row may shrink too.
    for (const label of ['Work Mode', 'Source', 'Deadline']) {
      const control = labelled(label);
      assert.ok(control, `the ${label} control is on the tab`);
      assert.ok(classes(control).includes('flex-1') && classes(control).includes('min-w-0'), `${label}: ${classes(control).join(' ')}`);
    }
  } finally {
    await view.unmount();
  }
});
