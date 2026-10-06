// UI rebuild B3 (cluster frame, first commit): the save status (SaveStatus, "Saved 2m ago" under the preview) is
// extracted to EditorSaveStatus, a memo leaf of three primitives (persistError, saving, savedAt) that the
// Editor gives as an element of its own, never through EditorHeader. The four states and the 30 s tick are the
// live ones (tests/pdf/89-save-status keeps the store side); what is pinned here: the four states and the tick
// of the leaf, that EditorPreviewPane still exports SaveStatus, that the header is given none of the save
// state (so the write that follows a keystroke wakes the chip and nothing else), that the chip renders at most
// twice per keystroke burst, and the testids editor-bar and editor-sidebar.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { prepare, finish, openEditor, loadModule, elements, MARK, text } from './180-ui-b3-editor-mount.mjs';
import { mount } from './fake-dom.mjs';

before(prepare);
after(finish);

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');

/** The chip over the given state; `tick()` fires its interval once, as 30 s going by would. */
async function chip(props) {
  const { EditorSaveStatus } = await loadModule('/src/components/EditorSaveStatus.jsx');
  const real = { setInterval: globalThis.setInterval, now: Date.now };
  const timers = [];
  globalThis.setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const view = mount(() => createElement(EditorSaveStatus, props), {});
  globalThis.setInterval = real.setInterval;
  const span = () => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'save-status');
  return {
    view, timers, span,
    tick: () => view.act(() => timers[0].fn()),
    at: (ms) => { Date.now = () => ms; },
    restore: () => { Date.now = real.now; },
  };
}

describe('EditorSaveStatus: the four states', () => {
  it('reads "Auto-saved to your browser" before the first write', async () => {
    const c = await chip({ persistError: false, saving: false, savedAt: null });
    try { assert.equal(text(c.span()), 'Auto-saved to your browser'); } finally { await c.view.unmount(); }
  });

  it('reads "Saving…" while a write is held, even when one landed before', async () => {
    const c = await chip({ persistError: false, saving: true, savedAt: 1_000 });
    try { assert.equal(text(c.span()), 'Saving…'); } finally { await c.view.unmount(); }
  });

  it('reads the red "Not saved" for a failed write, whatever else it holds', async () => {
    const c = await chip({ persistError: true, saving: true, savedAt: 1_000 });
    try {
      assert.equal(text(c.span()), 'Not saved');
      assert.ok(/\btext-cv-bad\b/.test(c.span().getAttribute('class')), 'red: the cv-bad colour');
    } finally { await c.view.unmount(); }
  });

  it('reads "Saved <time ago>" once a write landed, and the 30 s tick keeps the time current', async () => {
    const c = await chip({ persistError: false, saving: false, savedAt: 1_000_000 });
    try {
      assert.equal(c.timers.length, 1, 'one interval');
      assert.equal(c.timers[0].ms, 30_000, 'every 30 s');
      c.at(1_000_000 + 5_000);
      c.tick();
      assert.equal(text(c.span()), 'Saved Just now');
      c.at(1_000_000 + 125_000);
      c.tick();
      assert.equal(text(c.span()), 'Saved 2m ago', 'the tick rendered it again with the time that went by');
    } finally { c.restore(); await c.view.unmount(); }
  });
});

describe('EditorSaveStatus: where it sits in the page', () => {
  it('EditorPreviewPane still exports SaveStatus, and it is the same chip', async () => {
    const { SaveStatus } = await loadModule('/src/components/EditorPreviewPane.jsx');
    const { EditorSaveStatus } = await loadModule('/src/components/EditorSaveStatus.jsx');
    assert.equal(SaveStatus, EditorSaveStatus);
  });

  it('the Editor gives the chip its three primitives as an element of its own; EditorHeader takes none of the save state', () => {
    const editor = source('pages/Editor.jsx');
    const el = editor.match(/<EditorSaveStatus\b([^>]*)\/>/);
    assert.ok(el, 'the Editor builds an EditorSaveStatus element');
    const keys = [...el[1].matchAll(/(\w+)=\{/g)].map((m) => m[1]).sort();
    assert.deepEqual(keys, ['persistError', 'savedAt', 'saving'], 'exactly the three props');
    assert.match(el[1], /persistError=\{Boolean\(store\.persistError\)\}/, 'a primitive: whether a write failed, not the error object (a new one at each failure)');
    const header = editor.match(/<EditorHeader\b[\s\S]*?\/>/)[0];
    for (const key of ['persistError', 'saving', 'savedAt', 'saveStatus']) assert.ok(!header.includes(key), `the header element is given ${key}`);
    const signature = source('components/EditorHeader.jsx').match(/export const EditorHeader = memo\(function EditorHeader\(\{([^}]*)\}\)/)[1];
    for (const key of ['persistError', 'saving', 'savedAt', 'saveStatus']) assert.ok(!signature.includes(key), `EditorHeader takes ${key}`);
  });

  it('the chip is a memo leaf with no router hook and no link', () => {
    const chipSource = source('components/EditorSaveStatus.jsx');
    assert.match(chipSource, /export const EditorSaveStatus = memo\(/);
    assert.ok(!/useNavigate|useParams|useSearchParams|useLocation|<Link\b/.test(chipSource));
  });

  it('the page has the testids editor-bar and editor-sidebar', async () => {
    assert.match(source('pages/Editor.jsx'), /data-testid="editor-sidebar"/);
    const t = await openEditor();
    try {
      assert.equal(t.all().filter((el) => el.getAttribute('data-testid') === 'editor-bar').length, 1, 'one bar');
    } finally { await t.close(); }
  });
});

describe('a keystroke and the write that follows it (PERF-4)', () => {
  it('the chip renders at most twice for a burst of keys, shows Saving… then Saved, and no leaf of the header does', async () => {
    const t = await openEditor();
    try {
      assert.equal(text(t.byTid('save-status')), 'Auto-saved to your browser');
      // Past the store's coalesced write (SAVE_WAIT_MS, 300 ms): its state changes render the page again.
      const w = await t.measure(async () => { t.typeInSummary(); t.typeInSummary(); t.typeInSummary(); }, 600);
      assert.ok(t.store().activeResume.personal.summary.includes(MARK), 'the characters reached the store');
      assert.ok(t.store().savedAt, 'the write has happened');
      assert.ok(w.count('save') >= 1 && w.count('save') <= 2, `the chip rendered ${w.count('save')} times. ${w.report()}`);
      assert.match(text(t.byTid('save-status')), /^Saved /, 'and says Saved now');
      assert.equal(w.count('header'), 0, `the header rendered. ${w.report()}`);
      assert.equal(w.count('alerts'), 0, `the alerts rendered. ${w.report()}`);
      assert.equal(w.count('modes'), 0, `the mode bar rendered. ${w.report()}`);
      assert.deepEqual(Object.keys(t.save()).sort(), ['persistError', 'savedAt', 'saving']);
    } finally { await t.close(); }
  });

  it('the count is live: a rename of the résumé does render the header', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(() => t.act(() => t.store().renameResume(t.id, 'Renamed')));
      assert.ok(w.count('header') >= 1, `the header shows the new name, so it renders. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('a failed write reads the red "Not saved" in the chip, and the header is still not rendered', async () => {
    const t = await openEditor();
    try {
      localStorage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
      const w = await t.measure(() => t.typeInSummary(), 600);
      assert.equal(text(t.byTid('save-status')), 'Not saved');
      assert.equal(w.count('header'), 0, `the header rendered. ${w.report()}`);
    } finally { await t.close(); }
  });
});
