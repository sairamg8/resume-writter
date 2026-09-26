// R4-DUX-15: Design → Spacing → 1-Page Fit. Past the spacing steps its ladder lowers the base text
// size (down to 9 pt), but the button's tooltip spoke only of margins and line heights, and a fit
// that worked left the notice empty: the user's 11 pt text became 9 pt without a word. Now the
// tooltip says the text size may be reduced, and a fit that brought it down says so under the
// presets ("Fits on 1 page — text size 11 → 9 pt."); a fit on spacing alone still says nothing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const words = 'delivered measured reduced platform service customers pipeline release quality latency roadmap migration'.split(' ');
const sentence = (seed, len) => Array.from({ length: len }, (_, i) => words[(seed * 5 + i * 3) % words.length]).join(' ');
/** A résumé of `n` experience entries, three wrapping bullets each (fictional). */
const long = (n) => resume({
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
  sections: [experience(Array.from({ length: n }, (_, i) => ({
    description: `<ul>${[0, 1, 2].map((b) => `<li>${sentence(i * 3 + b, 22)}</li>`).join('')}</ul>`,
  })))],
});
const pagesOf = async (r) => (await read(await render(r))).length;
const at = (r, settings) => ({ ...r, settings: { ...r.settings, ...settings } });

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
  const spacing = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Spacing');
  view.act(() => reactProps(spacing).onClick());
  const button = () => all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title')?.startsWith('Fit more onto 1 page'));
  const settled = async () => {
    for (let i = 0; i < 100 && !button().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 0); });
    assert.match(button().textContent, /Fitting/, 'busy while it measures');
    for (let i = 0; i < 600 && button().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 100); });
    await new Promise((res) => { setTimeout(res, 0); });
  };
  const notice = () => all().find((el) => el.tagName === 'P' && el.textContent.trim().startsWith('Fits on 1 page'))?.textContent.trim();
  return { button, settled, notice, settings: () => current.settings, unmount: () => view.unmount() };
}

describe('1-Page Fit names a smaller text size (R4-DUX-15)', () => {
  it('the notice text: the size change on a fit, nothing for spacing alone or no fit', async () => {
    const { fitSizeNotice } = await loadModule('/src/utils/pageFit.js');
    assert.equal(fitSizeNotice({}, { pages: 1, settings: { marginV: 5, fontSizeBase: 9 } }), 'Fits on 1 page — text size 11 → 9 pt.', 'an unset base prints at 11 pt');
    assert.equal(fitSizeNotice({ fontSizeBase: 12 }, { pages: 1, settings: { fontSizeBase: 10 } }), 'Fits on 1 page — text size 12 → 10 pt.');
    assert.equal(fitSizeNotice({}, { pages: 1, settings: { marginV: 8 } }), '', 'spacing only: nothing to say');
    assert.equal(fitSizeNotice({}, { pages: 2, settings: { fontSizeBase: 9 } }), '', 'no fit: the "Still N pages" notice speaks instead');
    assert.equal(fitSizeNotice({}, null), '');
  });

  it('the tooltip says the text size may be reduced', async () => {
    const p = await panel(long(1));
    try {
      assert.match(p.button().getAttribute('title'), /reducing the text size \(down to 9 pt\)/);
      assert.doesNotMatch(p.button().getAttribute('title'), /safely/);
    } finally { await p.unmount(); }
  });

  it('a résumé that fits only at a smaller text size is fitted and the panel says 11 → N pt', async () => {
    const { fitLadder, fitOnePage } = await loadModule('/src/utils/pageFit.js');
    // The fewest entries that run past one page at the tightest spacing: only a smaller size fits them.
    const spacingOnly = fitLadder({}).filter((s) => s.fontSizeBase === undefined).at(-1);
    let n = 4;
    while (await pagesOf(at(long(n), spacingOnly)) < 2) n += 1;
    const r = long(n);
    const fit = await fitOnePage(r);
    assert.equal(fit.pages, 1, `${n} entries fit on one page at a smaller size`);
    assert.ok(fit.settings.fontSizeBase < 11, 'the text size came down');
    const p = await panel(r);
    try {
      reactProps(p.button()).onClick();
      await p.settled();
      assert.equal(p.settings().fontSizeBase, fit.settings.fontSizeBase, 'the smaller size is stored');
      assert.equal(p.notice(), `Fits on 1 page — text size 11 → ${fit.settings.fontSizeBase} pt.`);
    } finally { await p.unmount(); }
  });
});
