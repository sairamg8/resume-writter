// R5-HUNT6-FIT-UNDO: Design → Spacing → 1-Page Fit replaces all five spacing numbers and can lower the
// text size to 9 pt, yet it was the only preset with no way back: Balanced and Spacious raise a notice
// whose Undo hands back the look the résumé had (R4-DUX-25), the fit only set its inline text. Now a
// finished fit raises the same notice, and its Undo calls restoreDesign with the résumé's settings as
// they were before the click. Mounted with react-dom/client over fake-dom. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(async () => {
  await setup();
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom(); // the toast region's focus and selectors
});
after(teardown);

const tick = () => new Promise((res) => { setTimeout(res, 0); });

describe('1-Page Fit offers Undo (R5-HUNT6-FIT-UNDO)', () => {
  it('a finished fit raises a notice whose Undo hands back the hand-tuned spacing and text size', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
    const tuned = { marginV: 16, marginH: 20, sectionGap: 18, itemGap: 9, lineHeightValue: 1.45, fontSizeBase: 11, fontSizeEntryDelta: 1 };
    const r = resume({
      settings: tuned,
      personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
      sections: [experience([{ description: '<ul><li>Delivered the release pipeline.</li></ul>' }])],
    });
    let current = r;
    let view = null;
    const restored = [];
    const props = () => ({ resume: current, updateSetting, setTemplate: () => {}, resetSettings: () => {}, restoreDesign: (snap) => restored.push(snap) });
    function updateSetting(key, value) {
      current = { ...current, settings: { ...current.settings, [key]: value } };
      queueMicrotask(() => view.update(props()));
    }
    const Wrapped = (p) => createElement(ToastProvider, null, createElement(DesignPanel, p));
    view = mount(Wrapped, props());
    const buttonIn = (root, match) => [...elements(root)].find((el) => el.tagName === 'BUTTON' && match(el.textContent.trim()));
    try {
      view.act(() => reactProps(buttonIn(view.container, (t) => t === 'Spacing')).onClick());
      const fit = () => buttonIn(view.container, (t) => /1-Page Fit|Fitting/.test(t));
      reactProps(fit()).onClick();
      for (let i = 0; i < 100 && !fit().textContent.includes('Fitting'); i += 1) await tick();
      for (let i = 0; i < 600 && fit().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 100); });
      for (let i = 0; i < 5; i += 1) await tick();
      assert.equal(current.settings.marginV, 10, 'the fit wrote its spacing');
      const region = [...elements(view.document.body)].find((el) => el.getAttribute?.('role') === 'status');
      assert.ok(region, 'the notice region');
      assert.match(region.textContent, /1-Page Fit/, 'a notice names the fit');
      const undo = buttonIn(region, (t) => t === 'Undo');
      assert.ok(undo, 'the notice offers Undo');
      view.act(() => reactProps(undo).onClick({ preventDefault() {}, stopPropagation() {} }));
      assert.equal(restored.length, 1, 'Undo restores the design once');
      assert.equal(restored[0].id, r.id, 'this résumé');
      assert.equal(restored[0].settings, r.settings, 'the settings the résumé had before the click');
    } finally { await view.unmount(); }
  });
});
