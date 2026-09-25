// Dragging a colour does not write the setting at every step (R2-142, PERF-4). An <input type="color">
// sends a change for every step of the drag, and each one called updateSetting: the whole editor
// re-rendered, a save was held and the preview's build re-armed dozens of times a second. Now each
// Design colour (Colors: accent, text, header text, name, job title, sidebar background; Headings:
// border) writes as the store's saves do (R2-077): the first step at once, then only the latest, a
// moment after the last step and at least every half second while the drag goes on; the swatch shows
// the drag meanwhile, and leaving the picker (blur) or closing the panel writes what is held at once.
// The real panels over the fake DOM, each change fired as React receives it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const evt = (value) => ({ target: { value }, currentTarget: { value }, preventDefault() {}, stopPropagation() {} });
const drag = (n, from = 0) => Array.from({ length: n }, (_, i) => `#${(0x102030 + (from + i) * 0x010101).toString(16)}`);

/** `Panel` for `r` over a store that applies and records each write; `input(label)` finds a colour input. */
async function panel(file, name, r) {
  const Panel = (await loadModule(file))[name];
  const writes = [];
  function Store({ initial }) {
    const [held, setHeld] = useState(initial);
    const updateSetting = (key, value) => {
      writes.push([key, value]);
      setHeld((cur) => ({ ...cur, settings: { ...cur.settings, [key]: value } }));
    };
    return createElement(Panel, { resume: held, settings: held.settings, template: held.template, updateSetting, onReset: () => {} });
  }
  const view = mount(Store, { initial: r });
  // The section opens closed: its title button opens it.
  view.act(() => reactProps([...elements(view.container)].find((el) => el.tagName === 'BUTTON')).onClick({}));
  const input = (label) => [...elements(view.container)].find((el) => el.tagName === 'INPUT' && (el.type || el.getAttribute('type')) === 'color'
    && (el.getAttribute('aria-label') === label || el.getAttribute('title') === label));
  const fire = (label, value) => view.act(() => reactProps(input(label)).onChange(evt(value)));
  const shown = (label) => { const el = input(label); return el.value !== undefined ? el.value : el.getAttribute('value'); };
  return { view, writes, input, fire, shown };
}

describe('dragging a Design colour writes it coalesced, not at every step (R2-142, PERF-4)', () => {
  it('a 30-step drag of the accent writes its first step and its last, and the swatch follows the drag', async () => {
    const p = await panel('/src/components/DesignPanelColors.jsx', 'ColorsSection', resume({ template: 'classic' }));
    try {
      const steps = drag(30);
      for (const [i, v] of steps.entries()) {
        p.fire('Custom accent color', v);
        assert.equal(p.shown('Custom accent color'), v, `the swatch shows step ${i + 1} of the drag`);
      }
      assert.deepEqual(p.writes, [['accentColor', steps[0]]], `before: ${p.writes.length} writes for one drag — one per step`);
      await wait(300);
      assert.deepEqual(p.writes, [['accentColor', steps[0]], ['accentColor', steps.at(-1)]], 'the last step is written after the drag');
      assert.equal(p.shown('Custom accent color'), steps.at(-1));
    } finally {
      await p.view.unmount();
    }
  });

  it('a drag that goes on is written at least every half second', async () => {
    const p = await panel('/src/components/DesignPanelColors.jsx', 'ColorsSection', resume({ template: 'classic' }));
    try {
      const steps = drag(24);
      for (const v of steps) { p.fire('Custom text color', v); await wait(50); } // 1.2 s of dragging
      const during = p.writes.length;
      assert.ok(during >= 3 && during <= 5, `${during} writes in 1.2 s of dragging (one per step would be 24)`);
      await wait(300);
      assert.deepEqual(p.writes.at(-1), ['textColor', steps.at(-1)]);
    } finally {
      await p.view.unmount();
    }
  });

  it('leaving the picker, or closing the panel, writes the held step at once', async () => {
    const p = await panel('/src/components/DesignPanelColors.jsx', 'ColorsSection', resume({ template: 'sidebar' }));
    const steps = drag(5, 40);
    for (const v of steps) p.fire('Custom sidebar background', v);
    p.view.act(() => reactProps(p.input('Custom sidebar background')).onBlur?.(evt(steps.at(-1))));
    assert.deepEqual(p.writes.at(-1), ['sidebarBg', steps.at(-1)], 'blur writes it');
    const more = drag(3, 60);
    for (const v of more) p.fire('Name color', v);
    await p.view.unmount();
    assert.deepEqual(p.writes.at(-1), ['nameColor', more.at(-1)], 'unmount writes it');
  });

  it('Headings → Border color is coalesced too', async () => {
    const p = await panel('/src/components/DesignPanelHeadings.jsx', 'HeadingsSection', resume({ template: 'classic', settings: { headingStyle: 'underline' } }));
    try {
      const steps = drag(20, 7);
      for (const v of steps) p.fire('Section border color', v);
      assert.equal(p.writes.length, 1, `before: ${p.writes.length} writes for one drag`);
      await wait(300);
      assert.deepEqual(p.writes.at(-1), ['sectionBorderColor', steps.at(-1)]);
    } finally {
      await p.view.unmount();
    }
  });
});
