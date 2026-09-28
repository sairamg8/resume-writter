// R4-DVIS-29: from lg the Dashboard's Career History sidebar is sticky (lg:sticky lg:top-6) but had no
// height of its own, so with a long history (~7 entries on a 768 px-tall laptop) and a taller résumé
// column it pinned at the top with its bottom — the last entries and "Open Job Tracker →" — below the
// fold until the page's end scrolled it up. The sidebar is now never taller than the window
// (lg:max-h-[calc(100dvh-3rem)], a column), and the panel is a column whose timeline alone scrolls
// (min-h-0 overflow-y-auto) while its header and its footer's link keep their height; below lg, and in
// the Job Tracker's aside, nothing holds the panel to a height, so nothing scrolls. The fake DOM has no
// layout, so this pins the classes on the real Dashboard and CareerHistoryPanel, mounted with
// react-dom/client over tests/pdf/fake-dom.mjs, with a fictional eight-job history.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume, experience } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';
import { MemoryStorage } from './resume-tab.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const JOBS = Array.from({ length: 8 }, (_, i) => ({
  company: `Tidewater Charts ${i + 1}`, role: 'Surveyor', startDate: `01/${2010 + i}`, endDate: `12/${2010 + i}`,
}));

/** The Dashboard over one résumé with an eight-job history. */
async function dashboard() {
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage([]);
  const cv = Object.assign(resume({ personal: { name: 'Marlo Quint' }, sections: [experience(JOBS)] }), { name: 'Chart Maker CV', updatedAt: 1000 });
  const noop = () => {};
  const store = {
    appState: { resumes: [cv], activeId: cv.id }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop, createLetter: noop,
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  function Page() {
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Dashboard, { store, auth, sync, publicLinks: null }));
  }
  const view = mount(Page, {});
  return {
    view,
    all: () => [...elements(view.container)],
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

it('the pinned Career History sidebar is never taller than the window, and a long history scrolls inside its timeline', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const heading = all.find((el) => el.tagName === 'H2' && text(el) === 'Career History');
    assert.ok(heading, 'the sidebar\'s "Career History" heading');
    const sidebar = all.find((el) => tokens(el).includes('lg:sticky') && el.contains(heading));
    assert.ok(sidebar, 'the sticky sidebar');
    const cls = tokens(sidebar);
    assert.ok(cls.includes('lg:max-h-[calc(100dvh-3rem)]'), `held to the window's height under its 24 px top: ${cls.join(' ')}`);
    assert.ok(cls.includes('lg:flex') && cls.includes('lg:flex-col'), 'a column, so the panel takes what the heading leaves');
    assert.ok(!cls.includes('max-h-[calc(100dvh-3rem)]') && !cls.includes('flex'), 'held only from lg, where it is pinned: below lg it follows the page');

    const [headingRow, panel] = sidebar.childNodes;
    assert.ok(headingRow.contains(heading) && tokens(headingRow).includes('shrink-0'), 'the heading row keeps its height');
    for (const t of ['flex', 'flex-col', 'min-h-0', 'overflow-hidden']) assert.ok(tokens(panel).includes(t), `the panel has ${t}: ${tokens(panel).join(' ')}`);

    const [header, timeline] = panel.childNodes;
    const footer = panel.childNodes.at(-1);
    assert.ok(text(header).includes('Marlo Quint') && tokens(header).includes('shrink-0'), 'the panel\'s header keeps its height');
    for (const t of ['min-h-0', 'overflow-y-auto']) assert.ok(tokens(timeline).includes(t), `the timeline scrolls when the panel is held: ${tokens(timeline).join(' ')}`);
    for (const job of JOBS) assert.ok(text(timeline).includes(job.company), `${job.company} is in the scrolling timeline`);
    assert.ok(text(footer) === 'Open Job Tracker →' && tokens(footer).includes('shrink-0'), 'the footer\'s link keeps its height, in view under the timeline');
  } finally { await page.close(); }
});
