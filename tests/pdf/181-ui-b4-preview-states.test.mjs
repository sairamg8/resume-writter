// UI rebuild B4 (cluster stage): the preview's states in the canvas look. Each is the live state with its live words:
// the page-shaped "Rendering preview…" until the first pages paint, the "Updating preview…" chip while a rebuild runs
// over pages already shown (clear of the phone's pill and of an open dock), the red "Preview failed to render (...)."
// with Retry, and the font fallback note with both wordings. data-preview-status and data-preview-pages stay what
// the readers expect. PdfPreview over the fake pdf.js of tests/pdf/preview-stub.mjs; the builds are the test's to finish.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupPreview, teardownPreview, preview, opened, versions, heldBuild, wait } from './preview-stub.mjs';
import { loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
before(setupPreview);
after(teardownPreview);

const tokens = (el) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
/** Polls until `done()` holds, by what the screen shows (500 x 10 ms), never a fixed tick count. */
async function until(done, what) {
  for (let i = 0; i < 500; i += 1) {
    if (done()) return;
    await wait(10);
  }
  assert.fail(`never happened: ${what}`);
}
const byTid = (p, id) => [...elements(p.view.container)].find((el) => el.getAttribute('data-testid') === id);
const attr = (p, name) => [...elements(p.view.container)].find((el) => el.hasAttribute('data-preview-status'))?.getAttribute(name);

describe('the placeholder: a page-shaped "Rendering preview…" until the first pages paint', () => {
  it('shows with its words while the first build runs, drawn from the tokens, and goes with the first page', async () => {
    const [v0] = versions(1);
    const { calls, build } = heldBuild();
    const p = await preview({ render: build, input: v0 });
    try {
      await until(() => calls.length === 1, 'the first build starts');
      const box = byTid(p, 'preview-placeholder');
      assert.ok(box, 'the placeholder');
      assert.equal(box.textContent, 'Rendering preview…');
      assert.ok(tokens(box).includes('text-cv-faint'), tokens(box).join(' '));
      assert.ok(tokens(box).includes('bg-white') && tokens(box).includes('shadow-2xl'), 'a sheet of paper');
      assert.ok(parseFloat(box.style.height) > parseFloat(box.style.width), 'a portrait page, at the page\'s ratio');
      assert.equal(attr(p, 'data-preview-status'), 'rendering');
      assert.equal(attr(p, 'data-preview-pages'), '0');
      calls[0].finish();
      await until(() => p.shown() !== '', 'the first page is on screen');
      assert.equal(byTid(p, 'preview-placeholder'), undefined, 'gone with the first page');
      assert.equal(attr(p, 'data-preview-pages'), '1');
    } finally { await p.view.unmount(); }
  });
});

describe('the Updating chip: while a rebuild runs over pages already shown', () => {
  it('shows for the rebuild only, in the chip look, above the pill below md and clear of an open dock', async () => {
    const [v0, v1] = versions(2);
    const p = await opened(v0);
    try {
      assert.equal(byTid(p, 'preview-updating'), undefined, 'no chip while the pages are current');
      p.set({ render: p.build, input: v1 });
      await until(() => byTid(p, 'preview-updating'), 'the chip while the edit rebuilds');
      const chip = byTid(p, 'preview-updating');
      assert.equal(chip.textContent, 'Updating preview…');
      const t = tokens(chip);
      for (const kept of ['fixed', 'bottom-4', 'right-4', 'max-md:bottom-16', 'cv-preview-chip', 'bg-cv-surface/90', 'border-cv-hairline', 'rounded-cv-chip']) {
        assert.ok(t.includes(kept), `the chip keeps ${kept}: ${t.join(' ')}`);
      }
      await until(() => p.calls.length === 2, 'the rebuild starts');
      p.calls[1].finish();
      await until(() => byTid(p, 'preview-updating') === undefined, 'the chip goes with the rebuild');
    } finally { await p.view.unmount(); }
  });

  it('the stylesheet moves it left of an open dock (360 px, plus its own 1 rem), for either dock', () => {
    const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
    const rule = css.match(/body:has\(([^)]*)\)\s*\.cv-preview-chip\s*\{([^}]*)\}/);
    assert.ok(rule, 'a rule for the chip beside a dock');
    assert.match(rule[1], /data-testid="dock-design"/);
    assert.match(rule[1], /data-testid="dock-ats"/);
    assert.match(rule[2], /right:\s*calc\(360px \+ 1rem\)/);
    // At the top level of the sheet, outside every @layer: it must outrank the utility's right-4.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const before = bare.slice(0, bare.indexOf(rule[0]));
    const depth = [...before].reduce((n, c) => n + (c === '{') - (c === '}'), 0);
    // Not inside a layer (a utility would outrank it): the one block around it is the media query that keeps it to the widths
    // where the dock sits BESIDE the stage (from 1100 px; below it the dock lies over the stage and the chip stays at the corner).
    assert.equal(depth, 1, 'the rule is inside one block, and that block is not a layer');
    assert.match(before.slice(before.lastIndexOf('@')), /^@media \(min-width: 1100px\)\s*\{\s*$/, 'the block is the media query for the dock beside the stage');
  });
});

describe('the chip and the notice stack (L3)', () => {
  it('the stylesheet moves the chip left of the toast stack while a notice is up, from md, after the dock rule', () => {
    const css = readFileSync(path.join(ROOT, 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const at = css.indexOf('body:has([aria-label="Notifications"] > *) .cv-preview-chip');
    assert.ok(at > css.indexOf('.cv-preview-chip'), 'a rule for the chip while a notice is up, after the dock rule');
    assert.match(css.slice(at, at + 200), /right:\s*calc\(360px \+ 2\.5rem\)/);
    assert.match(css.slice(css.lastIndexOf('@media', at), at), /^@media \(min-width: 768px\)\s*\{\s*$/);
  });
});

describe('Preview failed, with Retry', () => {
  it('says why in the red notice, and Retry builds again with the placeholder in the meantime', async () => {
    const [v0] = versions(1);
    const { calls, build } = heldBuild();
    const p = await preview({ render: build, input: v0 });
    try {
      await until(() => calls.length === 1, 'the first build');
      calls[0].fail('boom');
      await until(() => p.alert(), 'the notice');
      const alert = p.alert();
      assert.equal(alert.textContent, 'Preview failed to render (boom).Retry');
      assert.equal(alert.getAttribute('data-testid'), 'preview-error');
      assert.ok(tokens(alert).includes('cv-notice-bad'), tokens(alert).join(' '));
      assert.equal(attr(p, 'data-preview-status'), 'error');
      assert.equal(byTid(p, 'preview-placeholder'), undefined, 'a failed first build shows the notice, not the placeholder');
      p.retry();
      await until(() => calls.length === 2, 'Retry builds again');
      assert.equal(p.alert(), undefined, 'the notice goes while it builds');
      assert.ok(byTid(p, 'preview-placeholder'), 'and the placeholder is back');
      calls[1].finish();
      await until(() => p.shown() !== '', 'the retry paints');
      await until(() => attr(p, 'data-preview-status') === 'ready', 'ready');
    } finally { await p.view.unmount(); }
  });
});

describe('the font fallback note: both wordings', () => {
  it('offline it says until you are back online; online, in its place; drawn from the warn notice tokens; gone when it clears', async () => {
    const { FontFallbackNotice } = await loadModule('/src/components/FontFallbackNotice.jsx');
    const store = await loadModule('/src/utils/fontFallback.js');
    store.setFontFallback(null);
    const view = mount(FontFallbackNotice, {});
    const note = () => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'font-fallback-notice');
    try {
      assert.equal(note(), undefined, 'nothing while the chosen font prints');
      view.window.navigator.onLine = false;
      view.act(() => store.setFontFallback('Lora'));
      assert.equal(note().textContent, 'Lora could not be loaded — the PDF uses Noto Sans until you are back online.');
      assert.equal(note().getAttribute('data-font-fallback'), 'Lora');
      assert.ok(tokens(note()).includes('cv-notice-warn'), tokens(note()).join(' '));
      view.act(() => store.setFontFallback(null));
      assert.equal(note(), undefined);
      view.window.navigator.onLine = true;
      view.act(() => store.setFontFallback('Lora'));
      assert.equal(note().textContent, 'Lora could not be loaded — the PDF uses Noto Sans in its place.');
      view.act(() => store.setFontFallback(null));
      assert.equal(note(), undefined, 'cleared once the font loads');
    } finally { await view.unmount(); }
  });
});
