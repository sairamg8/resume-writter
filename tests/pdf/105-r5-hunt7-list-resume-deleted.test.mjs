// R5-HUNT7-LIST-RESUME-DELETED: the Job Tracker list's Résumé cell for a job whose linked résumé was
// deleted. It drew '—', the same as a job never linked, while the job page says 'Résumé deleted'
// (linkedResume, J-21). It now says 'Résumé deleted' too; a job with no link keeps its '—' and a
// linked one its résumé's name. Real ListView through Vite (tests/pdf/fake-dom.mjs). Fictional data.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const kids = (el) => el.childNodes.filter((n) => n.nodeType === 1);

async function resumeCell(job, resumes) {
  const { ListView } = await loadModule('/src/components/job/ListView.jsx');
  const page = await render(ListView, { jobs: [job], resumes, onNavigate: () => {}, onDelete: () => {} });
  try {
    const row = page.all().find((el) => el.tagName === 'TR' && el.getAttribute('class')?.includes('cursor-pointer'));
    assert.ok(row, 'the job\'s row');
    const cells = kids(row).filter((el) => el.tagName === 'TD');
    // The Résumé cell is the one before the row's actions.
    return cells[cells.length - 2].textContent;
  } finally {
    await page.view.unmount();
  }
}

it('R5-HUNT7: a job linked to a deleted résumé reads "Résumé deleted" in the list, not "—"', async () => {
  assert.equal(await resumeCell({ ...acme, resumeId: 'gone' }, [{ id: 'other', name: 'Other CV' }]), 'Résumé deleted');
});

it('R5-HUNT7: a job never linked keeps its "—", and a linked one shows the résumé\'s name', async () => {
  assert.equal(await resumeCell({ ...acme, resumeId: '' }, [{ id: 'r1', name: 'Main CV' }]), '—');
  assert.equal(await resumeCell({ ...acme, resumeId: 'r1' }, [{ id: 'r1', name: 'Main CV' }]), 'Main CV');
});
