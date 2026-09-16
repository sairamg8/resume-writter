// Design → Section Headings: the rule each heading style draws, and the unit its thickness is in.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, loadModule, TEMPLATES } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

// A Border colour no template swaps for one of its own greys, so the rule is easy to pick out.
// tint() keeps a colour's RGB and only adds alpha, so a tinted rule still paints in this red.
const BORDER = '#e11d48';

/** A résumé whose headings draw their rule in BORDER at `sectionBorderWidth`. */
const ruled = (template, headingStyle, sectionBorderWidth) => render(resume({
  template,
  settings: { headingStyle, sectionBorderWidth, sectionBorderColor: BORDER },
  sections: [experience([{ description: '<p>Built things.</p>' }])],
}));

/** Heights of page 1's BORDER fills, in pt: what a Ruled or Line-after heading prints. */
const fillHeights = async (bytes) => [...new Set((await painted(bytes))
  .filter((p) => p.paint === 'fill' && p.colour === BORDER)
  .map((p) => Math.round((p.y1 - p.y0) * 100) / 100))];

/** Widths of page 1's BORDER strokes, in pt: what an Underline heading prints. */
const strokeWidths = async (bytes) => [...new Set((await painted(bytes))
  .filter((p) => p.paint === 'stroke' && p.colour === BORDER)
  .map((p) => p.width))];

describe('section heading rule thickness (VM3-3 / R3-7)', () => {
  // A guard on the print: the label is the bug, the PDF is untouched, so every saved value keeps
  // the look it always had. It is what "pt" in the panel now claims, measured.
  for (const template of TEMPLATES) {
    it(`${template}: a stored 1, 2, 4 or 8 prints a heading rule that many pt thick`, async () => {
      for (const width of [1, 2, 4, 8]) {
        assert.deepEqual(await fillHeights(await ruled(template, 'ruled', width)), [width], `${template} ruled ${width}`);
        assert.deepEqual(await fillHeights(await ruled(template, 'line', width)), [width], `${template} line after ${width}`);
        assert.deepEqual(await strokeWidths(await ruled(template, 'underline', width)), [width], `${template} underline ${width}`);
      }
      assert.deepEqual(await fillHeights(await ruled(template, 'ruled', undefined)), [1], `${template}: an unset thickness is 1 pt`);
    });
  }
});

const noop = () => {};

/**
 * The Design panel's elements, the sections that only open on a click included: a component
 * called during another's render builds its whole tree — renderToString prints the open sections
 * only, and Section Headings starts closed.
 */
async function designPanel(template = 'classic', settings = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  let tree = null;
  function Capture() {
    tree = DesignPanel({ resume: resume({ template, settings }), updateSetting: noop, setTemplate: noop, resetSettings: noop });
    return null;
  }
  renderToString(createElement(Capture));
  return [...walk(tree)];
}

/** Every element of a React tree, outermost first. */
function* walk(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
  if (!node || typeof node !== 'object' || !node.props) return;
  yield node;
  yield* walk(node.props.children);
}

/** What a React tree shows as text. */
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object') return node.props ? textOf(node.props.children) : '';
  return String(node);
}

describe('Design → Section Headings names its units (VM3-3)', () => {
  // Border thickness showed "px" for a value the PDF prints as points, so an "8 px" rule came out
  // 10.7 px and a "1 px" one 1.33 px — the header rule's Thickness said the same before R3-7.
  it('Border thickness is measured in pt, and the box and its input both say pt', async () => {
    const nodes = await designPanel();
    const row = nodes.find((n) => textOf(n).startsWith('Border thickness'));
    assert.ok(row, 'the Border thickness row');
    assert.match(textOf(row), /pt$/, `the unit next to the stepper: ${textOf(row)}`);
    assert.doesNotMatch(textOf(row), /px/, `no px: ${textOf(row)}`);
    const input = nodes.find((n) => n.props['aria-label']?.startsWith('Section border thickness'));
    assert.equal(input?.props['aria-label'], 'Section border thickness (pt)');
  });

  // Spacing's two steppers really are CSS px: resolveTemplateSettings converts them (CSS_PX_TO_PT).
  it('Spacing still says px for Between Sections and Between Items, which are converted', async () => {
    const nodes = await designPanel();
    for (const label of ['Between Sections', 'Between Items']) {
      const row = nodes.find((n) => n.props.label === label);
      assert.equal(row?.props.unit, 'px', label);
    }
  });
});
