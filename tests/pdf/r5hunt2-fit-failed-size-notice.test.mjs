// R5-HUNT2: Design → Spacing → 1-Page Fit on a résumé too long for one page. No step of the ladder
// fits, so the last one is kept — the tightest spacing with the base text at 9 pt — and all of it is
// written, the text size too. The notice spoke only of spacing ("Still N pages at the tightest
// spacing — …"), so an 11 pt résumé became 9 pt without a word, and 1-Page Fit has no Undo. Now the
// notice names the text size as well: "Still N pages at the tightest spacing and 9 pt text (was 11 pt)
// — shorten the content to fit one page." A résumé already at 9 pt hears only the spacing.
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
  const notice = () => all().find((el) => el.tagName === 'P' && el.textContent.trim().startsWith('Still '))?.textContent.trim();
  return { button, settled, notice, settings: () => current.settings, unmount: () => view.unmount() };
}

describe('1-Page Fit that stays over a page names the smaller text size (R5-HUNT2)', () => {
  it('the notice text: the size change when the tightest step lowered it, spacing alone when it did not', async () => {
    const { fitSizeNotice } = await loadModule('/src/utils/pageFit.js');
    assert.equal(fitSizeNotice({}, { pages: 2, settings: { marginV: 5, fontSizeBase: 9 } }),
      'Still 2 pages at the tightest spacing and 9 pt text (was 11 pt) — shorten the content to fit one page.', 'an unset base prints at 11 pt');
    assert.equal(fitSizeNotice({ fontSizeBase: 12 }, { pages: 3, settings: { fontSizeBase: 9 } }),
      'Still 3 pages at the tightest spacing and 9 pt text (was 12 pt) — shorten the content to fit one page.');
    assert.equal(fitSizeNotice({ fontSizeBase: 9 }, { pages: 2, settings: { marginV: 5 } }),
      'Still 2 pages at the tightest spacing — shorten the content to fit one page.', 'already at 9 pt: no size step, only spacing to say');
  });

  it('a résumé too long for one page: the 9 pt text is stored and the panel says so', async () => {
    const { fitLadder } = await loadModule('/src/utils/pageFit.js');
    const r = long(40);
    const tightest = fitLadder(r.settings).at(-1);
    assert.equal(tightest.fontSizeBase, 9, 'the last step lowers the text to 9 pt');
    assert.ok(await pagesOf(at(r, tightest)) > 1, 'still over a page at it');
    const p = await panel(r);
    try {
      reactProps(p.button()).onClick();
      await p.settled();
      assert.equal(p.settings().fontSizeBase, 9, 'the tightest step is stored, text size included');
      assert.match(p.notice() || '', /^Still \d+ pages at the tightest spacing and 9 pt text \(was 11 pt\) — shorten the content to fit one page\.$/);
    } finally { await p.unmount(); }
  });
});
