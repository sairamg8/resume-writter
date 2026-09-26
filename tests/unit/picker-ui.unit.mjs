// Design → Template's gallery and Undo (R2-139), mounted with react-dom/client over fake-dom (the kit's
// harness adds focus and selectors). A2: "Browse templates" opens every card as a picture of its page
// (A1) with its letterhead (F1); B3 and A3: category and filter chips narrow them; a pick applies at
// once, Done closes. E1: on a phone it is a full-screen sheet, two cards to a row, Done in its footer.
// A4: a pick, in the panel or the gallery, raises a notice whose Undo puts back the look the résumé had.
// Run: node --test tests/unit/picker-ui.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, byText, wait } from './ui-dom-harness.mjs';

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

const cv = (template = 'classic', settings = {}) => ({
  id: 'resume_a', name: 'A', template, settings: { accentColor: '#9f1239', ...settings },
  personal: { name: 'Robin Sample' }, sections: [{ id: 'sec_skills', type: 'skills', title: 'Skills', items: [], settings: { columns: 1 } }], coverLetter: {},
});

/** Store calls recorded as [name, ...args]. */
function spies() {
  const calls = [];
  const spy = (name) => (...a) => calls.push([name, ...a]);
  return {
    calls,
    props: { setTemplate: spy('setTemplate'), updateSetting: spy('updateSetting'), applyDesign: spy('applyDesign'), restoreDesign: spy('restoreDesign') },
  };
}

/** The gallery, open, over `resume`; `cards()` the test ids shown, `chip(text)` clicks a chip. */
function gallery(resume = cv(), designs = []) {
  const { calls, props } = spies();
  let closed = 0;
  const view = mount(() => h(ToastProvider, null, h(TemplateGallery, { open: true, onClose: () => { closed += 1; }, resume, designs, ...props })), {});
  const root = () => byAttr(view.document.body, 'data-testid', 'template-gallery')[0];
  const cards = () => [...byAttr(root(), 'data-testid')].map((el) => el.getAttribute('data-testid')).filter((id) => id.startsWith('gallery-')).map((id) => id.slice(8));
  const click = (el) => view.act(() => reactProps(el).onClick(ev()));
  const chip = (text) => click(byText(root(), text));
  return { view, calls, cards, chip, click, root, closed: () => closed };
}

describe('the template gallery (A2, A1, F1)', () => {
  it('shows every card — templates, the single column, designs — each with its page and its letterhead', async () => {
    const g = gallery();
    try {
      const shown = g.cards();
      for (const id of ['template-classic', 'template-sidebar', 'template-sidebar-single', 'template-compact', 'preset-harbor', 'preset-inkwell']) assert.ok(shown.includes(id), id);
      const card = byAttr(g.root(), 'data-testid', 'gallery-template-modern')[0];
      assert.equal(byAttr(card, 'data-look-thumb', 'page').length, 1, 'its page');
      assert.equal(byAttr(card, 'data-look-thumb', 'letter').length, 1, 'its letterhead');
      assert.match(byAttr(g.root(), 'data-testid', 'gallery-template-classic')[0].textContent, /Selected/, 'the one the résumé is on');
    } finally { await g.view.unmount(); }
  });

  it('a pick applies at once and Done closes it', async () => {
    const g = gallery();
    try {
      g.click(byAttr(g.root(), 'data-testid', 'gallery-preset-nordic')[0]);
      assert.deepEqual(g.calls, [['setTemplate', 'minimal', 'nordic']]);
      g.click(byAttr(g.view.document.body, 'data-testid', 'gallery-done')[0]);
      assert.equal(g.closed(), 1);
    } finally { await g.view.unmount(); }
  });
});

describe('its categories and filters (B3, A3)', () => {
  it('a category chip shows its cards alone; All shows every one again', async () => {
    const g = gallery();
    try {
      const all = g.cards().length;
      g.chip('Compact');
      assert.deepEqual(g.cards(), ['template-compact', 'preset-inkwell']);
      g.chip('All');
      assert.equal(g.cards().length, all);
    } finally { await g.view.unmount(); }
  });

  it('filters add up: Two columns is the Sidebar; with ATS-safe, nothing — and it says so', async () => {
    const g = gallery();
    try {
      g.chip('Two columns');
      assert.deepEqual(g.cards(), ['template-sidebar']);
      g.chip('ATS-safe');
      assert.deepEqual(g.cards(), []);
      assert.match(g.root().textContent, /No template has all of these/);
      g.chip('Two columns');
      assert.ok(g.cards().includes('template-sidebar-single'));
      assert.ok(!g.cards().includes('template-sidebar'));
    } finally { await g.view.unmount(); }
  });

  it('the designs the user saved are a category of their own', async () => {
    const mine = [{ id: 'design_1', label: 'Violet', engine: 'executive', settings: { accentColor: '#6d28d9', font: 'literata' } }];
    const g = gallery(cv(), mine);
    try {
      g.chip('My designs');
      assert.deepEqual(g.cards(), ['design-design_1']);
      g.click(byAttr(g.root(), 'data-testid', 'gallery-design-design_1')[0]);
      assert.deepEqual(g.calls.map((c) => c[0]), ['applyDesign']);
      assert.equal(g.calls[0][1].id, 'design_1');
    } finally { await g.view.unmount(); }
  });
});

describe('on a phone (E1)', () => {
  it('is a full-screen sheet below the small breakpoint, two cards to a row, with Done in the footer', async () => {
    const g = gallery();
    try {
      const panel = byAttr(g.view.document.body, 'aria-modal', 'true')[0];
      assert.match(panel.className, /max-sm:h-dvh/, 'the whole screen');
      assert.match(panel.className, /max-sm:rounded-none/);
      const grid = byAttr(g.root(), 'data-testid', 'gallery-template-classic')[0].parentNode;
      assert.match(grid.className, /(^|\s)grid-cols-2(\s|$)/, 'two to a row');
      const done = byAttr(g.view.document.body, 'data-testid', 'gallery-done')[0];
      assert.ok(!g.root().contains(done), 'Done sits in the footer, outside the scrolling cards');
      assert.match(done.className, /min-h-11/, 'a finger-sized target');
    } finally { await g.view.unmount(); }
  });
});

describe('Undo a switch (A4)', () => {
  it('a card picked in the panel raises a notice; its Undo hands back the look the résumé had', async () => {
    const { calls, props } = spies();
    const resume = cv('classic', { headingStyle: 'box' });
    const view = mount(() => h(ToastProvider, null, h(DesignPanel, { resume, resetSettings: () => {}, ...props })), {});
    try {
      const card = byAttr(view.container, 'data-testid', 'template-modern')[0];
      view.act(() => reactProps(card).onClick(ev()));
      assert.deepEqual(calls, [['setTemplate', 'modern']]);
      const region = byAttr(view.document.body, 'role', 'status')[0];
      assert.match(region.textContent, /Template: Modern/);
      view.act(() => reactProps(byText(region, 'Undo')).onClick(ev()));
      const [name, snap] = calls[1];
      assert.equal(name, 'restoreDesign');
      assert.equal(snap.template, 'classic');
      assert.equal(snap.settings, resume.settings, 'its settings as they were, the same object');
      assert.deepEqual(snap.sections, [{ id: 'sec_skills', has: true, settings: { columns: 1 } }]);
      await wait(200);
      view.act(() => {});
      assert.equal(byAttr(region, 'data-toast').length, 0, 'Undo dismisses the notice');
    } finally { await view.unmount(); }
  });

  it('the card it is on already raises nothing', async () => {
    const { calls, props } = spies();
    const view = mount(() => h(ToastProvider, null, h(DesignPanel, { resume: cv(), resetSettings: () => {}, ...props })), {});
    try {
      view.act(() => reactProps(byAttr(view.container, 'data-testid', 'template-classic')[0]).onClick(ev()));
      assert.deepEqual(calls, []);
      assert.equal(byAttr(byAttr(view.document.body, 'role', 'status')[0], 'data-toast').length, 0);
    } finally { await view.unmount(); }
  });
});
