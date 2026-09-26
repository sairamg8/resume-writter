// R4-JOB-04: the job page's Overview let both Company and Role be blanked, which the job form
// refuses ("A company or a role is enough to save the job", canSave): the job became "Untitled
// Company / No role specified" and search could not find it. Now the same rule holds on both paths:
// blanking one while the other is blank keeps it as it was (the field shows it again, and opens on
// it next time); either may be blanked while the other is set. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, render } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

/** The Overview of `job`; `edit(label, value)` types `value` into that field and presses Enter. */
async function overview(job) {
  const { OverviewTab } = await loadModule('/src/components/job/OverviewTab.jsx');
  const edits = [];
  const page = await render(OverviewTab, { job, set: (k, v) => edits.push([k, v]), resumes: [], navigate: () => {} });
  const field = (label) => page.all().find((el) => el.tagName === 'P' && el.textContent === label).parentNode;
  const open = (label) => {
    const pencil = [...(field(label).childNodes[1]?.childNodes || [])].find((el) => el.tagName === 'BUTTON');
    page.fire(pencil, 'onClick');
    return page.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label);
  };
  const edit = (label, value) => {
    page.fire(open(label), 'onChange', { target: { value } });
    page.fire(page.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label), 'onKeyDown', { key: 'Enter', nativeEvent: {} });
  };
  return { page, edits, edit, open, field };
}

it('blanking the role while the company is blank keeps the role', async () => {
  const { page, edits, edit, open, field } = await overview({ ...acme, company: '', role: 'Dev' });
  try {
    edit('Role / Position', '   ');
    assert.deepEqual(edits, [], 'nothing saved');
    assert.match(field('Role / Position').textContent, /Dev/, 'the field shows the role again');
    assert.equal(page.props(open('Role / Position')).value, 'Dev', 'and opens on it next time');
  } finally { await page.view.unmount(); }
});

it('blanking the company while the role is blank keeps the company', async () => {
  const { page, edits, edit } = await overview({ ...acme, company: 'Acme', role: '' });
  try {
    edit('Company', '');
    assert.deepEqual(edits, []);
  } finally { await page.view.unmount(); }
});

it('either one may be blanked while the other is set', async () => {
  const { page, edits, edit } = await overview({ ...acme, company: 'Acme', role: 'Dev' });
  try {
    edit('Company', '');
    assert.deepEqual(edits, [['company', '']]);
  } finally { await page.view.unmount(); }
});
