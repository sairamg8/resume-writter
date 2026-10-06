// UI rebuild B4 (cluster stage): the stage toolbar and the resize handle in the canvas look. Every function of the live
// stage stays: the three layouts (hiding is display:none, never unmount, and a hidden stage builds nothing), the paper
// label, the zoom from 50 to 150 % in 25 % steps, the 4 px handle with its title, its range 240-640, its keys and its
// storage key, the Terms / Privacy footer. Each section below is named for the commit that built it.
// Mounted over tests/pdf/fake-dom.mjs, as tests/unit/panel-resize-separator.unit.mjs and tests/pdf/71-preview-hidden-builds mount.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { setup, teardown, loadModule, resume } from './harness.mjs';

const KEY = 'cpwtcv-panel-width';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const quiet = { ResizeObserver: globalThis.ResizeObserver };
before(async () => {
  await setup();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
});
after(async () => {
  if (quiet.ResizeObserver) globalThis.ResizeObserver = quiet.ResizeObserver;
  else delete globalThis.ResizeObserver;
  await teardown();
});

let restore = null;
/** localStorage over a Map for one test; the Map is returned. */
function memoryStorage(data = {}) {
  const store = new Map(Object.entries(data));
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    configurable: true, writable: true,
  });
  restore = () => { if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage; };
  return store;
}
afterEach(() => { restore?.(); restore = null; });

describe('the panel is held off the stage\'s floor while a dock is open (the resize handle)', () => {
  /** The hook mounted as the Editor calls it: `dockOpen` is a prop of the probe; the window is `width` px wide. */
  async function hook(width, dockOpen = false) {
    const { usePanelResize } = await loadModule('/src/hooks/usePanelResize.js');
    let latest = null;
    const Probe = ({ open }) => { latest = usePanelResize({ dockOpen: open }); return null; };
    const view = mount(Probe, { open: false });
    view.window.innerWidth = width;
    view.update({ open: dockOpen });
    return { view, now: () => latest };
  }

  it('a stored 640 at 1100 px with a dock open is drawn at 420 (window - 360 - 320); the stored width is untouched', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now } = await hook(1100, true);
    try {
      assert.equal(now().panelWidth, 420);
      assert.equal(now().storedWidth, 640);
      assert.equal(store.get(KEY), '640', 'the remembered width is not rewritten by the clamp');
    } finally { await view.unmount(); }
  });

  it('the same stored 640 with no dock is drawn at 640; the window\'s width is followed while a dock is open', async () => {
    memoryStorage({ [KEY]: '640' });
    const { view, now } = await hook(1180, false);
    try {
      assert.equal(now().panelWidth, 640, 'no dock: no clamp');
      view.update({ open: true });
      assert.equal(now().panelWidth, 500);
      view.window.innerWidth = 1280;
      view.act(() => view.window.dispatchEvent({ type: 'resize' }));
      assert.equal(now().panelWidth, 600, 'a wider window gives the width back');
      view.update({ open: false });
      assert.equal(now().panelWidth, 640);
      assert.equal(view.window.listeners('resize'), 0, 'the window is not followed without a dock');
    } finally { await view.unmount(); }
  });

  it('never under the panel\'s own 240 px floor, and a width already narrower is left as it is', async () => {
    memoryStorage({ [KEY]: '300' });
    const narrow = await hook(768, true);
    try { assert.equal(narrow.now().panelWidth, 240); } finally { await narrow.view.unmount(); }
    const wide = await hook(1280, true);
    try { assert.equal(wide.now().panelWidth, 300); } finally { await wide.view.unmount(); }
  });

  it('a key moves the width drawn, and remembers it', async () => {
    const store = memoryStorage({ [KEY]: '640' });
    const { view, now } = await hook(1100, true);
    try {
      const e = { key: 'ArrowLeft', preventDefault() {} };
      view.act(() => now().separatorProps.onKeyDown(e));
      assert.equal(now().panelWidth, 404, 'one 16 px step from the 420 drawn, not from the 640 remembered');
      assert.equal(store.get(KEY), '404');
      assert.equal(now().separatorProps['aria-valuenow'], 404);
    } finally { await view.unmount(); }
    await sleep(0);
  });
});

// ── The stage: toolbar, layouts, zoom, footer ─────────────────────────────────────────────────────────────────────
const tokens = (el) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/**
 * The pane as the Editor holds it: the zoom and the layout are the page's state, kept while the pane stays mounted.
 * `r` / `tab` / `phone` are props of the probe so a test can change them; the address is shown by `where()`.
 */
async function stage({ layout = 'split', phone = false, onLegal, r = resume({ personal: { name: 'Pat Sample' } }), tab = 'resume' } = {}) {
  const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
  let where = '';
  const Where = () => { const l = useLocation(); where = l.pathname; return null; };
  const Page = (p) => {
    const [mode, setMode] = useState(layout);
    const [zoom, setZoom] = useState(1);
    const shownMode = p.phone ? (mode === 'preview' ? 'preview' : 'editor') : mode;
    return createElement(MemoryRouter, null,
      createElement(Where),
      createElement(EditorPreviewPane, { resume: p.r, activeTab: p.tab, layoutMode: shownMode, setLayoutMode: setMode, previewZoom: zoom, setPreviewZoom: setZoom, isMobile: p.phone, onLegal }));
  };
  const view = mount(Page, { r, tab, phone });
  const all = () => [...elements(view.container)];
  const byTid = (id) => all().find((el) => el.getAttribute('data-testid') === id);
  const press = (id) => {
    const el = byTid(id);
    assert.ok(el, `no control with the testid ${id}`);
    view.act(() => reactProps(el).onClick({ preventDefault() {}, stopPropagation() {} }));
  };
  const status = () => all().find((el) => el.hasAttribute('data-preview-status'));
  return {
    view, all, byTid, press, status, where: () => where,
    /** The pane's root: the box the preview sits and scrolls in. */
    root: () => status().parentNode,
    level: () => byTid('zoom-level')?.textContent,
    set: (next) => view.update({ r, tab, phone, ...next }),
  };
}

describe('the stage toolbar: zoom -, the percent and +, the paper, the layout toggle (canvas look)', () => {
  it('draws the stepper as a minus, the percent and a plus, in that order, on the stage ground, from the cv tokens', async () => {
    const t = await stage();
    try {
      const bar = t.byTid('stage-toolbar');
      assert.ok(bar, 'the toolbar');
      const out = t.byTid('zoom-out');
      const level = t.byTid('zoom-level');
      const plus = t.byTid('zoom-in');
      assert.deepEqual([out.textContent, level.textContent, plus.textContent], ['−', '100%', '+']);
      assert.equal(out.nextSibling, level, 'the percent sits right of the minus');
      assert.equal(level.nextSibling, plus, 'and left of the plus (cypress 02 and 23 read the label as the span before the plus)');
      assert.ok(tokens(t.root()).includes('bg-cv-stage'), tokens(t.root()).join(' '));
      for (const el of [bar, out, level, plus, t.byTid('layout-toggle')]) assert.ok(!/\[#/.test(el.getAttribute('class')), 'no raw colour in the toolbar');
      assert.ok(tokens(out.parentNode).includes('rounded-cv-control'), 'the stepper is a control-radius box');
    } finally { await t.view.unmount(); }
  });

  it('steps by 25 % from 50 to 150, each end disabled, and the label follows', async () => {
    const t = await stage();
    try {
      const seen = [t.level()];
      t.press('zoom-in'); seen.push(t.level());
      t.press('zoom-in'); seen.push(t.level());
      assert.equal(t.byTid('zoom-in').hasAttribute('disabled'), true, 'at 150 % the plus is off');
      for (let i = 0; i < 4; i += 1) { t.press('zoom-out'); seen.push(t.level()); }
      assert.deepEqual(seen, ['100%', '125%', '150%', '125%', '100%', '75%', '50%']);
      assert.equal(t.byTid('zoom-out').hasAttribute('disabled'), true, 'at 50 % the minus is off');
      assert.equal(t.byTid('zoom-in').hasAttribute('disabled'), false);
    } finally { await t.view.unmount(); }
  });

  it('the zoom is remembered while the page stays mounted: across the layouts and the letter, and kept on a phone', async () => {
    const t = await stage();
    try {
      t.press('zoom-in');
      const bar = t.byTid('stage-toolbar');
      for (const mode of ['editor', 'preview', 'split']) t.press(`layout-${mode}`);
      t.set({ tab: 'coverletter' });
      t.set({ tab: 'resume' });
      assert.equal(t.byTid('stage-toolbar'), bar, 'the toolbar was never unmounted');
      assert.equal(t.level(), '125%');
    } finally { await t.view.unmount(); }
    const phone = await stage({ phone: true, layout: 'preview' });
    try {
      assert.equal(phone.byTid('layout-toggle'), undefined, 'no layout toggle on a phone');
      phone.press('zoom-in');
      phone.press('zoom-in');
      assert.equal(phone.level(), '150%', 'the zoom buttons stay on a phone (MOBI-074)');
      phone.press('zoom-out');
      assert.equal(phone.level(), '125%');
    } finally { await phone.view.unmount(); }
  });

  it('names the paper beside the zoom, for the résumé and for the letter', async () => {
    const letter = resume({ personal: { name: 'Pat Sample' } });
    letter.settings.pageSize = 'LETTER';
    const t = await stage({ r: letter });
    try {
      assert.equal(t.byTid('stage-paper').textContent, 'Résumé · US Letter');
      t.set({ tab: 'coverletter' });
      assert.equal(t.byTid('stage-paper').textContent, 'Cover Letter · US Letter');
    } finally { await t.view.unmount(); }
  });

  it('the layout toggle: Editor only hides the stage and builds nothing, Split and Preview only show it; the pressed one says so', async () => {
    const t = await stage({ layout: 'editor' });
    try {
      const hidden = () => tokens(t.root()).includes('hidden');
      assert.deepEqual(['editor', 'split', 'preview'].map((m) => t.byTid(`layout-${m}`).getAttribute('title')), ['Editor only', 'Split view', 'Preview only']);
      assert.equal(hidden(), true, 'Editor only: the stage is hidden');
      assert.equal(t.status().getAttribute('data-preview-status'), 'paused', 'and builds nothing');
      assert.equal(t.status().getAttribute('data-preview-pages'), '0');
      assert.equal(t.byTid('layout-editor').getAttribute('data-active'), 'true');
      t.set({ r: resume({ personal: { name: 'Pat Edited' } }) });
      assert.equal(t.status().getAttribute('data-preview-status'), 'paused', 'an edit while hidden builds nothing');
      t.press('layout-split');
      assert.equal(hidden(), false);
      assert.equal(t.byTid('layout-split').getAttribute('data-active'), 'true');
      assert.equal(t.byTid('layout-editor').getAttribute('data-active'), 'false');
      t.press('layout-preview');
      assert.equal(hidden(), false);
      assert.equal(t.byTid('layout-preview').getAttribute('data-active'), 'true');
      t.press('layout-editor');
      assert.equal(hidden(), true, 'and back: hidden, still mounted');
      assert.ok(t.status(), 'the preview was never unmounted');
    } finally { await t.view.unmount(); }
  });
});

describe('the stage footer: Terms and Privacy', () => {
  it('goes to /terms and /privacy through the callback the page gives', async () => {
    const asked = [];
    const t = await stage({ onLegal: (path) => asked.push(path) });
    try {
      assert.ok(t.byTid('stage-footer'));
      t.press('legal-terms');
      t.press('legal-privacy');
      assert.deepEqual(asked, ['/terms', '/privacy']);
      assert.equal(t.where(), '/', 'the router was not used');
    } finally { await t.view.unmount(); }
  });

  it('without a callback it still goes to the pages, through the router', async () => {
    const t = await stage();
    try {
      assert.deepEqual(t.byTid('stage-footer').textContent, 'TermsPrivacy');
      t.press('legal-privacy');
      assert.equal(t.where(), '/privacy');
      t.press('legal-terms');
      assert.equal(t.where(), '/terms');
    } finally { await t.view.unmount(); }
  });
});
