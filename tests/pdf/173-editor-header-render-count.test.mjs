// PERF-4 follow-up (docs/tracking/HANDOFF.md: "PersonalInfoEditor and EditorHeader still re-render per
// key"), rewritten for the B3 frame (UI rebuild: no tab strip; a bar of memo leaves, a Resume | Cover Letter
// switch, the ATS chip, the Design button, one right dock). The intent is the one it always had: a keystroke
// anywhere in the résumé must render none of the editor's bar — back and the name (EditorBackName), the Export
// menu (EditorExportMenu, ExportDropdown), Share, the account bar (EditorAccount, AuthBar), the document switch
// (EditorDocSwitch), the ATS chip, the Design button, the alerts, the phone's pill — and, with a dock open,
// neither the Design panel nor the ATS scan in the commit of the key. Each of those was once rendered at every
// key: a keystroke changes the store's open résumé, so the Editor page renders, and every prop it gave a part was
// a new value every time (the rename box, the Export menu's state and handlers, the account and the sync that
// App.jsx's useAuth and useCloudSync make new at every render, Share's and Back's handlers, the document and
// dock pickers). And a router hook or a <Link> inside a memo part woke it however its props were kept: the
// router gives every component using one a new context value whenever the page's <Routes> render, and the store
// sits above them, so that is every key.
// Three things are pinned: what a keystroke may touch (nothing of the bar; the save chip at most twice, in its
// own labelled budget: it reads `saving` and `savedAt`, which a keystroke and its write change); that what the
// bar shows still updates (the name and the rename box, an export in progress, the Export menu's wording for
// the open document, the layout, the account and the sync, the open document and dock); and that a handler a
// part has held since its first render acts on the LATEST state (stable handlers that kept the first render's
// closure would export the text as it was before the last key, drop an import's notice from the address and
// leave a phone on the preview).
//
// The tests are only worth having if they fail when the contract is broken, so the file proves its own sensitivity
// twice. In the file: a probe memo leaf given a new object at every render, and one holding a <Link>, are mounted
// beside the bar in the same real page and router, and a keystroke must render both (while a leaf of stable props
// renders 0 times). Against the source: the lead's failfirst is a sabotage commit pair (a <Link> added to a leaf of
// the bar; saving passed through EditorHeader; an unstable prop given to a leaf) which turns the counts and the
// `changed` lists below red, and the revert turns them green.
//
// How it counts (renders, never time), as tests/pdf/165-perf4-editor-render-count.test.mjs: a React DevTools hook
// installed before react-dom loads is told of every commit, and the fibers that RENDERED in it (a function
// component's body ran; the fibers a memoised component bails out of are not among them) are credited to the part
// that is, or holds, them. What is mounted is the real Editor page (src/pages/Editor.jsx) over the real store
// (useAppStore), wired as App.jsx and AppRoutes.jsx wire it: the store above <Routes>, in a MemoryRouter, the
// account and the sync new objects at every render. The page's body runs as in the app — `Editor(props)` called
// from the route's component, hooks and all — and of the tree it returns the bar whole, the alerts, the Résumé
// tab, the phone's pill and the dock are mounted, exactly as the page built them. The preview (a PDF built in a
// worker), the template gallery and the share dialog are not drawn. No component is edited, wrapped or mocked.
// Fictional people.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement, Fragment, memo, useState } from 'react';

// No Firebase in this test's build, whatever .env holds (the Editor imports the share dialog, whose cloud
// is the app's own Firestore). Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';
// The demo accounts of this test's build (VITE_DEMO_ACCOUNTS): a made-up one, never the owner's. Read when
// setup() starts Vite.
const DEMO = { uid: 'u_demo', displayName: 'Demo Person', email: 'demo.person@example.com', photoURL: null };
process.env.VITE_DEMO_ACCOUNTS = DEMO.email;
// The Export menu is placed by the kit's useFloating, which cancels its animation frame when the menu
// closes; Node has none (tests/pdf/78-letter-export-menu does the same).
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

const PERFORMED_WORK = 1; // React's flag on a fiber whose component rendered in this commit
const RENDERING_TAGS = new Set([0, 1, 11, 15]); // function, class, forwardRef, simple memo component

/**
 * Installs the hook react-dom reports its commits to. It must be there BEFORE react-dom loads (react-dom
 * looks for it once, at load), so everything that loads it — the fake DOM, the router — is imported after.
 */
function installRenderProbe() {
  const probe = { on: false, parts: [], commits: [] }; // parts: [label, the type the page imports] for each part counted

  /** The fibers that rendered in the commit that just finished: the walk the DevTools make. */
  function rendered(root) {
    const out = [];
    const visit = (next, prev) => {
      if (RENDERING_TAGS.has(next.tag) && (next.flags & PERFORMED_WORK)) out.push(next);
      // Children shared with the last tree were not touched by this commit: skip them.
      if (prev && next.child === prev.child) return;
      for (let c = next.child; c; c = c.sibling) visit(c, c.alternate);
    };
    visit(root.current, root.current.alternate);
    return out;
  }

  /**
   * The label of the part a fiber is, or sits under, else 'rest'. The nearest part wins: the switch, the chip and
   * the Design button are under the mode bar, so each is its own label and 'modes' is the mode bar's own function.
   * A part is found by the type the page imports (`elementType`: the memo wrapper, or the function itself where
   * it is not memoised), or the function a simple memo's fiber holds.
   */
  function labelOf(fiber) {
    for (let f = fiber; f; f = f.return) {
      for (const [label, type] of probe.parts) if (f.elementType === type || f.type === type) return label;
    }
    return 'rest';
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
      if (!probe.on) return;
      // Labelled now: a fiber's `return` and flags are rewritten by the next commit.
      probe.commits.push(rendered(root).map((f) => ({ label: labelOf(f), name: f.type?.displayName || f.type?.name || f.type?.render?.name || f.type?.type?.name || `tag${f.tag}` })));
    },
  };
  return probe;
}

const probe = installRenderProbe();
const { setup, teardown, loadModule, resume, section, experience } = await import('./harness.mjs');
const { mount, elements, reactProps, withInnerHtml } = await import('./fake-dom.mjs');
const { MemoryStorage, settle } = await import('./resume-tab.mjs');
const { MemoryRouter, Routes, Route, Link, useNavigate } = await import('react-router-dom');

let build;
before(async () => {
  await setup();
  withInnerHtml();
  // The warm-up the Editor starts for its PDF goes to a worker that answers at once, not to react-pdf on
  // the main thread: it is not what is tested here.
  build = await loadModule('/src/utils/pdfBuild.js');
  build._setPdfWorkerForTest(() => ({
    onmessage: null,
    postMessage(job) { Promise.resolve().then(() => this.onmessage({ data: { id: job.id } })); },
    terminate() {},
  }));
});
after(async () => {
  build._setPdfWorkerForTest(null);
  await teardown();
  delete globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
});

const KEY = 'cpwtcv_v1';
const MARK = 'Z'; // the one character typed
const NAME = 'Operations Analyst CV';
const USER = { uid: 'u_tamsin', displayName: 'Tamsin Verhoeven', email: 'tamsin.verhoeven@example.com', photoURL: null };
const NO_HELD = []; // the sync's held list is a state: one array until a résumé is held or let go
const DOCUMENT = 'Robin Vale\nProduct Designer\nrobin@example.org\n\nEXPERIENCE\nFabrikam Studio - Lead Designer\n2019 - 2023 | Leeds, UK\n* Designed the booking flow.';
const NOTICE = 'This résumé was read from a document, best-effort: check each section.';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const attr = (el, name) => el.getAttribute(name) ?? '';
/** The leaves of the bar, the alerts and the pill: none of them may render for a keystroke. */
const BAR = ['header', 'modes', 'switch', 'chip', 'designButton', 'alerts', 'pill'];
/** Past the store's coalesced write (SAVE_WAIT_MS, 300 ms) and the ATS scan's pause (250 ms): the state changes that follow a key render the page again. */
const PAUSE = 700;

/** Up to four jobs with bullets, an education, a skills section and a summary: a résumé long enough to feel. */
function fixture(jobs) {
  const bullets = (n) => `<ul><li>Cut the claims backlog by ${n}% across the Tidewater region</li><li>Mentored ${n} analysts through their first audit</li></ul>`;
  const history = [
    { company: 'Harbor Mutual', role: 'Senior Analyst', description: bullets(40) },
    { company: 'Pinecrest Logistics', role: 'Analyst', description: bullets(25) },
    { company: 'Northgate Freight', role: 'Coordinator', description: bullets(18) },
    { company: 'Bluebell Insurance', role: 'Intern', description: bullets(10) },
  ].slice(0, jobs);
  const r = resume({
    personal: {
      name: 'Tamsin Verhoeven', title: 'Operations Analyst', email: 'tamsin.verhoeven@example.com', phone: '+1 555 0142',
      location: 'Portland, OR', summary: '<p>Operations analyst who turns messy claim queues into calm, measurable workflows.</p>',
    },
    sections: [
      experience(history),
      section('education', [{ institution: 'Lakeshore State University', degree: 'BA', fieldOfStudy: 'Economics', startDate: '09/2012', endDate: '06/2016', description: '<p>Dean\'s list</p>' }]),
      section('skills', [{ category: 'Tools', skills: 'SQL, Excel, Tableau' }]),
    ],
  });
  r.name = NAME;
  return r;
}

/** The first element of a React tree (as written, components uncalled) whose type is `type`. */
function find(node, type) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!node || typeof node !== 'object' || !node.props) return null;
  return node.type === type ? node : find(node.props.children, type);
}

/** The first element of a React tree (as written) whose `data-testid` prop is `id`. */
function findTid(node, id) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findTid(child, id);
      if (hit) return hit;
    }
    return null;
  }
  if (!node || typeof node !== 'object' || !node.props) return null;
  return node.props['data-testid'] === id ? node : findTid(node.props.children, id);
}

/** Polls until `done()` holds (a write the store makes 300 ms after a key, a state set after one): by what happened, not by a clock. */
async function until(done, what) {
  for (let i = 0; i < 500; i += 1) {
    if (done()) return;
    await sleep(10);
  }
  assert.fail(`never happened: ${what}`);
}

// Two probe leaves for the sensitivity twins: memo leaves that hold what a sabotaged leaf of the bar would.
let probeLeaves = false; // mounted beside the bar only where a test asks
const StableLeaf = memo(function StableLeaf({ label }) { return createElement('i', { 'data-probe': 'stable' }, label); });
const UnstableLeaf = memo(function UnstableLeaf({ options }) { return createElement('i', { 'data-probe': 'unstable' }, String(options.n)); });
const LinkLeaf = memo(function LinkLeaf() { return createElement(Link, { to: '/', 'data-probe': 'link' }, 'Home'); });

/**
 * The editor as the app mounts it, over a saved résumé. `signedIn`: the account is signed in; `signInAs`:
 * whom the sign-in button signs in. `expand`: every entry's card opened (a card starts collapsed), so its
 * bullets can be typed in. `path`: the address after /resume/:id ('' or '?tab=coverletter', '?dock=design').
 * Returns the page's parts to read and drive, and `measure(fn)`: `fn`'s commits — which labelled parts rendered
 * in each, and which of the props the Editor gave the header, the alerts, the mode bar and the dock were not the
 * same value as before.
 */
async function openEditor({ jobs = 1, signedIn = false, expand = false, signInAs = USER, path = '' } = {}) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Editor } = await loadModule('/src/pages/Editor.jsx');
  const { EditorHeader, EditorAlerts, EditorModeBar, EditorAtsChip, EditorDesignButton } = await loadModule('/src/components/EditorHeader.jsx');
  const { EditorDocSwitch } = await loadModule('/src/components/EditorDocSwitch.jsx');
  const { EditorDock } = await loadModule('/src/components/EditorDock.jsx');
  const { EditorMobilePill } = await loadModule('/src/components/EditorMobilePill.jsx');
  const { EditorSaveStatus } = await loadModule('/src/components/EditorSaveStatus.jsx');
  const { EditorTabContent } = await loadModule('/src/components/EditorTabContent.jsx');
  const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  probe.parts = [
    ['header', EditorHeader], ['alerts', EditorAlerts], ['modes', EditorModeBar], ['save', EditorSaveStatus],
    ['switch', EditorDocSwitch], ['chip', EditorAtsChip], ['designButton', EditorDesignButton],
    ['pill', EditorMobilePill], ['dock', EditorDock], ['designPanel', DesignPanel], ['atsPanel', AtsCheckerPanel],
    ['probeStable', StableLeaf], ['probeUnstable', UnstableLeaf], ['probeLink', LinkLeaf],
  ];
  // The ATS panel keeps the pasted posting for the session.
  const sessionMap = new Map();
  globalThis.sessionStorage = {
    get length() { return sessionMap.size; }, key: (i) => [...sessionMap.keys()][i] ?? null,
    getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null), setItem: (k, v) => sessionMap.set(k, String(v)), removeItem: (k) => sessionMap.delete(k),
  };

  const r = fixture(jobs);
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  const live = {
    store: null, navigate: null, setSyncStatus: null, appRenders: 0, signOuts: [], tree: null,
    headerProps: [], alertsProps: [], modesProps: [], dockProps: [], previewProps: [], saveProps: [],
  };
  // The window's width: a desktop one until `goPhone`. Only the query the Editor asks (useIsMobile) answers by it.
  const screen = { desktop: true, listeners: new Set() };

  /** The route's component: the Editor page's body, of which the bar, the alerts, the Résumé tab, the pill and the dock are mounted. */
  function Page(props) {
    live.navigate = useNavigate();
    const tree = Editor(props);
    const header = find(tree, EditorHeader);
    const alerts = find(tree, EditorAlerts);
    const modes = find(tree, EditorModeBar);
    const tab = find(tree, EditorTabContent);
    const preview = find(tree, EditorPreviewPane);
    const bar = findTid(tree, 'editor-bar');
    const save = find(tree, EditorSaveStatus);
    assert.ok(header && alerts && modes && tab && preview, 'the Editor renders its header, alerts, mode bar, tab area and preview pane');
    assert.ok(bar && save, 'the Editor renders its bar, with the save chip in it');
    const pill = find(tree, EditorMobilePill);
    const dock = find(tree, EditorDock);
    live.tree = tree;
    live.headerProps.push(header.props);
    live.alertsProps.push(alerts.props);
    live.modesProps.push(modes.props);
    live.dockProps.push(dock ? dock.props : null);
    live.previewProps.push(preview.props);
    live.saveProps.push(save.props);
    const probes = probeLeaves
      ? [
        createElement(StableLeaf, { key: 'a', label: 'stable' }),
        // A new object at every render of the page: the unstable prop a leaf of the bar must never be given.
        createElement(UnstableLeaf, { key: 'b', options: { n: 1 } }),
        createElement(LinkLeaf, { key: 'c' }),
      ]
      : [];
    return createElement(Fragment, null, bar, alerts, tab.props.activeTab === 'resume' ? tab : null, pill, dock, ...probes);
  }

  /** App.jsx: the store, the account and the sync, below which the routes are — new objects at every render. */
  function App() {
    const store = useAppStore();
    const [user, setUser] = useState(signedIn ? USER : null);
    const [syncStatus, setSyncStatus] = useState('synced');
    live.appRenders += 1;
    const at = live.appRenders;
    Object.assign(live, { store, setSyncStatus });
    const auth = {
      user, authLoading: false, cloudAvailable: true,
      signInWithGoogle: () => setUser(signInAs),
      signOut: () => { live.signOuts.push(at); setUser(null); },
    };
    const sync = { syncStatus, lastSynced: null, isOnline: true, account: null, heldResumes: NO_HELD, readCloudCopies: () => at };
    return createElement(Routes, null,
      createElement(Route, { path: '/resume/:id', element: createElement(Page, { store, auth, sync }) }),
      createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') }));
  }

  // A desktop window: the fake one has no matchMedia, which the Editor reads as a phone. Every query matches, but
  // the Editor's own (`(min-width: 768px)`), which follows `screen`; `goPhone` tells its listeners.
  const DESKTOP = '(min-width: 768px)';
  function Root() {
    window.matchMedia = (query) => ({
      get matches() { return query === DESKTOP ? screen.desktop : true; },
      media: query,
      addEventListener(_type, listener) { if (query === DESKTOP) screen.listeners.add(listener); },
      removeEventListener(_type, listener) { screen.listeners.delete(listener); },
    });
    return createElement(MemoryRouter, { initialEntries: [`/resume/${r.id}${path}`] }, createElement(App));
  }

  const view = mount(Root, {});
  await settle();
  const all = () => [...elements(view.container)];
  const byTitle = (title) => all().find((el) => el.getAttribute('title') === title);
  const byTid = (id) => all().find((el) => attr(el, 'data-testid') === id);
  const call = (el, name, event = {}) => {
    const handler = reactProps(el)?.[name];
    assert.ok(handler, `no ${name} handler on <${el?.tagName}>`);
    view.act(() => handler({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...event }));
  };

  if (expand) {
    const headers = all().filter((el) => el.tagName === 'DIV' && /cursor-pointer select-none/.test(attr(el, 'class')));
    assert.equal(headers.length, jobs + 2, 'one header per entry: the jobs, the education, the skills');
    view.act(() => {
      for (const el of headers) reactProps(el).onClick({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el });
    });
    await settle();
  }

  const boxes = () => all().filter((el) => attr(el, 'role') === 'textbox');
  const summaryBox = () => boxes().find((el) => attr(el, 'aria-label') === 'Professional summary');
  const bulletBox = (job) => boxes().filter((el) => el !== summaryBox())[job];

  /** One character typed at the start of a rich-text box's text, as the browser fires `input`. */
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

  /** Downloads from now on are kept (the fake page's links cannot click; the object URL is the Blob itself). */
  function keepDownloads() {
    const files = [];
    const make = view.document.createElement.bind(view.document);
    view.document.createElement = (tag, ...rest) => {
      const el = make(tag, ...rest);
      if (String(tag).toLowerCase() === 'a') el.click = () => {};
      return el;
    };
    const saved = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = (blob) => { files.push(blob); return 'blob:x'; };
    URL.revokeObjectURL = () => {};
    return { files, restore() { Object.assign(URL, { createObjectURL: saved.create, revokeObjectURL: saved.revoke }); } };
  }

  return {
    live,
    id: r.id,
    byTitle,
    byTid,
    call,
    act: (fn) => view.act(fn),
    text: () => view.container.textContent,
    store: () => live.store,
    /** What the Editor gave the header at its latest render, and at its first. */
    header: () => live.headerProps.at(-1),
    firstHeader: () => live.headerProps[0],
    /** The same for the alerts, and for the mode bar. */
    alerts: () => live.alertsProps.at(-1),
    firstAlerts: () => live.alertsProps[0],
    modes: () => live.modesProps.at(-1),
    firstModes: () => live.modesProps[0],
    /** What the save chip was given at its latest render. */
    save: () => live.saveProps.at(-1),
    /** The alerts on screen, each as its text: a message and its Dismiss button. */
    alertTexts: () => all().filter((el) => ['alert', 'status'].includes(attr(el, 'role')) && /\bpx-4 py-2 text-xs\b/.test(attr(el, 'class'))).map((el) => text(el).replace(/Dismiss$/, '')),
    dismissButtons: () => all().filter((el) => el.tagName === 'BUTTON' && text(el) === 'Dismiss'),
    /** A control of the bar, by its testid, pressed as a click, and the address change it sets off settled. */
    async press(id) {
      const el = byTid(id);
      assert.ok(el, `no control with the testid ${id}`);
      call(el, 'onClick');
      await settle(); // the address changes in the router's own time
    },
    /**
     * A control pressed, then waited for until `done()` holds (500 x 10 ms, by what happened, never a fixed tick count): the
     * address change reaches the page as a router transition, and a dock's panels (the Design groups, the ATS scan) take their
     * time to mount, so `press`'s settle can end before the screen shows the result. What the page rendered
     * (`modes()`, `header()`) is read while rendering, before the commit: only the screen says it is done.
     */
    async pressUntil(id, done, what) {
      const el = byTid(id);
      assert.ok(el, `no control with the testid ${id}`);
      call(el, 'onClick');
      await until(done, what);
    },
    /** The document switch's button that is lit (the open document), by the one class only the lit one has. */
    openDoc: () => ['doc-switch-resume', 'doc-switch-letter'].filter((id) => /\bshadow-sm\b/.test(attr(byTid(id), 'class'))),
    chipOpen: () => /\bbg-cv-good-soft\b/.test(attr(byTid('ats-chip'), 'class')),
    designOpen: () => /\bbg-cv-brand-soft\b/.test(attr(byTid('design-button'), 'class')),
    /** Which dock is on screen: 'design', 'ats' or null. */
    dockOnScreen: () => ['design', 'ats'].find((name) => byTid(`dock-${name}`)) ?? null,
    /** The layout the Editor gave the preview pane: 'split' on a desktop; on a phone 'editor', or 'preview' once the floating pill is on it. */
    previewLayout: () => live.previewProps.at(-1).layoutMode,
    /** The window becomes a phone's: its width query says so to the Editor, as the browser would. */
    goPhone() {
      screen.desktop = false;
      view.act(() => { for (const listener of screen.listeners) listener({ matches: false }); });
    },
    renameBox: () => all().find((el) => el.tagName === 'INPUT' && attr(el, 'aria-label') === 'Résumé name'),
    exportButton: () => all().find((el) => el.tagName === 'BUTTON' && /^(Export|\.\.\.|Reading…)$/.test(text(el))),
    syncDot: () => all().find((el) => attr(el, 'data-testid') === 'sync-status'),
    signInButton: () => all().find((el) => el.tagName === 'BUTTON' && attr(el, 'aria-label') === 'Sign in with Google'),
    buttonLabels: () => all().filter((el) => el.tagName === 'BUTTON').map(text),
    keepDownloads,
    typeInBullet: (job) => typeInBox(bulletBox(job)),
    typeInSummary: () => typeInBox(summaryBox()),
    typeInEmail,
    /**
     * `fn`'s commits (and what runs after it for `wait` ms more): `count(label)`, the number of commits in which
     * something of that labelled part rendered; `names(label)`, the components of it that rendered; `first`, the
     * labels of the first commit; and the props the Editor gave the header, the alerts, the mode bar and the dock that
     * were not the same value as before (`changed`, `changedAlerts`, `changedModes`, `changedDock`).
     */
    async measure(fn, wait = 0) {
      const from = live.headerProps.length;
      probe.commits = [];
      probe.on = true;
      try {
        await fn();
        await settle();
        if (wait) await sleep(wait);
      } finally {
        probe.on = false;
      }
      const commits = probe.commits.map((commit) => {
        const by = new Map();
        for (const { label, name } of commit) by.set(label, new Set(by.get(label)).add(name));
        return by;
      });
      /** The keys of `list`'s props since `from` that were not the same value as before it. */
      const changedIn = (list) => {
        const was = list[from - 1];
        const changed = new Set();
        if (!was) return [];
        for (const props of list.slice(from)) {
          if (!props) continue;
          for (const key of new Set([...Object.keys(was), ...Object.keys(props)])) if (!Object.is(was[key], props[key])) changed.add(key);
        }
        return [...changed];
      };
      const changed = changedIn(live.headerProps);
      const changedAlerts = changedIn(live.alertsProps);
      const changedModes = changedIn(live.modesProps);
      const changedDock = changedIn(live.dockProps);
      return {
        commits,
        count: (label) => commits.filter((c) => c.has(label)).length,
        names: (label) => [...new Set(commits.flatMap((c) => [...(c.get(label) ?? [])]))],
        /** The rendered components that are under none of the parts counted: the edit's own. */
        rest: () => [...new Set(commits.flatMap((c) => [...(c.get('rest') ?? [])]))],
        changed,
        changedAlerts,
        changedModes,
        changedDock,
        report: () => `${commits.length} commits: ${JSON.stringify(commits.map((c) => Object.fromEntries([...c].map(([l, n]) => [l, [...n]]))))}. Props that were not the same value as before — the header's: ${JSON.stringify(changed)}, the alerts': ${JSON.stringify(changedAlerts)}, the mode bar's: ${JSON.stringify(changedModes)}, the dock's: ${JSON.stringify(changedDock)}`,
      };
    },
    async close() {
      probeLeaves = false;
      await view.unmount();
      delete globalThis.localStorage;
      delete globalThis.sessionStorage;
    },
  };
}

/** What a keystroke may be: a bullet, the summary, a personal-info field — how it is typed, and how to see that it reached the store. */
const CASES = [
  ['a bullet of one job', (t) => t.typeInBullet(1), (t) => t.store().activeResume.sections[0].items[1].description.includes(MARK)],
  ['the summary', (t) => t.typeInSummary(), (t) => t.store().activeResume.personal.summary.includes(MARK)],
  ['a personal-info field (Email)', (t) => t.typeInEmail(), (t) => t.store().activeResume.personal.email.endsWith(MARK)],
];

describe('typing one character renders nothing of the editor bar (PERF-4)', () => {
  for (const signedIn of [false, true]) {
    for (const [what, type, reached] of CASES) {
      it(`${what}, ${signedIn ? 'signed in' : 'signed out'}: not the header, the Export menu or the account bar, nor a prop of it that is a new value`, async () => {
        const t = await openEditor({ jobs: 4, signedIn, expand: true });
        try {
          const w = await t.measure(() => type(t));
          assert.ok(reached(t), 'the character reached the store');
          assert.ok(w.commits.length >= 1 && w.rest().length >= 1, `the edit rendered its own part, so the count is live. ${w.report()}`);
          assert.deepEqual(w.names('header'), [], `typing rendered part of the header (back, name, Export menu, Share, account). ${w.report()}`);
          assert.deepEqual(w.changed, [], `typing gave the header a prop that is not the same value as before. ${w.report()}`);
        } finally { await t.close(); }
      });
    }
  }

  // The same page, the same router, for the Personal Info editor (tests/pdf/165 mounts the tab without one):
  // a memoised part is only as still as what is under it, and a router hook or link anywhere in its tree would
  // wake it at every key however its props were kept.
  it('a bullet does not render the Personal Info editor, nor a part of it; a key in its own field does', async () => {
    const PERSONAL = ['PersonalInfoEditor', 'HeaderCustomization', 'PhotoSection'];
    const t = await openEditor({ jobs: 4, expand: true });
    try {
      let w = await t.measure(() => t.typeInEmail());
      assert.ok(w.rest().includes('PersonalInfoEditor'), `a key in its own field renders it, so the count is live. ${w.report()}`);
      w = await t.measure(() => t.typeInBullet(1));
      assert.ok(t.store().activeResume.sections[0].items[1].description.includes(MARK), 'the character reached the store');
      assert.ok(w.rest().length >= 1, `the bullet rendered its own part. ${w.report()}`);
      assert.deepEqual(w.rest().filter((name) => PERSONAL.includes(name)), [], `typing in a bullet rendered part of the Personal Info editor. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('the write that follows the keystroke (Saving…, then Saved) renders nothing of the header either', async () => {
    const t = await openEditor({ jobs: 1 });
    try {
      const w = await t.measure(() => t.typeInSummary(), PAUSE);
      assert.ok(t.store().savedAt, 'the write has happened');
      assert.deepEqual(w.names('header'), [], `the header rendered. ${w.report()}`);
      assert.deepEqual(w.changed, [], w.report());
    } finally { await t.close(); }
  });
});

describe('typing one character renders none of the switch, the ATS chip, the Design button, the alerts or the pill (PERF-4)', () => {
  for (const signedIn of [false, true]) {
    for (const [what, type, reached] of CASES) {
      it(`${what}, ${signedIn ? 'signed in' : 'signed out'}: not EditorModeBar, EditorDocSwitch, EditorAtsChip, EditorDesignButton, EditorAlerts`, async () => {
        const t = await openEditor({ jobs: 4, signedIn, expand: true });
        try {
          const w = await t.measure(() => type(t));
          assert.ok(reached(t), 'the character reached the store');
          assert.ok(w.commits.length >= 1 && w.rest().length >= 1, `the edit rendered its own part, so the count is live. ${w.report()}`);
          for (const label of BAR) assert.equal(w.count(label), 0, `typing rendered ${label}. ${w.report()}`);
          assert.deepEqual(w.changedAlerts, [], `typing gave the alerts a prop that is not the same value as before. ${w.report()}`);
          assert.deepEqual(w.changedModes, [], `typing gave the mode bar a prop that is not the same value as before. ${w.report()}`);
        } finally { await t.close(); }
      });
    }
  }

  it('the write that follows the keystroke (Saving…, then Saved) renders none of them either, in a phone\'s window too', async () => {
    for (const phone of [false, true]) {
      const t = await openEditor({ jobs: 1 });
      try {
        if (phone) t.goPhone();
        const w = await t.measure(() => t.typeInSummary(), PAUSE);
        assert.ok(t.store().savedAt, 'the write has happened');
        for (const label of BAR) assert.equal(w.count(label), 0, `${label} rendered${phone ? ' on a phone' : ''}. ${w.report()}`);
        assert.deepEqual([w.changed, w.changedAlerts, w.changedModes], [[], [], []], w.report());
        if (phone) assert.ok(t.byTid('editor-pill'), 'the phone has its pill, so the count of it is live');
      } finally { await t.close(); }
    }
  });
});

describe('typing with a dock open renders no part of the bar and neither panel in the key\'s own commit (PERF-4)', () => {
  for (const [dock, panel] of [['design', 'designPanel'], ['ats', 'atsPanel']]) {
    it(`the ${dock} dock: the bar's leaves do not render, the dock is given the same design, store and close, and ${panel} waits for the pause`, async () => {
      const t = await openEditor({ jobs: 1, signedIn: true, path: `?dock=${dock}` });
      try {
        assert.equal(t.dockOnScreen(), dock, 'the dock is open');
        const w = await t.measure(() => t.typeInSummary(), PAUSE);
        assert.ok(t.store().activeResume.personal.summary.includes(MARK), 'the character reached the store');
        assert.ok(w.commits.length >= 1 && w.commits[0].size >= 1, `the key rendered its own part, so the count is live. ${w.report()}`);
        for (const label of BAR) assert.equal(w.count(label), 0, `${label} rendered with the ${dock} dock open. ${w.report()}`);
        assert.equal(w.commits[0].has(panel), false, `${panel} rendered in the key's own commit. ${w.report()}`);
        assert.ok(w.count(panel) <= 1, `${panel} rendered ${w.count(panel)} times. ${w.report()}`);
        assert.deepEqual(w.changedDock, ['resume'], `the dock is given what a keystroke changes, its résumé, and nothing else (an unstable design, store or onClose renders its panels at every key). ${w.report()}`);
        assert.deepEqual(w.changed, [], w.report());
      } finally { await t.close(); }
    });
  }

  it('the count is live: opening a dock renders the dock, and the button or the chip that shows it', async () => {
    const t = await openEditor();
    try {
      // Each button is lit by its own dock only (`open` is a boolean of its own), so the Design dock opening renders the Design
      // button and not the chip, and the ATS dock the chip: the leaf that shows the dock renders, the other does not need to.
      let w = await t.measure(() => t.pressUntil('design-button', () => t.dockOnScreen() === 'design', 'the Design dock opens'));
      for (const label of ['modes', 'designButton', 'dock']) assert.ok(w.count(label) >= 1, `${label} did not render for the Design dock opening. ${w.report()}`);
      assert.equal(w.count('header'), 0, `the header rendered for a dock opening. ${w.report()}`);
      w = await t.measure(() => t.pressUntil('ats-chip', () => t.dockOnScreen() === 'ats', 'the ATS dock replaces it'));
      for (const label of ['modes', 'chip', 'designButton', 'dock']) assert.ok(w.count(label) >= 1, `${label} did not render for the ATS dock opening. ${w.report()}`);
      assert.equal(w.count('header'), 0, `the header rendered for a dock opening. ${w.report()}`);
    } finally { await t.close(); }
  });
});

describe('the save chip has its own budget (PERF-4)', () => {
  it('a burst of keys renders it at most twice (Saving…, then Saved), as primitives, and nothing else of the bar', async () => {
    const t = await openEditor({ jobs: 1 });
    try {
      // The store writes the résumé it opened with 300 ms after the mount, so on a slow machine the chip already reads "Saved"
      // here: that first write is waited for, and the burst is counted after it ("Auto-saved to your browser" before a
      // write is pinned on the leaf itself, tests/pdf/180-ui-b3-save-chip).
      await until(() => t.store().savedAt && /^Saved /.test(text(t.byTid('save-status'))), 'the write of the opened résumé landed');
      const first = t.store().savedAt;
      const w = await t.measure(async () => {
        t.typeInSummary(); t.typeInSummary(); t.typeInSummary();
        await until(() => t.store().savedAt !== first && /^Saved /.test(text(t.byTid('save-status'))), 'the burst was written and the chip says Saved');
      });
      assert.ok(t.store().savedAt, 'the write has happened');
      assert.ok(w.count('save') >= 1, `the chip shows Saving… and Saved, so it renders. ${w.report()}`);
      assert.ok(w.count('save') <= 2, `the chip rendered ${w.count('save')} times for one burst. ${w.report()}`);
      assert.match(text(t.byTid('save-status')), /^Saved /);
      for (const label of BAR) assert.equal(w.count(label), 0, `${label} rendered for the write. ${w.report()}`);
      assert.deepEqual(Object.keys(t.save()).sort(), ['persistError', 'savedAt', 'saving'], 'the chip is given three primitives and no more');
      for (const value of Object.values(t.save())) assert.ok(['boolean', 'number', 'object'].includes(typeof value) && (typeof value !== 'object' || value === null), 'each a boolean or a time, never an object');
    } finally { await t.close(); }
  });

  it('the header is not given the save state: no prop of it holds saving, savedAt or an error', async () => {
    const t = await openEditor();
    try {
      const keys = Object.keys(t.header());
      for (const key of ['saving', 'savedAt', 'persistError', 'saveStatus']) assert.ok(!keys.includes(key), `EditorHeader is given ${key}`);
    } finally { await t.close(); }
  });
});

describe('the count catches what it guards against (sensitivity twins)', () => {
  it('a leaf given a new object at every render renders at every key; a leaf of stable props and one with a router hook do as they should', async () => {
    probeLeaves = true;
    const t = await openEditor();
    try {
      const w = await t.measure(() => { t.typeInSummary(); t.typeInSummary(); });
      assert.ok(w.count('probeUnstable') >= 1, `a memo leaf given {…} at every render must render: the count would not see an unstable prop on a leaf of the bar. ${w.report()}`);
      assert.ok(w.count('probeLink') >= 1, `a memo leaf with a <Link> must render at a key: the count would not see a Link added to a leaf of the bar. ${w.report()}`);
      assert.equal(w.count('probeStable'), 0, `a leaf of stable props rendered. ${w.report()}`);
      for (const label of BAR) assert.equal(w.count(label), 0, `${label} rendered. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('the changed-props list sees a prop that is a new value, and none that is not', async () => {
    const t = await openEditor();
    try {
      // A rename of the résumé is a new `name` for the header: the list names it, and nothing more.
      const w = await t.measure(() => t.act(() => t.store().renameResume(t.id, 'Another name')));
      assert.ok(w.count('header') >= 1, `the header shows the new name, so it renders. ${w.report()}`);
      assert.ok(w.changed.includes('name'), w.report());
      for (const key of ['exportMenu', 'auth', 'sync', 'onBack', 'onShare']) assert.ok(!w.changed.includes(key), `${key} is the same value as before. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('no memo part of the bar reads the router or draws a Link (the source of the leaves)', () => {
    const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const file of ['components/EditorHeader.jsx', 'components/EditorDocSwitch.jsx', 'components/EditorSaveStatus.jsx', 'components/EditorMobilePill.jsx', 'components/EditorDock.jsx']) {
      const code = strip(fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8'));
      assert.ok(!/useNavigate|useParams|useSearchParams|useLocation|<Link\b|react-router/.test(code), `${file} uses the router`);
    }
  });
});

describe('what the bar shows still updates', () => {
  it('renaming: the box opens on the name, Enter saves what was typed, and the header shows it', async () => {
    const t = await openEditor();
    try {
      assert.equal(text(t.byTitle('Rename resume')), NAME);
      let w = await t.measure(() => t.call(t.byTitle('Rename resume'), 'onClick'));
      assert.equal(t.renameBox()?.value, NAME, 'the box opens on the name');
      assert.ok(w.count('header') >= 1, `the header shows the box. ${w.report()}`);
      w = await t.measure(() => t.call(t.renameBox(), 'onChange', { target: { value: 'Operations CV' } }));
      assert.equal(t.renameBox().value, 'Operations CV', 'the box shows what is typed');
      assert.ok(w.count('header') >= 1, w.report());
      w = await t.measure(() => t.call(t.renameBox(), 'onKeyDown', { key: 'Enter' }));
      assert.equal(t.store().activeResume.name, 'Operations CV', 'Enter reached the store');
      assert.equal(t.renameBox(), undefined, 'the box is closed');
      assert.equal(text(t.byTitle('Rename resume')), 'Operations CV', 'the header shows the new name');
      assert.ok(w.count('header') >= 1, w.report());
    } finally { await t.close(); }
  });

  it('renamed in another tab: the header shows it, and the box opens on it — the rename handlers act on the latest name', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(() => t.act(() => t.store().renameResume(t.id, 'Renamed in another tab')));
      assert.equal(text(t.byTitle('Rename resume')), 'Renamed in another tab');
      assert.ok(w.count('header') >= 1, w.report());
      t.call(t.byTitle('Rename resume'), 'onClick');
      assert.equal(t.renameBox().value, 'Renamed in another tab', 'a stale start() would open the box on the name the header first held');
      t.call(t.renameBox(), 'onBlur');
      assert.equal(t.store().activeResume.name, 'Renamed in another tab', 'leaving the box untouched writes nothing back');
    } finally { await t.close(); }
  });

  it('an export in progress disables the Export button and says so, and it comes back when the file is made', async () => {
    const t = await openEditor();
    const downloads = t.keepDownloads();
    try {
      assert.equal(text(t.exportButton()), 'Export');
      let run;
      const w = await t.measure(() => {
        t.act(() => { run = t.header().exportMenu.handleExportJSON(); });
        assert.equal(text(t.exportButton()), '...', 'the button says an export is running');
        assert.equal(reactProps(t.exportButton()).disabled, true);
        return run;
      });
      assert.equal(text(t.exportButton()), 'Export', 'and is back once the file is made');
      assert.equal(downloads.files.length, 1);
      assert.ok(w.names('header').includes('ExportDropdown'), `the Export menu rendered for it. ${w.report()}`);
    } finally { downloads.restore(); await t.close(); }
  });

  it('an import in progress says "Reading…" and disables the Export button until the document is read, then the new résumé opens', async () => {
    const t = await openEditor();
    try {
      // A picked document whose bytes arrive when the test says, as a big PDF's do while pdf.js loads.
      let release;
      const bytes = new Promise((resolve) => { release = () => resolve(new TextEncoder().encode(DOCUMENT).buffer); });
      const file = { name: 'robin.txt', arrayBuffer: () => bytes };
      let run;
      const w = await t.measure(() => { t.act(() => { run = t.header().exportMenu.handleImportFile(file); }); });
      assert.equal(text(t.exportButton()), 'Reading…', 'the button says a document is being read');
      assert.equal(reactProps(t.exportButton()).disabled, true);
      assert.ok(w.names('header').includes('ExportDropdown'), `the Export menu rendered for it. ${w.report()}`);
      release();
      await run;
      await settle();
      assert.equal(text(t.exportButton()), 'Export', 'and is back once it is read');
      assert.equal(t.store().appState.resumes.length, 2, 'the document became a new résumé');
      assert.notEqual(text(t.byTitle('Rename resume')), NAME, 'which the editor opened, and the header shows');
    } finally { await t.close(); }
  });

  it('on the Cover Letter document the Export menu names the letter (the switch picks it, the menu follows)', async () => {
    const t = await openEditor();
    try {
      t.call(t.exportButton(), 'onClick'); // opens the menu, on the Resume document
      assert.ok(t.buttonLabels().includes('Export PDF'), t.buttonLabels().join(' | '));
      const w = await t.measure(() => t.pressUntil('doc-switch-letter', () => t.openDoc()[0] === 'doc-switch-letter', 'the Cover letter is the open document'));
      assert.deepEqual(t.openDoc(), ['doc-switch-letter']);
      assert.ok(t.buttonLabels().includes('Export Cover Letter PDF'), t.buttonLabels().join(' | '));
      assert.ok(w.names('header').includes('ExportDropdown'), w.report());
    } finally { await t.close(); }
  });

  it('a demo account\'s Export menu offers Import as my original once it is signed in', async () => {
    const t = await openEditor({ signInAs: DEMO });
    try {
      const offered = () => t.buttonLabels().some((label) => /Import as my original/.test(label));
      t.call(t.exportButton(), 'onClick'); // opens the menu, signed out
      assert.equal(offered(), false, t.buttonLabels().join(' | '));
      const w = await t.measure(() => t.call(t.signInButton(), 'onClick'));
      assert.equal(offered(), true, t.buttonLabels().join(' | '));
      assert.ok(w.names('header').includes('ExportDropdown'), w.report());
    } finally { await t.close(); }
  });

  it('the editor-only layout shows the layout toggle in the header, the split layout does not', async () => {
    const t = await openEditor();
    try {
      const toggles = () => ['Editor only', 'Split view', 'Preview only'].filter((title) => t.byTitle(title));
      assert.deepEqual(toggles(), [], 'in the split layout the preview toolbar carries it');
      const w = await t.measure(() => t.act(() => t.header().setLayoutMode('editor')));
      assert.equal(toggles().length, 3);
      assert.ok(w.names('header').includes('LayoutToggle'), w.report());
      t.act(() => t.header().setLayoutMode('split'));
      assert.deepEqual(toggles(), []);
    } finally { await t.close(); }
  });

  it('signing in and out, and the sync, reach the account bar', async () => {
    const t = await openEditor();
    try {
      assert.ok(t.signInButton(), 'signed out: the sign-in button');
      let w = await t.measure(() => t.call(t.signInButton(), 'onClick'));
      assert.equal(t.signInButton(), undefined, 'signed in: no sign-in button');
      assert.equal(attr(t.syncDot(), 'aria-label'), 'Synced');
      assert.ok(w.names('header').includes('AuthBar'), `the account bar rendered for it. ${w.report()}`);
      w = await t.measure(() => t.act(() => t.live.setSyncStatus('syncing')));
      assert.equal(attr(t.syncDot(), 'aria-label'), 'Syncing…', 'the sync dot follows the status');
      assert.ok(w.names('header').includes('AuthBar'), w.report());
      t.act(() => t.header().auth.signOut());
      assert.ok(t.signInButton(), 'signed out again');
    } finally { await t.close(); }
  });

  it('Back to dashboard goes to the dashboard', async () => {
    const t = await openEditor();
    try {
      t.call(t.byTitle('Back to dashboard'), 'onClick');
      await settle();
      assert.match(t.text(), /THE DASHBOARD/);
    } finally { await t.close(); }
  });
});

describe('a handler the header has held since its first render acts on the latest (no stale closure)', () => {
  it('Export Backup JSON writes the text typed since', async () => {
    const t = await openEditor();
    const downloads = t.keepDownloads();
    try {
      const held = t.firstHeader().exportMenu;
      t.typeInEmail();
      t.typeInEmail();
      await settle();
      assert.equal(t.header().exportMenu, held, 'the header was given the same Export menu after the keys');
      await held.handleExportJSON();
      assert.equal(downloads.files.length, 1);
      const out = JSON.parse(await downloads.files[0].text());
      assert.ok(out.personal.email.endsWith(`${MARK}${MARK}`), `the file holds the text as of the last key, not the first render's: ${out.personal.email}`);
    } finally { downloads.restore(); await t.close(); }
  });

  it('Import opens the imported résumé, and the header shows it', async () => {
    const t = await openEditor();
    try {
      const held = t.firstHeader().exportMenu;
      t.typeInEmail();
      await settle();
      const file = resume({ personal: { name: 'Imported Person' } });
      file.name = 'Imported CV';
      t.act(() => held.handleImportJSON(JSON.parse(JSON.stringify(file))));
      await settle();
      assert.equal(t.store().appState.resumes.length, 2, 'the file was added as a new résumé');
      assert.equal(text(t.byTitle('Rename resume')), 'Imported CV', 'the editor opened it (its address, the open résumé) and the header shows its name');
    } finally { await t.close(); }
  });

  it('the account bar’s sign out reaches the latest render’s function', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      const held = t.firstHeader().auth;
      t.typeInEmail();
      t.typeInEmail();
      await settle();
      assert.equal(t.header().auth, held, 'the header was given the same account object after the keys');
      const latest = t.live.appRenders;
      assert.ok(latest > 1, 'the page rendered again');
      t.act(() => held.signOut());
      assert.deepEqual(t.live.signOuts, [latest], 'the call went to the render the page was last at, not the first');
    } finally { await t.close(); }
  });

  it('Back goes to the dashboard from the function the header held since its first render', async () => {
    const t = await openEditor();
    try {
      const held = t.firstHeader().onBack;
      t.typeInEmail();
      await settle();
      assert.equal(t.header().onBack, held, 'the header was given the same Back after the keys');
      t.act(() => held());
      await settle();
      assert.match(t.text(), /THE DASHBOARD/);
    } finally { await t.close(); }
  });
});

describe('what the alerts, the switch, the chip and the Design button show still updates', () => {
  it('an export error shows, and its Dismiss takes it away', async () => {
    const t = await openEditor();
    try {
      assert.deepEqual(t.alertTexts(), []);
      let w = await t.measure(() => t.act(() => t.header().exportMenu.setExportError('PDF export failed (boom). Check your connection and try again.')));
      assert.deepEqual(t.alertTexts(), ['PDF export failed (boom). Check your connection and try again.']);
      assert.ok(w.names('alerts').includes('EditorAlerts'), `the alert rendered for it. ${w.report()}`);
      w = await t.measure(() => t.call(t.dismissButtons()[0], 'onClick'));
      assert.deepEqual(t.alertTexts(), [], 'Dismiss takes it away');
      assert.ok(w.names('alerts').includes('EditorAlerts'), w.report());
    } finally { await t.close(); }
  });

  it('a storage that is full is said once: later refused writes (a new error, the same reason) render nothing, and a write that fits takes it away', async () => {
    const FULL = 'Not saved: browser storage is full. Export JSON to keep a copy, or remove large photos.';
    const t = await openEditor();
    try {
      localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
      let w = await t.measure(async () => { t.typeInSummary(); await until(() => t.store().persistError, 'the write storage refuses'); });
      assert.deepEqual(t.alertTexts(), [FULL]);
      assert.ok(w.names('alerts').includes('EditorAlerts'), `the notice rendered the alerts. ${w.report()}`);
      assert.equal(text(t.byTid('save-status')), 'Not saved', 'and the save chip says so, in red');
      const first = t.store().persistError;
      w = await t.measure(async () => { t.typeInSummary(); await until(() => t.store().persistError !== first, 'another refused write'); });
      assert.notEqual(t.store().persistError, first, 'a refused write makes a new error each time');
      assert.deepEqual(t.alertTexts(), [FULL]);
      for (const label of BAR) assert.equal(w.count(label), 0, `the same reason is no news, but ${label} rendered. ${w.report()}`);
      delete localStorage.setItem; // storage takes writes again
      w = await t.measure(async () => { t.typeInSummary(); await until(() => !t.store().persistError, 'a write that fits'); });
      assert.deepEqual(t.alertTexts(), [], 'the notice goes once a write fits');
      assert.ok(w.names('alerts').includes('EditorAlerts'), w.report());
    } finally {
      delete localStorage.setItem;
      await t.close();
    }
  });

  it('a document import\'s notice shows, and its Dismiss takes it off the address and leaves the document where it is', async () => {
    const t = await openEditor();
    try {
      let w = await t.measure(() => t.act(() => t.live.navigate(`/resume/${t.id}?tab=coverletter`, { state: { importNotice: NOTICE } })));
      assert.deepEqual(t.alertTexts(), [NOTICE]);
      assert.ok(w.names('alerts').includes('EditorAlerts'), `the notice rendered the alerts. ${w.report()}`);
      assert.equal(t.modes().doc, 'coverletter');
      w = await t.measure(() => t.call(t.dismissButtons()[0], 'onClick'));
      assert.deepEqual(t.alertTexts(), [], 'Dismiss takes the notice away');
      assert.equal(t.modes().doc, 'coverletter', 'and leaves the document it was on');
      assert.ok(w.names('alerts').includes('EditorAlerts'), w.report());
    } finally { await t.close(); }
  });

  it('the switch shows the open document and the chip and the Design button show their dock: pressed, a dock opens, and pressed again goes back to the résumé', async () => {
    const t = await openEditor();
    try {
      assert.deepEqual(t.openDoc(), ['doc-switch-resume']);
      let w = await t.measure(() => t.pressUntil('doc-switch-letter', () => t.openDoc()[0] === 'doc-switch-letter', 'the Cover letter is the open document'));
      assert.equal(t.modes().doc, 'coverletter');
      assert.deepEqual(t.openDoc(), ['doc-switch-letter']);
      assert.ok(w.count('switch') >= 1 && w.count('modes') >= 1, `the switch rendered for it. ${w.report()}`);
      // (The header does render for a document pick: the Export menu's words follow the open document.)
      // Design belongs to the résumé: opened from the letter it opens over the Resume (EDIT-171).
      w = await t.measure(() => t.pressUntil('design-button', () => t.dockOnScreen() === 'design', 'the Design dock opens over the Resume'));
      assert.equal(t.modes().dock, 'design');
      assert.equal(t.modes().doc, 'resume', 'a dock opened from the letter switches to the Resume');
      assert.deepEqual(t.openDoc(), ['doc-switch-resume']);
      assert.equal(t.dockOnScreen(), 'design');
      assert.ok(t.designOpen() && !t.chipOpen(), 'the Design button is the lit one');
      assert.ok(w.count('designButton') >= 1 && w.count('modes') >= 1, `the Design button rendered for it. ${w.report()}`);
      await t.pressUntil('design-button', () => t.dockOnScreen() === null, 'the Design button again closes the dock');
      assert.equal(t.modes().dock, null, 'the Design button again closes the dock');
      assert.equal(t.dockOnScreen(), null);
      assert.deepEqual(t.openDoc(), ['doc-switch-resume'], 'and the document is the Resume');
      // The ATS chip is the same toggle, and one dock at a time.
      w = await t.measure(() => t.pressUntil('ats-chip', () => t.dockOnScreen() === 'ats', 'the ATS dock opens'));
      assert.equal(t.dockOnScreen(), 'ats');
      assert.ok(t.chipOpen() && !t.designOpen());
      assert.ok(w.count('chip') >= 1, `the chip rendered for it. ${w.report()}`);
      await t.pressUntil('design-button', () => t.dockOnScreen() === 'design', 'the other dock replaces it');
      assert.equal(t.dockOnScreen(), 'design', 'the other dock replaces it');
      assert.ok(t.designOpen() && !t.chipOpen());
    } finally { await t.close(); }
  });

  it('negative twin: picking the Cover letter closes an open dock, and the Resume switch never opens one', async () => {
    const t = await openEditor({ path: '?dock=ats' });
    try {
      assert.equal(t.dockOnScreen(), 'ats');
      await t.pressUntil('doc-switch-letter', () => t.dockOnScreen() === null, 'the dock is closed');
      assert.equal(t.dockOnScreen(), null, 'the dock is closed');
      assert.equal(t.modes().doc, 'coverletter');
      await t.pressUntil('doc-switch-resume', () => t.openDoc()[0] === 'doc-switch-resume', 'the Resume is the open document');
      assert.equal(t.dockOnScreen(), null, 'the Resume switch opens no dock');
      assert.equal(t.modes().doc, 'resume');
    } finally { await t.close(); }
  });
});

describe('a handler the alerts or the mode bar have held since their first render acts on the latest (no stale closure)', () => {
  it('the document picker keeps its identity, and a document picked through it leaves the import notice the address holds now', async () => {
    const t = await openEditor();
    try {
      const held = t.firstModes().onPickDoc;
      t.typeInEmail();
      await settle();
      assert.equal(t.modes().onPickDoc, held, 'the mode bar was given the same function after the keys');
      t.act(() => t.live.navigate(`/resume/${t.id}`, { state: { importNotice: NOTICE } }));
      await settle();
      assert.deepEqual(t.alertTexts(), [NOTICE], 'a notice came after the picker was made');
      t.act(() => held('coverletter'));
      await until(() => t.openDoc()[0] === 'doc-switch-letter', 'the Cover letter is the open document');
      assert.equal(t.modes().doc, 'coverletter');
      assert.deepEqual(t.alertTexts(), [NOTICE], 'a stale picker read the address as it was at the first render, and took the notice off');
    } finally { await t.close(); }
  });

  it('the dock toggle keeps its identity, and a dock opened through it leaves the import notice the address holds now', async () => {
    const t = await openEditor();
    try {
      const held = t.firstModes().onToggleDock;
      t.typeInEmail();
      await settle();
      assert.equal(t.modes().onToggleDock, held, 'the mode bar was given the same function after the keys');
      t.act(() => t.live.navigate(`/resume/${t.id}`, { state: { importNotice: NOTICE } }));
      await settle();
      assert.deepEqual(t.alertTexts(), [NOTICE]);
      t.act(() => held('design'));
      await until(() => t.dockOnScreen() === 'design', 'the dock opens');
      assert.equal(t.modes().dock, 'design');
      assert.deepEqual(t.alertTexts(), [NOTICE], 'a stale toggle took the notice off the address');
      t.act(() => held('design'));
      await until(() => t.dockOnScreen() === null, 'the dock closes');
      assert.equal(t.modes().dock, null, 'the same toggle, held since the first render, closes the dock it opened');
      assert.deepEqual(t.alertTexts(), [NOTICE]);
    } finally { await t.close(); }
  });

  it('on a phone, a document or a dock picked through the functions held since the desktop brings the editor back from the preview', async () => {
    const t = await openEditor();
    try {
      const heldDoc = t.firstModes().onPickDoc;
      const heldDock = t.firstModes().onToggleDock;
      assert.equal(t.previewLayout(), 'split');
      t.goPhone();
      assert.equal(t.previewLayout(), 'editor', 'a phone starts on the editor');
      await t.press('pill-preview');
      assert.equal(t.previewLayout(), 'preview');
      t.act(() => heldDoc('coverletter'));
      await until(() => t.openDoc()[0] === 'doc-switch-letter', 'the Cover letter is the open document');
      assert.equal(t.modes().doc, 'coverletter');
      assert.equal(t.previewLayout(), 'editor', 'a stale picker knew a desktop, and left the phone on the preview');
      await t.press('pill-preview');
      assert.equal(t.previewLayout(), 'preview');
      t.act(() => heldDock('ats'));
      await until(() => t.dockOnScreen() === 'ats', 'the ATS dock opens');
      assert.equal(t.modes().dock, 'ats');
      assert.equal(t.previewLayout(), 'editor', 'a stale toggle left the phone on the preview, under the dock it opened');
    } finally { await t.close(); }
  });

  it('the import notice\'s Dismiss acts on the latest address: it leaves the dock the editor is on', async () => {
    const t = await openEditor();
    try {
      const held = t.firstAlerts().onDismissImport;
      t.typeInEmail();
      await settle();
      assert.equal(t.alerts().onDismissImport, held, 'the alerts were given the same function after the keys');
      t.act(() => t.live.navigate(`/resume/${t.id}?dock=design`, { state: { importNotice: NOTICE } }));
      await until(() => t.dockOnScreen() === 'design' && t.alertTexts().length === 1, 'the Design dock and the notice are on screen');
      assert.equal(t.modes().dock, 'design');
      assert.deepEqual(t.alertTexts(), [NOTICE]);
      t.act(() => held());
      await until(() => t.alertTexts().length === 0, 'the notice is gone');
      assert.deepEqual(t.alertTexts(), [], 'the notice is gone');
      assert.equal(t.modes().dock, 'design', 'a stale Dismiss went to the address of the first render, the Resume with no dock');
    } finally { await t.close(); }
  });

  it('the export error\'s Dismiss clears an error that came after the first render', async () => {
    const t = await openEditor();
    try {
      const held = t.firstAlerts().onDismiss;
      t.typeInEmail();
      await settle();
      assert.equal(t.alerts().onDismiss, held, 'the alerts were given the same function after the keys');
      t.act(() => t.header().exportMenu.setExportError('Word export failed (boom). Try again, or reload the page if it keeps failing.'));
      assert.equal(t.alertTexts().length, 1);
      t.act(() => held());
      assert.deepEqual(t.alertTexts(), []);
    } finally { await t.close(); }
  });
});

describe('useStableObject (the header\'s props are kept by it)', () => {
  it('keeps its identity while its plain values are the same, calls the latest functions, and is a new object when a value changes', async () => {
    const { useStableObject } = await loadModule('/src/hooks/useStableObject.js');
    const seen = [];
    let set;
    function Host() {
      const [n, setN] = useState(0);
      const [label, setLabel] = useState('a');
      set = { n: setN, label: setLabel };
      seen.push(useStableObject({ label, count: () => n, fixed: true }));
      return null;
    }
    const view = mount(Host, {});
    try {
      await settle();
      view.act(() => set.n(1));
      view.act(() => set.n(2));
      assert.ok(seen.length >= 3, 'it rendered again');
      assert.ok(seen.every((o) => o === seen[0]), 'the same object while nothing it holds but a function changed');
      assert.equal(seen[0].count(), 2, 'and its function calls the latest one, not the first');
      const was = seen.at(-1);
      view.act(() => set.label('b'));
      assert.notEqual(seen.at(-1), was, 'a changed value makes a new object');
      assert.equal(seen.at(-1).label, 'b');
      assert.equal(seen.at(-1).count, was.count, 'whose functions are still the same ones');
    } finally { await view.unmount(); }
  });

  it('takes no object at all as an empty one, kept', async () => {
    const { useStableObject } = await loadModule('/src/hooks/useStableObject.js');
    const seen = [];
    let bump;
    function Host() {
      const [, setN] = useState(0);
      bump = setN;
      seen.push(useStableObject(undefined));
      return null;
    }
    const view = mount(Host, {});
    try {
      view.act(() => bump(1));
      assert.ok(seen.length >= 2, 'it rendered again');
      assert.deepEqual(seen.at(-1), {});
      assert.equal(seen.at(-1), seen[0]);
    } finally { await view.unmount(); }
  });
});
