// R5-HUNT2-LETTER-APPLY-UNDO-WRITES-OTHER-RESUME: the "Generated letter applied" notice's Undo
// (R4-DUX-04) called updateCoverLetter, which patches whichever résumé is active when Undo is
// clicked. The Editor (and its ToastProvider) stays mounted from /resume/A to /resume/B (a JSON
// import navigates there), so an Undo clicked within its 10 s wrote A's old recipient, company,
// subject, body and closing into B's letter. Now the notice leaves when another résumé opens, and
// its Undo writes only while the résumé it applied to is still open.
//
// The real Cover Letter panel is mounted (as in 102-r4-dux-04-letter-apply-undo) under the UI kit's
// ToastProvider, with two résumés and an updateCoverLetter that patches the active one, as the
// store's patchActive does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const LETTER_A = { body: '<p>A wrote this.</p>', subject: 'A subject', closing: 'Best', company: 'Initech', recipientName: 'Sam Lowell' };
const LETTER_B = { body: '<p>B is a different letter.</p>', subject: 'B subject', closing: 'Cheers', company: 'Hooli', recipientName: 'Gavin B' };

const person = (id, coverLetter) => ({
  ...resume({
    personal: { name: 'Jordan Rivera', title: 'Product Designer' },
    sections: [experience([{ role: 'Product Designer', company: 'Globex', description: '' }])],
    coverLetter,
  }),
  id,
});

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('Apply\'s Undo never writes into another résumé (R5-HUNT2)', () => {
  it('after another résumé opens, Undo leaves its letter as it was', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/index.js');
    const docs = { A: person('A', LETTER_A), B: person('B', LETTER_B) };
    let state;
    let open;
    function Editor() {
      const [s, setS] = useState({ active: 'A', letters: { A: LETTER_A, B: LETTER_B } });
      state = s;
      open = (id) => setS((prev) => ({ ...prev, active: id }));
      const r = docs[s.active];
      const cl = s.letters[s.active];
      // The store's patchActive: the résumé active when it is called.
      const updateCoverLetter = (field, value) => setS((prev) => ({
        ...prev, letters: { ...prev.letters, [prev.active]: { ...prev.letters[prev.active], [field]: value } },
      }));
      return createElement(ToastProvider, null,
        createElement(CoverLetterPanel, { resume: { ...r, coverLetter: cl }, coverLetter: cl, personal: r.personal, settings: r.settings, template: r.template, updateCoverLetter }));
    }
    const view = mount(Editor, {});
    try {
      const buttons = (label) => [...elements(view.document.body)].filter((el) => el.tagName === 'BUTTON' && text(el) === label);
      const input = (placeholder) => [...elements(view.document.body)].find((e) => e.tagName === 'INPUT' && e.getAttribute('placeholder') === placeholder);
      view.act(() => reactProps(buttons('Auto-Generate from Resume')[0]).onClick());
      view.act(() => reactProps(input('e.g. Google, Stripe')).onChange({ target: { value: 'Umbrella' } }));
      view.act(() => reactProps(buttons('Apply to Cover Letter')[0]).onClick());
      const applied = state.letters.A;
      assert.equal(applied.company, 'Umbrella', 'Apply wrote the generated letter into A');
      assert.equal(buttons('Undo').length, 1, 'Apply shows a notice with an Undo');

      view.act(() => open('B'));
      for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); });
      // Whatever Undo is still on the page (one leaving, say), clicking it touches neither letter.
      for (const undo of buttons('Undo')) view.act(() => reactProps(undo).onClick());
      assert.deepEqual(state.letters.B, LETTER_B, 'B\'s letter is untouched');
      assert.deepEqual(state.letters.A, applied, 'A keeps what Apply wrote');
    } finally {
      await view.unmount();
    }
  });
});
