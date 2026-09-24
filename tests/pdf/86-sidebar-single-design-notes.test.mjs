// Sidebar "Single · ATS-safe": the Design panel describes the page it prints (R2-082, R2-096, R2-120).
// That Layout prints Classic's page — no side column, and contact icons only with Contact style Icon —
// but Typography and Section Headings still explained what "the side column" keeps, and the Contact
// icons hint said "The Sidebar template always shows them" over a résumé printing none (Contact style
// Bar). The panel read the template (templateId), not the page it prints (headerTemplateId). The
// Colors half (Header Text Color, Sidebar Background) was fixed in 0b5f6e2 and is guarded here.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** Every element of a React tree, outermost first, calling each component so closed sections are walked too. */
function* walk(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
  if (!node || typeof node !== 'object' || !node.props) return;
  yield node;
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

/** The Design panel's text, its closed sections included, for a Sidebar résumé with `settings`. */
async function panelText(settings) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  let text = '';
  function Capture() {
    const tree = DesignPanel({ resume: resume({ template: 'sidebar', settings }), updateSetting: noop, setTemplate: noop, resetSettings: noop });
    // Walked inside the render pass: the section components' hooks need one.
    text = [...walk(tree)].map(textOf).join('\n');
    return null;
  }
  renderToString(createElement(Capture));
  return text;
}

const SIDE_TYPE = /side column&apos;s sections keep|side column's sections keep/;
const SIDE_HEADINGS = /The side column keeps its own small headings/;
const ALWAYS = /Sidebar template always shows them/;

describe('Sidebar Single · ATS-safe: the Design panel\'s notes describe the page it prints (R2-082, R2-096, R2-120)', () => {
  it('Typography and Section Headings say nothing of a side column the page does not print', async () => {
    const text = await panelText({ sidebarSingleColumn: true });
    assert.doesNotMatch(text, SIDE_TYPE, 'Typography');
    assert.doesNotMatch(text, SIDE_HEADINGS, 'Section Headings');
  });

  it('Contact icons: no "always shows them" where Contact style Bar prints none', async () => {
    const settings = { sidebarSingleColumn: true, contactStyle: 'bar' };
    const text = await panelText(settings);
    assert.doesNotMatch(text, ALWAYS);
    assert.match(text, /Used by the résumé when Contact style is Icon/);
    assert.match(text, /Picking a pack switches the résumé to Icon/);
  });

  it('Contact icons with Contact style Icon: the hint says the style decides, not the template', async () => {
    const text = await panelText({ sidebarSingleColumn: true, contactStyle: 'icon' });
    assert.doesNotMatch(text, ALWAYS);
    assert.match(text, /Used by the résumé when Contact style is Icon/);
  });

  it('Colors offers no Header Text Color or Sidebar Background (0b5f6e2, guard)', async () => {
    const text = await panelText({ sidebarSingleColumn: true });
    assert.doesNotMatch(text, /Header Text Color/);
    assert.doesNotMatch(text, /Sidebar Background/);
  });

  it('Two columns keeps every note: the side column, its headings, its icons, its colours', async () => {
    const text = await panelText({ sidebarSingleColumn: false, contactStyle: 'bar' });
    assert.match(text, SIDE_TYPE);
    assert.match(text, SIDE_HEADINGS);
    assert.match(text, ALWAYS);
    assert.match(text, /Header Text Color/);
    assert.match(text, /Sidebar Background/);
  });
});
