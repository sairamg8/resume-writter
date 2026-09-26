// Design → Section Headings: the rule each heading style draws, and the unit its thickness is in.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, render, loadModule, TEMPLATES } from './harness.mjs';
import { painted, drawing } from './extractors.mjs';

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
  let nodes = null;
  function Capture() {
    const tree = DesignPanel({ resume: resume({ template, settings }), updateSetting: noop, setTemplate: noop, resetSettings: noop });
    nodes = [...walk(tree)];   // walked inside the render pass: walk() calls child components, whose hooks need one
    return null;
  }
  renderToString(createElement(Capture));
  return nodes;
}

/** Every element of a React tree, outermost first. */
function* walk(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
  if (!node || typeof node !== 'object' || !node.props) return;
  yield node;
  // A block split into its own component (DesignPanelHeadings, DesignPanelColors, …) is an element
  // whose children do not exist until it is called — call it, as DesignPanel itself is called above.
  if (typeof node.type === 'function') {
    try { yield* walk(node.type(node.props)); } catch { /* a component this walk cannot render: its own elements still counted */ }
  }
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

/** Widths of page 1's BORDER fills, in pt: what a Left bar heading's bar prints. */
const fillWidths = async (bytes) => [...new Set((await painted(bytes))
  .filter((p) => p.paint === 'fill' && p.colour === BORDER)
  .map((p) => Math.round((p.x1 - p.x0) * 100) / 100))];

/** Design → Section Headings' elements for `settings`, and every value its Border thickness row stores. */
async function headingControls(settings, template = 'classic') {
  const { HeadingControls } = await loadModule('/src/components/DesignPanelHeadings.jsx');
  const stored = [];
  const updateSetting = (key, value) => { if (key === 'sectionBorderWidth') stored.push(value); };
  // Walked inside a render pass: the thickness box is typed with a hook (R4-LO-19).
  let nodes = [];
  let rowNodes = [];
  function Capture() {
    nodes = [...walk(HeadingControls({ settings, template, updateSetting }))];
    rowNodes = [...walk(nodes.find((n) => textOf(n).startsWith('Border thickness')))];
    return null;
  }
  renderToString(createElement(Capture));
  return {
    text: nodes.map(textOf).join('\n'),
    input: rowNodes.find((n) => n.type === 'input'),
    button: (label) => rowNodes.find((n) => n.type === 'button' && textOf(n) === label),
    stored,
  };
}

describe('Left bar: Border thickness says the width the bar prints (ONB-12)', () => {
  // The bar is 2 pt wider than the stored thickness (a 1 pt bar beside bold capitals is a hairline),
  // so a panel showing the stored "1 pt" printed a 3 pt bar and "8 pt" a 10 pt one. The print is
  // kept — every saved Left bar résumé looks as it did — and the panel says, and sets, what it prints.
  for (const template of TEMPLATES) {
    it(`${template}: a stored unset, 1, 2, 4 or 8 prints a 3, 3, 4, 6 or 10 pt bar, as it always has`, async () => {
      for (const [width, pt] of [[undefined, 3], [1, 3], [2, 4], [4, 6], [8, 10]]) {
        assert.deepEqual(await fillWidths(await ruled(template, 'leftbar', width)), [pt], `${template} left bar ${width}`);
      }
    });
  }

  it('the stepper shows the bar\'s printed width in pt, measured off the PDF, from 3 to 10', async () => {
    for (const width of [undefined, 1, 2, 4, 8]) {
      const [printed] = await fillWidths(await ruled('classic', 'leftbar', width));
      const { input } = await headingControls({ headingStyle: 'leftbar', sectionBorderWidth: width });
      assert.equal(input.props.value, String(printed), `stored ${width}: the box says what the PDF prints`);
      assert.equal(input.props.min, 3, 'the thinnest bar is 3 pt');
      assert.equal(input.props.max, 10, 'the thickest bar is 10 pt');
    }
  });

  it('a Left bar width typed or stepped prints at that width: it stores 2 pt less, within 1–8', async () => {
    const at = async (sectionBorderWidth) => headingControls({ headingStyle: 'leftbar', sectionBorderWidth });
    for (const [typed, stores] of [['6', 4], ['3', 1], ['10', 8], ['2', 1], ['1', 1], ['99', 8]]) {
      const c = await at(4);
      // Typed, then written on leaving the box (R4-LO-19: not on every keystroke).
      c.input.props.onBlur({ target: { value: typed } });
      assert.deepEqual(c.stored, [stores], `typed ${typed}`);
      const [printed] = await fillWidths(await ruled('classic', 'leftbar', stores));
      assert.equal(printed, Math.min(10, Math.max(3, Number(typed))), `typed ${typed} prints that width, within 3–10`);
    }
    const thinnest = await at(1);
    thinnest.button('−').props.onClick();
    thinnest.button('+').props.onClick();
    assert.deepEqual(thinnest.stored, [1, 2], 'at 3 pt, − stays at 3 pt and + gives 4 pt');
    const thickest = await at(8);
    thickest.button('+').props.onClick();
    thickest.button('−').props.onClick();
    assert.deepEqual(thickest.stored, [8, 7], 'at 10 pt, + stays at 10 pt and − gives 9 pt');
  });

  it('says why a Left bar starts at 3 pt, and only under Left bar', async () => {
    assert.match((await headingControls({ headingStyle: 'leftbar' })).text, /left bar is 2 pt wider/i);
    for (const headingStyle of ['ruled', 'line', 'underline', undefined]) {
      assert.doesNotMatch((await headingControls({ headingStyle })).text, /left bar is 2 pt wider/i, `${headingStyle}`);
    }
  });

  it('the other styles still show and store Border thickness as the pt their rule prints', async () => {
    for (const headingStyle of ['ruled', 'line', 'underline']) {
      for (const width of [undefined, 1, 4, 8]) {
        const { input } = await headingControls({ headingStyle, sectionBorderWidth: width });
        assert.equal(input.props.value, String(width ?? 1), `${headingStyle} ${width}`);
        assert.deepEqual([input.props.min, input.props.max], [1, 8], `${headingStyle} range`);
      }
      const c = await headingControls({ headingStyle, sectionBorderWidth: 4 });
      c.input.props.onBlur({ target: { value: '6' } });
      c.button('−').props.onClick();
      c.button('+').props.onClick();
      assert.deepEqual(c.stored, [6, 3, 5], `${headingStyle}: typed 6, − and + from 4`);
    }
    // With nothing stored the panel marks, and the PDF prints, the template's own style (R5-3).
    const { input } = await headingControls({}, 'sidebar');
    assert.equal(input.props.value, '1', 'Sidebar with no stored style prints plain headings');
  });
});

describe('inert controls under Boxed and Plain (ONB-13)', () => {
  it('box and plain: sectionBorderWidth 1 vs 8 produce identical drawings; ruled differs', async () => {
    assert.equal(
      await drawing(await ruled('classic', 'box', 1)),
      await drawing(await ruled('classic', 'box', 8)),
      'box: thickness 1 and 8 are identical',
    );
    assert.equal(
      await drawing(await ruled('classic', 'plain', 1)),
      await drawing(await ruled('classic', 'plain', 8)),
      'plain: thickness 1 and 8 are identical',
    );
    assert.notEqual(
      await drawing(await ruled('classic', 'ruled', 1)),
      await drawing(await ruled('classic', 'ruled', 8)),
      'ruled: thickness 1 and 8 differ',
    );
  });

  it('disables inert controls and shows hints under Boxed and Plain', async () => {
    // Boxed: thickness disabled, hint shown
    const boxed = await headingControls({ headingStyle: 'box' });
    assert.equal(boxed.input.props.disabled, true, 'boxed: thickness input disabled');
    assert.equal(boxed.button('−').props.disabled, true, 'boxed: minus button disabled');
    assert.equal(boxed.button('+').props.disabled, true, 'boxed: plus button disabled');
    assert.match(boxed.text, /Boxed has no border line/i, 'boxed hint');

    // Plain: thickness and color disabled, hint shown
    const plain = await headingControls({ headingStyle: 'plain' });
    assert.equal(plain.input.props.disabled, true, 'plain: thickness input disabled');
    assert.equal(plain.button('−').props.disabled, true, 'plain: minus button disabled');
    assert.equal(plain.button('+').props.disabled, true, 'plain: plus button disabled');
    assert.match(plain.text, /Plain has no border/i, 'plain hint');

    // Ruled: enabled, no inert hint
    const ruledControls = await headingControls({ headingStyle: 'ruled' });
    assert.equal(ruledControls.input.props.disabled, false, 'ruled: thickness input enabled');
    assert.equal(ruledControls.button('−').props.disabled, false, 'ruled: minus button enabled');
    assert.equal(ruledControls.button('+').props.disabled, false, 'ruled: plus button enabled');
    assert.doesNotMatch(ruledControls.text, /no border/i, 'ruled: no inert hint');
  });
});

