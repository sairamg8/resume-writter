// A job from another tool's file or a shared list keeps the id it came with (normalizeJob), and that
// id can hold "/", "?" or "#" (an address as an id). The pages put it into a path as it was, so the
// router read the "/" as a path break and the job could not be opened again: its Edit button, the
// tracker's rows and the form's Save and breadcrumb went to a path that matches no job.
// Each now writes it with encodeURIComponent, as the projects' paths always did.
// Run: node --test tests/pdf/225-cyc4-job-id-in-path.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement as h } from 'react';
import { useParams } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const ID = 'https://jobs.example.com/view/1?ref=a#top';
const ENC = encodeURIComponent(ID);
const job = { ...acme, id: ID };
const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

function Landed({ name }) {
  const { id } = useParams();
  return h('p', { 'data-landed': name }, `${name}:${id}`);
}

it('the job page\'s Edit button opens the form of the job whose id holds / ? and #', async () => {
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const page = await atRoute(`/jobs/${ENC}`, {
    '/jobs/:id': h(JobDetail, { store: { appState: { resumes: [] } } }),
    '/jobs/:id/edit': h(Landed, { name: 'EDIT' }),
  }, [job]);
  try {
    const edit = page.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Edit job');
    assert.ok(edit, 'the job opened, so its Edit button is there');
    page.fire(edit, 'onClick');
    assert.equal(page.text(), `EDIT:${ID}`, 'the edit route got the whole id');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('the edit form\'s breadcrumb to the job writes the id encoded', async () => {
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { elements } = await import('./fake-dom.mjs');
  const page = await atRoute(`/jobs/${ENC}/edit`, {
    '/jobs/:id/edit': h(JobForm, { store: { appState: { resumes: [] } } }),
    '/jobs/:id': h(Landed, { name: 'DETAIL' }),
  }, [job]);
  try {
    const header = page.all().find((el) => el.tagName === 'HEADER');
    const links = [...elements(header)].filter((el) => el.tagName === 'A');
    const crumb = links.find((a) => a.textContent === 'Acme');
    assert.ok(crumb, 'the job\'s crumb is shown');
    assert.ok((crumb.getAttribute('href') || '').endsWith(`/jobs/${ENC}`), crumb.getAttribute('href'));
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('the tracker\'s row, the form\'s Save and back path all encode the id', () => {
  assert.match(src('src/pages/JobTracker.jsx'), /navigate\(`\/jobs\/\$\{encodeURIComponent\(id\)\}`\)/);
  const form = src('src/pages/JobForm.jsx');
  assert.match(form, /backPath = isEdit && existing \? `\/jobs\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(form, /leaveTo\(`\/jobs\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.ok(!/`\/jobs\/\$\{id\}`/.test(form), 'no path takes the id as it is');
});
