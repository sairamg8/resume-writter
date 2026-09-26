// R4-DUX-03: ATS Check → "Switch to Classic" replaced the template, its heading style and its title
// case with no notice and no Undo (its tooltip even said "There is no undo."), while the same switch
// made in Design → Template raises a "Template: Classic" notice whose Undo puts the old look back
// (usePickCard, A4). The ATS button now switches the way a picked card does: the same notice, and
// its Undo hands back the template, heading style and title case the résumé had.
//
// Mounted as Editor.jsx mounts it — the real store (useAppStore over an in-memory localStorage)
// inside the Editor's ToastProvider — with react-dom/client over tests/pdf/fake-dom.mjs.
// Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => {
  await setup();
  patchFakeDom();
});
after(teardown);

const KEY = 'cpwtcv_v1';
const SWITCH = 'Switch to Classic';
/** A heading style and title case no template brings on its own, so "back" is a real assertion. */
const PICKED = { headingStyle: 'box', sectionTitleCase: 'normal' };

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const buttonsIn = (root) => [...elements(root)].filter((el) => el.tagName === 'BUTTON');

it('"Switch to Classic" raises the "Template: Classic" notice, and its Undo puts the old look back', async () => {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
  const r = resume({ template: 'sidebar', settings: PICKED, personal: { name: 'Robin Sample' } });
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  function AtsTab() {
    store = useAppStore();
    return h(AtsCheckerPanel, { resume: store.activeResume, store });
  }
  const view = mount(() => h(ToastProvider, null, h(AtsTab)), {});
  try {
    const was = store.appState.resumes[0];
    const button = buttonsIn(view.container).find((el) => text(el) === SWITCH);
    assert.ok(button, `no "${SWITCH}" button`);
    assert.doesNotMatch(reactProps(button).title, /no undo/i, 'the tooltip no longer says the switch cannot be undone');

    view.act(() => reactProps(button).onClick({}));
    assert.equal(store.appState.resumes[0].template, 'classic', 'the button still switches to Classic');

    const region = [...elements(view.document.body)].find((el) => el.getAttribute('role') === 'status');
    assert.ok(region, 'the notification stack is on the page');
    assert.match(text(region), /Template: Classic/, 'the switch raises the same notice Design → Template does');
    const undo = buttonsIn(region).find((el) => text(el) === 'Undo');
    assert.ok(undo, `the notice offers Undo — it reads: "${text(region)}"`);

    view.act(() => reactProps(undo).onClick({}));
    const now = store.appState.resumes[0];
    assert.equal(now.template, 'sidebar', 'Undo puts the template back');
    assert.equal(now.settings.headingStyle, PICKED.headingStyle, 'and the heading style');
    assert.equal(now.settings.sectionTitleCase, PICKED.sectionTitleCase, 'and the title case');
    assert.deepEqual(now.settings, was.settings, 'every setting as it was');
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
