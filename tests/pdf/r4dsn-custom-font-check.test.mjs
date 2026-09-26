// R4-DSN-04: Design → Typography → Add a Google Font. (a) A check that could not reach Fontsource
// (offline: fetch rejects; or the CDN answers 503) was reported as a misspelling ("was not found on
// Google Fonts"); now it says the font could not be checked and keeps the typed name. (b) A slow
// check wrote customFont to whichever résumé was open when it finished, over a font picked while it
// ran; now a later pick (or another résumé opened meanwhile) stands and the result is not applied.
// The real Design panel is mounted over the fake DOM, over a small store that records each write and
// can switch to another résumé; Fontsource's metadata answers come from a stub fetch, some held back
// until the test releases them, and the custom font list lives in a stand-in localStorage.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A localStorage stand-in. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
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

// Fontsource's metadata, by package: 'offline' rejects as fetch does with no connection, a number is
// that HTTP status, 'held' waits for release(pkg) and then answers with the font.
const answers = {};
const held = new Map();
const requested = [];
const release = (pkg) => held.get(pkg)?.();
let saved;
before(() => {
  saved = { fetch: globalThis.fetch, localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage') };
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
  globalThis.fetch = async (url) => {
    const pkg = String(url).match(/@fontsource\/([^@]+)@5\/metadata\.json$/)?.[1];
    requested.push(pkg);
    const answer = answers[pkg] ?? 404;
    if (answer === 'offline') throw new TypeError('fetch failed');
    if (answer === 'held') await new Promise((r) => { held.set(pkg, r); });
    const status = answer === 'held' ? 200 : answer;
    const family = pkg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    return { ok: status === 200, status, json: async () => ({ family, weights: [400, 700], styles: ['normal'] }) };
  };
});
after(() => {
  if (saved.fetch === undefined) delete globalThis.fetch;
  else globalThis.fetch = saved.fetch;
  if (saved.localStorage) Object.defineProperty(globalThis, 'localStorage', saved.localStorage);
  else delete globalThis.localStorage;
});

/**
 * The Design panel for `r` with Typography open, over a store that applies each write to the résumé
 * shown: `writes` (every [résumé id, key, value] since the last click), `click(el)`, `button(text)`,
 * `has(text)`, `input()`, `add(name)` (types it and presses Add), `open(other)` (another résumé in the
 * panel, as the editor's switcher does), `text()`, `settings()`.
 */
async function typography(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const writes = [];
  let current = r;
  let show;
  function Store({ initial }) {
    const [held_, setHeld] = useState(initial);
    current = held_;
    show = setHeld;
    const updateSetting = (key, value) => {
      writes.push([current.id, key, value]);
      setHeld((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
    };
    return createElement(DesignPanel, { resume: held_, updateSetting, setTemplate: () => {}, resetSettings: () => {} });
  }
  const view = mount(Store, { initial: r });
  const all = () => [...elements(view.container)];
  const button = (text) => {
    const el = all().find((b) => b.tagName === 'BUTTON' && b.textContent.trim() === text);
    assert.ok(el, `the "${text}" button`);
    return el;
  };
  const click = (el) => {
    writes.length = 0;
    view.act(() => reactProps(el).onClick());
    return [...writes];
  };
  const input = () => all().find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === 'e.g. Nunito, Raleway, Poppins');
  click(button('Typography'));
  return {
    writes,
    click,
    button,
    has: (text) => all().some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    input,
    add(name) {
      view.act(() => reactProps(input()).onChange({ target: { value: name } }));
      click(button('Add'));
    },
    open(other) { view.act(() => show(other)); },
    text: () => view.container.textContent,
    settings: () => current.settings,
    unmount: () => view.unmount(),
  };
}

const cv = (settings = {}) => resume({ settings, personal: { name: 'Morgan Ashby', email: 'morgan@example.com' } });

describe('Add a Google Font: a check that could not be made is not a misspelling (R4-DSN-04 a)', () => {
  for (const [how, answer] of [['offline (fetch rejects)', 'offline'], ['the CDN answering 503', 503]]) {
    it(`${how}: says it could not check, keeps the name, stores nothing`, async () => {
      const pkg = answer === 'offline' ? 'fictional-nunito' : 'fictional-poppins';
      answers[pkg] = answer;
      const name = answer === 'offline' ? 'Fictional Nunito' : 'Fictional Poppins';
      const view = await typography(cv({ font: 'inter' }));
      try {
        view.add(name);
        await until(() => view.has('Add') && requested.includes(pkg), 'the check ends');
        await until(() => /Could not check/.test(view.text()), 'a could-not-check message');
        assert.ok(view.text().includes(`Could not check “${name}”`), 'naming what was typed');
        assert.ok(/offline/.test(view.text()), 'saying the connection may be the cause');
        assert.equal(view.text().includes('was not found on Google Fonts'), false, 'not called a misspelling');
        assert.deepEqual(view.writes, []);
        assert.equal(String(reactProps(view.input()).value), name, 'the name stays to try again');
        assert.equal(view.settings().font, 'inter');
      } finally { await view.unmount(); }
    });
  }

  it('a 404 is still reported as not found', async () => {
    const view = await typography(cv({ font: 'inter' }));
    try {
      view.add('Nowhere Face');
      await until(() => view.text().includes('was not found on Google Fonts'), 'the refusal is shown');
      assert.equal(/Could not check/.test(view.text()), false);
    } finally { await view.unmount(); }
  });
});

describe('Add a Google Font: a slow check does not overwrite a later choice (R4-DSN-04 b)', () => {
  it('a font picked while it checks stands: the check\'s result is not applied', async () => {
    answers['fictional-raleway'] = 'held';
    const view = await typography(cv({ font: 'inter' }));
    try {
      view.add('Fictional Raleway');
      await until(() => held.has('fictional-raleway'), 'the check is waiting on Fontsource');
      const picked = view.click(view.button('Lato'));
      assert.deepEqual(picked.map(([, k, v]) => [k, v]), [['font', 'lato'], ['customFont', '']]);
      release('fictional-raleway');
      await until(() => view.has('Add') && view.has('Fictional Raleway'), 'the check ends, the font is remembered as a chip');
      assert.deepEqual(view.writes.map(([, k, v]) => [k, v]), [['font', 'lato'], ['customFont', '']], 'nothing written after the pick');
      assert.equal(view.settings().font, 'lato', 'Lato stays selected');
      assert.equal(view.settings().customFont, '');
    } finally { await view.unmount(); }
  });

  it('another résumé opened while it checks is left alone, as is the one it was asked for', async () => {
    answers['fictional-karla'] = 'held';
    const first = cv({ font: 'inter' });
    const other = cv({ font: 'literata' });
    const view = await typography(first);
    try {
      view.add('Fictional Karla');
      await until(() => held.has('fictional-karla'), 'the check is waiting on Fontsource');
      view.open(other);
      view.writes.length = 0;
      release('fictional-karla');
      await until(() => view.has('Add') && view.has('Fictional Karla'), 'the check ends');
      assert.deepEqual(view.writes, [], `no write to ${other.id}`);
      assert.equal(view.settings().font, 'literata');
      assert.equal(view.settings().customFont ?? '', '');
    } finally { await view.unmount(); }
  });

  it('with nothing changed meanwhile, the checked font is applied as before', async () => {
    answers['fictional-mulish'] = 'held';
    const view = await typography(cv({ font: 'inter' }));
    try {
      view.add('Fictional Mulish');
      await until(() => held.has('fictional-mulish'), 'the check is waiting on Fontsource');
      release('fictional-mulish');
      await until(() => view.writes.length >= 2, 'the font is applied');
      assert.deepEqual(view.writes.map(([, k, v]) => [k, v]), [['customFont', 'Fictional Mulish'], ['font', '']]);
    } finally { await view.unmount(); }
  });
});
