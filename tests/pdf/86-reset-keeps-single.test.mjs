// Design → Reset keeps the Sidebar's Layout (R2-089). Reset rebuilt the settings from the ATS-safe
// defaults, which hold no Layout, so a Sidebar in "Single · ATS-safe" went back to the two columns a
// portal may interleave — and the ATS Check warned about them — from a button that promises "this
// template's ATS-safe defaults". The reset runs through the store itself (useAppStore's
// resetSettings), and the résumé it stores is printed and checked.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, section, render, read, itemsWith, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** `r` after Design → Reset Design Settings → Yes, as the store's resetSettings stores it. */
async function reset(r) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) {
      done = true;
      store.resetSettings();
    }
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes[0];
}

/** A Sidebar résumé with a job and a skill (the side column's), styled away from its defaults. */
const cv = (sidebarSingleColumn) => resume({
  template: 'sidebar',
  settings: { sidebarSingleColumn, accentColor: '#e11d48', fontSizeBase: 13, headingStyle: 'box' },
  sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer' }]), section('skills', [{ category: 'Core', skills: 'Go, SQL' }])],
});

/** One column: the Skills title starts where the Experience title does. */
async function oneColumn(r) {
  const pages = await read(await render(r));
  const [exp, skills] = [itemsWith(pages, 'EXPERIENCE')[0], itemsWith(pages, 'SKILLS')[0]];
  assert.ok(exp && skills, 'both section titles print');
  return Math.abs(exp.x - skills.x) < 2;
}

/** The ATS Check's verdict on the template's layout: pass, or warn. */
async function verdict(r) {
  const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
  return analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'template').status;
}

describe('Design → Reset keeps the Sidebar\'s Single · ATS-safe Layout (R2-089)', () => {
  it('the repro: Single · ATS-safe, Reset → still one column, and the ATS Check still passes it', async () => {
    const r = cv(true);
    assert.equal(await oneColumn(r), true, 'one column before');
    const after = await reset(r);
    assert.equal(after.settings.sidebarSingleColumn, true, 'the Layout is kept');
    assert.equal(await oneColumn(after), true, 'one column after Reset');
    assert.equal(await verdict(after), 'pass', 'no multi-column warning');
  });

  it('everything else is reset: the design settings are the template\'s defaults', async () => {
    const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const after = await reset(cv(true));
    const { sidebarSingleColumn, customContactIcons, ...rest } = after.settings;
    const { customContactIcons: none, ...defaults } = defaultSettings('sidebar');
    assert.deepEqual(rest, defaults);
    assert.deepEqual([sidebarSingleColumn, customContactIcons, none], [true, {}, {}]);
  });

  it('Two columns stays two columns (the template\'s own Layout, guard)', async () => {
    const after = await reset(cv(false));
    assert.notEqual(after.settings.sidebarSingleColumn, true);
    assert.equal(await oneColumn(after), false);
  });

  it('the Layout is kept on any template, as a switch keeps it: picking the Sidebar after Reset prints one column', async () => {
    const { settingsAfterReset } = await loadModule('/src/utils/defaultData.js');
    const r = resume({ template: 'classic', settings: { sidebarSingleColumn: true } });
    assert.equal(settingsAfterReset(r).sidebarSingleColumn, true);
  });
});
