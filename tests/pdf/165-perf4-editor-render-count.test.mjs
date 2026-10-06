// PERF-4 (docs/tracking/TYPING-FREEZE-HUNT-2026-10-05.md): every keystroke in the editor re-rendered the
// whole editor — every section, every expanded entry, every field of every entry — because the store's
// actions were new functions at each render and nothing in the section editor was memoised. With a
// long résumé that was the freeze. This pins what a keystroke may touch: typing ONE character into an
// entry's bullet, the summary, or a personal-info field re-renders the field's own part of the tree
// and NOTHING else (no other entry, no other section), and the editor's actions keep their identity (useStableActions).
//
// How it counts (renders, never time): the real Résumé tab (EditorResumeTab) over the real store
// (useAppStore), wired as the Editor wires it, mounted with react-dom/client over fake-dom.mjs. A
// React DevTools hook installed before react-dom loads is told of every commit (as the DevTools
// extension is); the fibers that RENDERED in it (a function component's body ran — the fibers a
// memoised component bails out of are not among them) are credited to the entry (a component with
// an `item` prop of that entry's id), the section (the fiber keyed by its id) and the Personal Info
// editor (a component with an `updatePersonal` prop) they sit in. A label's count is the number of
// commits in which any fiber under it rendered. No component is edited, wrapped or mocked.
// Fictional people.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';

const PERFORMED_WORK = 1; // React's flag on a fiber whose component rendered in this commit
const RENDERING_TAGS = new Set([0, 1, 11, 15]); // function, class, forwardRef, simple memo component

/**
 * Installs the hook react-dom reports its commits to. It must be there BEFORE react-dom loads (react-dom
 * looks for it once, at load), so everything that loads it is imported after this runs.
 */
function installRenderProbe() {
  const probe = { on: false, ids: null, commits: [] };

  /** The fibers that rendered in the commit that just finished: the walk the DevTools make. */
  function rendered(root) {
    const out = [];
    const visit = (next, prev) => {
      if (RENDERING_TAGS.has(next.tag) && (next.flags & PERFORMED_WORK)) out.push(next);
      // Children shared with the last tree were not touched by this commit: skip them. Their flags are
      // those of an earlier commit.
      if (prev && next.child === prev.child) return;
      for (let c = next.child; c; c = c.sibling) visit(c, c.alternate);
    };
    visit(root.current, root.current.alternate);
    return out;
  }

  /** What a rendered fiber sits in: the entry, the section, the Personal Info editor. */
  function labelsOf(fiber) {
    const labels = new Set();
    for (let f = fiber; f; f = f.return) {
      if (probe.ids.sections.has(f.key)) labels.add(`section ${f.key}`);
      const props = f.memoizedProps;
      if (props?.item && probe.ids.entries.has(props.item.id)) labels.add(`entry ${props.item.id}`);
      if (typeof props?.updatePersonal === 'function') labels.add('personal');
    }
    if (!labels.size) labels.add('shell');
    return labels;
  }

  globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject() { return 1; },
    checkDCE() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
    onCommitFiberRoot(_id, root) {
      if (!probe.on || !probe.ids) return;
      // Labelled now: a fiber's `return` and flags are rewritten by the next commit.
      probe.commits.push(rendered(root).map((f) => ({ labels: labelsOf(f), name: f.type?.displayName || f.type?.name || f.type?.render?.name || f.type?.type?.name || `tag${f.tag}` })));
    },
  };
  return probe;
}

const probe = installRenderProbe();
const { setup, teardown, loadModule, resume, section, experience } = await import('./harness.mjs');
const { mount, elements, reactProps, withInnerHtml } = await import('./fake-dom.mjs');
const { MemoryStorage, settle } = await import('./resume-tab.mjs');

before(async () => { await setup(); withInnerHtml(); });
after(async () => { await teardown(); delete globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__; });

const KEY = 'cpwtcv_v1';
const MARK = 'Z'; // the one character typed

/** Four jobs with bullets, an education, a skills section and a summary: a résumé long enough to feel. */
function fixture() {
  const bullets = (n) => `<ul><li>Cut the claims backlog by ${n}% across the Tidewater region</li><li>Mentored ${n} analysts through their first audit</li></ul>`;
  return resume({
    personal: {
      name: 'Tamsin Verhoeven', title: 'Operations Analyst', email: 'tamsin.verhoeven@example.com', phone: '+1 555 0142',
      location: 'Portland, OR', summary: '<p>Operations analyst who turns messy claim queues into calm, measurable workflows.</p>',
    },
    sections: [
      experience([
        { company: 'Harbor Mutual', role: 'Senior Analyst', description: bullets(40) },
        { company: 'Pinecrest Logistics', role: 'Analyst', description: bullets(25) },
        { company: 'Northgate Freight', role: 'Coordinator', description: bullets(18) },
        { company: 'Bluebell Insurance', role: 'Intern', description: bullets(10) },
      ]),
      section('education', [{ institution: 'Lakeshore State University', degree: 'BA', fieldOfStudy: 'Economics', startDate: '09/2012', endDate: '06/2016', description: '<p>Dean\'s list</p>' }]),
      section('skills', [{ category: 'Tools', skills: 'SQL, Excel, Tableau' }]),
    ],
  });
}

/**
 * The Résumé tab over the real store, as the Editor wires it (Personal Info open, sections expanded),
 * every entry opened. `measure(fn)` runs `fn` and returns how many commits each part re-rendered in.
 */
async function openTab() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { EditorResumeTab } = await loadModule('/src/components/EditorResumeTab.jsx');
  const r = fixture();
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  function Tab() {
    store = useAppStore();
    const [personalOpen, setPersonalOpen] = useState(true);
    const [addSectionOpen, setAddSectionOpen] = useState(false);
    return createElement(EditorResumeTab, {
      resume: store.activeResume, store,
      personalOpen, setPersonalOpen, allExpanded: true, forceOpenKey: 0, toggleAllSections() {},
      addSectionOpen, setAddSectionOpen,
    });
  }
  const view = mount(Tab, {});
  await settle();
  const all = () => [...elements(view.container)];
  const attr = (el, name) => el.getAttribute(name) ?? '';

  // Open every entry (a card starts collapsed): the headers carry `cursor-pointer select-none`.
  const headers = all().filter((el) => el.tagName === 'DIV' && /cursor-pointer select-none/.test(attr(el, 'class')));
  assert.equal(headers.length, 6, 'one header per entry: four jobs, the education, the skills');
  view.act(() => {
    for (const el of headers) reactProps(el).onClick({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el });
  });
  await settle();

  const resumeNow = () => store.activeResume;
  const sections = resumeNow().sections;
  probe.ids = {
    sections: new Set(sections.map((s) => s.id)),
    entries: new Set(sections.flatMap((s) => s.items.map((i) => i.id))),
  };
  const jobs = sections[0].items.map((i) => i.id);
  const others = sections.flatMap((s) => s.items.map((i) => i.id)).filter((id) => !jobs.includes(id));

  const boxes = () => all().filter((el) => attr(el, 'role') === 'textbox');
  const summaryBox = () => boxes().find((el) => attr(el, 'aria-label') === 'Professional summary');
  const bulletBox = (job) => boxes().filter((el) => el !== summaryBox())[job];

  /** One character typed at the start of the first bullet's text, as the browser fires `input`. */
  const typeInBox = (box) => {
    assert.ok(box, 'the rich-text box is on screen');
    const html = box.innerHTML;
    const at = html.indexOf('</');
    box.innerHTML = at === -1 ? html + MARK : html.slice(0, at) + MARK + html.slice(at);
    view.document.activeElement = box;
    view.act(() => reactProps(box).onInput({}));
  };
  const typeInEmail = () => {
    const input = all().find((el) => el.tagName === 'INPUT' && attr(el, 'placeholder') === 'john@email.com');
    assert.ok(input, 'the Email box is on screen');
    view.act(() => reactProps(input).onChange({ target: { value: `${reactProps(input).value}${MARK}` } }));
  };

  return {
    store: () => store,
    jobs,
    others,
    sectionIds: sections.map((s) => s.id),
    typeInBullet: (job) => typeInBox(bulletBox(job)),
    typeInSummary: () => typeInBox(summaryBox()),
    typeInEmail,
    /** `fn`'s commits: label -> the number of commits in which something under it rendered. */
    async measure(fn) {
      probe.commits = [];
      probe.on = true;
      try {
        fn();
        await settle();
      } finally {
        probe.on = false;
      }
      const tally = new Map();
      const names = new Map(); // label -> the components of it that rendered, to say what woke it
      for (const commit of probe.commits) {
        for (const label of new Set(commit.flatMap(({ labels }) => [...labels]))) tally.set(label, (tally.get(label) ?? 0) + 1);
        for (const { labels, name } of commit) for (const label of labels) names.set(label, new Set(names.get(label)).add(name));
      }
      return {
        commits: probe.commits.length,
        count: (label) => tally.get(label) ?? 0,
        names: (label) => [...(names.get(label) ?? [])],
        report: () => JSON.stringify([...tally]) + ' Rendered: ' + JSON.stringify([...names].map(([l, n]) => [l, [...n].join('/')])),
      };
    },
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

/**
 * Nothing under `labels` (entries, sections) rendered in `w`: no component at all — not the card, not a
 * field, not dnd-kit's sortable wrapper or the section's header. The whole list is compared, so a
 * renamed or new component cannot slip past a list of names.
 */
function assertUntouched(w, labels, what) {
  for (const label of labels) {
    assert.deepEqual(w.names(label), [], `${what}: ${label} re-rendered. Counts: ${w.report()}`);
  }
}

describe('typing one character re-renders only the edited field (PERF-4)', () => {
  it('a bullet of one job: that job renders (a commit or three), no other job and no other section does', async () => {
    const t = await openTab();
    try {
      const w = await t.measure(() => t.typeInBullet(1));
      assert.ok(t.store().activeResume.sections[0].items[1].description.includes(MARK), 'the character reached the store');
      const own = w.count(`entry ${t.jobs[1]}`);
      assert.ok(own >= 1 && own <= 3, `the edited job renders in 1-3 commits, not ${own}. Counts: ${w.report()}`);
      assertUntouched(w, [t.jobs[0], t.jobs[2], t.jobs[3]].map((id) => `entry ${id}`), 'typing in a bullet');
      assertUntouched(w, t.others.map((id) => `entry ${id}`), 'typing in a bullet');
      assertUntouched(w, t.sectionIds.slice(1).map((id) => `section ${id}`), 'typing in a bullet');
    } finally { await t.close(); }
  });

  it('the summary: no job and no section renders', async () => {
    const t = await openTab();
    try {
      const w = await t.measure(() => t.typeInSummary());
      assert.ok(t.store().activeResume.personal.summary.includes(MARK), 'the character reached the store');
      assert.ok(w.count('personal') >= 1, `the Personal Info editor renders for its own summary. Counts: ${w.report()}`);
      assertUntouched(w, [...t.jobs, ...t.others].map((id) => `entry ${id}`), 'typing in the summary');
      assertUntouched(w, t.sectionIds.map((id) => `section ${id}`), 'typing in the summary');
    } finally { await t.close(); }
  });

  it('a personal-info field (Email): no job and no section renders', async () => {
    const t = await openTab();
    try {
      const w = await t.measure(() => t.typeInEmail());
      assert.ok(t.store().activeResume.personal.email.endsWith(MARK), 'the character reached the store');
      assert.ok(w.count('personal') >= 1, `the Personal Info editor renders for its own field. Counts: ${w.report()}`);
      assertUntouched(w, [...t.jobs, ...t.others].map((id) => `entry ${id}`), 'typing in Email');
      assertUntouched(w, t.sectionIds.map((id) => `section ${id}`), 'typing in Email');
    } finally { await t.close(); }
  });

  it('useStableActions: each action keeps its identity across renders and calls the latest one', async () => {
    const { useStableActions } = await loadModule('/src/hooks/useStableActions.js');
    const seen = [];
    let bump;
    function Host() {
      const [n, setN] = useState(0);
      bump = setN;
      seen.push(useStableActions({ count: () => n, plain: 7 }));
      return null;
    }
    const view = mount(Host, {});
    await settle();
    view.act(() => bump(1));
    await settle();
    assert.ok(seen.length >= 2, 'it rendered again');
    assert.ok(seen.every((a) => a === seen[0] && a.count === seen[0].count), 'the same functions at every render');
    assert.equal(seen[0].count(), 1, 'the call reaches the latest action, not the first');
    assert.equal('plain' in seen[0], false, 'only functions are carried over');
    await view.unmount();
  });
});
