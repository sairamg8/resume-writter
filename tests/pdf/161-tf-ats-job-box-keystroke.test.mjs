// TYPING-FREEZE 6: each key typed into ATS Check's job-description box redid the whole ATS report
// (analyzeAtsScore: every section, every item) with the posting, though only the job match reads the
// posting. The report is now kept for the résumé and a key redoes the match alone. The real panel is
// mounted over fake-dom and an in-memory sessionStorage; the résumé is a Proxy that counts reads of
// its sections, so a key's cost is compared with the cost of the match by itself (the report reads
// the sections many times over, the match once), and the box's result is still on the panel.
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
  const counts = { sections: 0 };
  const base = {
    ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform, React' }]), id: 'sk' }] }),
    id: 'res-tf-ats-6',
  };
  const r = new Proxy(base, { get(target, key) { if (key === 'sections') counts.sections += 1; return target[key]; } });
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const { matchResumeWithJob } = await loadModule('/src/utils/atsChecker.js');

  counts.sections = 0;
  matchResumeWithJob(r, 'We use React and Kubernetes');
  const matchOnly = counts.sections;
  assert.ok(matchOnly >= 1);

  counts.sections = 0;
  const view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
  try {
    const mounted = counts.sections;
    assert.ok(mounted > matchOnly * 2, `the report reads the sections many times (${mounted} against ${matchOnly})`);
    const box = [...elements(view.container)]
      .find((el) => el.tagName === 'TEXTAREA' && (el.getAttribute('placeholder') ?? '').startsWith('Paste job posting'));
    assert.ok(box);
    counts.sections = 0;
    view.act(() => reactProps(box).onChange({ target: { value: 'We use React and Kubernetes' } }));
    assert.equal(counts.sections, matchOnly, 'a key reads the résumé as the match does, and no more');
    const text = view.container.textContent;
    assert.match(text, /% Match/);
    assert.match(text, /Kubernetes/);
    counts.sections = 0;
    view.act(() => reactProps(box).onChange({ target: { value: 'We use React and Kubernetes and Go' } }));
    assert.equal(counts.sections, matchOnly, 'and so on for the next key');
  } finally {
    await view.unmount();
  }
});
