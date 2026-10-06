// UI rebuild B3 (cluster frame): no tab strip remains. The editor panel's three tabs (Resume | Cover Letter | ATS
// Check) and the palette toggle are replaced by the document switch (Resume | Cover Letter: exactly two buttons)
// and, beside it, the ATS chip and the Design button, which open the right dock. This is the negative twin of the
// old tabs: nothing of them is left on screen, in the testids or in the source.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepare, finish, openEditor, until, text, attr, reactProps, elements } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const source = (file) => fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
const buttonsIn = (el) => [...elements(el)].filter((b) => b.tagName === 'BUTTON');

describe('no Resume | Cover Letter | ATS Check tab strip', () => {
  it('the switch has exactly two buttons, Resume and Cover Letter', async () => {
    const t = await openEditor();
    try {
      const resumeButton = t.byTid('doc-switch-resume');
      const group = resumeButton.parentNode;
      assert.equal(t.byTid('doc-switch-letter').parentNode, group, 'both in one group');
      const buttons = buttonsIn(group);
      assert.equal(buttons.length, 2, buttons.map(text).join(' | '));
      assert.deepEqual(buttons.map(text), ['Resume', 'Cover Letter']);
      for (const b of buttons) assert.ok(reactProps(b).onClick, 'each picks a document');
    } finally { await t.close(); }
  });

  it('in the bar beside it only the ATS chip and the Design button: four controls, none of them a third tab', async () => {
    const t = await openEditor();
    try {
      const bar = buttonsIn(t.byTid('editor-bar'));
      const ids = ['doc-switch-resume', 'doc-switch-letter', 'ats-chip', 'design-button'];
      const row = bar.filter((b) => ids.includes(attr(b, 'data-testid')));
      assert.deepEqual(row.map(text), ['Resume', 'Cover Letter', 'ATS check', 'Design']);
      assert.deepEqual(row.map((b) => attr(b, 'data-testid')), ids);
    } finally { await t.close(); }
  });

  it('the old tab hooks and labels are gone: no ats-open, no design-open, no "ATS Check" tab', async () => {
    const t = await openEditor();
    try {
      const ids = t.all().map((el) => attr(el, 'data-testid'));
      assert.ok(!ids.includes('ats-open') && !ids.includes('design-open'), 'the tab testids are gone');
      assert.ok(!t.all().some((el) => el.tagName === 'BUTTON' && text(el) === 'ATS Check'), 'no ATS Check tab');
      assert.equal(t.all().filter((el) => el.tagName === 'BUTTON' && text(el) === 'Cover Letter').length, 1, 'one Cover Letter button');
    } finally { await t.close(); }
  });

  it('picking a document leaves no tab selected in the chip or the button; a dock marks only its own opener', async () => {
    const t = await openEditor();
    try {
      const on = (id) => /\bbg-cv-(good|brand)-soft\b/.test(attr(t.byTid(id), 'class'));
      assert.ok(!on('ats-chip') && !on('design-button'));
      // A dock's panels may arrive after the press: wait for the lit opener, not a count of ticks.
      await t.press('ats-chip');
      await until(() => on('ats-chip') && !on('design-button'), 'the ATS chip is the lit opener');
      await t.press('design-button');
      await until(() => !on('ats-chip') && on('design-button'), 'the Design button is the lit opener');
    } finally { await t.close(); }
  });

  it('the source holds no tab state: no EDITOR_TABS, no active-tab state in the Editor, no ATS Check tab in the header', () => {
    assert.ok(!/EDITOR_TABS/.test(source('hooks/useEditorTab.js')));
    assert.ok(!/setActiveTab|\bactiveTab [!=]==/.test(source('pages/Editor.jsx')), 'the Editor has a document and a dock, not an active tab');
    const header = source('components/EditorHeader.jsx');
    assert.ok(!/setActiveTab|ats-open|design-open|emerald-600 text-white|violet-600 text-white/.test(header));
  });
});
