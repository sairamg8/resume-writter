// Design's picker and its door, as assistive technology and a finger meet them (R2-139: the Templates
// UI audit's A7, A8, A11, A13, A14). The template cards and the panel's segment controls said which
// option was chosen by colour alone — no radio role, no aria-checked, no word; the cards had no test
// id, so the e2e specs picked a template by its description; the descriptions were gray-400 at 10 px
// (2.5:1 on white); a section's header did not say whether it was open; and the Design button was a
// 33 px icon named only by its tooltip, which a phone never shows, with nothing saying Design was open.
// Mounted over tests/pdf/fake-dom.mjs; cypress/e2e/04-design.cy.js and 26-mobile-layout.cy.js check the
// same in a real browser, sizes included.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule, TEMPLATES } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const all = (view) => [...elements(view.container)];
const classes = (el) => el.className.split(/\s+/);
const group = (view, name) => all(view).find((el) => el.getAttribute('role') === 'radiogroup' && el.getAttribute('aria-label') === name);
const radios = (el) => [...elements(el)].filter((x) => x.getAttribute('role') === 'radio');
const checked = (el) => radios(el).filter((x) => x.getAttribute('aria-checked') === 'true');
const cards = (view) => all(view).filter((el) => el.getAttribute('data-testid') === 'template-card');
/** A section's header: the button whose own text is its title. */
const header = (view, title) => all(view).find((el) => el.tagName === 'BUTTON' && text(el).toLowerCase() === title.toLowerCase());
const click = (view, el) => view.act(() => reactProps(el).onClick({ stopPropagation() {}, preventDefault() {} }));
const key = (view, el, k) => view.act(() => reactProps(el).onKeyDown({ key: k, preventDefault() {} }));

/** The Design panel over a résumé on `template`, its writes applied as the store would: { view, picked }. */
async function designPanel(template, settings = {}) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const picked = [];
  function Panel({ start }) {
    const [r, setR] = useState(start);
    return createElement(DesignPanel, {
      resume: r,
      updateSetting: (k, v) => setR((x) => ({ ...x, settings: { ...x.settings, [k]: v } })),
      setTemplate: (id) => { picked.push(id); setR((x) => ({ ...x, template: id })); },
      resetSettings: () => {},
    });
  }
  return { view: mount(Panel, { start: resume({ template, settings }) }), picked };
}

describe('Design → Template is a radio group of cards (A8, A11)', () => {
  it('one card per template the picker offers, each a radio with the test id, in a group named Template', async () => {
    const { TEMPLATE_PICKER } = await loadModule('/src/constants/templates.js');
    const { view } = await designPanel('classic');
    try {
      const list = group(view, 'Template');
      assert.ok(list, 'a radiogroup named "Template"');
      const found = cards(view);
      assert.equal(found.length, TEMPLATE_PICKER.length, 'one card per template');
      // In the picker's order, each card's text opening with its template's name.
      TEMPLATE_PICKER.forEach((t, i) => assert.ok(text(found[i]).startsWith(t.label), `card ${i}: "${text(found[i])}", not ${t.label}`));
      for (const c of found) {
        assert.equal(c.tagName, 'BUTTON');
        assert.equal(c.getAttribute('role'), 'radio', text(c));
        assert.ok(list.contains(c), `${text(c)}: in the Template group`);
      }
      assert.deepEqual(radios(list), found, 'every radio in the group is a card');
    } finally { await view.unmount(); }
  });

  it('every template: its own card alone is checked and shows "Selected"; the others are unchecked and do not', async () => {
    const { templateLabel } = await loadModule('/src/constants/templates.js');
    const wrong = [];
    for (const template of TEMPLATES) {
      const { view } = await designPanel(template);
      try {
        for (const c of cards(view)) {
          const own = text(c).startsWith(templateLabel(template));
          const state = c.getAttribute('aria-checked');
          if (state !== String(own)) wrong.push(`${template}: "${text(c).slice(0, 20)}" aria-checked=${state}`);
          if (/Selected/.test(text(c)) !== own) wrong.push(`${template}: "${text(c).slice(0, 20)}" ${own ? 'has no' : 'shows a'} "Selected"`);
        }
      } finally { await view.unmount(); }
    }
    assert.deepEqual(wrong, []);
  });

  it('the "Selected" word is for the eye: a screen reader hears aria-checked, not the word as well', async () => {
    const { view } = await designPanel('modern');
    try {
      const [on] = checked(group(view, 'Template'));
      const word = [...elements(on)].find((el) => el.tagName === 'SPAN' && text(el) === 'Selected');
      assert.ok(word, 'the checked card\'s "Selected"');
      assert.equal(word.getAttribute('aria-hidden'), 'true');
    } finally { await view.unmount(); }
  });

  it('a pick moves aria-checked and "Selected" to the card picked', async () => {
    const { view, picked } = await designPanel('classic');
    try {
      const card = (label) => cards(view).find((c) => text(c).startsWith(label));
      click(view, card('Modern'));
      assert.deepEqual(picked, ['modern']);
      assert.deepEqual(checked(group(view, 'Template')).map((c) => text(c).slice(0, 6)), ['Modern']);
      assert.equal(card('Classic').getAttribute('aria-checked'), 'false');
      assert.doesNotMatch(text(card('Classic')), /Selected/);
      assert.match(text(card('Modern')), /Selected/);
    } finally { await view.unmount(); }
  });
});

describe('Design → Template\'s descriptions read at 4.5:1 or more (A13)', () => {
  it('each card\'s description and each of the section\'s notes is gray-600 at 11 px, not gray-400 at 10 px', async () => {
    const { TEMPLATE_PICKER } = await loadModule('/src/constants/templates.js');
    const wrong = [];
    const notes = { sidebar: /^Single column reads/, academic: /^Academic brings/, compact: /^Compact brings/, classic: /^The cover letter/ };
    for (const [template, note] of Object.entries(notes)) {
      const { view } = await designPanel(template);
      try {
        const para = (re) => all(view).find((el) => el.tagName === 'P' && re.test(text(el)));
        const wanted = [note, ...(template === 'classic' ? TEMPLATE_PICKER.map((t) => new RegExp(`^${t.desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)) : [])];
        for (const re of wanted) {
          const p = para(re);
          if (!p) { wrong.push(`${template}: no paragraph ${re}`); continue; }
          const c = classes(p);
          if (!c.includes('text-gray-600') || !c.includes('text-[11px]') || c.includes('text-gray-400') || c.includes('text-[10px]')) wrong.push(`${template}: "${text(p).slice(0, 30)}" is ${p.className}`);
        }
      } finally { await view.unmount(); }
    }
    assert.deepEqual(wrong, []);
  });
});

describe('the Design panel\'s segment controls are named radio groups, 44 px tall (A8, A11)', () => {
  it('Sidebar → Layout: aria-checked, a check and the Tab stop follow the choice', async () => {
    const { view } = await designPanel('sidebar');
    try {
      const layout = group(view, 'Layout');
      assert.ok(layout, 'a radiogroup named "Layout"');
      const state = () => radios(group(view, 'Layout')).map((r) => [text(r), r.getAttribute('aria-checked'), r.getAttribute('tabindex'), [...elements(r)].some((el) => el.tagName === 'svg')]);
      assert.deepEqual(state(), [['Two columns', 'true', '0', true], ['Single · ATS-safe', 'false', '-1', false]]);
      for (const r of radios(layout)) {
        assert.ok(classes(r).includes('min-h-11'), `${text(r)}: 44 px tall (${r.className})`);
        const mark = [...elements(r)].find((el) => el.tagName === 'svg');
        if (mark) assert.equal(mark.getAttribute('aria-hidden'), 'true', 'the check is for the eye');
      }
      click(view, radios(group(view, 'Layout'))[1]);
      assert.deepEqual(state(), [['Two columns', 'false', '-1', false], ['Single · ATS-safe', 'true', '0', true]]);
    } finally { await view.unmount(); }
  });

  it('Sidebar → Layout by keys: ←/→ move and choose, wrapping; Home and End jump; focus goes with the choice', async () => {
    const { view } = await designPanel('sidebar');
    try {
      let focused = null;
      const spyFocus = () => { for (const r of radios(group(view, 'Layout'))) r.focus = () => { focused = text(r); }; };
      const chosen = () => checked(group(view, 'Layout')).map(text);
      const steps = [['ArrowRight', 'Single · ATS-safe'], ['ArrowRight', 'Two columns'], ['ArrowLeft', 'Single · ATS-safe'],
        ['Home', 'Two columns'], ['End', 'Single · ATS-safe'], ['ArrowUp', 'Two columns'], ['ArrowDown', 'Single · ATS-safe']];
      for (const [k, want] of steps) {
        spyFocus();
        key(view, group(view, 'Layout'), k);
        assert.deepEqual(chosen(), [want], k);
        assert.equal(focused, want, `${k}: focus follows`);
      }
      spyFocus();
      focused = null;
      key(view, group(view, 'Layout'), 'a');
      assert.deepEqual(chosen(), ['Single · ATS-safe'], 'another key changes nothing');
      assert.equal(focused, null);
    } finally { await view.unmount(); }
  });

  it('Typography → Font Size is a radio group named Font Size, its options 44 px tall', async () => {
    const { view } = await designPanel('classic');
    try {
      click(view, header(view, 'Typography'));
      const size = group(view, 'Font Size');
      assert.ok(size, 'a radiogroup named "Font Size"');
      assert.deepEqual(radios(size).map(text), ['Small', 'Normal', 'Large']);
      assert.ok(checked(size).length <= 1);
      assert.equal(radios(size).filter((r) => r.getAttribute('tabindex') === '0').length, 1, 'one Tab stop');
      for (const r of radios(size)) assert.ok(classes(r).includes('min-h-11'), `${text(r)}: ${r.className}`);
      click(view, radios(size).find((r) => text(r) === 'Large'));
      assert.deepEqual(checked(group(view, 'Font Size')).map(text), ['Large']);
    } finally { await view.unmount(); }
  });
});

describe('a Design section\'s header says whether it is open, and what it opens (A14)', () => {
  it('Template opens open: aria-expanded true, aria-controls naming the box that holds the cards', async () => {
    const { view } = await designPanel('classic');
    try {
      const h = header(view, 'Template');
      assert.equal(h.getAttribute('aria-expanded'), 'true');
      const id = h.getAttribute('aria-controls');
      assert.ok(id, 'aria-controls');
      const box = all(view).find((el) => el.getAttribute('id') === id);
      assert.ok(box, `an element with the id ${id}`);
      assert.ok(box.contains(group(view, 'Template')), 'the box it names holds the template cards');
    } finally { await view.unmount(); }
  });

  it('Colors opens closed and follows each click; closed, it names no box (there is none)', async () => {
    const { view } = await designPanel('classic');
    try {
      const state = () => {
        const h = header(view, 'Colors');
        const id = h.getAttribute('aria-controls');
        return [h.getAttribute('aria-expanded'), id === null ? null : Boolean(all(view).find((el) => el.getAttribute('id') === id)?.textContent.includes('Accent'))];
      };
      assert.deepEqual(state(), ['false', null]);
      click(view, header(view, 'Colors'));
      assert.deepEqual(state(), ['true', true], 'open: it names the box holding the colours');
      click(view, header(view, 'Colors'));
      assert.deepEqual(state(), ['false', null]);
      const ids = all(view).map((el) => el.getAttribute('aria-controls')).filter(Boolean);
      assert.equal(new Set(ids).size, ids.length, 'each open section names a box of its own');
    } finally { await view.unmount(); }
  });
});

describe('the Design button (A7)', () => {
  /** The editor's tab bar, one activeTab as Editor.jsx holds it: { view, design() }. */
  async function modeBar() {
    const { EditorModeBar } = await loadModule('/src/components/EditorHeader.jsx');
    function Bar() {
      const [activeTab, setActiveTab] = useState('resume');
      return createElement('div', { 'data-tab': activeTab }, createElement(EditorModeBar, { activeTab, setActiveTab }));
    }
    const view = mount(Bar, {});
    const design = () => all(view).find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Design & Customize');
    return { view, design, tab: () => all(view).find((el) => el.hasAttribute('data-tab')).getAttribute('data-tab') };
  }

  it('says "Design" on screen, keeps its title, and is 44 px square at least', async () => {
    const { view, design } = await modeBar();
    try {
      assert.ok(design(), 'found by its title, as the e2e specs find it');
      assert.equal(text(design()), 'Design');
      for (const c of ['min-h-11', 'min-w-11']) assert.ok(classes(design()).includes(c), `${c}: ${design().className}`);
      const icon = [...elements(design())].find((el) => el.tagName === 'svg');
      assert.equal(icon?.getAttribute('aria-hidden'), 'true', 'the palette is for the eye; the word names it');
    } finally { await view.unmount(); }
  });

  it('aria-pressed follows Design: pressed while it is open, not after the button closes it or another tab is picked', async () => {
    const { view, design, tab } = await modeBar();
    try {
      const button = (label) => all(view).find((el) => el.tagName === 'BUTTON' && text(el) === label);
      assert.deepEqual([tab(), design().getAttribute('aria-pressed')], ['resume', 'false']);
      click(view, design());
      assert.deepEqual([tab(), design().getAttribute('aria-pressed')], ['design', 'true']);
      click(view, design());
      assert.deepEqual([tab(), design().getAttribute('aria-pressed')], ['resume', 'false']);
      click(view, design());
      click(view, button('ATS Check'));
      assert.deepEqual([tab(), design().getAttribute('aria-pressed')], ['ats', 'false']);
    } finally { await view.unmount(); }
  });

  it('its label reads at 4.5:1 or more: gray-500 on white, amber-700 on amber-50 (not gray-400, amber-600)', async () => {
    const { view, design } = await modeBar();
    try {
      assert.ok(classes(design()).includes('text-gray-500'), design().className);
      assert.ok(!classes(design()).includes('text-gray-400'));
      click(view, design());
      assert.ok(classes(design()).includes('text-amber-700'), design().className);
      assert.ok(!classes(design()).includes('text-amber-600'));
    } finally { await view.unmount(); }
  });
});
