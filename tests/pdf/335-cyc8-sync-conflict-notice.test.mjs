// CYC8-S1 (notice): when two devices changed the same job or project and the older edits were kept
// as a conflict copy (collectionSyncConflict.js), the user is told: one short sentence in the
// held-items strip every job and project page already shows (SyncHeldNotice), naming the item or
// counting several, until dismissed. The engine's report feeds it (collectionReport), and a list
// leaving the browser with its account takes the names with it. The real component and store over
// fake-dom (tests/pdf/fake-dom.mjs).
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';

after(teardown);

let syncConflicts;
let collectionReport;
let SyncHeldNotice;
before(async () => {
  await setup();
  ({ syncConflicts, collectionReport } = await loadModule('/src/utils/collectionSyncMeta.js'));
  ({ SyncHeldNotice } = await loadModule('/src/components/SyncHeldNotice.jsx'));
});
afterEach(() => { syncConflicts.dismiss('jobs'); syncConflicts.dismiss('boards'); });

async function open(name) {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(() => createElement(SyncHeldNotice, { name, className: 'mb-3' }), {});
  const all = () => [...dom.elements(view.container)];
  return {
    view,
    text: () => view.container.textContent,
    notice: () => all().find((el) => el.tagName === 'P'),
    dismiss: () => view.act(() => dom.reactProps(all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Dismiss')).onClick({ preventDefault() {}, stopPropagation() {} })),
    has: (label) => all().some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label),
  };
}

it('says nothing without a conflict, then names the one job, in the held strip\'s look', async () => {
  const page = await open('jobs');
  try {
    assert.equal(page.text(), '');
    page.view.act(() => collectionReport('jobs').conflict(['Acme — Staff Engineer']));
    assert.equal(page.text(), '“Acme — Staff Engineer” was changed on two devices: the older edits are kept as a copy marked (conflict copy).Dismiss');
    assert.match(page.notice().getAttribute('class'), /\bcv-notice-warn\b/);
    assert.equal(page.notice().getAttribute('role'), 'status');
  } finally {
    await page.view.unmount();
  }
});

it('counts several jobs, or projects on the projects\' pages, and each list has its own', async () => {
  const jobs = await open('jobs');
  try {
    jobs.view.act(() => {
      collectionReport('jobs').conflict(['Acme — Staff Engineer']);
      collectionReport('jobs').conflict(['Globex — Analyst']);
      collectionReport('boards').conflict(['Roadmap']);
    });
    assert.match(jobs.text(), /^2 jobs were changed on two devices: the older edits are kept as copies marked \(conflict copy\)\./);
  } finally {
    await jobs.view.unmount();
  }
  const boards = await open('boards');
  try {
    assert.match(boards.text(), /^“Roadmap” was changed on two devices/);
  } finally {
    await boards.view.unmount();
  }
});

it('Dismiss removes it, and a list leaving the browser forgets the names', async () => {
  const page = await open('jobs');
  try {
    page.view.act(() => collectionReport('jobs').conflict(['Acme — Staff Engineer']));
    assert.ok(page.has('Dismiss'));
    page.dismiss();
    assert.equal(page.text(), '', 'dismissed');
    assert.deepEqual(syncConflicts.get().jobs, []);

    page.view.act(() => collectionReport('jobs').conflict(['Globex — Analyst']));
    assert.ok(page.text().includes('Globex'));
    page.view.act(() => collectionReport('jobs').conflict(null)); // the engine's leave
    assert.equal(page.text(), '', 'the next account is not shown the last one\'s job names');
  } finally {
    await page.view.unmount();
  }
});
