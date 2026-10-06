// UI rebuild B3 (cluster frame B): the editor's bar. One full-width bar of independent memo leaves: back, the
// résumé's name (rename in place, with a pencil), the Resume | Cover Letter switch, the ATS chip, the save chip,
// the Design button, the Export menu, Share, the sync dot and the account. Pinned here: every function is in the
// bar exactly once, the leaves take callbacks and stable objects only (no router hook, no link: PERF-4), Share
// keeps its live visibility rule, the chip and the Design button toggle their dock, the save chip lives in the
// bar and the preview's footer has none, and the four CHANGED rows EDIT-019 (sync dot), EDIT-026 (phone export,
// share, import), EDIT-141 (a pick returns to Edit) and EDIT-171 (the open document), each with a negative twin.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { prepare, finish, openEditor, loadModule, elements, reactProps, text, attr, NAME, MARK, USER } from './180-ui-b3-editor-mount.mjs';
import { mount } from './fake-dom.mjs';

before(prepare);
after(finish);

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const inBar = (t) => [...elements(t.byTid('editor-bar'))];
const count = (list, test) => list.filter(test).length;
const byTid = (list, id) => list.filter((el) => attr(el, 'data-testid') === id);
const exportButton = (list) => list.find((el) => el.tagName === 'BUTTON' && /^(Export|\.\.\.|Reading…)$/.test(text(el)));
const nameButton = (list) => list.find((el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Rename resume');
const nameBox = (list) => list.find((el) => el.tagName === 'INPUT' && attr(el, 'aria-label') === 'Résumé name');

const noop = () => {};
const renameStub = () => ({ editing: false, draft: '', setDraft: noop, start: noop, commit: noop, cancel: noop });
const exportStub = (over = {}) => ({
  exporting: false, importing: false, keeps: false, letterTab: false, setExportError: noop,
  handleExportPDF: noop, handleExportWord: noop, handleExportJSON: noop, handleExportMarkdown: noop, handleExportAtsText: noop,
  handleExportLetterText: noop, handleExportJsonResume: noop, handleImportJSON: noop, handleImportFile: noop, ...over,
});
const authOf = (user) => ({ user, authLoading: false, cloudAvailable: true, signInWithGoogle: noop, signOut: noop });
const syncOf = (over = {}) => ({ syncStatus: 'synced', lastSynced: null, isOnline: true, heldResumes: [], ...over });

/** EditorHeader alone, over stub props (`over` replaces any), as the Editor gives them. */
async function header(over = {}) {
  const { EditorHeader } = await loadModule('/src/components/EditorHeader.jsx');
  const props = {
    name: NAME, rename: renameStub(), layoutMode: 'split', setLayoutMode: noop, exportMenu: exportStub(), auth: authOf(USER), sync: syncOf(),
    isMobile: false, onShare: undefined, onBack: noop, ...over,
  };
  const view = mount(EditorHeader, props);
  return { view, list: () => [...elements(view.container)], act: (fn) => view.act(fn), update: (next) => view.update({ ...props, ...next }) };
}

describe('every bar function is present once', () => {
  it('back, name, switch, chip, save chip, Design, Export, sync dot and account: one each, all inside the bar', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      const bar = inBar(t);
      assert.equal(t.all().filter((el) => attr(el, 'data-testid') === 'editor-bar').length, 1, 'one bar');
      assert.equal(count(bar, (el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Back to dashboard'), 1, 'back');
      assert.equal(count(bar, (el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Rename resume'), 1, 'the name');
      assert.equal(text(nameButton(bar)), NAME, 'the name is the button\'s text (the pencil is an icon)');
      for (const id of ['doc-switch-resume', 'doc-switch-letter', 'ats-chip', 'design-button', 'save-status', 'sync-status', 'account-button']) {
        assert.equal(byTid(bar, id).length, 1, `${id} in the bar`);
        assert.equal(byTid(t.all(), id).length, 1, `${id} once on the page`);
      }
      assert.equal(count(bar, (el) => el.tagName === 'BUTTON' && /^Export$/.test(text(el))), 1, 'the Export menu');
      assert.equal(byTid(bar, 'share-button').length, 0, 'no Share in a build without a cloud');
    } finally { await t.close(); }
  });

  it('the save chip is in the bar and the preview has none of its own: one chip on the page', async () => {
    const t = await openEditor();
    try {
      assert.equal(byTid(t.all(), 'save-status').length, 1);
      assert.equal(byTid(inBar(t), 'save-status').length, 1);
      assert.ok(!/saveStatus|<SaveStatus|<EditorSaveStatus/.test(source('components/EditorPreviewPane.jsx')), 'the preview pane draws no save chip');
    } finally { await t.close(); }
  });

  it('signed out: the Google button replaces the avatar, and no sync dot shows (the live account bar)', async () => {
    const t = await openEditor({ signedIn: false });
    try {
      const bar = inBar(t);
      assert.equal(byTid(bar, 'sign-in-button').length, 1);
      assert.equal(byTid(bar, 'account-button').length, 0);
      assert.equal(byTid(bar, 'sync-status').length, 0, 'EDIT-019 twin: hidden when signed out');
    } finally { await t.close(); }
  });
});

describe('callbacks only (PERF-4)', () => {
  it('no memo part of the bar reads the router or draws a Link', () => {
    for (const file of ['components/EditorHeader.jsx', 'components/EditorDocSwitch.jsx', 'components/EditorSaveStatus.jsx', 'components/EditorMobilePill.jsx']) {
      assert.ok(!/useNavigate|useParams|useSearchParams|useLocation|<Link\b|react-router/.test(source(file)), `${file} uses the router`);
    }
  });

  it('EditorHeader takes primitives, stable objects and callbacks, and Back is a callback the Editor makes with navigate(\'/\')', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      const props = t.header();
      for (const [key, value] of Object.entries(props)) {
        assert.ok(['string', 'boolean', 'function', 'object', 'undefined'].includes(typeof value), key);
      }
      assert.equal(typeof props.onBack, 'function');
      assert.match(source('pages/Editor.jsx'), /const goBack = useCallback\(\(\) => navigate\('\/'\), \[navigate\]\);/, 'Back always goes to Documents, never history back');
      const before = t.header();
      t.typeInSummary();
      await t.measure(async () => {});
      const after = t.header();
      for (const key of ['rename', 'exportMenu', 'auth', 'sync', 'onBack']) assert.equal(after[key], before[key], `${key} kept its identity`);
    } finally { await t.close(); }
  });

  it('a keystroke renders none of the leaves of the bar, the switch, the chip, the Design button or the pill; the save chip alone', async () => {
    const t = await openEditor({ signedIn: true });
    try {
      const w = await t.measure(async () => { t.typeInSummary(); t.typeInSummary(); }, 600);
      assert.ok(t.store().activeResume.personal.summary.includes(MARK));
      for (const label of ['header', 'alerts', 'modes', 'switch', 'chip', 'designButton', 'pill']) assert.equal(w.count(label), 0, `${label} rendered. ${w.report()}`);
      assert.ok(w.count('save') >= 1 && w.count('save') <= 2, `the save chip rendered ${w.count('save')} times`);
    } finally { await t.close(); }
  });

  it('negative twin: a rename of the résumé does render the header, so the count above measures something', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(() => t.act(() => t.store().renameResume(t.id, 'Another name')));
      assert.ok(w.count('header') >= 1, w.report());
    } finally { await t.close(); }
  });
});

describe('rename in place keeps its rules (EDIT-003)', () => {
  async function renameWith(steps) {
    const t = await openEditor();
    try {
      t.call(nameButton(t.all()), 'onClick');
      assert.ok(nameBox(t.all()), 'the box opens');
      assert.equal(reactProps(nameBox(t.all())).value, NAME, 'on the current name');
      steps(t);
      return { name: t.store().activeResume.name, editing: Boolean(nameBox(t.all())) };
    } finally { await t.close(); }
  }
  const type = (t, value) => t.call(nameBox(t.all()), 'onChange', { target: { value } });
  const key = (t, k, extra) => t.call(nameBox(t.all()), 'onKeyDown', { key: k, ...extra });

  it('Enter commits the trimmed name', async () => {
    const r = await renameWith((t) => { type(t, '  Data Lead CV  '); key(t, 'Enter'); });
    assert.deepEqual(r, { name: 'Data Lead CV', editing: false });
  });
  it('Escape cancels', async () => {
    const r = await renameWith((t) => { type(t, 'Never saved'); key(t, 'Escape'); });
    assert.deepEqual(r, { name: NAME, editing: false });
  });
  it('an IME\'s Enter does not commit, and its Escape does not cancel', async () => {
    const r = await renameWith((t) => { type(t, 'Half typed'); key(t, 'Enter', { keyCode: 229 }); key(t, 'Escape', { isComposing: true }); });
    assert.deepEqual(r, { name: NAME, editing: true });
  });
  it('an empty name is no edit, and neither is the same name', async () => {
    const r = await renameWith((t) => { type(t, '   '); key(t, 'Enter'); });
    assert.deepEqual(r, { name: NAME, editing: false });
    const same = await renameWith((t) => { type(t, NAME); key(t, 'Enter'); });
    assert.deepEqual(same, { name: NAME, editing: false });
  });
});

describe('Share keeps its live visibility rule', () => {
  it('the Editor offers it only to a signed-in account, on a build with a cloud, and never for a letter', () => {
    assert.match(source('pages/Editor.jsx'), /const canShare = Boolean\(firebasePublicIo && auth\?\.user\?\.uid && resume\.kind !== 'letter'\);/);
    assert.match(source('pages/Editor.jsx'), /onShare=\{canShare \? openShare : undefined\}/);
  });

  it('a given onShare draws the Share button once on a desktop bar; none given draws none (signed out, no cloud, a letter)', async () => {
    const yes = await header({ onShare: noop });
    const no = await header({ onShare: undefined });
    try {
      assert.equal(byTid(yes.list(), 'share-button').length, 1);
      assert.equal(byTid(no.list(), 'share-button').length, 0);
      yes.act(() => reactProps(byTid(yes.list(), 'share-button')[0]).onClick());
    } finally { await yes.view.unmount(); await no.view.unmount(); }
  });

  it('no cloud and a letter in the real Editor: no Share anywhere', async () => {
    for (const [name, opts] of [['no cloud', { signedIn: true }], ['a letter', { signedIn: true, path: '?tab=coverletter', extra: { kind: 'letter' } }]]) {
      const t = await openEditor(opts);
      try {
        assert.equal(byTid(t.all(), 'share-button').length, 0, name);
        assert.equal(t.header().onShare, undefined, name);
      } finally { await t.close(); }
    }
  });
});

describe('the chip and the Design button toggle the dock', () => {
  it('each opens its own dock, a second press closes it, and the other replaces it', async () => {
    const t = await openEditor();
    try {
      const open = () => t.all().map((el) => attr(el, 'data-testid')).filter((id) => /^dock-(design|ats)$/.test(id));
      await t.press('ats-chip');
      assert.deepEqual(open(), ['dock-ats']);
      await t.press('design-button');
      assert.deepEqual(open(), ['dock-design']);
      await t.press('design-button');
      assert.deepEqual(open(), []);
    } finally { await t.close(); }
  });
});

describe('the save chip in the bar: its states', () => {
  it('"Auto-saved to your browser", then "Saved <time>" after a write, and the red "Not saved" when a write fails', async () => {
    const t = await openEditor();
    try {
      assert.equal(text(byTid(inBar(t), 'save-status')[0]), 'Auto-saved to your browser');
      t.typeInSummary();
      await t.measure(async () => {}, 600);
      assert.match(text(byTid(inBar(t), 'save-status')[0]), /^Saved /);
      localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
      t.typeInSummary();
      await t.measure(async () => {}, 600);
      const chip = byTid(inBar(t), 'save-status')[0];
      assert.equal(text(chip), 'Not saved');
      assert.match(attr(chip, 'class'), /\btext-cv-bad\b/);
    } finally { await t.close(); }
  });

  it('"Saving…" while a write is held (the leaf, over its primitives)', async () => {
    const { EditorSaveStatus } = await loadModule('/src/components/EditorSaveStatus.jsx');
    const view = mount(() => createElement(EditorSaveStatus, { persistError: false, saving: true, savedAt: 5 }), {});
    try { assert.equal(text([...elements(view.container)].find((el) => attr(el, 'data-testid') === 'save-status')), 'Saving…'); } finally { await view.unmount(); }
  });
});

describe('EDIT-019 (CHANGED): the sync dot keeps every state in the bar, with its words', () => {
  const dot = (h) => byTid(h.list(), 'sync-status')[0];
  const cases = [
    [syncOf({ isOnline: false }), /Offline/],
    [syncOf({ syncStatus: 'offline' }), /Cannot reach your account/],
    [syncOf({ syncStatus: 'syncing' }), /^Syncing…$/],
    [syncOf({ syncStatus: 'synced' }), /^Synced/],
    [syncOf({ syncStatus: 'error' }), /^Sync error/],
    [syncOf({ syncStatus: 'stopped', heldResumes: [{ name: 'Large photo CV' }] }), /“Large photo CV” not synced \(a large photo\?\) — saved in this browser/],
    [syncOf({ syncStatus: 'off' }), /^Sync is off/],
  ];
  for (const [sync, words] of cases) {
    it(`${sync.syncStatus}${sync.isOnline ? '' : ' (offline)'}: ${words}`, async () => {
      const h = await header({ sync });
      try { assert.match(attr(dot(h), 'aria-label'), words); } finally { await h.view.unmount(); }
    });
  }
  it('negative twin: signed out, no dot; a build without a cloud, no account bar at all', async () => {
    const out = await header({ auth: authOf(null) });
    const none = await header({ auth: { ...authOf(null), cloudAvailable: false } });
    try {
      assert.equal(byTid(out.list(), 'sync-status').length, 0);
      assert.equal(byTid(none.list(), 'sign-in-button').length + byTid(none.list(), 'account-button').length, 0);
    } finally { await out.view.unmount(); await none.view.unmount(); }
  });
});

describe('EDIT-026 (CHANGED): export, share and import stay reachable on a phone', () => {
  const open = (h) => h.act(() => reactProps(exportButton(h.list())).onClick());
  const items = (h) => h.list().filter((el) => el.tagName === 'BUTTON').map(text);

  it('the phone header opens the whole menu: formats, Share a public link, and Import', async () => {
    const h = await header({ isMobile: true, onShare: noop });
    try {
      assert.equal(byTid(h.list(), 'share-button').length, 0, 'no second Share button on a phone');
      open(h);
      const labels = items(h);
      for (const want of ['Export PDF', 'Export Word', 'Export Markdown (.md)', 'Export ATS Text (.txt)', 'Export JSON Resume (.json)', 'Export Backup JSON', 'Share a public link…', 'Import as a new résumé (JSON, PDF, Word or text)']) {
        assert.ok(labels.includes(want), `${want} in ${labels.join(' | ')}`);
      }
      assert.equal(count(h.list(), (el) => text(el) === 'Share a public link…'), 1, 'Share once');
    } finally { await h.view.unmount(); }
  });

  it('negative twin: on a desktop bar the Share button is the one Share, and the menu has no second one', async () => {
    const h = await header({ isMobile: false, onShare: noop });
    try {
      assert.equal(byTid(h.list(), 'share-button').length, 1);
      open(h);
      assert.ok(!items(h).includes('Share a public link…'));
      assert.ok(items(h).includes('Export PDF'));
    } finally { await h.view.unmount(); }
  });

  it('a phone header carries the account, the name\'s rename and the back arrow too', async () => {
    const h = await header({ isMobile: true });
    try {
      assert.equal(byTid(h.list(), 'account-button').length, 1);
      assert.equal(byTid(h.list(), 'sync-status').length, 1);
      assert.ok(nameButton(h.list()));
      assert.ok(h.list().some((el) => attr(el, 'title') === 'Back to dashboard'));
    } finally { await h.view.unmount(); }
  });
});

describe('EDIT-171 (CHANGED): the open document and the docks', () => {
  it('a dock opened from the letter shows the résumé; the Resume switch is not the dock\'s opener', async () => {
    const t = await openEditor({ path: '?tab=coverletter' });
    try {
      assert.equal(t.preview().activeTab, 'coverletter');
      await t.press('design-button');
      assert.equal(t.preview().activeTab, 'resume');
      assert.equal(t.header().exportMenu.letterTab, false);
      // negative twin: the Resume switch (EDIT-089's live rule) leaves the dock as it was
      await t.press('doc-switch-resume');
      assert.ok(t.all().some((el) => attr(el, 'data-testid') === 'dock-design'));
    } finally { await t.close(); }
  });

  it('negative twin: picking the Cover letter closes an open dock and shows the letter', async () => {
    const t = await openEditor({ path: '?dock=ats' });
    try {
      assert.ok(t.all().some((el) => attr(el, 'data-testid') === 'dock-ats'));
      await t.press('doc-switch-letter');
      assert.ok(!t.all().some((el) => attr(el, 'data-testid') === 'dock-ats'));
      assert.equal(t.preview().activeTab, 'coverletter');
    } finally { await t.close(); }
  });
});
