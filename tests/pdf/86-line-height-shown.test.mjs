// Design → Spacing → Line Height shows the line height the PDF prints (R2-083). The row rounded its
// box to one decimal, so after the Smart Page Fit presets it read 1.4 over a page laid out at 1.35
// (1-Page Fit) and 1.6 over 1.65 (Spacious); Academic's own 1.35 read 1.4 too.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

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

/** The Design panel's tree for `r`, and the settings its clicks write. */
async function panel(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = {};
  let tree = null;
  function Capture() {
    tree = DesignPanel({ resume: r, updateSetting: (k, v) => { writes[k] = v; }, setTemplate: () => {}, resetSettings: () => {} });
    return null;
  }
  renderToString(createElement(Capture));
  return { tree, writes };
}

/** The number Line Height's box shows on `r`. */
async function shownLineHeight(r) {
  const { tree } = await panel(r);
  const row = [...walk(tree)].find((n) => n.props?.label === 'Line Height');
  assert.ok(row, 'the Line Height row');
  const html = renderToString(row);
  const value = /<input[^>]*value="([^"]*)"/.exec(html)?.[1];
  assert.ok(value, `Line Height's box in ${html}`);
  return Number(value);
}

/** The line height the PDF of `r` is laid out with. */
async function printedLineHeight(r) {
  const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
  const { templateId } = await loadModule('/src/constants/templates.js');
  return resolveTemplateSettings(r.settings, templateId(r.template)).lineHeightValue;
}

describe('Line Height shows what the PDF prints (R2-083)', () => {
  for (const preset of ['1-Page Fit', 'Balanced', 'Spacious']) {
    it(`after the ${preset} preset`, async () => {
      const r = resume();
      const { tree, writes } = await panel(r);
      const button = [...walk(tree)].find((n) => n.type === 'button' && textOf(n).includes(preset));
      assert.ok(button, `the ${preset} button`);
      button.props.onClick();
      const after = { ...r, settings: { ...r.settings, ...writes } };
      assert.equal(await shownLineHeight(after), await printedLineHeight(after));
    });
  }

  it('every template\'s own line height, unset and stored', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const lineHeightValue of [undefined, 1.15, 1.35, 1.65, 1.8000000000000003]) {
        const r = resume({ template });
        if (lineHeightValue !== undefined) r.settings.lineHeightValue = lineHeightValue;
        const shown = await shownLineHeight(r);
        const printed = await printedLineHeight(r);
        if (Math.abs(shown - printed) > 1e-9) wrong.push(`${template} ${lineHeightValue}: shows ${shown}, prints ${printed}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
});
