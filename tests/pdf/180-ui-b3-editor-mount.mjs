// UI rebuild B3 (cluster frame): the real Editor page for the 180-ui-b3-* tests, mounted as tests/pdf/173 mounts
// it: the page's body (`Editor(props)`) is called from a route's component over the real store (useAppStore), in
// a MemoryRouter, the account and the sync new objects at every render as App.jsx makes them; of the tree it
// returns, the parts under test are mounted exactly as the page built them (the preview, a PDF built in a
// worker, the template gallery and the share dialog are not drawn). A React DevTools hook installed before
// react-dom loads is told of every commit (as tests/pdf/165 and 173 count): the fibers that RENDERED in it
// are credited to the part they sit in. No component is edited, wrapped or mocked. Fictional people.
// A test file imports THIS module before anything that loads react-dom.
import assert from 'node:assert/strict';
import { createElement, Fragment, useState } from 'react';

// No Firebase in these tests' build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';
// The Export menu is placed by the kit's useFloating, which cancels its animation frame when the menu closes.
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

const PERFORMED_WORK = 1; // React's flag on a fiber whose component rendered in this commit
const RENDERING_TAGS = new Set([0, 1, 11, 15]); // function, class, forwardRef, simple memo component

const probe = { on: false, parts: [], commits: [] }; // parts: [label, type] for each part counted

/** The fibers that rendered in the commit that just finished: the walk the DevTools make. */
function rendered(root) {
  const out = [];
  const visit = (next, prev) => {
    if (RENDERING_TAGS.has(next.tag) && (next.flags & PERFORMED_WORK)) out.push(next);
    if (prev && next.child === prev.child) return; // children shared with the last tree were not touched
    for (let c = next.child; c; c = c.sibling) visit(c, c.alternate);
  };
  visit(root.current, root.current.alternate);
  return out;
}

/** The label of the part a fiber is, or sits under (the type the page imports: a memo's wrapper, or the function), else 'rest'. */
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

const harness = await import('./harness.mjs');
const fakeDom = await import('./fake-dom.mjs');
const { MemoryStorage, settle } = await import('./resume-tab.mjs');
const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
const router = await import('react-router-dom');
const { setup, teardown, loadModule, resume, section, experience } = harness;
const { mount, elements, reactProps, withInnerHtml } = fakeDom;
const { MemoryRouter, Routes, Route, useNavigate, useLocation } = router;

export { loadModule, resume, section, experience, elements, reactProps, settle };

const KEY = 'cpwtcv_v1';
export const MARK = 'Z'; // the one character typed
export const NAME = 'Operations Analyst CV';
export const USER = { uid: 'u_tamsin', displayName: 'Tamsin Verhoeven', email: 'tamsin.verhoeven@example.com', photoURL: null };
const NO_HELD = []; // the sync's held list is a state: one array until a résumé is held or let go
export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
export const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
export const attr = (el, name) => el.getAttribute(name) ?? '';

let build;
/** The `before` of a test file: the harness, innerHTML, and a PDF worker that answers at once (the warm-up is not what is tested). */
export async function prepare() {
  patchFakeDom();
  await setup();
  withInnerHtml();
  build = await loadModule('/src/utils/pdfBuild.js');
  build._setPdfWorkerForTest(() => ({
    onmessage: null,
    postMessage(job) { Promise.resolve().then(() => this.onmessage({ data: { id: job.id } })); },
    terminate() {},
  }));
}
/** The `after` of a test file. */
export async function finish() {
  build._setPdfWorkerForTest(null);
  await teardown();
  delete globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

/** Polls until `done()` holds, by what happened, not by a clock. */
export async function until(done, what) {
  for (let i = 0; i < 500; i += 1) {
    if (done()) return;
    await sleep(10);
  }
  assert.fail(`never happened: ${what}`);
}

/** Two jobs with bullets, an education, a skills section and a summary. */
function fixture(extra = {}) {
  const bullets = (n) => `<ul><li>Cut the claims backlog by ${n}% across the Tidewater region</li><li>Mentored ${n} analysts through their first audit</li></ul>`;
  const r = resume({
    personal: {
      name: 'Tamsin Verhoeven', title: 'Operations Analyst', email: 'tamsin.verhoeven@example.com', phone: '+1 555 0142',
      location: 'Portland, OR', summary: '<p>Operations analyst who turns messy claim queues into calm, measurable workflows.</p>',
    },
    sections: [
      experience([
        { company: 'Harbor Mutual', role: 'Senior Analyst', description: bullets(40) },
        { company: 'Pinecrest Logistics', role: 'Analyst', description: bullets(25) },
      ]),
      section('education', [{ institution: 'Lakeshore State University', degree: 'BA', fieldOfStudy: 'Economics', startDate: '09/2012', endDate: '06/2016', description: '<p>Dean\'s list</p>' }]),
      section('skills', [{ category: 'Tools', skills: 'SQL, Excel, Tableau' }]),
    ],
  });
  r.name = NAME;
  return Object.assign(r, extra);
}

/** The first element of a React tree (as written, components uncalled) whose type is `type`. */
export function find(node, type) {
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

/**
 * The editor as the app mounts it, over a saved résumé (`extra`: fields to set on it, such as `{ kind: 'letter' }`),
 * opened at `path` (the part after /resume/:id: '' or '?tab=coverletter'). Mounted: the header, the alerts, the mode
 * bar (the document switch with the ATS chip and the Design button), the save chip, the Résumé tab and, when open, the dock.
 * Returns what to read and drive, and `measure(fn)`: `fn`'s commits, each as the parts that rendered in it.
 */
export async function openEditor({ signedIn = false, path = '', extra = {}, toasts = false } = {}) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Editor } = await loadModule('/src/pages/Editor.jsx');
  const { EditorHeader, EditorAlerts, EditorModeBar, EditorAtsChip, EditorDesignButton } = await loadModule('/src/components/EditorHeader.jsx');
  const { EditorDocSwitch } = await loadModule('/src/components/EditorDocSwitch.jsx');
  const { EditorDock } = await loadModule('/src/components/EditorDock.jsx');
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const { TemplateGallery } = await loadModule('/src/components/TemplateGallery.jsx');
  const { ToastProvider, useToast } = await loadModule('/src/components/ui/Toast.jsx');
  const { EditorTabContent } = await loadModule('/src/components/EditorTabContent.jsx');
  const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
  const { EditorSaveStatus } = await loadModule('/src/components/EditorSaveStatus.jsx');
  probe.parts = [
    ['header', EditorHeader], ['alerts', EditorAlerts], ['modes', EditorModeBar], ['save', EditorSaveStatus],
    ['switch', EditorDocSwitch], ['chip', EditorAtsChip], ['designButton', EditorDesignButton],
    ['dock', EditorDock], ['designPanel', DesignPanel], ['atsPanel', AtsCheckerPanel],
  ];
  // The ATS panel keeps the pasted posting for the session.
  const sessionMap = new Map();
  globalThis.sessionStorage = {
    get length() { return sessionMap.size; }, key: (i) => [...sessionMap.keys()][i] ?? null,
    getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null), setItem: (k, v) => sessionMap.set(k, String(v)), removeItem: (k) => sessionMap.delete(k),
  };

  const r = fixture(extra);
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  const live = { store: null, navigate: null, url: '', tree: null, headerProps: [], previewProps: [], saveProps: [], appRenders: 0 };
  const screen = { desktop: true, listeners: new Set() };

  /** The route's component: the Editor page's body, of which the parts under test are mounted. */
  function Page(props) {
    live.navigate = useNavigate();
    const loc = useLocation();
    live.url = `${loc.pathname}${loc.search}`;
    live.state = loc.state;
    const tree = Editor(props);
    const header = find(tree, EditorHeader);
    const alerts = find(tree, EditorAlerts);
    const modes = find(tree, EditorModeBar);
    const tab = find(tree, EditorTabContent);
    const preview = find(tree, EditorPreviewPane);
    assert.ok(header && alerts && modes && tab && preview, 'the Editor renders its header, alerts, mode bar, tab area and preview pane');
    const save = preview.props.saveStatus;
    assert.ok(save && save.type === EditorSaveStatus, 'the Editor gives the preview its save chip');
    const dock = find(tree, EditorDock);
    live.tree = tree;
    live.gallery = find(tree, TemplateGallery)?.props;
    live.dockProps = dock?.props ?? null;
    live.headerProps.push(header.props);
    live.previewProps.push(preview.props);
    live.saveProps.push(save.props);
    const parts = createElement(Fragment, null, header, alerts, modes, save, tab.props.activeTab === 'resume' ? tab : null, dock);
    return toasts ? createElement(ToastProvider, null, createElement(ToastProbe), parts) : parts;
  }
  function ToastProbe() { live.toast = useToast().toast; return null; }

  /** App.jsx: the store, the account and the sync, below which the routes are, new objects at every render. */
  function App() {
    const store = useAppStore();
    const [user, setUser] = useState(signedIn ? USER : null);
    live.appRenders += 1;
    live.store = store;
    const auth = { user, authLoading: false, cloudAvailable: true, signInWithGoogle: () => setUser(USER), signOut: () => setUser(null) };
    const sync = { syncStatus: 'synced', lastSynced: null, isOnline: true, account: null, heldResumes: NO_HELD, readCloudCopies: () => 0 };
    return createElement(Routes, null,
      createElement(Route, { path: '/resume/:id', element: createElement(Page, { store, auth, sync }) }),
      createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') }));
  }

  // A desktop window: the fake one has no matchMedia, which the Editor reads as a phone. Every query matches, but
  // the Editor's own (`(min-width: 768px)`), which follows `screen`.
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
  const byTid = (id) => all().find((el) => attr(el, 'data-testid') === id);
  const call = (el, name, event = {}) => {
    const handler = reactProps(el)?.[name];
    assert.ok(handler, `no ${name} handler on <${el?.tagName}>`);
    view.act(() => handler({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...event }));
  };

  const boxes = () => all().filter((el) => attr(el, 'role') === 'textbox');
  const summaryBox = () => boxes().find((el) => attr(el, 'aria-label') === 'Professional summary');
  /** One character typed at the start of a rich-text box's text, as the browser fires `input`. */
  const typeInBox = (box) => {
    assert.ok(box, 'the rich-text box is on screen');
    const html = box.innerHTML;
    const at = html.indexOf('</');
    box.innerHTML = at === -1 ? html + MARK : html.slice(0, at) + MARK + html.slice(at);
    view.document.activeElement = box;
    view.act(() => reactProps(box).onInput({}));
  };

  return {
    live, id: r.id, all, byTid, call, body: () => [...elements(view.document.body)],
    act: (fn) => view.act(fn),
    /** A click on the control with this testid, and the renders and the address change it sets off. */
    async press(id) {
      const el = byTid(id);
      assert.ok(el, `no control with the testid ${id}`);
      call(el, 'onClick');
      await settle();
    },
    store: () => live.store,
    url: () => live.url,
    header: () => live.headerProps.at(-1),
    preview: () => live.previewProps.at(-1),
    save: () => live.saveProps.at(-1),
    saveCount: () => live.saveProps.length,
    headerCount: () => live.headerProps.length,
    typeInSummary: () => typeInBox(summaryBox()),
    /** The window becomes a phone's: its width query says so to the Editor, as the browser would. */
    goPhone() {
      screen.desktop = false;
      view.act(() => { for (const listener of screen.listeners) listener({ matches: false }); });
    },
    /**
     * `fn`'s commits (and what runs after it for `wait` ms more), each as the labelled parts that rendered in it:
     * `commits[i]` is a Map label -> the names of the components of it that rendered.
     */
    async measure(fn, wait = 0) {
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
      return {
        commits,
        /** The number of commits in which something of `label` rendered. */
        count: (label) => commits.filter((c) => c.has(label)).length,
        /** The components of `label` that rendered, in any commit. */
        names: (label) => [...new Set(commits.flatMap((c) => [...(c.get(label) ?? [])]))],
        report: () => `${commits.length} commits: ${JSON.stringify(commits.map((c) => Object.fromEntries([...c].map(([l, n]) => [l, [...n]]))))}`,
      };
    },
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
      delete globalThis.sessionStorage;
    },
  };
}
