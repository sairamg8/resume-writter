// R4-DUX-04: Cover Letter → Auto-Generate from Resume → "Apply to Cover Letter" wrote over the
// letter the user had written — its body, subject, closing, company and recipient — and blanked the
// Signature Name and Designation they had typed, with no confirm and no undo (only a grey footer
// line in the modal said so). Now Apply keeps a typed signature (the generator writes none), and its
// notice has an Undo that puts back every field Apply touched, as it was.
//
// The real Cover Letter panel is mounted (react-dom/client through tests/pdf/fake-dom.mjs) under the
// UI kit's ToastProvider, as the Editor mounts it, with an updateCoverLetter that patches the letter
// as the store's does; the generator is driven through its own buttons.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const WRITTEN = {
  body: '<p>I have followed Initech for years and wrote this letter myself.</p>',
  subject: 'My application — Product Designer',
  closing: 'Warm regards',
  company: 'Initech',
  recipientName: 'Sam Lowell',
  recipientTitle: 'Design Director',
  signatureName: 'J. Rivera',
  signatureDesignation: 'Design Lead',
};

const person = (coverLetter) => resume({
  personal: { name: 'Jordan Rivera', title: 'Product Designer', email: 'jordan@example.com' },
  sections: [experience([{ role: 'Product Designer', company: 'Globex', description: '' }])],
  coverLetter,
});

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/**
 * Mounts the panel over `r` under a ToastProvider, opens the generator, types `company` into it
 * (so Apply writes a new company), clicks Apply, then runs `after({ letter, button })`: `letter()`
 * is the letter as stored now, `button(label)` a button anywhere on the page (the toast's too).
 */
async function applyGenerated(r, company, after) {
  const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
  const { ToastProvider } = await loadModule('/src/components/ui/index.js');
  let letter = r.coverLetter;
  function Tab() {
    const [cl, setCl] = useState(r.coverLetter);
    letter = cl;
    const updateCoverLetter = (field, value) => setCl((prev) => ({ ...prev, [field]: value }));
    return createElement(ToastProvider, null,
      createElement(CoverLetterPanel, { coverLetter: cl, personal: r.personal, settings: r.settings, template: r.template, updateCoverLetter }));
  }
  const view = mount(Tab, {});
  try {
    const button = (label) => [...elements(view.document.body)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
    const input = (placeholder) => [...elements(view.document.body)].find((e) => e.tagName === 'INPUT' && e.getAttribute('placeholder') === placeholder);
    view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
    const companyInput = input('e.g. Google, Stripe');
    assert.ok(companyInput, 'the generator has its Target Company input');
    view.act(() => reactProps(companyInput).onChange({ target: { value: company } }));
    view.act(() => reactProps(button('Apply to Cover Letter')).onClick());
    await after({ letter: () => letter, button, act: view.act });
  } finally {
    await view.unmount();
  }
}

describe('Apply generated letter loses nothing the user wrote (R4-DUX-04)', () => {
  it('keeps the Signature Name and Designation the user typed', async () => {
    await applyGenerated(person(WRITTEN), 'Umbrella', ({ letter }) => {
      const cl = letter();
      assert.notEqual(cl.body, WRITTEN.body, 'the generated body was applied');
      assert.equal(cl.signatureName, 'J. Rivera');
      assert.equal(cl.signatureDesignation, 'Design Lead');
    });
  });

  it('shows a notice whose Undo puts back every field Apply replaced', async () => {
    await applyGenerated(person(WRITTEN), 'Umbrella', ({ letter, button, act }) => {
      const applied = letter();
      assert.notEqual(applied.body, WRITTEN.body, 'the generated body was applied');
      assert.equal(applied.company, 'Umbrella', 'the generator\'s company was applied');
      const undo = button('Undo');
      assert.ok(undo, 'Apply shows a notice with an Undo');
      act(() => reactProps(undo).onClick());
      const restored = letter();
      for (const [key, value] of Object.entries(WRITTEN)) assert.equal(restored[key], value, key);
    });
  });

  it('Undo on a new letter takes the generated text away again', async () => {
    await applyGenerated(person({}), 'Umbrella', ({ letter, button, act }) => {
      assert.ok(letter().body, 'the generated body was applied');
      act(() => reactProps(button('Undo')).onClick());
      const restored = letter();
      for (const key of ['body', 'subject', 'company', 'recipientName']) assert.ok(!restored[key], `${key}: ${JSON.stringify(restored[key])}`);
    });
  });
});
