// CYC6 letter generator: the Smart Cover Letter Generator kept the Target Role typed for one letter
// when another opened in the same Editor. The Editor and the Cover Letter panel stay mounted from
// /resume/A to /resume/B (a JSON import, history Back), and the generator is a part of the panel, so
// B's generator started on A's role and its Apply wrote "Application for <A's role>" into B's subject.
// Now the generator is one per letter: B's opens on its own (empty) Target Role.
//
// The real Cover Letter panel is mounted under the UI kit's ToastProvider, as
// r5hunt2-letter-undo-other-resume does, with two letters and the Editor's switch between them.
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

const person = (id) => ({
  ...resume({
    personal: { name: 'Jordan Rivera', title: 'Product Designer' },
    sections: [experience([{ role: 'Product Designer', company: 'Globex', description: '' }])],
    coverLetter: {},
  }),
  id,
});

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('the generator starts from the letter that is open (CYC6)', () => {
  it('a Target Role typed for letter A is not B\'s', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/index.js');
    const docs = { A: person('A'), B: person('B') };
    let open;
    function Editor() {
      const [active, setActive] = useState('A');
      open = setActive;
      const r = docs[active];
      return createElement(ToastProvider, null,
        createElement(CoverLetterPanel, { resume: r, coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template: r.template, updateCoverLetter: () => {} }));
    }
    const view = mount(Editor, {});
    try {
      const all = () => [...elements(view.document.body)];
      const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label);
      // Inside the generator's dialog: the panel's own Signature Designation field has the same placeholder (the
      // person's title) and comes first in the page, so a search of the whole page typed into the wrong box.
      const dialog = () => all().find((el) => el.getAttribute('aria-modal') === 'true');
      const role = () => [...elements(dialog())].find((e) => e.tagName === 'INPUT' && e.getAttribute('placeholder') === 'Product Designer');

      view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
      view.act(() => reactProps(role()).onChange({ target: { value: 'Staff Engineer' } }));
      assert.equal(reactProps(role()).value, 'Staff Engineer', 'the role is typed into A\'s generator');
      assert.ok(all().some((el) => text(el).includes('Application for Staff Engineer')), 'and A\'s preview uses it');
      view.act(() => reactProps(button('Cancel')).onClick());

      view.act(() => open('B'));
      view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
      assert.equal(reactProps(role()).value, '', 'B\'s generator opens on an empty Target Role');
      assert.ok(!all().some((el) => text(el).includes('Staff Engineer')), 'nothing of A\'s role is in B\'s preview');
    } finally {
      await view.unmount();
    }
  });
});
