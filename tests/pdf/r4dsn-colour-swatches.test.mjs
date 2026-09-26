// R4-DSN-05: Design → Colors' swatches hold the colour the PDF prints where none is picked. Name and Job
// title showed #000000 for "Template default" — while Modern prints its name white on the banner — so
// the swatch misstated the page and picking pure black changed nothing (the input's value did not move,
// so no change fired). The Accent swatch showed a panel-wide #2563eb on a résumé storing none, while
// Gridline prints its own navy (#1e40af). The Text swatch has done this since R9-7.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const evt = (value) => ({ target: { value }, currentTarget: { value }, preventDefault() {}, stopPropagation() {} });

/** Colors for a résumé on `template` storing `settings`, over a store that records each write. */
async function colors(template, settings) {
  const { ColorsSection } = await loadModule('/src/components/DesignPanelColors.jsx');
  const writes = [];
  function Store({ initial }) {
    const [held, setHeld] = useState(initial);
    const updateSetting = (key, value) => {
      writes.push([key, value]);
      setHeld((cur) => ({ ...cur, settings: { ...cur.settings, [key]: value } }));
    };
    return createElement(ColorsSection, { resume: held, settings: held.settings, template: held.template, updateSetting, onReset: () => {} });
  }
  const view = mount(Store, { initial: { id: 'resume_c', template, settings, personal: { name: 'Robin Sample' }, sections: [] } });
  view.act(() => reactProps([...elements(view.container)].find((el) => el.tagName === 'BUTTON')).onClick({}));
  const input = (label) => [...elements(view.container)].find((el) => el.tagName === 'INPUT'
    && (el.getAttribute('aria-label') === label || el.getAttribute('title') === label));
  const shown = (label) => { const el = input(label); return String(el.value !== undefined ? el.value : el.getAttribute('value')).toLowerCase(); };
  return { view, writes, input, shown };
}

describe('Design → Colors shows the colours the PDF prints (R4-DSN-05)', () => {
  it('Modern with no Name or Job title colour: the swatches hold the banner\'s white, and black can be picked', async () => {
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    const settings = { accentColor: '#2563eb', textColor: '#1f2937', nameColor: '', jobTitleColor: '' };
    const printed = resolveTemplateSettings(settings, 'modern');
    assert.equal(printed.nameColor.toLowerCase(), '#ffffff');
    const p = await colors('modern', settings);
    try {
      assert.equal(p.shown('Name color'), '#ffffff');
      assert.equal(p.shown('Job title color'), printed.jobTitleColor.toLowerCase());
      // An <input type="color"> fires no change for the value it already holds: black is pickable
      // only where the swatch is not already black.
      assert.notEqual(p.shown('Name color'), '#000000');
      p.view.act(() => reactProps(p.input('Name color')).onChange(evt('#000000')));
      assert.deepEqual(p.writes, [['nameColor', '#000000']]);
    } finally { await p.view.unmount(); }
  });

  it('Classic with none: the Name swatch is the Text colour it prints in, the title the accent', async () => {
    const p = await colors('classic', { accentColor: '#0f4c81', textColor: '#1f2937' });
    try {
      assert.equal(p.shown('Name color'), '#1f2937');
      assert.equal(p.shown('Job title color'), '#0f4c81');
    } finally { await p.view.unmount(); }
  });

  it('Gridline storing no accent: the Accent swatch and its hex are Gridline\'s own', async () => {
    const p = await colors('gridline', { textColor: '#111111' });
    try {
      assert.equal(p.shown('Custom accent color'), '#1e40af');
      const hex = [...elements(p.view.container)].find((el) => el.tagName === 'SPAN' && /^#[0-9a-f]{6}$/i.test(el.textContent.trim()));
      assert.equal(hex.textContent.trim().toLowerCase(), '#1e40af');
    } finally { await p.view.unmount(); }
  });
});
