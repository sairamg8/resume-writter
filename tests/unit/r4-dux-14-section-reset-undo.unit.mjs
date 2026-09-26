// R4-DUX-14: Design → a section's ↺ (Colors, Typography, Spacing, Lists, …) put a whole group of
// settings back to the template's defaults in one click, with no confirm and no way back. It now
// raises a notice "<Section> reset" whose Undo writes back what the reset changed — those keys only,
// as they were, an unset one deleted again (clearSettings). The notice leaves with the panel (another
// tab) or the résumé (another opened): its Undo would have written into whichever résumé is open. The real panel is mounted in a ToastProvider over fake-dom (the kit's harness), on a
// small store that keeps the résumé in state as the editor's does. Fictional data only.
// Run: node --test tests/unit/r4-dux-14-section-reset-undo.unit.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, useState } from 'react';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText, elements, wait } from './ui-dom-harness.mjs';

let kit;
let DesignPanel;
let ToastProvider;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ default: DesignPanel } = await kit.load('/src/components/DesignPanel.jsx'));
  ({ ToastProvider } = await kit.load('/src/components/ui/Toast.jsx'));
});
after(() => kit?.close());

const START = { accentColor: '#9f1239', bulletStyle: 'dash', linkStyle: 'underline' };
const cv = () => ({
  id: 'resume_a', name: 'A', template: 'classic', settings: { ...START },
  personal: { name: 'Robin Sample' }, sections: [], coverLetter: {},
});

/**
 * The panel over a résumé kept in state, as the editor's store keeps it; `settings()` reads it now,
 * `reset(title)` clicks that ↺, `leave()` shows another tab (the panel unmounts, the notices stay),
 * `open(r)` opens another résumé.
 */
function editor() {
  let now = cv();
  let setShown;
  let setResumeOut;
  function Store() {
    const [resume, setResume] = useState(cv);
    const [shown, show] = useState(true);
    now = resume;
    setShown = show;
    setResumeOut = setResume;
    const updateSetting = (k, v) => setResume((r) => ({ ...r, settings: { ...r.settings, [k]: v } }));
    const clearSettings = (keys) => setResume((r) => {
      const settings = { ...r.settings };
      for (const k of keys) delete settings[k];
      return { ...r, settings };
    });
    return h(ToastProvider, null, shown ? h(DesignPanel, { resume, updateSetting, clearSettings, setTemplate: () => {}, resetSettings: () => {} }) : null);
  }
  const view = mount(Store, {});
  const leave = () => view.act(() => setShown(false));
  const open = (r) => view.act(() => setResumeOut(r));
  const reset = (title) => {
    const button = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === `Reset ${title} to defaults`);
    assert.ok(button, `the ${title} ↺`);
    view.act(() => reactProps(button).onClick(ev()));
  };
  const notice = () => byAttr(view.document.body, 'role', 'status')[0];
  const undo = () => {
    const button = byText(notice(), 'Undo');
    assert.ok(button, 'the notice offers Undo');
    view.act(() => reactProps(button).onClick(ev()));
  };
  /** The notice's Undo, if it is still drawn (a dismissed toast stays a moment as it leaves). */
  const undoIfShown = () => {
    const button = byText(notice(), 'Undo');
    if (button) view.act(() => reactProps(button).onClick(ev()));
  };
  const shownNotices = () => byAttr(notice(), 'data-toast').length;
  return { view, settings: () => now.settings, reset, notice, undo, undoIfShown, shownNotices, leave, open };
}

it('a section\'s ↺ says "<Section> reset", and its Undo puts that section back as it was', async () => {
  const e = editor();
  try {
    e.reset('Lists');
    assert.equal(e.settings().bulletStyle, 'bullet', 'the ↺ still resets');
    assert.match(e.notice().textContent, /Lists reset/);
    e.undo();
    assert.equal(e.settings().bulletStyle, 'dash', 'Undo brings the dashes back');

    e.reset('Colors');
    assert.equal(e.settings().accentColor, '#374151', 'Colors reset to Classic\'s');
    assert.match(e.notice().textContent, /Colors reset/);
    e.undo();
    assert.equal(e.settings().accentColor, '#9f1239', 'the accent colour is back');
    for (const k of ['textColor', 'sidebarBg', 'headerTextColor', 'nameColor', 'jobTitleColor']) {
      assert.equal(k in e.settings(), false, `${k}: unset again (deleted), as it was`);
    }
    assert.equal(e.settings().linkStyle, 'underline', 'another section\'s setting untouched');
    assert.equal(e.settings().bulletStyle, 'dash', 'the earlier Undo stands');
    await wait(200);
    e.view.act(() => {});
  } finally { await e.view.unmount(); }
});

it('the Undo leaves with the panel: another tab, then Undo, writes nothing', async () => {
  const e = editor();
  try {
    e.reset('Lists');
    assert.match(e.notice().textContent, /Lists reset/);
    e.leave();
    e.undoIfShown();
    assert.equal(e.settings().bulletStyle, 'bullet', 'the reset stands: no Undo from a panel gone');
    await wait(600);
    e.view.act(() => {});
    assert.equal(e.shownNotices(), 0, 'the notice left with the panel');
  } finally { await e.view.unmount(); }
});

it('the Undo leaves with the résumé: another opened, then Undo, writes nothing into it', async () => {
  const e = editor();
  try {
    e.reset('Lists');
    assert.match(e.notice().textContent, /Lists reset/);
    const other = { ...cv(), id: 'resume_b', name: 'B', settings: { bulletStyle: 'number' } };
    e.open(other);
    e.undoIfShown();
    assert.deepEqual(e.settings(), { bulletStyle: 'number' }, 'the other résumé untouched');
    await wait(600);
    e.view.act(() => {});
    assert.equal(e.shownNotices(), 0, 'the notice left with the résumé');
  } finally { await e.view.unmount(); }
});
