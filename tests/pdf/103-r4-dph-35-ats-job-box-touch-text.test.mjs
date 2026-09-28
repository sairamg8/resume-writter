// R4-DPH-35: ATS Check → Target Job Description Scanner's box is 16 px on a touch screen. iOS Safari
// zooms the page into any field it focuses whose text is under 16 px, and the box a posting is pasted
// or typed into — the only field on the tab — was 12 px (text-xs) with nothing for a touch screen, so
// every tap on it zoomed the page. It now carries pointer-coarse:text-base, as the kit's controlClass
// and the job tracker's fields do (tests/pdf/81-job-inputs-touch-text.test.mjs); with a mouse it stays
// 12 px. The real panel is mounted (react-dom/client over tests/pdf/fake-dom.mjs) over an in-memory
// sessionStorage (the box is kept there, R4-CL-03); fake-dom has no layout or media queries, so the
// box's class tokens are checked.
// Run: node --test tests/pdf/103-r4-dph-35-ats-job-box-touch-text.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(() => { delete globalThis.sessionStorage; return teardown(); });

function memoryStorage() {
  const map = new Map();
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const store = { updateSections() {}, updateSetting() {}, setTemplate() {} };

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

it('R4-DPH-35: the job description box is 16 px on a touch screen and 12 px with a mouse', async () => {
  globalThis.sessionStorage = memoryStorage();
  const r = {
    ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform' }]), id: 'sk' }] }),
    id: 'res-dph-35',
  };
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
  try {
    const box = [...elements(view.container)]
      .find((el) => el.tagName === 'TEXTAREA' && (el.getAttribute('placeholder') ?? '').startsWith('Paste job posting'));
    assert.ok(box, 'the scanner\'s box is on the tab');
    assert.ok(tokens(box).has('pointer-coarse:text-base'), 'the box is 12 px on a touch screen: iOS zooms the page into it');
    assert.ok(tokens(box).has('text-xs'), 'with a mouse it keeps its 12 px');
    assert.equal(tokens(box).has('text-base'), false, 'it is not 16 px with a mouse too');
  } finally {
    await view.unmount();
  }
});
