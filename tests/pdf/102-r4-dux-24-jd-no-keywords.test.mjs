// R4-DUX-24: ATS Check → Target Job Description Scanner says so when the pasted text holds no
// keyword. A short or non-technical posting ("We are looking for a strong candidate to join our
// team.") is all stop words, so matchResumeWithJob returns null and the panel showed no % Match, no
// list and no message: the box took the text and nothing happened. Now a line under the box asks
// for the full posting. An empty box, and a posting that does yield keywords, show no such line.
//
// The real panel is mounted (react-dom/client over tests/pdf/fake-dom.mjs), over an in-memory
// sessionStorage (the box is kept there, R4-CL-03).
import { before, after, describe, it } from 'node:test';
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

const r = {
  ...resume({ template: 'classic', sections: [{ ...section('skills', [{ category: 'Tools', skills: 'Terraform' }]), id: 'sk' }] }),
  id: 'res-dux-24',
};
const store = { updateSections() {}, updateSetting() {}, setTemplate() {} };

/** The scanner's box, its "no keywords" line (or null), and whether a % Match badge shows. */
function scanner(view) {
  const all = [...elements(view.container)];
  const box = all.find((el) => el.tagName === 'TEXTAREA');
  assert.ok(box, 'the scanner\'s box is on the tab');
  const note = all.find((el) => el.tagName === 'P' && /No skills or keywords found in this text/.test(el.textContent)) ?? null;
  const badge = all.some((el) => el.tagName === 'DIV' && /^\d+% Match$/.test(el.textContent.trim()));
  return { box, note, badge };
}

describe('the job scanner says when a pasted posting has no keywords (R4-DUX-24)', () => {
  it('shows a line asking for the full posting, and hides it for an empty box or a real posting', async () => {
    globalThis.sessionStorage = memoryStorage();
    const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
    const view = mount(() => createElement(AtsCheckerPanel, { resume: r, store }), {});
    try {
      assert.equal(scanner(view).note, null, 'an empty box asks for nothing');

      view.act(() => reactProps(scanner(view).box).onChange({ target: { value: 'We are looking for a strong candidate to join our team.' } }));
      const vague = scanner(view);
      assert.equal(vague.badge, false, 'no keyword, so no % Match');
      assert.ok(vague.note, 'the scanner says it found no keyword');
      assert.match(vague.note.textContent, /paste the full posting/);

      view.act(() => reactProps(scanner(view).box).onChange({ target: { value: '   \n  ' } }));
      assert.equal(scanner(view).note, null, 'blank space is an empty box');

      view.act(() => reactProps(scanner(view).box).onChange({ target: { value: 'Kubernetes Kubernetes Terraform' } }));
      const real = scanner(view);
      assert.equal(real.badge, true, 'a posting with keywords shows its % Match');
      assert.equal(real.note, null, 'and no "no keywords" line');
    } finally {
      await view.unmount();
    }
  });
});
