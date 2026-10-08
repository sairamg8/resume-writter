// R4-DVIS-01: the Add / Edit job form built its own header — a centred max-w-3xl bar with a 16 px
// bold title and no breadcrumbs — where the job page beside it (and the tracker) wear the shell's
// PageHeader: full width at px-4 / md:px-8, a 24 px title, "Job Tracker / Acme" breadcrumbs. Opening
// Edit from a job made the title jump in size, weight and place. The form wears PageHeader now:
// breadcrumbs Job Tracker › the job (when editing) › the page, the title "Edit job application" /
// "Add job application", the back arrow first and Cancel / Save as its actions; the body sits
// left-aligned at the header's padding, as the job page's. The fake DOM has no layout: this reads
// the real JobForm's structure and class tokens (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);

/** Asserts `el` has every token of `has` and none of `hasNot`. */
function tokens(el, name, { has = [], hasNot = [] }) {
  assert.ok(el, `${name} is shown`);
  const cls = classes(el);
  for (const t of has) assert.ok(cls.includes(t), `${name}: ${t} (class="${el.getAttribute('class')}")`);
  for (const t of hasNot) assert.ok(!cls.includes(t), `${name}: no ${t} (class="${el.getAttribute('class')}")`);
}

async function openForm(path) {
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { elements } = await import('./fake-dom.mjs');
  const form = h(JobForm, { store: { appState: { resumes: [] } } });
  const page = await atRoute(path, { '/jobs/new': form, '/jobs/:id/edit': form, '/jobs/:id': h('p', null, 'DETAIL') }, [acme]);
  const header = page.all().find((el) => el.tagName === 'HEADER');
  const within = (el) => (el ? [...elements(el)] : []);
  return { page, header, within };
}

for (const [path, title, crumbs] of [
  ['/jobs/a/edit', 'Edit job application', [['Job Tracker', '/jobs'], ['Acme', '/jobs/a']]],
  ['/jobs/new', 'Add job application', [['Job Tracker', '/jobs']]],
]) {
  it(`R4-DVIS-01: ${path} — the shell's PageHeader: breadcrumbs, the page title at its size, the arrow and the actions`, async () => {
    const { page, header, within } = await openForm(path);
    try {
      // Sticky from md up, and scrolled away with the page on a phone (PageHeader, R4-DPH-07).
      tokens(header, 'the header', { has: ['md:sticky', 'md:top-0', 'bg-cv-surface', 'border-b', 'border-cv-hairline'], hasNot: ['sticky', 'top-0'] });
      tokens(header.childNodes[0], 'the header\'s frame', { has: ['px-4', 'md:px-8'], hasNot: ['max-w-3xl', 'mx-auto', 'px-6'] });

      const h1 = within(header).find((el) => el.tagName === 'H1');
      assert.equal(h1?.textContent, title);
      tokens(h1, 'the title', { has: ['text-2xl', 'font-semibold', 'leading-8', 'truncate'], hasNot: ['text-base', 'font-bold'] });

      const nav = within(header).find((el) => el.tagName === 'NAV' && el.getAttribute('aria-label') === 'Breadcrumb');
      assert.ok(nav, 'breadcrumbs above the title');
      const links = within(nav).filter((el) => el.tagName === 'A');
      assert.deepEqual(links.map((a) => a.textContent), crumbs.map(([label]) => label));
      links.forEach((a, i) => assert.ok((a.getAttribute('href') || '').endsWith(crumbs[i][1]), `${a.textContent} links to ${crumbs[i][1]} (${a.getAttribute('href')})`));
      const here = within(nav).find((el) => el.getAttribute('aria-current') === 'page');
      assert.equal(here?.textContent, title, 'the last crumb is this page');

      // The back arrow is the header's first control (R4-DUX-06 clicks it so), then Cancel and Save.
      const buttons = within(header).filter((el) => el.tagName === 'BUTTON');
      assert.equal(buttons[0].textContent, '', 'the arrow comes first');
      assert.equal(typeof page.props(buttons[0]).onClick, 'function');
      assert.deepEqual(buttons.slice(1).map((b) => b.textContent.trim()), ['Cancel', path === '/jobs/new' ? 'Add Job' : 'Save Changes']);

      // The body is at the header's padding, left-aligned, no longer a centred column under it.
      const body = page.all().find((el) => el.tagName === 'FORM').parentNode;
      tokens(body, 'the body', { has: ['max-w-3xl', 'px-4', 'md:px-8'], hasNot: ['mx-auto', 'sm:px-6'] });
      assert.ok(!page.all().some((el) => classes(el).includes('max-w-3xl') && classes(el).includes('py-4')), 'the old centred header bar is gone');
    } finally {
      await page.view.unmount();
      delete globalThis.localStorage;
    }
  });
}
