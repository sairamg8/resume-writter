// Design → Template: clicking the card already selected changes nothing (R2-087). It ran the whole
// template switch — the store's setTemplate always merges the template's heading style and title
// case — so a résumé set to Boxed headings in "Abc" went back to the template's own style, with no
// undo, from a click on the card that was already highlighted.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** `r` after the store's setTemplate(`to`), as the editor's store stores it. */
async function picked(r, to) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) {
      done = true;
      store.setTemplate(to);
    }
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes[0];
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

/** The ids setTemplate is called with when the Design panel's `label` card is clicked on a résumé on `template`. */
async function clickCard(template, label) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const calls = [];
  let tree = null;
  function Capture() {
    tree = DesignPanel({ resume: resume({ template }), updateSetting: () => {}, setTemplate: (id) => calls.push(id), resetSettings: () => {} });
    return null;
  }
  renderToString(createElement(Capture));
  // The template cards come first; a Contact icons card further down may share a name.
  const card = [...walk(tree)].find((n) => n.type === 'button' && textOf(n).startsWith(label));
  assert.ok(card, `${template}: the ${label} card`);
  card.props.onClick();
  return calls;
}

describe('clicking the template already selected changes nothing (R2-087)', () => {
  it('the repro: Classic with Boxed headings in "Abc", then Classic again — the headings stay', async () => {
    const r = { ...resume({ template: 'classic', settings: { headingStyle: 'box', sectionTitleCase: 'normal' } }), updatedAt: 5 };
    const after = await picked(r, 'classic');
    assert.equal(after.settings.headingStyle, 'box');
    assert.equal(after.settings.sectionTitleCase, 'normal');
    assert.deepEqual(after.settings, r.settings, 'no setting changes');
    assert.equal(after.updatedAt, 5, 'not an edit: nothing to save or sync');
  });

  it('every template: its own card is no switch in the panel, and none in the store', async () => {
    const { templateLabel } = await loadModule('/src/constants/templates.js');
    const wrong = [];
    for (const template of TEMPLATES) {
      const calls = await clickCard(template, templateLabel(template));
      if (calls.length) wrong.push(`${template}: the panel called setTemplate(${calls})`);
      const r = { ...resume({ template, settings: { headingStyle: 'leftbar', sectionTitleCase: 'normal', fontSizeBase: 13 } }), updatedAt: 5 };
      const after = await picked(r, template);
      if (JSON.stringify([after.settings, after.sections]) !== JSON.stringify([r.settings, r.sections])) wrong.push(`${template}: the store changed the résumé`);
      if (after.updatedAt !== 5) wrong.push(`${template}: the store stamped an edit`);
    }
    assert.deepEqual(wrong, []);
  });

  it('another template\'s card still switches, bringing its style (guard)', async () => {
    assert.deepEqual(await clickCard('classic', 'Modern'), ['modern']);
    const r = resume({ template: 'classic', settings: { headingStyle: 'box', sectionTitleCase: 'normal' } });
    const after = await picked(r, 'minimal');
    assert.equal(after.template, 'minimal');
    assert.equal(after.settings.headingStyle, 'underline', 'Minimal\'s own heading style');
  });
});
