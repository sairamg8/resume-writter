// PERF-4 follow-up (docs/tracking/HANDOFF.md: "PersonalInfoEditor and EditorHeader still re-render per
// key"): the editor's header — back, the résumé's name, the Export menu, the account — rendered again at
// every keystroke anywhere in the résumé, with the Export menu and the account bar under it. A keystroke
// changes the store's open résumé, so the Editor page renders, and each prop it gave the header was a new
// value every time: the résumé, the rename box (useRename), the Export menu's state and handlers
// (useEditorExports), the account and the sync (App.jsx's useAuth and useCloudSync make a new object, with
// new functions, at every render) and Share's handler. And the header's own useNavigate woke it however
// its props were kept: the router gives every component using one a new context value whenever the page's
// <Routes> render, and the store sits above them, so that is every key.
// This pins what a keystroke may touch — no component of the header at all — and, the other way, that what
// the header shows still updates (the name and the rename box, an export in progress, the Export menu's
// tab, the layout, the account and the sync), and that a handler the header has held since its first
// render acts on the LATEST résumé: stable handlers that kept the first render's closure would export the
// text as it was before the last key.
// The Personal Info editor is pinned here too, because it needs the same wiring (the router above it):
// a bullet's keystroke renders nothing of it.
// The editor's alerts (an export error, a storage-full error, an import notice: EditorAlerts) and its mode bar
// (Resume | Cover Letter | ATS Check | Design: EditorModeBar) are pinned the same way, each a part of its own in
// the count: a keystroke rendered both, for each handler the page gave them was a new function and neither
// was memoised. Kept, those handlers must still act on the LATEST state: a stale tab picker would drop an
// import's notice from the address and leave a phone on the preview; a stale Dismiss would send the editor
// back to the tab it had when the notice came. And what they show still updates: the open tab, an export
// error and its Dismiss, a storage that is full (said once: a failed write makes a new error each time, with
// the same reason), an import notice.
//
// How it counts (renders, never time), as tests/pdf/165-perf4-editor-render-count.test.mjs: a React
// DevTools hook installed before react-dom loads is told of every commit, and the fibers that RENDERED in
// it (a function component's body ran; the fibers a memoised component bails out of are not among them)
// are credited to the header, the alerts or the mode bar when it, or a component under it, is the one. What
// is mounted is the real Editor page (src/pages/Editor.jsx) over the real store (useAppStore), wired as
// App.jsx and AppRoutes.jsx wire it: the store above <Routes>, the account and the sync new objects at every
// render. The page's body runs as in the app — `Editor(props)` called from the route's component, hooks and
// all — and of the tree it returns the editor panel's header, alerts and mode bar and its Résumé tab are
// mounted, exactly as the page built them. The preview (a PDF built in a worker), the template gallery and
// the share dialog (closed) are not drawn. No component is edited, wrapped or mocked. Fictional people.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment, useState } from 'react';

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
  const probe = { on: false, parts: null, commits: [] }; // parts: label → the type the page imports, for each part counted

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
   * 'header', 'alerts' or 'modes' for that part's own fiber and everything under it, else 'rest'. A part is
   * found by the type the page imports (`elementType`: the memo wrapper, or the function itself where it is
   * not memoised).
   */
  function labelOf(fiber) {
    for (let f = fiber; f; f = f.return) {
      for (const [label, type] of Object.entries(probe.parts)) if (f.elementType === type) return label;
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
      if (!probe.on || !probe.parts) return;
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
const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom');

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

/** The text a React tree (as written) holds. */
const textIn = (node) => {
  if (Array.isArray(node)) return node.map(textIn).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node && typeof node === 'object' && node.props ? textIn(node.props.children) : '';
};

/** The first element of a React tree (as written) that is a <button> with exactly `label` for text. */
function findButton(node, label) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findButton(child, label);
      if (hit) return hit;
    }
    return null;
  }
  if (!node || typeof node !== 'object' || !node.props) return null;
  return node.type === 'button' && textIn(node) === label ? node : findButton(node.props.children, label);
}

/** Polls until `done()` holds (a write the store makes 300 ms after a key, a state set after one): by what happened, not by a clock. */
async function until(done, what) {
  for (let i = 0; i < 500; i += 1) {
    if (done()) return;
    await sleep(10);
  }
  assert.fail(`never happened: ${what}`);
}

/**
 * The editor as the app mounts it, over a saved résumé. `signedIn`: the account is signed in; `signInAs`:
 * whom the sign-in button signs in. `expand`: every entry's card opened (a card starts collapsed), so its
 * bullets can be typed in. Returns the page's
 * parts to read and drive, and `measure(fn)`: `fn`'s commits — which components of the header, of the alerts
 * and of the mode bar rendered, which others did, and which of each part's props were not the same value as before.
 */
async function openEditor({ jobs = 1, signedIn = false, expand = false, signInAs = USER } = {}) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Editor } = await loadModule('/src/pages/Editor.jsx');
  const { EditorHeader, EditorAlerts, EditorModeBar } = await loadModule('/src/components/EditorHeader.jsx');
  const { EditorTabContent } = await loadModule('/src/components/EditorTabContent.jsx');
  const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
  probe.parts = { header: EditorHeader, alerts: EditorAlerts, modes: EditorModeBar };

  const r = fixture(jobs);
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  const live = {
    store: null, navigate: null, setSyncStatus: null, appRenders: 0, signOuts: [], tree: null,
    headerProps: [], alertsProps: [], modesProps: [], previewProps: [],
  };
  // The window's width: a desktop one until `goPhone`. Only the query the Editor asks (useIsMobile) answers by it.
  const screen = { desktop: true, listeners: new Set() };

  /** The route's component: the Editor page's body, of which the header, the alerts, the mode bar and the Résumé tab are mounted. */
  function Page(props) {
    live.navigate = useNavigate();
    const tree = Editor(props);
    const header = find(tree, EditorHeader);
    const alerts = find(tree, EditorAlerts);
    const modes = find(tree, EditorModeBar);
    const tab = find(tree, EditorTabContent);
    const preview = find(tree, EditorPreviewPane);
    assert.ok(header && alerts && modes && tab && preview, 'the Editor renders its header, alerts, mode bar, tab area and preview pane');
    live.tree = tree;
    live.headerProps.push(header.props);
    live.alertsProps.push(alerts.props);
    live.modesProps.push(modes.props);
    live.previewProps.push(preview.props);
    return createElement(Fragment, null, header, alerts, modes, tab.props.activeTab === 'resume' ? tab : null);
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
    return createElement(MemoryRouter, { initialEntries: [`/resume/${r.id}`] }, createElement(App));
  }

  const view = mount(Root, {});
  await settle();
  const all = () => [...elements(view.container)];
  const byTitle = (title) => all().find((el) => el.getAttribute('title') === title);
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
    /** The alerts on screen, each as its text: a message and its Dismiss button. */
    alertTexts: () => all().filter((el) => ['alert', 'status'].includes(attr(el, 'role')) && /\bpx-4 py-2 text-xs\b/.test(attr(el, 'class'))).map((el) => text(el).replace(/Dismiss$/, '')),
    dismissButtons: () => all().filter((el) => el.tagName === 'BUTTON' && text(el) === 'Dismiss'),
    /** A tab of the mode bar, by its label. */
    tabButton: (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label),
    /** The layout the Editor gave the preview pane: 'split' on a desktop; on a phone 'editor', or 'preview' once the floating toggle is on it. */
    previewLayout: () => live.previewProps.at(-1).layoutMode,
    /** The window becomes a phone's: its width query says so to the Editor, as the browser would. */
    goPhone() {
      screen.desktop = false;
      view.act(() => { for (const listener of [...screen.listeners]) listener({ matches: false }); });
    },
    /** The phone's floating toggle: Preview, as the Editor's latest render built it. */
    showPreview() {
      const button = findButton(live.tree, 'Preview');
      assert.ok(button, 'a phone has the floating Edit | Preview toggle');
      view.act(() => button.props.onClick());
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
     * `fn`'s commits (and what runs after it for `wait` ms more): the rendered components under the header, under the
     * alerts and under the mode bar, the others', and each part's props that changed (`changed` the header's).
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
      const names = { header: new Set(), alerts: new Set(), modes: new Set(), rest: new Set() };
      for (const commit of probe.commits) for (const { label, name } of commit) names[label].add(name);
      /** The keys of `list`'s props since `from` that were not the same value as before it. */
      const changedIn = (list) => {
        const was = list[from - 1];
        const changed = new Set();
        for (const props of list.slice(from)) {
          for (const key of new Set([...Object.keys(was), ...Object.keys(props)])) if (!Object.is(was[key], props[key])) changed.add(key);
        }
        return [...changed];
      };
      const changed = changedIn(live.headerProps);
      const changedAlerts = changedIn(live.alertsProps);
      const changedModes = changedIn(live.modesProps);
      return {
        commits: probe.commits.length,
        header: [...names.header],
        alerts: [...names.alerts],
        modes: [...names.modes],
        rest: [...names.rest],
        changed,
        changedAlerts,
        changedModes,
        report: () => `${probe.commits.length} commits. Rendered under the header: ${JSON.stringify([...names.header])}, under the alerts: ${JSON.stringify([...names.alerts])}, under the mode bar: ${JSON.stringify([...names.modes])}; elsewhere: ${JSON.stringify([...names.rest])}. Props that were not the same value as before — the header's: ${JSON.stringify(changed)}, the alerts': ${JSON.stringify(changedAlerts)}, the mode bar's: ${JSON.stringify(changedModes)}`,
      };
    },
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

/** What a keystroke may be: a bullet, the summary, a personal-info field — how it is typed, and how to see that it reached the store. */
const CASES = [
  ['a bullet of one job', (t) => t.typeInBullet(1), (t) => t.store().activeResume.sections[0].items[1].description.includes(MARK)],
  ['the summary', (t) => t.typeInSummary(), (t) => t.store().activeResume.personal.summary.includes(MARK)],
  ['a personal-info field (Email)', (t) => t.typeInEmail(), (t) => t.store().activeResume.personal.email.endsWith(MARK)],
];

describe('typing one character renders nothing of the editor header (PERF-4)', () => {
  for (const signedIn of [false, true]) {
    for (const [what, type, reached] of CASES) {
      it(`${what}, ${signedIn ? 'signed in' : 'signed out'}: not the header, the Export menu or the account bar`, async () => {
        const t = await openEditor({ jobs: 4, signedIn, expand: true });
        try {
          const w = await t.measure(() => type(t));
          assert.ok(reached(t), 'the character reached the store');
          assert.ok(w.commits >= 1 && w.rest.length >= 1, `the edit rendered its own part, so the count is live. ${w.report()}`);
          assert.deepEqual(w.header, [], `typing rendered part of the header. ${w.report()}`);
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
      assert.ok(w.rest.includes('PersonalInfoEditor'), `a key in its own field renders it, so the count is live. ${w.report()}`);
      w = await t.measure(() => t.typeInBullet(1));
      assert.ok(t.store().activeResume.sections[0].items[1].description.includes(MARK), 'the character reached the store');
      assert.ok(w.rest.length >= 1, `the bullet rendered its own part. ${w.report()}`);
      assert.deepEqual(w.rest.filter((name) => PERSONAL.includes(name)), [], `typing in a bullet rendered part of the Personal Info editor. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('the write that follows the keystroke (Saving…, then Saved) renders nothing of it either', async () => {
    const t = await openEditor({ jobs: 1 });
    try {
      // Past the store's coalesced write (SAVE_WAIT_MS, 300 ms): its state changes render the page again.
      const w = await t.measure(() => t.typeInSummary(), 500);
      assert.ok(t.store().savedAt, 'the write has happened');
      assert.deepEqual(w.header, [], `the header rendered. ${w.report()}`);
      assert.deepEqual(w.changed, [], w.report());
    } finally { await t.close(); }
  });
});

describe('what the header shows still updates', () => {
  it('renaming: the box opens on the name, Enter saves what was typed, and the header shows it', async () => {
    const t = await openEditor();
    try {
      assert.equal(text(t.byTitle('Rename resume')), NAME);
      let w = await t.measure(() => t.call(t.byTitle('Rename resume'), 'onClick'));
      assert.equal(t.renameBox()?.value, NAME, 'the box opens on the name');
      assert.ok(w.header.includes('EditorHeader'), `the header shows the box. ${w.report()}`);
      w = await t.measure(() => t.call(t.renameBox(), 'onChange', { target: { value: 'Operations CV' } }));
      assert.equal(t.renameBox().value, 'Operations CV', 'the box shows what is typed');
      assert.ok(w.header.includes('EditorHeader'), w.report());
      w = await t.measure(() => t.call(t.renameBox(), 'onKeyDown', { key: 'Enter' }));
      assert.equal(t.store().activeResume.name, 'Operations CV', 'Enter reached the store');
      assert.equal(t.renameBox(), undefined, 'the box is closed');
      assert.equal(text(t.byTitle('Rename resume')), 'Operations CV', 'the header shows the new name');
      assert.ok(w.header.includes('EditorHeader'), w.report());
    } finally { await t.close(); }
  });

  it('renamed in another tab: the header shows it, and the box opens on it — the rename handlers act on the latest name', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(() => t.act(() => t.store().renameResume(t.id, 'Renamed in another tab')));
      assert.equal(text(t.byTitle('Rename resume')), 'Renamed in another tab');
      assert.ok(w.header.includes('EditorHeader'), w.report());
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
      assert.ok(w.header.includes('ExportDropdown'), `the Export menu rendered for it. ${w.report()}`);
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
      assert.ok(w.header.includes('ExportDropdown'), `the Export menu rendered for it. ${w.report()}`);
      release();
      await run;
      await settle();
      assert.equal(text(t.exportButton()), 'Export', 'and is back once it is read');
      assert.equal(t.store().appState.resumes.length, 2, 'the document became a new résumé');
      assert.notEqual(text(t.byTitle('Rename resume')), NAME, 'which the editor opened, and the header shows');
    } finally { await t.close(); }
  });

  it('on the Cover Letter tab the Export menu names the letter', async () => {
    const t = await openEditor();
    try {
      t.call(t.exportButton(), 'onClick'); // opens the menu, on the Résumé tab
      assert.ok(t.buttonLabels().includes('Export PDF'), t.buttonLabels().join(' | '));
      const w = await t.measure(() => t.act(() => t.live.navigate(`/resume/${t.id}?tab=coverletter`)));
      assert.ok(t.buttonLabels().includes('Export Cover Letter PDF'), t.buttonLabels().join(' | '));
      assert.ok(w.header.includes('ExportDropdown'), w.report());
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
      assert.ok(w.header.includes('ExportDropdown'), w.report());
    } finally { await t.close(); }
  });

  it('the editor-only layout shows the layout toggle in the header, the split layout does not', async () => {
    const t = await openEditor();
    try {
      const toggles = () => ['Editor only', 'Split view', 'Preview only'].filter((title) => t.byTitle(title));
      assert.deepEqual(toggles(), [], 'in the split layout the preview toolbar carries it');
      const w = await t.measure(() => t.act(() => t.header().setLayoutMode('editor')));
      assert.equal(toggles().length, 3);
      assert.ok(w.header.includes('LayoutToggle'), w.report());
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
      assert.ok(w.header.includes('AuthBar'), `the account bar rendered for it. ${w.report()}`);
      w = await t.measure(() => t.act(() => t.live.setSyncStatus('syncing')));
      assert.equal(attr(t.syncDot(), 'aria-label'), 'Syncing…', 'the sync dot follows the status');
      assert.ok(w.header.includes('AuthBar'), w.report());
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
});

describe('typing one character renders neither the alerts nor the mode bar of the editor (PERF-4)', () => {
  for (const signedIn of [false, true]) {
    for (const [what, type, reached] of CASES) {
      it(`${what}, ${signedIn ? 'signed in' : 'signed out'}: not EditorAlerts, not EditorModeBar`, async () => {
        const t = await openEditor({ jobs: 4, signedIn, expand: true });
        try {
          const w = await t.measure(() => type(t));
          assert.ok(reached(t), 'the character reached the store');
          assert.ok(w.commits >= 1 && w.rest.length >= 1, `the edit rendered its own part, so the count is live. ${w.report()}`);
          assert.deepEqual(w.alerts, [], `typing rendered part of the alerts. ${w.report()}`);
          assert.deepEqual(w.modes, [], `typing rendered part of the mode bar. ${w.report()}`);
          assert.deepEqual(w.changedAlerts, [], `typing gave the alerts a prop that is not the same value as before. ${w.report()}`);
          assert.deepEqual(w.changedModes, [], `typing gave the mode bar a prop that is not the same value as before. ${w.report()}`);
        } finally { await t.close(); }
      });
    }
  }

  it('the write that follows the keystroke (Saving…, then Saved) renders neither either', async () => {
    const t = await openEditor({ jobs: 1 });
    try {
      const w = await t.measure(() => t.typeInSummary(), 500);
      assert.ok(t.store().savedAt, 'the write has happened');
      assert.deepEqual([w.alerts, w.modes], [[], []], w.report());
      assert.deepEqual([w.changedAlerts, w.changedModes], [[], []], w.report());
    } finally { await t.close(); }
  });
});

describe('what the alerts and the mode bar show still updates', () => {
  it('an export error shows, and its Dismiss takes it away', async () => {
    const t = await openEditor();
    try {
      assert.deepEqual(t.alertTexts(), []);
      let w = await t.measure(() => t.act(() => t.header().exportMenu.setExportError('PDF export failed (boom). Check your connection and try again.')));
      assert.deepEqual(t.alertTexts(), ['PDF export failed (boom). Check your connection and try again.']);
      assert.ok(w.alerts.includes('EditorAlerts'), `the alert rendered for it. ${w.report()}`);
      w = await t.measure(() => t.call(t.dismissButtons()[0], 'onClick'));
      assert.deepEqual(t.alertTexts(), [], 'Dismiss takes it away');
      assert.ok(w.alerts.includes('EditorAlerts'), w.report());
    } finally { await t.close(); }
  });

  it('a storage that is full is said once: later refused writes (a new error, the same reason) render nothing, and a write that fits takes it away', async () => {
    const FULL = 'Not saved: browser storage is full. Export JSON to keep a copy, or remove large photos.';
    const t = await openEditor();
    try {
      localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
      let w = await t.measure(async () => { t.typeInSummary(); await until(() => t.store().persistError, 'the write storage refuses'); });
      assert.deepEqual(t.alertTexts(), [FULL]);
      assert.ok(w.alerts.includes('EditorAlerts'), `the notice rendered the alerts. ${w.report()}`);
      const first = t.store().persistError;
      w = await t.measure(async () => { t.typeInSummary(); await until(() => t.store().persistError !== first, 'another refused write'); });
      assert.notEqual(t.store().persistError, first, 'a refused write makes a new error each time');
      assert.deepEqual(t.alertTexts(), [FULL]);
      assert.deepEqual([w.alerts, w.modes], [[], []], `the same reason is no news. ${w.report()}`);
      delete localStorage.setItem; // storage takes writes again
      w = await t.measure(async () => { t.typeInSummary(); await until(() => !t.store().persistError, 'a write that fits'); });
      assert.deepEqual(t.alertTexts(), [], 'the notice goes once a write fits');
      assert.ok(w.alerts.includes('EditorAlerts'), w.report());
    } finally {
      delete localStorage.setItem;
      await t.close();
    }
  });

  it('a document import\'s notice shows, and its Dismiss takes it off the address and leaves the tab where it is', async () => {
    const t = await openEditor();
    try {
      let w = await t.measure(() => t.act(() => t.live.navigate(`/resume/${t.id}?tab=coverletter`, { state: { importNotice: NOTICE } })));
      assert.deepEqual(t.alertTexts(), [NOTICE]);
      assert.ok(w.alerts.includes('EditorAlerts'), `the notice rendered the alerts. ${w.report()}`);
      assert.equal(t.modes().activeTab, 'coverletter');
      w = await t.measure(() => t.call(t.dismissButtons()[0], 'onClick'));
      assert.deepEqual(t.alertTexts(), [], 'Dismiss takes the notice away');
      assert.equal(t.modes().activeTab, 'coverletter', 'and leaves the tab it was on');
      assert.ok(w.alerts.includes('EditorAlerts'), w.report());
    } finally { await t.close(); }
  });

  it('picking a tab shows it open in the mode bar; the Design button opens Design and, pressed again, goes back to the résumé', async () => {
    const t = await openEditor();
    try {
      const open = () => ['Resume', 'Cover Letter', 'ATS Check'].filter((label) => /bg-(?:blue|violet|emerald)-600/.test(attr(t.tabButton(label), 'class')));
      assert.deepEqual(open(), ['Resume']);
      let w = await t.measure(() => t.call(t.tabButton('Cover Letter'), 'onClick'));
      assert.equal(t.modes().activeTab, 'coverletter');
      assert.deepEqual(open(), ['Cover Letter']);
      assert.ok(w.modes.includes('EditorModeBar'), `the mode bar rendered for it. ${w.report()}`);
      w = await t.measure(() => t.call(t.byTitle('Design & Customize'), 'onClick'));
      assert.equal(t.modes().activeTab, 'design');
      assert.deepEqual(open(), [], 'none of the three is open on Design');
      assert.match(attr(t.byTitle('Design & Customize'), 'class'), /bg-amber-50/);
      assert.ok(w.modes.includes('EditorModeBar'), w.report());
      t.call(t.byTitle('Design & Customize'), 'onClick');
      assert.equal(t.modes().activeTab, 'resume', 'the Design button again goes back to the résumé');
      assert.deepEqual(open(), ['Resume']);
    } finally { await t.close(); }
  });
});

describe('a handler the alerts or the mode bar have held since their first render acts on the latest (no stale closure)', () => {
  it('the tab picker keeps its identity, and a tab picked through it leaves the import notice the address holds now', async () => {
    const t = await openEditor();
    try {
      const held = t.firstModes().setActiveTab;
      t.typeInEmail();
      await settle();
      assert.equal(t.modes().setActiveTab, held, 'the mode bar was given the same function after the keys');
      t.act(() => t.live.navigate(`/resume/${t.id}`, { state: { importNotice: NOTICE } }));
      assert.deepEqual(t.alertTexts(), [NOTICE], 'a notice came after the picker was made');
      t.act(() => held('design'));
      assert.equal(t.modes().activeTab, 'design');
      assert.deepEqual(t.alertTexts(), [NOTICE], 'a stale picker read the address as it was at the first render, and took the notice off');
    } finally { await t.close(); }
  });

  it('on a phone, a tab picked through the picker held since the desktop brings the editor back from the preview', async () => {
    const t = await openEditor();
    try {
      const held = t.firstModes().setActiveTab;
      assert.equal(t.previewLayout(), 'split');
      t.goPhone();
      assert.equal(t.previewLayout(), 'editor', 'a phone starts on the editor');
      t.showPreview();
      assert.equal(t.previewLayout(), 'preview');
      t.act(() => held('coverletter'));
      assert.equal(t.modes().activeTab, 'coverletter');
      assert.equal(t.previewLayout(), 'editor', 'a stale picker knew a desktop, and left the phone on the preview');
    } finally { await t.close(); }
  });

  it('the import notice\'s Dismiss acts on the latest address: it leaves the tab the editor is on', async () => {
    const t = await openEditor();
    try {
      const held = t.firstAlerts().onDismissImport;
      t.typeInEmail();
      await settle();
      assert.equal(t.alerts().onDismissImport, held, 'the alerts were given the same function after the keys');
      t.act(() => t.live.navigate(`/resume/${t.id}?tab=design`, { state: { importNotice: NOTICE } }));
      assert.equal(t.modes().activeTab, 'design');
      assert.deepEqual(t.alertTexts(), [NOTICE]);
      t.act(() => held());
      assert.deepEqual(t.alertTexts(), [], 'the notice is gone');
      assert.equal(t.modes().activeTab, 'design', 'a stale Dismiss went to the address of the first render, the Résumé tab');
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
