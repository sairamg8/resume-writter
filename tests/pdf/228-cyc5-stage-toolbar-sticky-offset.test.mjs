// The stage toolbar (zoom, the paper, the layout toggle) keeps to the top of the preview as the pages scroll under it, FLUSH with the
// top of the box. A sticky box is held at its `top` measured from the scroll box's PADDING edge, not its outer edge: the box pads its top
// (pt-4 sm:pt-8) and the bar pulls itself up over that padding with a negative margin, so with `top-0` it stuck as far down as the
// padding (32 px from sm) and the résumé showed ABOVE it while scrolling, the toolbar floating mid-page over the text (the owner's
// screenshot, 2026-10-08). Measured in Chromium on a probe of the same structure: top:0 -> the bar 32 px low with the page visible above
// it; top:-32px -> flush, the page scrolls cleanly under it. So the `top` offset is the negative of the box's top padding, at each
// breakpoint, the same numbers as the pull-up margin.
// Run: node --test tests/pdf/228-cyc5-stage-toolbar-sticky-offset.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = fs.readFileSync(new URL('../../src/components/EditorPreviewPane.jsx', import.meta.url), 'utf8');

/** The class list of the opening tag that carries `marker`. */
function tokensAround(marker) {
  const from = text.indexOf(marker);
  assert.ok(from >= 0, `${marker} is in EditorPreviewPane.jsx`);
  const open = text.slice(text.lastIndexOf('<', from), text.indexOf('>', from));
  const quoted = open.match(/className="([^"]*)"/);
  assert.ok(quoted, `${marker} has a class list`);
  return quoted[1].split(/\s+/).filter(Boolean);
}

/** The top padding of the scroll box, per breakpoint: { '': 4, 'sm:': 8 }. */
function boxPadding() {
  const box = text.match(/overflow-auto bg-cv-stage[^`]*`/)?.[0] ?? '';
  const found = {};
  for (const token of box.split(/\s+/)) {
    const m = /^(sm:)?pt-(\d+)$/.exec(token);
    if (m) found[m[1] ?? ''] = Number(m[2]);
  }
  return found;
}

describe('the stage toolbar\'s sticky offset', () => {
  it('is the negative of the preview box\'s top padding at every breakpoint, as is the margin that pulls it up', () => {
    const pad = boxPadding();
    assert.deepEqual(Object.keys(pad).sort(), ['', 'sm:'], `the box pads its top at the base and from sm: ${JSON.stringify(pad)}`);
    const bar = tokensAround('data-testid="stage-toolbar"');
    for (const [prefix, n] of Object.entries(pad)) {
      assert.ok(bar.includes(`${prefix}-top-${n}`), `${prefix}-top-${n} (a sticky top is measured from the box's padding edge): ${bar.join(' ')}`);
      assert.ok(bar.includes(`${prefix}-mt-${n}`), `${prefix}-mt-${n} pulls the bar up over the padding: ${bar.join(' ')}`);
      assert.ok(bar.includes(`${prefix}pt-${n}`), `${prefix}pt-${n} puts the padding back inside the bar: ${bar.join(' ')}`);
    }
  });

  it('is not top-0, which stuck the bar one padding too low with the résumé showing above it', () => {
    const bar = tokensAround('data-testid="stage-toolbar"');
    assert.ok(bar.includes('sticky'));
    assert.ok(!bar.includes('top-0'), bar.join(' '));
    assert.ok(!bar.some((t) => /^(sm:)?top-\d/.test(t)), `no positive top offset: ${bar.join(' ')}`);
  });
});
