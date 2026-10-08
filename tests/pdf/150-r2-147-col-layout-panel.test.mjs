// R2-147-col — the editor's side of Design → Template → Layout on the two-column Sidebar: the real Design
// panel, mounted over the fake DOM with a spy store, offers Columns (Side column | Mixed), Details (Left |
// Right | Top; none in Mixed, whose details are on its band) and the column's Width (24–45 %), each
// showing what prints and writing the key the PDF reads — on the Sidebar's two columns only. Section
// Options offers no Grids to a section in a Mixed column (one entry to a row), the notes that speak of
// the side column or of the photo say what the layout prints, and Reset Design Settings takes the layout
// back to the default page while no section ↺ touches it. There were no controls.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const evt = (value = '') => {
  const target = { value, blur() {}, select() {} };
  return { target, currentTarget: target, key: '', stopPropagation() {}, preventDefault() {} };
};

/** The Design panel for a résumé on `template` with `settings`; `writes` records each [key, value] written. */
async function panel(template, settings = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = [];
  const view = mount(DesignPanel, { resume: resume({ template, settings }), updateSetting: (k, v) => writes.push([k, v]), setTemplate: () => {}, resetSettings: () => {} });
  const row = (id) => [...elements(view.container)].find((el) => el.getAttribute?.('data-testid') === id) || null;
  const buttons = (id) => (row(id) ? [...elements(row(id))].filter((el) => el.tagName === 'BUTTON') : []);
  return {
    writes,
    row,
    labels: (id) => buttons(id).map((b) => b.textContent.trim()),
    /** The button of row `id` reading `label`, clicked; the writes it made. */
    click(id, label) {
      const b = buttons(id).find((x) => x.textContent.trim() === label);
      assert.ok(b, `${id}: "${label}"`);
      writes.length = 0;
      view.act(() => reactProps(b).onClick(evt()));
      return [...writes];
    },
    /** The active button of row `id` (SegmentControl marks it blue). */
    active: (id) => buttons(id).find((b) => /(^|\s)bg-cv-brand(\s|$)/.test(b.getAttribute('class') || ''))?.textContent.trim(),
    /** Width's box: its text, and `type(v)` — typed and left, as a person does. */
    width() {
      const input = [...elements(row('layout-width'))].find((el) => el.tagName === 'INPUT');
      return {
        shown: reactProps(input).value,
        label: row('layout-width').textContent,
        type(v) {
          writes.length = 0;
          view.act(() => reactProps(input).onFocus(evt(v)));
          view.act(() => reactProps(input).onBlur(evt(String(v))));
          return [...writes];
        },
      };
    },
    unmount: () => view.unmount(),
  };
}

describe('Design → Template → Layout offers the Sidebar\'s columns, details and width (R2-147-col)', () => {
  it('the two columns: Columns, Details and Width, each writing the key the PDF reads', async () => {
    const p = await panel('sidebar');
    try {
      assert.deepEqual(p.labels('layout-columns'), ['Side column', 'Mixed']);
      assert.deepEqual(p.labels('layout-details'), ['Left', 'Right', 'Top']);
      assert.equal(p.active('layout-columns'), 'Side column', 'nothing stored shows Side column');
      assert.equal(p.active('layout-details'), 'Left', 'nothing stored shows Left');
      assert.equal(p.width().shown, '38%', 'nothing stored shows 38 %');
      assert.match(p.width().label, /Side column/);
      assert.deepEqual(p.click('layout-columns', 'Mixed'), [['layoutColumns', 'mixed']]);
      assert.deepEqual(p.click('layout-details', 'Right'), [['layoutDetails', 'right']]);
      assert.deepEqual(p.click('layout-details', 'Top'), [['layoutDetails', 'top']]);
      assert.deepEqual(p.click('layout-width', '+'), [['layoutSideWidth', 39]]);
      assert.deepEqual(p.click('layout-width', '−'), [['layoutSideWidth', 37]]);
      assert.deepEqual(p.width().type(99), [['layoutSideWidth', 45]], 'typed past the range: its end');
      assert.deepEqual(p.width().type(10), [['layoutSideWidth', 24]]);
      assert.deepEqual(p.width().type(30.4), [['layoutSideWidth', 30]], 'whole percents');
    } finally { await p.unmount(); }
  });

  it('Mixed takes no Details (its details are on the band), and Width is its left column\'s', async () => {
    const p = await panel('sidebar', { layoutColumns: 'mixed', layoutDetails: 'right', layoutSideWidth: 30 });
    try {
      assert.equal(p.active('layout-columns'), 'Mixed');
      assert.equal(p.row('layout-details'), null, 'no Details in Mixed');
      assert.equal(p.width().shown, '30%');
      assert.match(p.width().label, /Left column/);
    } finally { await p.unmount(); }
  });

  it('a stored value no build offered shows the default it prints', async () => {
    const p = await panel('sidebar', { layoutColumns: 'grid', layoutDetails: 'bottom', layoutSideWidth: 'wide' });
    try {
      assert.equal(p.active('layout-columns'), 'Side column');
      assert.equal(p.active('layout-details'), 'Left');
      assert.equal(p.width().shown, '38%');
    } finally { await p.unmount(); }
  });

  it('only on the Sidebar\'s two columns: not in Single · ATS-safe, not on another template', async () => {
    for (const [template, settings] of [['sidebar', { sidebarSingleColumn: true }], ['classic', {}], ['modern', {}], ['compact', {}]]) {
      const p = await panel(template, settings);
      try {
        for (const id of ['layout-columns', 'layout-details', 'layout-width']) assert.equal(p.row(id), null, `${template} ${JSON.stringify(settings)}: ${id}`);
      } finally { await p.unmount(); }
    }
  });

  it('Reset Design Settings takes the layout back to the default page; no section ↺ writes it', async () => {
    const { settingsAfterReset, sectionReset } = await loadModule('/src/utils/defaultData.js');
    const r = resume({ template: 'sidebar', settings: { layoutColumns: 'mixed', layoutDetails: 'top', layoutSideWidth: 30 } });
    const after = settingsAfterReset(r);
    for (const key of ['layoutColumns', 'layoutDetails', 'layoutSideWidth']) assert.equal(key in after, false, `${key} reset`);
    const all = Object.keys(r.settings);
    const reset = sectionReset('sidebar', all, r.settings);
    assert.deepEqual([reset.layoutColumns, reset.layoutDetails, reset.layoutSideWidth], ['mixed', 'top', 30], 'no template default overwrites them');
  });
});

describe('the rest of the editor says what the layout prints (R2-147-col)', () => {
  /** Section Options for a Languages section (Grids 2 stored) on `template` with `settings`, as HTML. */
  async function options(template, settings) {
    const { SectionCustomizer } = await loadModule('/src/components/SectionEditorCustomizer.jsx');
    return renderToString(createElement(SectionCustomizer, { section: section('languages', [{ language: 'Portuguese' }]), template, settings, updateSectionSettings: () => {} }));
  }

  it('Section Options: a section in a Mixed column offers no Grids and says why; the main column and Classic still offer it', async () => {
    const mixed = await options('sidebar', { layoutColumns: 'mixed' });
    assert.doesNotMatch(mixed, />Grids</, 'Mixed: no Grids');
    assert.match(mixed, /data-testid="mixed-column-note"/);
    assert.match(mixed, />Alignment</, 'Mixed: Alignment still applies');
    assert.match(await options('classic', {}), />Grids</, 'Classic: Grids');
    assert.doesNotMatch(await options('sidebar', {}), /mixed-column-note/, 'the side column keeps its own note');
  });

  it('Typography and Section Headings say nothing of a side column in Mixed; on the side column they still do', async () => {
    // Both sections open closed: their text is read by calling each component of the tree inside a
    // render pass, as 86-sidebar-single-design-notes reads it.
    function* walk(node) {
      if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
      if (!node || typeof node !== 'object' || !node.props) return;
      yield node;
      if (typeof node.type === 'function') {
        try { yield* walk(node.type(node.props)); } catch { /* a component this walk cannot render */ }
      }
      yield* walk(node.props.children);
    }
    const textOf = (node) => (node == null || typeof node === 'boolean' ? ''
      : Array.isArray(node) ? node.map(textOf).join('')
        : typeof node === 'object' ? (node.props ? textOf(node.props.children) : '') : String(node));
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const panelText = (settings) => {
      let text = '';
      function Capture() {
        const tree = DesignPanel({ resume: resume({ template: 'sidebar', settings }), updateSetting: () => {}, setTemplate: () => {}, resetSettings: () => {} });
        text = [...walk(tree)].map(textOf).join('\n');
        return null;
      }
      renderToString(createElement(Capture));
      return text;
    };
    const [two, mixed] = [panelText({}), panelText({ layoutColumns: 'mixed' })];
    for (const [where, re] of [['Section Headings', /The side column keeps its own small headings/], ['Typography', /side column('|&apos;)s sections keep/]]) {
      assert.match(two, re, `${where}: the side column's note`);
      assert.doesNotMatch(mixed, re, `${where}: no side column in Mixed`);
    }
  });

  it('Photo: on the band the photo prints left of the name; in the column, above it', async () => {
    const { PhotoSection } = await loadModule('/src/components/PersonalInfoEditorPhoto.jsx');
    const html = (s) => renderToString(createElement(PhotoSection, {
      personal: {}, updatePersonal: () => {}, toggleFieldVisibility: () => {}, hidden: new Set(), s, set: () => {},
      template: 'sidebar', open: true, onToggle: () => {},
    }));
    assert.match(html({}), /prints the photo above your name/);
    assert.match(html({ layoutDetails: 'top' }), /prints the photo left of your name, on the band across the top/);
    assert.match(html({ layoutColumns: 'mixed' }), /prints the photo left of your name, on the band across the top/);
  });
});
