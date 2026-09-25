// Design → Template's cards (R2-139): built from the data, never listed by hand, so a template the table
// gains — another session is adding engines — is a card, in its category, with no picker change. A9: the
// Sidebar's single column, the ATS-safe page it prints as Classic's, is a card of its own beside the two
// columns (it was a toggle that showed only once the Sidebar was picked). B3 and A3: every card has a
// category and the traits the gallery filters on (ATS-safe, one or two columns, colour header, serif).
// A12: whether Template is open can be kept by the editor, so a collapsed Template stays collapsed when
// the panel is mounted again (a tab change unmounts it).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, loadModule, TEMPLATES } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** The Design panel over the fake DOM with spies: `calls` records every store call; `click(testid)`. */
async function panel(template, settings = {}, extra = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const calls = [];
  const props = {
    resume: resume({ template, settings }),
    updateSetting: (...a) => calls.push(['updateSetting', ...a]),
    setTemplate: (...a) => calls.push(['setTemplate', ...a]),
    resetSettings: noop,
    ...extra,
  };
  const view = mount(DesignPanel, props);
  const byTestid = (id) => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === id);
  return {
    view, calls, byTestid,
    click: (id) => view.act(() => reactProps(byTestid(id)).onClick()),
    selected: (id) => /border-blue-500/.test(byTestid(id).className),
  };
}

describe('the cards come from the data (R2-139)', () => {
  it('every template and every design is a card; the picker module names none of them', async () => {
    const { TEMPLATE_IDS } = await loadModule('/src/constants/templates.js');
    const { PRESET_IDS } = await loadModule('/src/constants/templatePresets.js');
    const html = renderToString(createElement((await loadModule('/src/components/DesignPanel.jsx')).default,
      { resume: resume({ template: 'classic' }), updateSetting: noop, setTemplate: noop, resetSettings: noop }));
    for (const id of TEMPLATE_IDS) assert.match(html, new RegExp(`data-testid="template-${id}"`), id);
    for (const id of PRESET_IDS) assert.match(html, new RegExp(`data-testid="preset-${id}"`), id);
    // Listed by hand, a template added to the table would be missing from the picker.
    // (The category chips' own ids — 'modern', 'compact' — are categories, not templates: left out.)
    const file = fs.readFileSync(new URL('../../src/utils/templatePicker.js', import.meta.url), 'utf8');
    const source = file.replace(/export const PICKER_CATEGORIES = \[[\s\S]*?\];/, '');
    assert.notEqual(source, file, 'the categories were found and left out');
    for (const id of [...TEMPLATE_IDS, ...PRESET_IDS]) assert.doesNotMatch(source, new RegExp(`['"\`]${id}['"\`]`), `templatePicker.js names ${id}`);
  });

  it('each card is in its template\'s category (Simple where the table names none), and offers the traits the filters read', async () => {
    const { pickerCards, PICKER_CATEGORIES } = await loadModule('/src/utils/templatePicker.js');
    const { TEMPLATES: TABLE } = await loadModule('/src/constants/templateTable.js');
    const cards = pickerCards({});
    const known = new Set(PICKER_CATEGORIES.map((c) => c.id));
    for (const id of TEMPLATES) {
      const c = cards.find((x) => x.testid === `template-${id}`);
      assert.equal(c.category, TABLE[id].category || 'simple', id);
      assert.ok(known.has(c.category), `${id}: ${c.category} is a category the gallery offers`);
      for (const k of ['ats', 'colourHeader', 'serif']) assert.equal(typeof c[k], 'boolean', `${id}.${k}`);
      assert.ok([1, 2].includes(c.columns), `${id}.columns`);
    }
    for (const c of cards.filter((x) => x.preset)) assert.ok(known.has(c.category), c.testid);
  });

  it('a category with no card offers no chip; one the table names that the gallery does not know gets one', async () => {
    const { categoriesOf } = await loadModule('/src/utils/templatePicker.js');
    const ids = (cards) => categoriesOf(cards).map((c) => c.id);
    assert.deepEqual(ids([{ category: 'modern' }, { category: 'simple' }]), ['simple', 'modern']);
    assert.deepEqual(ids([{ category: 'simple' }, { category: 'photo' }, { category: 'mine' }]), ['simple', 'photo', 'mine']);
    assert.equal(categoriesOf([{ category: 'photo' }])[0].label, 'Photo');
  });
});

describe('the gallery\'s filters and categories (A3, B3)', () => {
  it('Two columns is the Sidebar alone; ATS-safe with it is nothing; the single column is ATS-safe and one column', async () => {
    const { pickerCards, filterCards } = await loadModule('/src/utils/templatePicker.js');
    const cards = pickerCards({});
    const ids = (q) => filterCards(cards, q).map((c) => c.testid);
    assert.deepEqual(ids({ filters: ['two'] }), ['template-sidebar']);
    assert.deepEqual(ids({ filters: ['two', 'ats'] }), []);
    assert.ok(ids({ filters: ['ats', 'one'] }).includes('template-sidebar-single'));
    assert.ok(!ids({ filters: ['ats'] }).includes('template-sidebar'));
  });

  it('Colour header is the banner and side-column pages; Serif the looks printed in a serif face', async () => {
    const { pickerCards, filterCards } = await loadModule('/src/utils/templatePicker.js');
    const cards = pickerCards({ font: 'notosans' });
    const ids = (q) => filterCards(cards, q).map((c) => c.testid);
    for (const id of ['template-modern', 'template-banner', 'template-sidebar', 'preset-midnight', 'preset-sunrise']) assert.ok(ids({ filters: ['colour'] }).includes(id), id);
    assert.ok(!ids({ filters: ['colour'] }).includes('template-classic'));
    assert.ok(!ids({ filters: ['colour'] }).includes('template-sidebar-single'), 'the single column prints Classic\'s white page');
    for (const id of ['template-academic', 'preset-ledger', 'preset-crimson']) assert.ok(ids({ filters: ['serif'] }).includes(id), id);
    assert.ok(!ids({ filters: ['serif'] }).includes('template-classic'));
  });

  it('a category lists its templates and the designs over them; none is every card', async () => {
    const { pickerCards, filterCards } = await loadModule('/src/utils/templatePicker.js');
    const cards = pickerCards({});
    assert.deepEqual(filterCards(cards, { category: 'compact' }).map((c) => c.testid), ['template-compact', 'preset-inkwell']);
    assert.equal(filterCards(cards, {}).length, cards.length);
  });
});

describe('the Sidebar\'s single column is a card of its own (A9)', () => {
  it('on Classic: its card switches to the Sidebar and sets the single column; it carries the ATS badge', async () => {
    const p = await panel('classic');
    try {
      assert.match(p.byTestid('template-sidebar-single').textContent, /Sidebar · Single column/);
      assert.match(p.byTestid('template-sidebar-single').textContent, /ATS/);
      assert.doesNotMatch(p.byTestid('template-sidebar').textContent, /ATS/);
      p.click('template-sidebar-single');
      assert.deepEqual(p.calls, [['setTemplate', 'sidebar'], ['updateSetting', 'sidebarSingleColumn', true]]);
    } finally { await p.view.unmount(); }
  });

  it('on Classic with the single column kept from before: the Sidebar card sets the two columns it names', async () => {
    const p = await panel('classic', { sidebarSingleColumn: true });
    try {
      p.click('template-sidebar');
      assert.deepEqual(p.calls, [['setTemplate', 'sidebar'], ['updateSetting', 'sidebarSingleColumn', false]]);
    } finally { await p.view.unmount(); }
  });

  it('on the Sidebar: the card of the Layout it prints is the one selected, and the other sets its Layout alone', async () => {
    const two = await panel('sidebar', { sidebarSingleColumn: false });
    try {
      assert.equal(two.selected('template-sidebar'), true);
      assert.equal(two.selected('template-sidebar-single'), false);
      two.click('template-sidebar');
      assert.deepEqual(two.calls, [], 'the card it is on: no switch');
      two.click('template-sidebar-single');
      assert.deepEqual(two.calls, [['updateSetting', 'sidebarSingleColumn', true]]);
    } finally { await two.view.unmount(); }
    const one = await panel('sidebar', { sidebarSingleColumn: true });
    try {
      assert.equal(one.selected('template-sidebar-single'), true);
      assert.equal(one.selected('template-sidebar'), false);
      one.click('template-sidebar');
      assert.deepEqual(one.calls, [['updateSetting', 'sidebarSingleColumn', false]]);
    } finally { await one.view.unmount(); }
  });
});

describe('Template\'s open state can be kept by the editor (A12)', () => {
  it('kept collapsed, the panel mounts with Template collapsed; its header asks to open it', async () => {
    const asks = [];
    const p = await panel('classic', {}, { templateOpen: false, onTemplateOpenChange: (v) => asks.push(v) });
    try {
      assert.equal(p.byTestid('template-classic'), undefined, 'no cards: collapsed');
      const header = [...elements(p.view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Template');
      p.view.act(() => reactProps(header).onClick());
      assert.deepEqual(asks, [true]);
    } finally { await p.view.unmount(); }
  });

  it('kept open, the header asks to collapse it; with nothing kept it opens as before', async () => {
    const asks = [];
    const p = await panel('classic', {}, { templateOpen: true, onTemplateOpenChange: (v) => asks.push(v) });
    try {
      assert.ok(p.byTestid('template-classic'));
      const header = [...elements(p.view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Template');
      p.view.act(() => reactProps(header).onClick());
      assert.deepEqual(asks, [false]);
    } finally { await p.view.unmount(); }
    const plain = await panel('classic');
    try { assert.ok(plain.byTestid('template-classic')); } finally { await plain.view.unmount(); }
  });
});
