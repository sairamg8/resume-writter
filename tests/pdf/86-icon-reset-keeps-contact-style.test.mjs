// Design → Contact icons ↺ resets the icon pack and size, and leaves Header Customization's Contact
// Style alone (R2-090). Its keys held `contactStyle`, so on Classic with Contact Style Bar (or Bullet)
// the ↺ switched the header to Icon: the résumé drew icons it had been set not to.
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

/** The settings the Design panel writes when `title`'s ↺ is clicked on `r`. */
async function resetOf(r, title) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = {};
  let tree = null;
  function Capture() {
    tree = DesignPanel({ resume: r, updateSetting: (k, v) => { writes[k] = v; }, setTemplate: () => {}, resetSettings: () => {} });
    return null;
  }
  renderToString(createElement(Capture));
  const box = [...walk(tree)].find((n) => n.props?.title === title && n.props?.onReset);
  assert.ok(box, `the ${title} section`);
  box.props.onReset();
  return writes;
}

describe('Contact icons ↺ keeps the Contact Style (R2-090)', () => {
  it('the repro: Classic with Contact Style Bar — still Bar, the pack and size reset', async () => {
    const r = resume({ settings: { contactStyle: 'bar', iconSet: 'outline', iconSize: 15 } });
    const writes = await resetOf(r, 'Contact icons');
    assert.equal(writes.contactStyle, undefined, 'the ↺ writes no Contact Style');
    assert.equal({ ...r.settings, ...writes }.contactStyle, 'bar');
    assert.ok('iconSize' in writes, 'Icon size is reset');
    assert.ok('iconSet' in writes, 'the pack is reset');
  });

  it('every template, Bar and Bullet: the Contact Style stays', async () => {
    const changed = [];
    for (const template of TEMPLATES) {
      for (const contactStyle of ['bar', 'bullet']) {
        const writes = await resetOf(resume({ template, settings: { contactStyle } }), 'Contact icons');
        if ('contactStyle' in writes) changed.push(`${template} ${contactStyle} → ${writes.contactStyle}`);
      }
    }
    assert.deepEqual(changed, []);
  });
});
