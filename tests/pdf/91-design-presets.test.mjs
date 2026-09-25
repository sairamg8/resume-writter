// Design → Spacing's Balanced and Spacious presets, and Design → Contact icons' Icon size stepper
// (R2-157). The presets were clicked in the gate only by 86-line-height-shown, which checks that the
// Line Height box agrees with the page — not what the preset stores: a preset that wrote one margin
// short, a gap too many or another setting passed. 69-word-spacing states the two sets by hand and
// never clicks. The stepper was pinned by no test: 86-icon-size-steps prints each size, but a − that
// went up or a + that ran past ICON_SIZE passed. (1-Page Fit is R2-149's and tested there.)
// The real panel is mounted over the fake DOM, its updateSetting a small store that records each
// write and re-renders with it, so the controls are read back as the person would see them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The two presets as DesignPanel.jsx's buttons must store them, written out, in the order they write. */
const BALANCED = [['marginV', 14], ['marginH', 18], ['sectionGap', 16], ['itemGap', 8], ['lineHeightValue', 1.5]];
const SPACIOUS = [['marginV', 20], ['marginH', 22], ['sectionGap', 22], ['itemGap', 12], ['lineHeightValue', 1.65]];

/**
 * The Design panel for `r`, as the editor mounts it, over a store that applies each write: `open(title)`
 * opens a section, `click(el)` clicks it and returns the [key, value] writes it made, `button(text)`,
 * `row(label)` (a stepper row: the value its box shows, and its − and + buttons), `settings()` and `unmount`.
 */
async function panel(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = [];
  let current = r;
  function Store({ initial }) {
    const [held, setHeld] = useState(initial);
    current = held;
    const updateSetting = (key, value) => {
      writes.push([key, value]);
      setHeld((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
    };
    return createElement(DesignPanel, { resume: held, updateSetting, setTemplate: () => {}, resetSettings: () => {} });
  }
  const view = mount(Store, { initial: r });
  const all = () => [...elements(view.container)];
  const click = (el) => {
    writes.length = 0;
    view.act(() => reactProps(el).onClick());
    return [...writes];
  };
  const button = (match) => {
    const el = all().find((b) => b.tagName === 'BUTTON' && match(b.textContent.trim()));
    assert.ok(el, `the button ${match}`);
    return el;
  };
  return {
    click,
    button,
    open(title) {
      click(button((t) => t === title));
    },
    row(label) {
      const span = all().find((el) => el.tagName === 'SPAN' && el.textContent.trim() === label);
      assert.ok(span, `the ${label} row`);
      const box = span.parentNode;
      const buttons = [...elements(box)].filter((el) => el.tagName === 'BUTTON');
      const input = [...elements(box)].find((el) => el.tagName === 'INPUT');
      const valueSpan = [...elements(box)].filter((el) => el.tagName === 'SPAN' && el !== span).at(-1);
      return {
        shown: input ? String(reactProps(input).value) : valueSpan.textContent.trim(),
        minus: buttons.find((b) => b.textContent.trim() === '−'),
        plus: buttons.find((b) => b.textContent.trim() === '+'),
      };
    },
    settings: () => current.settings,
    unmount: () => view.unmount(),
  };
}

/** What Design → Spacing's rows show. */
const spacingShown = (view) => ({
  'Top / Bottom margin': view.row('Top / Bottom margin').shown,
  'Left / Right margin': view.row('Left / Right margin').shown,
  'Between Sections': view.row('Between Sections').shown,
  'Between Items': view.row('Between Items').shown,
  'Line Height': view.row('Line Height').shown,
});

const cv = (settings = {}) => resume({ settings, personal: { name: 'Jordan Vale', email: 'jordan@example.com' } });

describe('Design → Spacing → Balanced and Spacious (R2-157)', () => {
  it('Spacious writes its five values, and only those; the rows then show them', async () => {
    const view = await panel(cv({ pageSize: 'LETTER', accentColor: '#e11d48' }));
    try {
      view.open('Spacing');
      assert.deepEqual(view.click(view.button((t) => t.endsWith('Spacious'))), SPACIOUS);
      assert.deepEqual(spacingShown(view), {
        'Top / Bottom margin': '20mm', 'Left / Right margin': '22mm', 'Between Sections': '22px', 'Between Items': '12px', 'Line Height': '1.65',
      });
      assert.equal(view.settings().pageSize, 'LETTER', 'the paper is not a preset\'s');
      assert.equal(view.settings().accentColor, '#e11d48');
    } finally { await view.unmount(); }
  });

  it('Balanced brings a Spacious résumé back to the standard set; the rows follow', async () => {
    const view = await panel(cv(Object.fromEntries(SPACIOUS)));
    try {
      view.open('Spacing');
      assert.equal(view.row('Top / Bottom margin').shown, '20mm', 'starts Spacious');
      assert.deepEqual(view.click(view.button((t) => t.endsWith('Balanced'))), BALANCED);
      assert.deepEqual(spacingShown(view), {
        'Top / Bottom margin': '14mm', 'Left / Right margin': '18mm', 'Between Sections': '16px', 'Between Items': '8px', 'Line Height': '1.5',
      });
    } finally { await view.unmount(); }
  });

  it('a preset writes its whole set even where the résumé already holds some of it (Academic\'s own 1.35 and gaps)', async () => {
    const view = await panel(resume({ template: 'academic' }));
    try {
      view.open('Spacing');
      assert.deepEqual(view.click(view.button((t) => t.endsWith('Balanced'))), BALANCED);
      assert.deepEqual(view.click(view.button((t) => t.endsWith('Spacious'))), SPACIOUS);
      for (const [key, value] of SPACIOUS) assert.equal(view.settings()[key], value, key);
    } finally { await view.unmount(); }
  });
});

describe('Design → Contact icons → Icon size (R2-157)', () => {
  it('none stored shows 11px; − stores 10 and + stores 12, as px', async () => {
    const r = cv();
    delete r.settings.iconSize;
    const view = await panel(r);
    try {
      assert.equal(view.row('Icon size').shown, '11px');
      assert.deepEqual(view.click(view.row('Icon size').minus), [['iconSize', 10]]);
      assert.equal(view.row('Icon size').shown, '10px');
      assert.deepEqual(view.click(view.row('Icon size').plus), [['iconSize', 11]]);
      assert.deepEqual(view.click(view.row('Icon size').plus), [['iconSize', 12]]);
      assert.equal(view.row('Icon size').shown, '12px');
    } finally { await view.unmount(); }
  });

  it('stays within ICON_SIZE: never under 9 px nor over 20 px', async () => {
    const { ICON_SIZE } = await loadModule('/src/constants/designNumbers.js');
    assert.deepEqual(ICON_SIZE, { min: 9, max: 20 }, 'the range the rows below are written for');
    const view = await panel(cv({ iconSize: 10 }));
    try {
      assert.deepEqual(view.click(view.row('Icon size').minus), [['iconSize', 9]]);
      assert.deepEqual(view.click(view.row('Icon size').minus), [['iconSize', 9]], 'at 9 px, − stays 9');
      assert.equal(view.row('Icon size').shown, '9px');
    } finally { await view.unmount(); }
    const top = await panel(cv({ iconSize: 19 }));
    try {
      assert.deepEqual(top.click(top.row('Icon size').plus), [['iconSize', 20]]);
      assert.deepEqual(top.click(top.row('Icon size').plus), [['iconSize', 20]], 'at 20 px, + stays 20');
      assert.equal(top.row('Icon size').shown, '20px');
    } finally { await top.unmount(); }
  });
});
