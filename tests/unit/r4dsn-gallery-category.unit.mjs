// R4-DSN-06: the template gallery stays mounted while closed, so a category picked once stayed picked
// after its cards were gone: My designs, then every saved design deleted. It offered no chip for it any
// more, All was not pressed, and the grid was empty, saying to turn off a filter that was not on. A
// category with no cards is now All.
// Run: node --test tests/unit/r4dsn-gallery-category.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, useState } from 'react';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText } from './ui-dom-harness.mjs';

let kit;
let TemplateGallery;
let ToastProvider;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TemplateGallery } = await kit.load('/src/components/TemplateGallery.jsx'));
  ({ ToastProvider } = await kit.load('/src/components/ui/Toast.jsx'));
});
after(() => kit?.close());

const cv = { id: 'resume_a', name: 'A', template: 'classic', settings: { accentColor: '#9f1239' }, personal: { name: 'Robin Sample' }, sections: [], coverLetter: {} };
const MINE = [{ id: 'design_1', label: 'Violet', engine: 'executive', settings: { accentColor: '#6d28d9' } }];
const noop = () => {};

describe('the gallery\'s category when its cards are gone (R4-DSN-06)', () => {
  it('My designs picked, then every saved design deleted: the gallery shows All, pressed', async () => {
    let setDesigns = null;
    function Host() {
      const [designs, set] = useState(MINE);
      setDesigns = set;
      return h(ToastProvider, null, h(TemplateGallery, { open: true, onClose: noop, resume: cv, designs, setTemplate: noop, updateSetting: noop, applyDesign: noop, restoreDesign: noop }));
    }
    const view = mount(Host, {});
    try {
      const root = () => byAttr(view.document.body, 'data-testid', 'template-gallery')[0];
      const cards = () => [...byAttr(root(), 'data-testid')].map((el) => el.getAttribute('data-testid')).filter((id) => id.startsWith('gallery-'));
      view.act(() => reactProps(byText(root(), 'My designs')).onClick(ev()));
      assert.deepEqual(cards(), ['gallery-design-design_1']);
      view.act(() => setDesigns([]));
      assert.ok(cards().includes('gallery-template-classic'), 'every card is shown again');
      assert.doesNotMatch(root().textContent, /No template has all of these/);
      const all = byText(byAttr(root(), 'data-testid', 'template-gallery-categories')[0], 'All');
      assert.equal(all.getAttribute('aria-pressed'), 'true', 'All is the chip pressed');
      view.act(() => setDesigns(MINE));
      assert.ok(cards().includes('gallery-template-classic'), 'a design saved later: still All, not My designs again');
    } finally { await view.unmount(); }
  });
});
