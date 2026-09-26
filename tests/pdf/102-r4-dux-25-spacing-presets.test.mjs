// R4-DUX-25: Design → Spacing. (a) After 1-Page Fit left "Still N pages at the tightest spacing — shorten
// the content…", clicking Spacious or Balanced, or typing a margin, left that notice on screen: it spoke of
// settings no longer there. It now goes once the settings it describes change, and not before (the fit's
// own writes keep it). (b) Balanced and Spacious overwrote hand-tuned spacing with no way back: a click now
// raises a notice whose Undo hands back the look the résumé had (designSnapshot → restoreDesign, as a
// template switch's Undo does). Mounted with react-dom/client over fake-dom. Fictional data only.
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
const words = 'delivered measured reduced platform service customers pipeline release quality latency roadmap migration'.split(' ');
const sentence = (seed, len) => Array.from({ length: len }, (_, i) => words[(seed * 5 + i * 3) % words.length]).join(' ');
/** A résumé of `n` experience entries, three wrapping bullets each: 60 never fit one page. */
const long = (n, settings = {}) => resume({
  settings,
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
  sections: [experience(Array.from({ length: n }, (_, i) => ({
    description: `<ul>${[0, 1, 2].map((b) => `<li>${sentence(i * 3 + b, 22)}</li>`).join('')}</ul>`,
  })))],
});

/** The Design panel with Spacing open over a store stand-in that re-renders with each write (as 91-page-fit). */
async function panel(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  let current = r;
  let view = null;
  const props = () => ({ resume: current, updateSetting, setTemplate: () => {}, resetSettings: () => {} });
  function updateSetting(key, value) {
    current = { ...current, settings: { ...current.settings, [key]: value } };
    queueMicrotask(() => view.update(props()));
  }
  view = mount(DesignPanel, props());
  const all = () => [...elements(view.container)];
  const buttonText = (match) => all().find((el) => el.tagName === 'BUTTON' && match(el.textContent.trim()));
  view.act(() => reactProps(buttonText((t) => t === 'Spacing')).onClick());
  const fit = () => buttonText((t) => /1-Page Fit|Fitting/.test(t));
  const notice = () => all().find((el) => el.tagName === 'P' && /pages at the tightest spacing|Could not measure/.test(el.textContent))?.textContent.trim();
  async function runFit() {
    reactProps(fit()).onClick();
    for (let i = 0; i < 100 && !fit().textContent.includes('Fitting'); i += 1) await tick();
    for (let i = 0; i < 600 && fit().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 100); });
    for (let i = 0; i < 5; i += 1) await tick();
  }
  const settle = async (done) => { for (let i = 0; i < 50 && !done(); i += 1) await tick(); };
  return {
    runFit, notice, settle, updateSetting,
    click: (match) => view.act(() => reactProps(buttonText(match)).onClick()),
    rerender: () => view.update(props()),
    settings: () => current.settings,
    unmount: () => view.unmount(),
  };
}

describe('the 1-Page Fit notice goes once the settings it speaks of change (R4-DUX-25)', () => {
  it('Spacious clicked after a fit that could not reach one page clears "Still N pages…"', async () => {
    const p = await panel(long(60));
    try {
      await p.runFit();
      assert.match(p.notice() || '', /^Still \d+ pages at the tightest spacing/, 'the fit left its notice');
      p.rerender();
      for (let i = 0; i < 5; i += 1) await tick();
      assert.match(p.notice() || '', /^Still \d+ pages/, 'a render with the same settings keeps it');
      p.click((t) => t.endsWith('Spacious'));
      await p.settle(() => p.notice() === undefined);
      assert.equal(p.settings().marginV, 20, 'Spacious written');
      assert.equal(p.notice(), undefined, 'the notice spoke of the tightest spacing, no longer there');
    } finally { await p.unmount(); }
  });

  it('a margin typed after the fit clears it too', async () => {
    const p = await panel(long(60));
    try {
      await p.runFit();
      assert.match(p.notice() || '', /^Still \d+ pages/);
      p.updateSetting('marginV', 25); // Top / Bottom margin typed
      await p.settle(() => p.notice() === undefined);
      assert.equal(p.notice(), undefined, 'a new margin: the page count it gave is stale');
    } finally { await p.unmount(); }
  });
});

describe('Balanced and Spacious offer Undo (R4-DUX-25)', () => {
  it('a preset click raises a notice whose Undo hands back the settings the résumé had', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
    const calls = [];
    const spy = (name) => (...a) => calls.push([name, ...a]);
    const r = resume({ settings: { marginV: 9, marginH: 11, sectionGap: 7, itemGap: 3, lineHeightValue: 1.25 } });
    const props = { resume: r, resetSettings: () => {}, setTemplate: spy('setTemplate'), updateSetting: spy('updateSetting'), applyDesign: spy('applyDesign'), restoreDesign: spy('restoreDesign') };
    const view = mount(() => createElement(ToastProvider, null, createElement(DesignPanel, props)), {});
    const buttonIn = (root, match) => [...elements(root)].find((el) => el.tagName === 'BUTTON' && match(el.textContent.trim()));
    try {
      view.act(() => reactProps(buttonIn(view.container, (t) => t === 'Spacing')).onClick());
      view.act(() => reactProps(buttonIn(view.container, (t) => t.endsWith('Spacious'))).onClick());
      assert.deepEqual(calls.map(([, k, v]) => [k, v]), [['marginV', 20], ['marginH', 22], ['sectionGap', 22], ['itemGap', 12], ['lineHeightValue', 1.65]], 'Spacious written');
      const region = [...elements(view.document.body)].find((el) => el.getAttribute?.('role') === 'status');
      assert.ok(region, 'the notice region');
      assert.match(region.textContent, /Spacing: Spacious/);
      const undo = buttonIn(region, (t) => t === 'Undo');
      assert.ok(undo, 'the notice offers Undo');
      calls.length = 0;
      view.act(() => reactProps(undo).onClick({ preventDefault() {}, stopPropagation() {} }));
      assert.equal(calls.length, 1);
      const [name, snap] = calls[0];
      assert.equal(name, 'restoreDesign');
      assert.equal(snap.id, r.id, 'this résumé');
      assert.equal(snap.settings, r.settings, 'the hand-tuned spacing, the very settings it had');
    } finally { await view.unmount(); }
  });
});
