// R4-DSN-07: "Browse templates (N)" in the Design panel and the gallery's title count the same cards.
// The button left out the designs the user saved while the gallery, which lists them, counted them: two
// saved designs read "Browse templates (27)" over "Templates (29)".
// Run: node --test tests/unit/r4dsn-gallery-count.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { kitLoader, patchFakeDom, mount, byAttr } from './ui-dom-harness.mjs';

let kit;
let TemplateGallery;
let DesignPanel;
let ToastProvider;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TemplateGallery } = await kit.load('/src/components/TemplateGallery.jsx'));
  ({ default: DesignPanel } = await kit.load('/src/components/DesignPanel.jsx'));
  ({ ToastProvider } = await kit.load('/src/components/ui/Toast.jsx'));
});
after(() => kit?.close());

const cv = { id: 'resume_a', name: 'A', template: 'classic', settings: { accentColor: '#9f1239' }, personal: { name: 'Robin Sample' }, sections: [], coverLetter: {} };
const MINE = [
  { id: 'design_1', label: 'Violet', engine: 'executive', settings: { accentColor: '#6d28d9' } },
  { id: 'design_2', label: 'Teal', engine: 'minimal', settings: { accentColor: '#0e7490' } },
];
const noop = () => {};
const store = { setTemplate: noop, updateSetting: noop, applyDesign: noop, restoreDesign: noop };

describe('the Browse templates button and the gallery count the same cards (R4-DSN-07)', () => {
  it('with two saved designs, both say the same number', async () => {
    const panel = mount(() => h(ToastProvider, null, h(DesignPanel, { resume: cv, designs: MINE, resetSettings: noop, onBrowseTemplates: noop, saveDesign: noop, deleteDesign: noop, ...store })), {});
    let onButton;
    try {
      const button = byAttr(panel.container, 'data-testid', 'browse-templates')[0];
      onButton = Number(button.textContent.match(/Browse templates \((\d+)\)/)[1]);
    } finally { await panel.unmount(); }
    const gallery = mount(() => h(ToastProvider, null, h(TemplateGallery, { open: true, onClose: noop, resume: cv, designs: MINE, ...store })), {});
    try {
      const onTitle = Number(gallery.document.body.textContent.match(/Templates \((\d+)\)/)[1]);
      assert.equal(onButton, onTitle);
    } finally { await gallery.unmount(); }
  });
});
