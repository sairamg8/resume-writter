// R5-HUNT1 (one-page-fit-loosens-tight-spacing-and-shrinks-text): Design → Spacing → 1-Page Fit wrote
// its preset (10/14 mm, gaps 10/5, line height 1.35) over whatever the résumé had, and its ladder never
// went tighter than 5/8 mm, 4/2 px, line height 1.2 — while the panel goes down to 0 mm, 0 px and 1.0.
// A résumé that fitted one page at its own tighter spacing was loosened past a page, and the ladder then
// shrank its text ("Fits on 1 page — text size 11 → 10 pt"). Now no step is looser than a number the
// résumé already has: each is the smaller of the step's and the stored one, so such a résumé keeps its
// spacing and its text size.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** Spacing tuned by hand, tighter than any step of the ladder. */
const TIGHT = { lineHeightValue: 1, marginV: 4, marginH: 6, sectionGap: 2, itemGap: 1 };
/** The ladder's tightest spacing before the fix. */
const OLD_TIGHTEST = { marginV: 5, marginH: 8, sectionGap: 4, itemGap: 2, lineHeightValue: 1.2 };
const SPACING = Object.keys(TIGHT);

const words = 'delivered measured reduced platform service customers pipeline release quality latency roadmap migration'.split(' ');
const sentence = (seed, len) => Array.from({ length: len }, (_, i) => words[(seed * 5 + i * 3) % words.length]).join(' ');
/** A résumé of `n` experience entries, three wrapping bullets each (fictional), at `settings`. */
const long = (n, settings = {}) => resume({
  settings,
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
  sections: [experience(Array.from({ length: n }, (_, i) => ({
    description: `<ul>${[0, 1, 2].map((b) => `<li>${sentence(i * 3 + b, 22)}</li>`).join('')}</ul>`,
  })))],
});
const pagesOf = async (r) => (await read(await render(r))).length;
const at = (r, settings) => ({ ...r, settings: { ...r.settings, ...settings } });
const spacingOf = (s) => Object.fromEntries(SPACING.map((k) => [k, s[k]]));

describe('1-Page Fit never loosens spacing the résumé has tighter (R5-HUNT1)', () => {
  it('every step of the ladder is at most the stored spacing, one step per distinct page', async () => {
    const { fitLadder } = await loadModule('/src/utils/pageFit.js');
    const ladder = fitLadder({ ...TIGHT, fontSizeBase: 11 });
    for (const [i, step] of ladder.entries()) {
      for (const k of SPACING) assert.ok(step[k] <= TIGHT[k], `step ${i}'s ${k} ${step[k]} is not looser than the stored ${TIGHT[k]}`);
    }
    assert.deepEqual(ladder[0], TIGHT, 'the first step keeps the tuned spacing');
    assert.ok(ladder.slice(1).every((s) => s.fontSizeBase < 11), 'no repeat of the same spacing: only smaller text follows');
    // Partly tighter: only the tighter numbers are kept, the others still tighten.
    const partly = fitLadder({ lineHeightValue: 1.1, marginV: 20 });
    assert.deepEqual(partly.map((s) => s.lineHeightValue).filter((v, i, a) => a.indexOf(v) === i), [1.1]);
    assert.equal(partly[0].marginV, 10, 'a looser margin still takes the preset\'s');
  });

  it('a résumé that fits at its own tight spacing is kept at it, text size untouched', async () => {
    const { fitOnePage } = await loadModule('/src/utils/pageFit.js');
    // The most entries that still print on one page at the tuned spacing but not at the old tightest step.
    let n = 6;
    while (await pagesOf(long(n + 1, TIGHT)) === 1) n += 1;
    const r = long(n, { ...TIGHT, fontSizeBase: 11 });
    assert.equal(await pagesOf(r), 1, `${n} entries fit at the tuned spacing`);
    assert.ok(await pagesOf(at(r, OLD_TIGHTEST)) > 1, 'but not at the ladder\'s own tightest spacing');
    const fit = await fitOnePage(r);
    assert.equal(fit.pages, 1);
    assert.equal(fit.settings.fontSizeBase, undefined, 'the text is not shrunk');
    assert.deepEqual(spacingOf(fit.settings), TIGHT, 'the tuned spacing stays');
  });

  it('the button keeps the tuned spacing of a résumé that fits, writing nothing looser', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    let current = long(1, { ...TIGHT, fontSizeBase: 11 });
    let view = null;
    const props = () => ({ resume: current, updateSetting, setTemplate: () => {}, resetSettings: () => {} });
    function updateSetting(key, value) {
      current = { ...current, settings: { ...current.settings, [key]: value } };
      queueMicrotask(() => view.update(props()));
    }
    view = mount(DesignPanel, props());
    try {
      const all = () => [...elements(view.container)];
      const spacing = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Spacing');
      view.act(() => reactProps(spacing).onClick());
      const button = () => all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title')?.startsWith('Fit more onto 1 page'));
      reactProps(button()).onClick();
      assert.deepEqual(spacingOf(current.settings), TIGHT, 'the preset written at once is no looser than the tuned spacing');
      for (let i = 0; i < 100 && !button().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 0); });
      for (let i = 0; i < 600 && button().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 100); });
      await new Promise((res) => { setTimeout(res, 0); });
      assert.deepEqual(spacingOf(current.settings), TIGHT, 'still the tuned spacing after measuring');
      assert.equal(current.settings.fontSizeBase, 11, 'text size unchanged');
      assert.equal(all().some((el) => el.tagName === 'P' && /Fits on 1 page|tightest spacing/.test(el.textContent)), false, 'no notice');
    } finally { await view.unmount(); }
  });
});
