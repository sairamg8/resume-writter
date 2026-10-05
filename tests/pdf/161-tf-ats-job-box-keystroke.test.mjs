// TYPING-FREEZE 6: each key typed into ATS Check's job-description box redid the whole ATS report
// (analyzeAtsScore: every section, every item) with the posting, though only the job match reads the
// posting. The report is now kept for the résumé and a key redoes the match alone. The real panel is
// mounted over fake-dom and an in-memory sessionStorage; the résumé is a Proxy that counts reads of
// its fields, so a key's cost is compared with the cost of the match by itself (the report reads the
// résumé many times over what the match does), and the box's result is still on the panel.
// Run: node --test tests/pdf/161-tf-ats-job-box-keystroke.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
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

const store = { updateSections() {}, updateSetting() {}, setTemplate() {} };

it('a key typed in the job box redoes the job match, not the whole report', async () => {
  globalThis.sessionStorage = memoryStorage();
  const counts = { reads: 0 };
  const base = {
    ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform, React' }]), id: 'sk' }] }),
    id: 'res-tf-ats-6',
  };
  const r = new Proxy(base, { get(target, key) { counts.reads += 1; return target[key]; } });
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');

  counts.reads = 0;
  const view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
  try {
    // Mounting reads the résumé for the report (and the render); a key must cost less than that.
    const mounted = counts.reads;
    const box = [...elements(view.container)]
      .find((el) => el.tagName === 'TEXTAREA' && (el.getAttribute('placeholder') ?? '').startsWith('Paste job posting'));
    assert.ok(box);
    counts.reads = 0;
    view.act(() => reactProps(box).onChange({ target: { value: 'We use React and Kubernetes' } }));
    const first = counts.reads;
    assert.ok(first < mounted, `a key read the résumé ${first} times, the report and the render together ${mounted}`);
    const text = view.container.textContent;
    assert.match(text, /% Match/);
    assert.match(text, /Kubernetes/);
    counts.reads = 0;
    view.act(() => reactProps(box).onChange({ target: { value: 'We use React and Kubernetes and Go' } }));
    assert.ok(counts.reads < mounted, `the next key read the résumé ${counts.reads} times, against ${mounted}`);
  } finally {
    await view.unmount();
  }
});
