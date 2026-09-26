// R4-DUX-14: Design → a section's ↺ (Colors, Typography, Spacing, Lists, …) put a whole group of
// settings back to the template's defaults in one click, with no confirm and no way back. It now
// raises a notice "<Section> reset" whose Undo writes back what the reset changed — those keys only,
// as they were. The real panel is mounted in a ToastProvider over fake-dom (the kit's harness), on a
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

/** The panel over a résumé kept in state; `settings()` reads it now, `reset(title)` clicks that ↺. */
function editor() {
  let now = cv();
  function Store() {
    const [resume, setResume] = useState(cv);
    now = resume;
    const updateSetting = (k, v) => setResume((r) => ({ ...r, settings: { ...r.settings, [k]: v } }));
    return h(ToastProvider, null, h(DesignPanel, { resume, updateSetting, setTemplate: () => {}, resetSettings: () => {} }));
  }
  const view = mount(Store, {});
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
  return { view, settings: () => now.settings, reset, notice, undo };
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
      assert.equal(e.settings()[k], undefined, `${k}: unset again, as it was`);
    }
    assert.equal(e.settings().linkStyle, 'underline', 'another section\'s setting untouched');
    assert.equal(e.settings().bulletStyle, 'dash', 'the earlier Undo stands');
    await wait(200);
    e.view.act(() => {});
  } finally { await e.view.unmount(); }
});
