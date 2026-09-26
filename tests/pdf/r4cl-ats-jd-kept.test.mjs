// R4-CL-03: the job description pasted into ATS Check → Target Job Description Scanner survives a
// trip to another tab. The Editor mounts the panel only while ATS Check is open, and the posting was
// the panel's own state, so going to the Résumé tab to add a missing keyword and coming back showed an
// empty box and no Match %. It is kept for the tab's session (sessionStorage) under the résumé's id,
// so another résumé's scanner starts empty.
//
// The real panel is mounted and unmounted as a tab switch does (react-dom/client over
// tests/pdf/fake-dom.mjs), over an in-memory sessionStorage.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(() => { delete globalThis.sessionStorage; return teardown(); });

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const JD = 'Kubernetes Kubernetes Terraform';
const person = (id) => ({
  ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform' }]), id: 'sk' }] }),
  id,
});
const store = { updateSections() {}, updateSetting() {}, setTemplate() {} };

/** The scanner's box, its value, and the keyword chips the scan lists as missing. */
function scanner(view) {
  const all = [...elements(view.container)];
  const box = all.find((el) => el.tagName === 'TEXTAREA');
  assert.ok(box, 'the scanner\'s box is on the tab');
  const missing = all.filter((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Click to add to Skills')
    .map((el) => el.textContent.replace(/\s+/g, ' ').trim());
  return { box, value: reactProps(box).value, missing };
}

describe('the pasted job description survives a trip to another tab (R4-CL-03)', () => {
  it('is back, with its results, when the ATS Check tab is opened again', async () => {
    globalThis.sessionStorage = memoryStorage();
    const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
    const r = person('res-a');
    let view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
    view.act(() => reactProps(scanner(view).box).onChange({ target: { value: JD } }));
    assert.deepEqual(scanner(view).missing, ['Kubernetes']);
    await view.unmount(); // to the Résumé tab

    view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
    try {
      const back = scanner(view);
      assert.equal(back.value, JD, 'the posting is still in the box');
      assert.deepEqual(back.missing, ['Kubernetes'], 'and its results are shown again');
    } finally {
      await view.unmount();
    }
  });

  it('is the résumé\'s own: another résumé\'s scanner starts empty, even in the same mounted tab', async () => {
    globalThis.sessionStorage = memoryStorage();
    const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
    const a = person('res-a');
    const b = person('res-b');
    let show = null;
    function Tab() {
      const [r, setR] = useState(a);
      show = setR;
      return createElement(AtsCheckerPanel, { resume: r, store });
    }
    const view = mount(Tab, {});
    try {
      view.act(() => reactProps(scanner(view).box).onChange({ target: { value: JD } }));
      view.act(() => show(b));
      assert.equal(scanner(view).value, '', 'résumé B does not show A\'s posting');
      view.act(() => show(a));
      assert.equal(scanner(view).value, JD, 'and A\'s is still A\'s');
    } finally {
      await view.unmount();
    }
    assert.equal(globalThis.sessionStorage.getItem('cpwtcv_ats_jd:res-b'), JSON.stringify(''));
  });
});
