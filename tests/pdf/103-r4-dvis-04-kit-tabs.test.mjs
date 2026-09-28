// R4-DVIS-04: the Job Tracker's Summary · Board · List tabs and a job page's Overview · Tasks ·
// Notes tabs were drawn by hand (14px labels, no side padding, the underline 1px higher, other
// greys) and the Tasks count was its own pill, unlike the kit's tab look (tabClass) and count
// (TabCount) that a project's tabs and Your work wear in the same header slot. Both pages now use
// the kit's tabClass and TabCount; they stay buttons marking the open view with aria-current (not
// the kit's role="tab" Tabs), and ?view= still switches the tracker's view. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';
import { acme, atRoute } from './100-r4-job-helpers.mjs';

before(setup);
after(teardown);

const tokens = (value) => String(value || '').split(/\s+/).filter(Boolean).sort();
const classOf = (el) => tokens(el.getAttribute('class'));

it('the Job Tracker\'s view tabs wear the kit\'s tabClass, and a click still moves ?view= and the selection', async () => {
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { tabClass } = await loadModule('/src/components/ui/Tabs.jsx');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const page = await atRoute('/jobs?view=summary', { '/jobs': h(JobTracker, { store: { appState: { resumes: [] } } }) }, [acme]);
  try {
    const nav = page.all().find((el) => el.tagName === 'NAV' && el.getAttribute('aria-label') === 'Job tracker views');
    assert.ok(nav, 'the view tabs');
    const tabs = () => nav.childNodes.filter((el) => el.tagName === 'BUTTON');
    assert.deepEqual(tabs().map((b) => b.textContent.trim()), ['Summary', 'Board', 'List']);
    const check = (selected) => {
      for (const b of tabs()) {
        const on = b.textContent.trim() === selected;
        assert.equal(b.getAttribute('aria-current'), on ? 'page' : null, `${b.textContent.trim()}: aria-current`);
        assert.deepEqual(classOf(b), tokens(tabClass(on)), `${b.textContent.trim()}: the kit's tab look (${on ? 'selected' : 'not selected'})`);
        assert.ok(!classOf(b).includes('text-sm'), 'not the hand-drawn 14px label');
      }
    };
    check('Summary');
    page.fire(tabs().find((b) => b.textContent.trim() === 'List'), 'onClick');
    check('List');
    assert.ok(page.all().some((el) => el.tagName === 'TABLE'), 'the List view is shown');
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('a job page\'s tabs wear the kit\'s tabClass, and the Tasks count is the kit\'s TabCount', async () => {
  const { tabClass, TabCount } = await loadModule('/src/components/ui/Tabs.jsx');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const todos = [{ id: 't1', text: 'Research', done: true }, { id: 't2', text: 'Prepare', done: false }];
  const page = await atRoute('/jobs/a', { '/jobs/:id': h(JobDetail, { store: { appState: { resumes: [] } } }) }, [{ ...acme, todos }]);
  try {
    // The page opens on Tasks: the one button marked current is that tab, in the row of tabs.
    const current = page.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-current') === 'page');
    assert.ok(current, 'the open tab');
    const tabs = current.parentNode.childNodes.filter((el) => el.tagName === 'BUTTON');
    assert.deepEqual(tabs.map((b) => b.textContent.trim()), ['Overview', 'Tasks2', 'Notes']);
    for (const b of tabs) {
      const on = b === current;
      assert.deepEqual(classOf(b), tokens(tabClass(on)), `${b.textContent.trim()}: the kit's tab look`);
    }
    const count = current.lastChild;
    assert.equal(count.tagName, 'SPAN');
    assert.equal(count.textContent, '2');
    const kitCount = renderToStaticMarkup(h(TabCount, null, 2)).match(/class="([^"]*)"/)[1];
    assert.deepEqual(classOf(count), tokens(kitCount), 'the kit\'s tab count');
    assert.ok(classOf(count).includes('leading-4') && classOf(count).includes('bg-slate-100'));
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});
