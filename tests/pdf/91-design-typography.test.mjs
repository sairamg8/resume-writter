// Design → Typography's custom fonts, its Small / Normal / Large and its Base (R2-157). No test in the
// gate used them: 16-saved-data-typography clamps a stored size delta on load, never the panel's
// setBase; the custom fonts were tried only by Cypress. So a Large that stored 13, a base change that
// rewrote every level (or left Section Title at a size its row cannot show), a font kept under the
// name typed instead of Google's, a refused name stored anyway, or a removed font left selected passed.
// The real panel is mounted over the fake DOM, its updateSetting a small store that records each write
// and re-renders with it; Fontsource's metadata lookup is answered by a stub fetch, and the custom
// font list lives in a stand-in localStorage.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const FONTS_KEY = 'cpwtcv_custom_fonts';

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** Waits (up to 2 s) for `ready()`, letting React's scheduled renders and the stub fetch run. */
async function until(ready, what) {
  for (let i = 0; i < 200 && !ready(); i += 1) await new Promise((r) => { setTimeout(r, 10); });
  assert.ok(ready(), what);
}

/**
 * The Design panel for `r`, as the editor mounts it, over a store that applies each write, with
 * Typography opened: `writes` (every [key, value] since the last `click`), `click(el)`, `type(el, text)`,
 * `button(text)` (exact text), `sizeButton(label)` (Small / Normal / Large: the button and whether it
 * shows selected), `row(label)` (a size row: what its box shows, its − and +), `text()`, `settings()`.
 */
async function typography(r) {
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
  const find = (match, what) => {
    const el = all().find(match);
    assert.ok(el, what);
    return el;
  };
  const button = (text) => find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text, `the "${text}" button`);
  const click = (el) => {
    writes.length = 0;
    view.act(() => reactProps(el).onClick());
    return [...writes];
  };
  click(button('Typography'));
  return {
    writes,
    click,
    button,
    has: (text) => all().some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    input: () => find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === 'e.g. Nunito, Raleway, Poppins', 'the Add a Google Font box'),
    type(el, text) {
      writes.length = 0;
      view.act(() => reactProps(el).onChange({ target: { value: text } }));
    },
    key(el, key) {
      writes.length = 0;
      view.act(() => reactProps(el).onKeyDown({ key }));
    },
    sizeButton(label) {
      const el = button(label);
      return { el, selected: el.className.includes('bg-blue-600') };
    },
    row(label) {
      const span = find((el) => el.tagName === 'SPAN' && el.textContent.trim() === label, `the ${label} row`);
      const box = span.parentNode;
      const buttons = [...elements(box)].filter((el) => el.tagName === 'BUTTON');
      const input = [...elements(box)].find((el) => el.tagName === 'INPUT');
      return { shown: String(reactProps(input).value), minus: buttons.find((b) => b.textContent.trim() === '−'), plus: buttons.find((b) => b.textContent.trim() === '+') };
    },
    /** The remove (×) button on the custom font chip `name`. */
    removeButton(name) {
      const chip = button(name).parentNode;
      const el = [...elements(chip)].find((b) => b.tagName === 'BUTTON' && b.getAttribute('title') === 'Remove font');
      assert.ok(el, `${name}'s remove button`);
      return el;
    },
    text: () => view.container.textContent,
    settings: () => current.settings,
    unmount: () => view.unmount(),
  };
}

const cv = (settings = {}) => resume({ settings, personal: { name: 'Morgan Ashby', email: 'morgan@example.com' } });

/** What the Full Name, Section Title and Entry Header rows show. */
const levels = (view) => ['Full Name', 'Section Title', 'Entry Header'].map((label) => view.row(label).shown);

describe('Design → Typography → Small / Normal / Large and Base keep each level\'s delta (R2-157)', () => {
  it('Small, Normal and Large store 10, 11 and 12 pt — the base only — and show which is in effect', async () => {
    const view = await typography(cv());
    try {
      assert.deepEqual(['Small', 'Normal', 'Large'].map((l) => view.sizeButton(l).selected), [false, true, false], 'base 11: Normal');
      assert.deepEqual(levels(view), ['19pt', '12pt', '11pt'], 'the default deltas: +8, +1, 0');
      for (const [label, base] of [['Large', 12], ['Small', 10], ['Normal', 11]]) {
        assert.deepEqual(view.click(view.sizeButton(label).el), [['fontSizeBase', base]], label);
        assert.deepEqual(['Small', 'Normal', 'Large'].map((l) => view.sizeButton(l).selected), ['Small', 'Normal', 'Large'].map((l) => l === label), `${label} selected`);
        assert.deepEqual(levels(view), [`${base + 8}pt`, `${base + 1}pt`, `${base}pt`], `${label}: every level moves with the base`);
      }
    } finally { await view.unmount(); }
  });

  it('a base none of them names (13 pt) marks none', async () => {
    const view = await typography(cv({ fontSizeBase: 13 }));
    try {
      assert.deepEqual(['Small', 'Normal', 'Large'].map((l) => view.sizeButton(l).selected), [false, false, false]);
      assert.equal(view.row('Base').shown, '13pt');
    } finally { await view.unmount(); }
  });

  it('Large from base 8 brings a delta its row cannot show back into range, and keeps the others', async () => {
    // Full Name 36 pt (+28), Section Title 6 pt (-2), Entry Header 24 pt (+16): each at a row's end on base 8.
    const view = await typography(cv({ fontSizeBase: 8, fontSizeNameDelta: 28, fontSizeSectionDelta: -2, fontSizeEntryDelta: 16 }));
    try {
      assert.deepEqual(view.click(view.sizeButton('Large').el), [['fontSizeBase', 12], ['fontSizeNameDelta', 24], ['fontSizeEntryDelta', 12]]);
      assert.deepEqual(levels(view), ['36pt', '10pt', '24pt'], 'Full Name and Entry Header stay at 36 and 24; Section Title keeps its -2');
    } finally { await view.unmount(); }
  });

  it('Small from base 16 lifts a Section Title or Entry Header that would print under 6 pt', async () => {
    const view = await typography(cv({ fontSizeBase: 16, fontSizeNameDelta: 0, fontSizeSectionDelta: 8, fontSizeEntryDelta: -10 }));
    try {
      assert.deepEqual(view.click(view.sizeButton('Small').el), [['fontSizeBase', 10], ['fontSizeEntryDelta', -4]]);
      assert.deepEqual(levels(view), ['10pt', '18pt', '6pt']);
    } finally { await view.unmount(); }
  });

  it('a delta the résumé does not store is left unstored', async () => {
    const r = cv({ fontSizeBase: 8 });
    for (const key of ['fontSizeNameDelta', 'fontSizeSectionDelta', 'fontSizeEntryDelta']) delete r.settings[key];
    const view = await typography(r);
    try {
      assert.deepEqual(view.click(view.sizeButton('Large').el), [['fontSizeBase', 12]]);
    } finally { await view.unmount(); }
  });

  it('Base − and + step one point, keep the deltas in range, and stop at 8 and 16', async () => {
    const view = await typography(cv({ fontSizeBase: 15, fontSizeNameDelta: 21, fontSizeSectionDelta: 1, fontSizeEntryDelta: 0 }));
    try {
      assert.deepEqual(view.click(view.row('Base').plus), [['fontSizeBase', 16], ['fontSizeNameDelta', 20]], 'Full Name stays 36 pt');
      assert.deepEqual(view.click(view.row('Base').plus), [['fontSizeBase', 16]], 'at 16, + stays 16');
      assert.deepEqual(view.click(view.row('Base').minus), [['fontSizeBase', 15]], 'the name\'s 20 fits base 15 as it is');
      assert.equal(view.row('Full Name').shown, '35pt');
    } finally { await view.unmount(); }
    const low = await typography(cv({ fontSizeBase: 9 }));
    try {
      assert.deepEqual(low.click(low.row('Base').minus), [['fontSizeBase', 8]]);
      assert.deepEqual(low.click(low.row('Base').minus), [['fontSizeBase', 8]], 'at 8, − stays 8');
    } finally { await low.unmount(); }
  });
});

describe('Design → Typography → custom fonts (R2-157)', () => {
  let saved;
  const requested = [];
  before(() => {
    saved = { fetch: globalThis.fetch, localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage') };
    // Fontsource's metadata: a package for "Fictional Grotesk" (as Google spells it), none for anything else.
    globalThis.fetch = async (url) => {
      requested.push(String(url));
      if (String(url).includes('/fictional-grotesk@5/metadata.json')) {
        return { ok: true, json: async () => ({ family: 'Fictional Grotesk', weights: [400, 700], styles: ['normal'] }) };
      }
      return { ok: false, status: 404, json: async () => null }; // jsDelivr's answer for no such package
    };
  });
  after(() => {
    if (saved.fetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = saved.fetch;
    if (saved.localStorage) Object.defineProperty(globalThis, 'localStorage', saved.localStorage);
    else delete globalThis.localStorage;
  });
  const storage = (fonts) => {
    Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(fonts ? [[FONTS_KEY, JSON.stringify(fonts)]] : []), configurable: true, writable: true });
    return globalThis.localStorage;
  };

  it('Add: a font Google has is stored under Google\'s name and selected, remembered, offered as a chip, and the box empties', async () => {
    const store = storage();
    const view = await typography(cv({ font: 'inter' }));
    try {
      view.type(view.input(), '  fictional grotesk ');
      view.click(view.button('Add'));
      await until(() => view.writes.length >= 2 && view.has('Fictional Grotesk'), 'the font is added');
      assert.ok(requested.some((u) => u.endsWith('/fictional-grotesk@5/metadata.json')), `asked Fontsource for its package: ${requested}`);
      assert.deepEqual(view.writes, [['customFont', 'Fictional Grotesk'], ['font', '']]);
      assert.deepEqual(JSON.parse(store.getItem(FONTS_KEY)), ['Fictional Grotesk'], 'remembered in this browser');
      assert.equal(String(reactProps(view.input()).value), '', 'the box empties');
      assert.ok(view.text().includes('Your custom fonts'));
    } finally { await view.unmount(); }
  });

  it('Enter on a name Google does not have: a message, nothing stored, nothing remembered', async () => {
    const store = storage(['Fictional Serif']);
    const view = await typography(cv({ font: 'inter' }));
    try {
      view.type(view.input(), 'Nowhere Face');
      view.key(view.input(), 'Enter');
      await until(() => view.text().includes('was not found on Google Fonts'), 'the refusal is shown');
      assert.ok(view.text().includes('Nowhere Face'), 'naming what was typed');
      assert.deepEqual(view.writes, []);
      assert.deepEqual(JSON.parse(store.getItem(FONTS_KEY)), ['Fictional Serif']);
      assert.equal(view.has('Nowhere Face'), false, 'no chip');
      assert.equal(String(reactProps(view.input()).value), 'Nowhere Face', 'the name stays to be corrected');
    } finally { await view.unmount(); }
  });

  it('a remembered font\'s chip selects it: customFont set, the built-in font cleared', async () => {
    storage(['Fictional Serif', 'Fictional Mono']);
    const view = await typography(cv({ font: 'inter' }));
    try {
      assert.deepEqual(view.click(view.button('Fictional Mono')), [['customFont', 'Fictional Mono'], ['font', '']]);
    } finally { await view.unmount(); }
  });

  it('× on the font in use: forgotten, and the résumé no longer set in it', async () => {
    const store = storage(['Fictional Serif', 'Fictional Mono']);
    const view = await typography(cv({ font: '', customFont: 'Fictional Serif' }));
    try {
      assert.deepEqual(view.click(view.removeButton('Fictional Serif')), [['customFont', '']]);
      assert.deepEqual(JSON.parse(store.getItem(FONTS_KEY)), ['Fictional Mono']);
      assert.equal(view.has('Fictional Serif'), false, 'its chip goes');
      assert.ok(view.has('Fictional Mono'), 'the other stays');
    } finally { await view.unmount(); }
  });

  it('× on a font not in use: forgotten, and the résumé\'s own font left alone', async () => {
    const store = storage(['Fictional Serif', 'Fictional Mono']);
    const view = await typography(cv({ font: '', customFont: 'Fictional Serif' }));
    try {
      assert.deepEqual(view.click(view.removeButton('Fictional Mono')), []);
      assert.deepEqual(JSON.parse(store.getItem(FONTS_KEY)), ['Fictional Serif']);
      assert.equal(view.has('Fictional Mono'), false);
      assert.equal(view.settings().customFont, 'Fictional Serif');
    } finally { await view.unmount(); }
  });
});
