// UI rebuild B3 (cluster frame B): the phone frame. The header (back, tap-to-rename name, save chip, Export
// menu, account) with the Resume | Cover Letter switch and a 44 px ATS button on a row under it, and the
// floating Edit | Preview | Design pill: Design opens the dock as a full-height sheet and every pick returns to
// Edit (EDIT-141, MOBI-043), with the desktop as each rule's negative twin. The real Editor page over the real
// store (tests/pdf/180-ui-b3-editor-mount.mjs); the width query says phone through `goPhone()`.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, finish, openEditor, until, sleep, attr, elements, text, NAME, MARK } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const has = (t, id) => t.all().some((el) => attr(el, 'data-testid') === id);
const lit = (t, id) => /\bbg-cv-brand\b/.test(attr(t.byTid(id), 'class'));
/**
 * A press, then a wait by what the screen shows (500 x 10 ms, never a fixed tick count): a dock or a document picked
 * is an address change, which reaches the page as a router transition after the click.
 */
const go = async (t, id, done, what) => { await t.press(id); await until(done, what); };
const phone = async (opts) => { const t = await openEditor(opts); t.goPhone(); await t.press('pill-editor'); return t; };

describe('the Edit | Preview | Design pill', () => {
  it('on a phone: three segments in order, Edit lit, the form shown (the preview is not built: layout editor)', async () => {
    const t = await phone();
    try {
      const segments = t.all().filter((el) => /^pill-/.test(attr(el, 'data-testid')));
      assert.deepEqual(segments.map(text), ['Edit', 'Preview', 'Design']);
      assert.deepEqual(segments.map((el) => attr(el, 'data-testid')), ['pill-editor', 'pill-preview', 'pill-design']);
      assert.ok(lit(t, 'pill-editor') && !lit(t, 'pill-preview') && !lit(t, 'pill-design'));
      assert.equal(t.preview().layoutMode, 'editor');
      assert.match(attr(t.byTid('editor-pill'), 'class'), /\bfixed\b.*\bbottom-4\b.*\bz-40\b/);
    } finally { await t.close(); }
  });

  it('negative twin: on a desktop window there is no pill', async () => {
    const t = await openEditor();
    try { assert.ok(!has(t, 'editor-pill')); assert.equal(t.preview().layoutMode, 'split'); } finally { await t.close(); }
  });

  it('Preview shows the preview alone, Edit brings the form back', async () => {
    const t = await phone();
    try {
      await t.press('pill-preview');
      assert.equal(t.preview().layoutMode, 'preview');
      assert.ok(lit(t, 'pill-preview') && !lit(t, 'pill-editor'));
      await t.press('pill-editor');
      assert.equal(t.preview().layoutMode, 'editor');
    } finally { await t.close(); }
  });

  it('Design opens the Design dock as a sheet (full width, over the stage) and lights itself; a second press closes it', async () => {
    const t = await phone();
    try {
      await go(t, 'pill-design', () => has(t, 'dock-design'), 'the Design dock opens');
      assert.ok(lit(t, 'pill-design') && !lit(t, 'pill-editor'));
      assert.equal(t.url(), `/resume/${t.id}?dock=design`);
      assert.match(attr(t.byTid('dock-design'), 'class'), /max-md:w-full/);
      assert.match(attr(t.byTid('dock-design'), 'class'), /max-\[1099px\]:absolute/);
      await go(t, 'pill-design', () => !has(t, 'dock-design'), 'the Design dock closes');
      assert.ok(lit(t, 'pill-editor'));
    } finally { await t.close(); }
  });

  it('Edit and Preview close an open dock', async () => {
    const t = await phone();
    try {
      await go(t, 'pill-design', () => has(t, 'dock-design'), 'the Design dock opens');
      await go(t, 'pill-editor', () => !has(t, 'dock-design'), 'Edit closes the dock');
      await go(t, 'pill-design', () => has(t, 'dock-design'), 'the Design dock opens again');
      await go(t, 'pill-preview', () => !has(t, 'dock-design'), 'Preview closes the dock');
      assert.equal(t.preview().layoutMode, 'preview');
      await until(() => t.url() === `/resume/${t.id}`, 'the address drops ?dock=');
    } finally { await t.close(); }
  });

  it('a keystroke renders no part of the pill (PERF-4)', async () => {
    const t = await phone();
    try {
      const w = await t.measure(async () => { t.typeInSummary(); }, 400);
      assert.ok(t.store().activeResume.personal.summary.includes(MARK));
      assert.equal(w.count('pill'), 0, w.report());
    } finally { await t.close(); }
  });
});

describe('EDIT-141 (CHANGED): any pick returns the phone to Edit', () => {
  it('from Preview: the Cover Letter switch, the ATS chip and the Design button each land on Edit with their panel', async () => {
    const t = await phone();
    try {
      await t.press('pill-preview');
      await go(t, 'doc-switch-letter', () => t.preview().activeTab === 'coverletter', 'the Cover Letter opens');
      assert.equal(t.preview().layoutMode, 'editor');
      await t.press('pill-preview');
      await go(t, 'ats-chip', () => has(t, 'dock-ats'), 'the ATS dock opens');
      assert.equal(t.preview().layoutMode, 'editor');
      await t.press('pill-preview');
      await go(t, 'design-button', () => has(t, 'dock-design'), 'the Design dock opens');
      assert.equal(t.preview().layoutMode, 'editor');
    } finally { await t.close(); }
  });

  it('negative twin: on a desktop a pick leaves the layout as it was (split)', async () => {
    const t = await openEditor();
    try {
      await go(t, 'doc-switch-letter', () => t.preview().activeTab === 'coverletter', 'the Cover Letter opens');
      await go(t, 'ats-chip', () => has(t, 'dock-ats'), 'the ATS dock opens');
      assert.equal(t.preview().layoutMode, 'split');
    } finally { await t.close(); }
  });

  it('a document pick on a phone closes the sheet; on a desktop the Resume pick leaves the dock open', async () => {
    const t = await phone();
    try {
      await go(t, 'pill-design', () => has(t, 'dock-design'), 'the Design dock opens');
      await go(t, 'doc-switch-resume', () => !has(t, 'dock-design'), 'the Resume pick closes the sheet');
      assert.equal(t.preview().activeTab, 'resume');
      await go(t, 'pill-design', () => has(t, 'dock-design'), 'the Design dock opens again');
      await go(t, 'doc-switch-letter', () => !has(t, 'dock-design'), 'the Cover Letter pick closes the sheet');
      await until(() => t.preview().activeTab === 'coverletter', 'the Cover Letter opens');
    } finally { await t.close(); }
    const d = await openEditor({ path: '?dock=design' });
    try {
      await until(() => has(d, 'dock-design'), 'the dock the address names opens');
      await d.press('doc-switch-resume');
      await sleep(50);
      assert.ok(has(d, 'dock-design'), 'the desktop keeps it (EDIT-089\'s rule)');
    } finally { await d.close(); }
  });
});

describe('the header on a phone (EDIT-142, EDIT-143, EDIT-026)', () => {
  it('the name taps to rename: Enter commits the trimmed name', async () => {
    const t = await phone();
    try {
      const button = t.all().find((el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Rename resume');
      assert.equal(text(button), NAME);
      t.call(button, 'onClick');
      const box = t.all().find((el) => el.tagName === 'INPUT' && attr(el, 'aria-label') === 'Résumé name');
      assert.match(attr(box, 'class'), /pointer-coarse:text-base/, '16 px on touch');
      t.call(box, 'onChange', { target: { value: ' Phone name ' } });
      t.call(box, 'onKeyDown', { key: 'Enter' });
      assert.equal(t.store().activeResume.name, 'Phone name');
    } finally { await t.close(); }
  });

  it('the account, the sync dot and the Export menu (with Share and Import inside) are in the header; the Share button is not', async () => {
    const t = await phone({ signedIn: true });
    try {
      assert.equal(t.header().isMobile, true);
      const bar = [...elements(t.byTid('editor-bar'))];
      for (const id of ['account-button', 'sync-status', 'save-status']) assert.equal(bar.filter((el) => attr(el, 'data-testid') === id).length, 1, id);
      assert.ok(bar.some((el) => el.tagName === 'BUTTON' && text(el) === 'Export'));
      assert.ok(!has(t, 'share-button'));
      assert.equal(t.header().exportMenu.letterTab, false);
    } finally { await t.close(); }
  });

  it('the account is signed out: the Google button is in the header', async () => {
    const t = await phone();
    try { assert.ok(has(t, 'sign-in-button')); } finally { await t.close(); }
  });
});

describe('the phone layout classes', () => {
  it('the switch and the ATS button are 44 px, the Design button is the pill\'s, the bar wraps to two rows', async () => {
    const t = await phone();
    try {
      // The 44 px is on the buttons, which are what a finger taps (the frame around them is 2 px of padding: H1-7).
      for (const id of ['doc-switch-resume', 'doc-switch-letter', 'ats-chip']) assert.match(attr(t.byTid(id), 'class'), /max-md:min-h-\[44px\]/, id);
      // Hidden by the Editor's own phone flag, the one that draws the pill (not by a rem breakpoint: H2-14).
      assert.match(attr(t.byTid('design-button'), 'class'), /(^|\s)hidden(\s|$)/);
      assert.match(attr(t.byTid('editor-bar'), 'class'), /max-xl:flex-wrap/);
      assert.match(attr(t.byTid('doc-switch-resume').parentNode, 'class'), /order-5 xl:order-20/, 'under the header on a phone, in the bar on a desktop (the rows are pinned in 180-ui-b3-bar-layout)');
    } finally { await t.close(); }
  });

  it('hover-only hints show as words on touch: Back, and the pencil beside the name', async () => {
    const t = await phone();
    try {
      const back = t.all().find((el) => el.tagName === 'BUTTON' && attr(el, 'title') === 'Back to dashboard');
      assert.match(attr([...back.childNodes].find((n) => n.tagName === 'SPAN'), 'class'), /pointer-coarse:inline/);
      assert.equal(text(t.byTid('design-button')), 'Design');
    } finally { await t.close(); }
  });

  it('R4-DPH-31: the form and the dock keep 64 px under them for the pill', () => {
    assert.match(source('components/EditorTabContent.jsx'), /max-md:pb-16/);
    assert.match(source('components/EditorDock.jsx'), /max-md:pb-16/);
  });
});
