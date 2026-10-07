// B5a (Documents page): Career History left its right-hand sidebar for a section below the Cover Letters group, so
// nothing is pinned or capped to the window any more; the test now pins that, and the panel's own column (header,
// scrolling timeline, footer link) that R4-DVIS-29 built and the Job Tracker's Summary still uses. Original note:
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
  // The panel loads apart from the start-up path (Dashboard.jsx, Lazy): loaded here already, then waited
  // for until React's boundary has shown it, so the assertions below read the real panel.
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  const view = mount(Page, {});
  for (let i = 0; i < 500 && ![...elements(view.container)].some((el) => text(el) === 'Open Job Tracker →'); i += 1) {
    await new Promise((r) => { setTimeout(r, 10); });
  }
  return {
    view,
    all: () => [...elements(view.container)],
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

it('Career History sits below the documents, not pinned beside them; its panel keeps a header, a timeline that can scroll and a footer link', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const heading = all.find((el) => el.tagName === 'H2' && text(el) === 'Career History');
    assert.ok(heading, 'the section\'s "Career History" heading');
    const section = all.find((el) => el.tagName === 'SECTION' && el.contains(heading));
    assert.ok(section, 'the Career History section');
    const cls = tokens(section);
    assert.ok(!cls.some((t) => t.startsWith('lg:sticky') || t.startsWith('lg:max-h') || t.startsWith('lg:top-')), `no longer pinned beside the cards: ${cls.join(' ')}`);
    assert.ok(!all.some((el) => el.tagName === 'ASIDE'), 'no sidebar');
    const main = all.find((el) => el.tagName === 'MAIN');
    const letters = all.find((el) => el.tagName === 'SECTION' && text(el).startsWith('Cover Letters'));
    assert.ok(main.childNodes.indexOf(letters) >= 0 && main.childNodes.indexOf(section) > main.childNodes.indexOf(letters), 'below the Cover Letters group, last on the page');

    const [headingRow, panel] = section.childNodes;
    assert.ok(headingRow.contains(heading) && [...elements(headingRow)].some((el) => el.tagName === 'BUTTON' && text(el) === 'Job Tracker →'), 'the heading row holds the Job Tracker link');
    for (const t of ['flex', 'flex-col', 'min-h-0', 'overflow-hidden']) assert.ok(tokens(panel).includes(t), `the panel has ${t}: ${tokens(panel).join(' ')}`);

    // The panel is still a column whose timeline alone scrolls when something holds it to a height (the Job
    // Tracker's Summary shows the same panel): its header and its footer's link keep their height.
    const [header, timeline] = panel.childNodes;
    const footer = panel.childNodes.at(-1);
    assert.ok(text(header).includes('Marlo Quint') && tokens(header).includes('shrink-0'), 'the panel\'s header keeps its height');
    for (const t of ['min-h-0', 'overflow-y-auto']) assert.ok(tokens(timeline).includes(t), `the timeline scrolls when the panel is held: ${tokens(timeline).join(' ')}`);
    for (const job of JOBS) assert.ok(text(timeline).includes(job.company), `${job.company} is in the timeline`);
    assert.ok(text(footer) === 'Open Job Tracker →' && tokens(footer).includes('shrink-0'), 'the footer\'s link keeps its height under the timeline');
  } finally { await page.close(); }
});
