// Design → Spacing → 1-Page Fit (R2-149). The button wrote one fixed set of spacing numbers and
// never looked at the result: a three-page résumé stayed two or more pages. Now it writes that set,
// prints the résumé with the app's own renderer and, while it is more than one page, steps down a
// ladder of tighter settings inside the panel's ranges (margins, gaps, line height, then the base font
// size), keeping the FIRST step that fits — never tighter than needed. When even the tightest is
// still over a page the tightest stays and the panel says the content has to be shortened. Content
// is never touched; the button reads "Fitting…" and ignores clicks while it measures.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The preset as the button always wrote it. */
const PRESET = { marginV: 10, marginH: 14, sectionGap: 10, itemGap: 5, lineHeightValue: 1.35 };
/** Each Spacing control's range and the Typography Base's (spacingNumbers.js, pageMargins.js, designNumbers.js). */
const RANGE = { marginV: [0, 40], marginH: [0, 40], sectionGap: [0, 60], itemGap: [0, 40], lineHeightValue: [1, 3], fontSizeBase: [8, 16] };

const words = 'delivered measured reduced platform service customers pipeline release quality latency roadmap migration'.split(' ');
const sentence = (seed, len) => Array.from({ length: len }, (_, i) => words[(seed * 5 + i * 3) % words.length]).join(' ');
/** A résumé of `n` experience entries, three wrapping bullets each (fictional). */
const long = (n, settings = {}) => resume({
  settings,
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com' },
  sections: [experience(Array.from({ length: n }, (_, i) => ({
    description: `<ul>${[0, 1, 2].map((b) => `<li>${sentence(i * 3 + b, 22)}</li>`).join('')}</ul>`,
  })))],
});
const pagesOf = async (r) => (await read(await render(r))).length;
const at = (r, settings) => ({ ...r, settings: { ...r.settings, ...settings } });

describe('the fit ladder (pageFit.js)', () => {
  it('starts at the preset, tightens every step and stays inside the panel\'s ranges', async () => {
    const { fitLadder } = await loadModule('/src/utils/pageFit.js');
    const ladder = fitLadder({});
    assert.deepEqual(ladder[0], PRESET, 'the first step is the preset itself');
    assert.ok(ladder.length >= 4, `spacing steps and then smaller type: ${ladder.length} steps`);
    const base = (s) => s.fontSizeBase ?? 11;
    for (let i = 1; i < ladder.length; i += 1) {
      const [prev, step] = [ladder[i - 1], ladder[i]];
      for (const k of Object.keys(PRESET)) assert.ok(step[k] <= prev[k], `step ${i} never loosens ${k}`);
      assert.ok(base(step) <= base(prev), `step ${i} never grows the type`);
      assert.notDeepEqual(step, prev, `step ${i} is tighter than step ${i - 1}`);
      for (const [k, [lo, hi]] of Object.entries(RANGE)) {
        if (step[k] !== undefined) assert.ok(step[k] >= lo && step[k] <= hi, `step ${i}'s ${k} ${step[k]} is in ${lo}–${hi}`);
      }
    }
    assert.ok(ladder.some((s) => s.fontSizeBase < 11), 'the last steps shrink the base font size');
    assert.ok(ladder.every((s) => (s.fontSizeBase ?? 11) >= 9), 'never below 9 pt');
    // A résumé already set smaller keeps its own size or smaller: the ladder never grows its type.
    assert.ok(fitLadder({ fontSizeBase: 10 }).every((s) => (s.fontSizeBase ?? 10) <= 10));
    assert.ok(fitLadder({ fontSizeBase: 9 }).every((s) => s.fontSizeBase === undefined), 'at 9 pt no step changes the size');
  });

  it('a résumé that fits at step N gets exactly step N, measured in order', async () => {
    const { fitLadder, fitOnePage } = await loadModule('/src/utils/pageFit.js');
    const r = long(1);
    const ladder = fitLadder(r.settings);
    for (const n of [0, 1, 2, ladder.length - 1]) {
      const seen = [];
      // Fits once the settings are step n's (and more pages at any looser one). The last match: the
      // font steps carry the tightest spacing step's values too.
      const countPages = async (x) => { seen.push(x.settings); return ladder.findLastIndex((s) => Object.entries(s).every(([k, v]) => x.settings[k] === v)) >= n ? 1 : 3; };
      const fit = await fitOnePage(r, { countPages });
      assert.equal(fit.step, n, `fits at step ${n}`);
      assert.deepEqual(fit.settings, ladder[n]);
      assert.equal(fit.pages, 1);
      assert.equal(seen.length, n + 1, 'stops at the first step that fits');
      seen.forEach((s, i) => assert.deepEqual({ ...r.settings, ...ladder[i] }, s, `step ${i} measured with the résumé's own settings under it`));
    }
  });

  it('keeps the tightest step and reports its page count when none fits', async () => {
    const { fitLadder, fitOnePage } = await loadModule('/src/utils/pageFit.js');
    const r = long(1);
    const fit = await fitOnePage(r, { countPages: async () => 2 });
    assert.deepEqual(fit.settings, fitLadder(r.settings).at(-1));
    assert.equal(fit.pages, 2);
  });

  it('a smaller base keeps each size delta printing in its row\'s range, as the Base control does', async () => {
    const { fitLadder } = await loadModule('/src/utils/pageFit.js');
    // Full Name prints base + delta and may not print smaller than the base: delta −1 on 11 pt is out of range at any base.
    const small = fitLadder({ fontSizeBase: 11, fontSizeNameDelta: -1, fontSizeSectionDelta: 2 }).filter((s) => s.fontSizeBase);
    assert.ok(small.length > 0);
    for (const s of small) {
      assert.equal(s.fontSizeNameDelta, 0, 'the name delta is clamped to the base');
      assert.equal('fontSizeSectionDelta' in s, false, 'an in-range delta is left alone');
    }
  });
});

describe('fitted with the app\'s own renderer', () => {
  it('counts the pages react-pdf wrote as pdf.js reads them', async () => {
    const { countPdfPages } = await loadModule('/src/utils/pageFit.js');
    for (const n of [1, 12, 30]) {
      const bytes = await render(long(n));
      assert.equal(countPdfPages(bytes), (await read(bytes)).length, `${n} entries`);
    }
  });

  it('a résumé just over a page at the preset is fitted onto one, at the first step that does it', async () => {
    const { fitLadder, fitOnePage } = await loadModule('/src/utils/pageFit.js');
    // The fewest entries that run past one page at the preset.
    let n = 4;
    while (await pagesOf(at(long(n), PRESET)) < 2) n += 1;
    const r = long(n);
    const fit = await fitOnePage(r);
    assert.equal(fit.pages, 1, `${n} entries fit on one page`);
    assert.ok(fit.step >= 1, 'tightened past the preset');
    assert.equal(await pagesOf(at(r, fit.settings)), 1, 'and prints on one page at the settings it returns');
    assert.ok(await pagesOf(at(r, fitLadder(r.settings)[fit.step - 1])) > 1, 'the step before it did not fit: never tighter than needed');
    assert.equal(r.sections[0].items.length, n, 'content untouched');
  });

  it('a three-page résumé comes out on one page, or with the tightest settings and their page count', async () => {
    const { fitLadder, fitOnePage } = await loadModule('/src/utils/pageFit.js');
    let n = 12;
    while (await pagesOf(long(n)) < 3) n += 2;
    const r = long(n);
    const fit = await fitOnePage(r);
    const printed = await pagesOf(at(r, fit.settings));
    assert.equal(printed, fit.pages, 'the page count it reports is the one that prints');
    if (fit.pages > 1) assert.deepEqual(fit.settings, fitLadder(r.settings).at(-1), 'no fit: the tightest step');
    else assert.equal(printed, 1);
  });
});

describe('the 1-Page Fit button', () => {
  /** The Design panel with Spacing open over a store stand-in that re-renders with each write. */
  async function panel(r) {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const writes = [];
    let current = r;
    let view = null;
    const props = () => ({ resume: current, updateSetting, setTemplate: () => {}, resetSettings: () => {} });
    function updateSetting(key, value) {
      writes.push([key, value]);
      current = { ...current, settings: { ...current.settings, [key]: value } };
      queueMicrotask(() => view.update(props()));
    }
    view = mount(DesignPanel, props());
    const all = () => [...elements(view.container)];
    const spacing = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Spacing');
    view.act(() => reactProps(spacing).onClick());
    const button = () => all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title')?.startsWith('Fit more onto 1 page'));
    const settled = async () => {
      // The click's state commits on a later tick: first "Fitting…" shows, then it goes.
      for (let i = 0; i < 100 && !button().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 0); });
      assert.match(button().textContent, /Fitting/, 'busy while it measures');
      for (let i = 0; i < 600 && button().textContent.includes('Fitting'); i += 1) await new Promise((res) => { setTimeout(res, 100); });
      await new Promise((res) => { setTimeout(res, 0); });
    };
    const notice = () => all().find((el) => el.tagName === 'P' && /pages at the tightest spacing|Could not measure/.test(el.textContent))?.textContent.trim();
    return { writes, button, settled, notice, settings: () => current.settings, unmount: () => view.unmount() };
  }

  it('writes the preset at once, shows it is busy, ignores a second click and writes nothing more for a résumé that fits', async () => {
    const p = await panel(long(1));
    try {
      reactProps(p.button()).onClick();
      assert.deepEqual(Object.fromEntries(p.writes), PRESET, 'the preset, at once');
      await new Promise((res) => { queueMicrotask(res); });
      assert.match(p.button().textContent, /Fitting/, 'busy while it measures');
      const count = p.writes.length;
      reactProps(p.button()).onClick();
      assert.equal(p.writes.length, count, 'a second click while measuring does nothing');
      await p.settled();
      assert.match(p.button().textContent, /1-Page Fit/);
      assert.equal(p.writes.length, count, 'one page at the preset: nothing tighter');
      assert.equal(p.notice(), undefined);
    } finally { await p.unmount(); }
  });

  it('tightens a long résumé to the tightest step and says it is still over a page', async () => {
    const { fitLadder } = await loadModule('/src/utils/pageFit.js');
    const r = long(60);
    const p = await panel(r);
    try {
      reactProps(p.button()).onClick();
      await p.settled();
      const tightest = fitLadder(r.settings).at(-1);
      assert.deepEqual(Object.fromEntries(Object.keys(tightest).map((k) => [k, p.settings()[k]])), tightest, 'the tightest step is stored');
      assert.match(p.notice() || '', /^Still \d+ pages at the tightest spacing — shorten the content to fit one page\.$/);
    } finally { await p.unmount(); }
  });
});
