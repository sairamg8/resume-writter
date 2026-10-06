// UI rebuild B3 (cluster frame): the letter as a document. A letter-kind record opens on its letter (the
// Dashboard's link is ?tab=coverletter), hides Share, and the preview and the Export menu follow the document
// that is open, as they followed the tab: the letter's words on the letter, the résumé's on the Résumé and under
// either dock. useEditorExports takes the open document as `letterTab`.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, finish, openEditor, until, loadModule, resume, text, attr } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const exportButton = (t) => t.all().find((el) => el.tagName === 'BUTTON' && /^(Export|\.\.\.|Reading…)$/.test(text(el)));
const labels = (t) => t.all().filter((el) => el.tagName === 'BUTTON').map(text);

describe('a letter-kind document', () => {
  it('opens on the letter: the switch shows it selected, the preview and Export are the letter\'s', async () => {
    const { editorPath } = await loadModule('/src/utils/letters.js');
    const record = { kind: 'letter' };
    const t = await openEditor({ path: editorPath('x', record).replace('/resume/x', ''), extra: record });
    try {
      assert.equal(t.preview().activeTab, 'coverletter');
      assert.equal(t.header().exportMenu.letterTab, true);
      assert.match(attr(t.byTid('doc-switch-letter'), 'class'), /\bbg-cv-surface\b/, 'the letter is the selected switch');
      assert.doesNotMatch(attr(t.byTid('doc-switch-resume'), 'class'), /\bbg-cv-surface\b/);
    } finally { await t.close(); }
  });

  it('hides Share: the live rule keeps a letter-kind record out of it (and a signed-in account without a cloud)', async () => {
    assert.match(source('pages/Editor.jsx'), /const canShare = Boolean\(firebasePublicIo && auth\?\.user\?\.uid && resume\.kind !== 'letter'\);/);
    const t = await openEditor({ path: '?tab=coverletter', extra: { kind: 'letter' }, signedIn: true });
    try { assert.equal(t.header().onShare, undefined); } finally { await t.close(); }
  });
});

describe('Export follows the open document', () => {
  it('the Export menu names the letter on the letter and the résumé on the Résumé, switching with the document', async () => {
    const t = await openEditor({ path: '?tab=coverletter' });
    try {
      t.call(exportButton(t), 'onClick');
      assert.ok(labels(t).includes('Export Cover Letter PDF'), labels(t).join(' | '));
      await t.press('doc-switch-resume');
      assert.equal(t.header().exportMenu.letterTab, false);
      assert.ok(labels(t).includes('Export PDF'), labels(t).join(' | '));
      await t.press('doc-switch-letter');
      assert.equal(t.header().exportMenu.letterTab, true);
    } finally { await t.close(); }
  });

  it('a dock opened from the letter makes the menu the résumé\'s', async () => {
    const t = await openEditor({ path: '?tab=coverletter' });
    try {
      await t.press('design-button');
      // The dock's panels may arrive after the press, and the page shows nothing new until they have.
      await until(() => t.byTid('dock-design'), 'the Design dock opens from the letter');
      assert.equal(t.header().exportMenu.letterTab, false);
      t.call(exportButton(t), 'onClick');
      assert.ok(labels(t).includes('Export PDF'), labels(t).join(' | '));
      assert.ok(!labels(t).includes('Export Cover Letter PDF'));
    } finally { await t.close(); }
  });

  it('useEditorExports exports the letter when `letterTab` says so, and the résumé when it does not', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { createElement } = await import('react');
    const { mount } = await import('./fake-dom.mjs');
    const seen = [];
    const view = mount(() => {
      seen.push(
        useEditorExports({ resume: resume({}), letterTab: true, navigate() {}, importResume() {} }).letterTab,
        useEditorExports({ resume: resume({}), letterTab: false, navigate() {}, importResume() {} }).letterTab,
      );
      return createElement('p');
    }, {});
    try { assert.deepEqual(seen.slice(0, 2), [true, false]); } finally { await view.unmount(); }
  });
});
