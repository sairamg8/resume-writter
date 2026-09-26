// R4-CL-01: the Smart Cover Letter Generator starts from the letter's own recipient and company.
// It opened on a blank Target Company and a Recipient of "Hiring Manager", whatever the letter held,
// so Apply replaced a typed recipient with "Hiring Manager" (and cleared the title typed for them),
// and the body said "…opportunity at [Company Name]" under a recipient block that still printed the
// letter's company, because Apply wrote the company only when the generator had one.
//
// The real Cover Letter panel is mounted (react-dom/client through tests/pdf/fake-dom.mjs) with an
// updateCoverLetter that patches the letter as the store's does, and the generator is driven through
// its own controls.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const person = (coverLetter) => resume({
  personal: { name: 'Test Person', title: 'Engineer', email: 'test@example.com' },
  sections: [experience([{ role: 'Staff Engineer', company: 'Globex', description: '' }])],
  coverLetter,
});

/**
 * Opens the generator over `r`'s letter, reads its inputs, applies `edits` ({ company, recipient }:
 * values typed into the modal, undefined leaves one as it opened), clicks Apply and returns the
 * values the modal opened with and the letter it stored.
 */
async function generate(r, edits = {}) {
  const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
  let letter = r.coverLetter;
  function Tab() {
    const [cl, setCl] = useState(r.coverLetter);
    letter = cl;
    const updateCoverLetter = (field, value) => setCl((prev) => ({ ...prev, [field]: value }));
    return createElement(CoverLetterPanel, { coverLetter: cl, personal: r.personal, settings: r.settings, template: r.template, updateCoverLetter });
  }
  const view = mount(Tab, {});
  try {
    const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
    const button = (label) => {
      const b = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
      assert.ok(b, `a button reads "${label}"`);
      return b;
    };
    const input = (placeholder) => {
      const el = [...elements(view.container)].find((e) => e.tagName === 'INPUT' && e.getAttribute('placeholder') === placeholder);
      assert.ok(el, `the generator has the "${placeholder}" input`);
      return el;
    };
    view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
    const opened = { company: reactProps(input('e.g. Google, Stripe')).value, recipient: reactProps(input('e.g. Hiring Manager')).value };
    if (edits.company !== undefined) view.act(() => reactProps(input('e.g. Google, Stripe')).onChange({ target: { value: edits.company } }));
    if (edits.recipient !== undefined) view.act(() => reactProps(input('e.g. Hiring Manager')).onChange({ target: { value: edits.recipient } }));
    view.act(() => reactProps(button('Apply to Cover Letter')).onClick());
    return { opened, cl: letter };
  } finally {
    await view.unmount();
  }
}

const plain = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the generator starts from the letter\'s own recipient and company (R4-CL-01)', () => {
  const JANE = { recipientName: 'Jane Smith', recipientTitle: 'Engineering Manager', company: 'Acme', body: '<p>Hello</p>' };

  it('opens on the letter\'s recipient and company, and Apply keeps them, with the title typed for her', async () => {
    const { opened, cl } = await generate(person(JANE));
    assert.deepEqual(opened, { company: 'Acme', recipient: 'Jane Smith' });
    assert.equal(cl.recipientName, 'Jane Smith');
    assert.equal(cl.recipientTitle, 'Engineering Manager');
    assert.equal(cl.company, 'Acme');
    const body = plain(cl.body);
    assert.match(body, /Dear Jane Smith,/);
    assert.match(body, /at Acme/);
    assert.ok(!body.includes('[Company Name]'), body);
    assert.ok(!body.includes('Hiring Manager'), body);
  });

  it('a letter with no recipient opens on none, and is greeted "Dear Hiring Team,"', async () => {
    const { opened, cl } = await generate(person({ company: 'Acme', body: '<p>Hello</p>' }));
    assert.deepEqual(opened, { company: 'Acme', recipient: '' });
    assert.equal(cl.recipientName, '');
    assert.match(plain(cl.body), /Dear Hiring Team,/);
  });

  it('a Company cleared in the generator clears the letter\'s, so the block and the body agree', async () => {
    const { cl } = await generate(person(JANE), { company: '' });
    assert.equal(cl.company, '', 'the block no longer prints "Acme" above a body about "[Company Name]"');
    assert.match(plain(cl.body), /\[Company Name\]/);
  });

  it('a company typed in the generator replaces the letter\'s in the block and the body', async () => {
    const { cl } = await generate(person(JANE), { company: 'Globex' });
    assert.equal(cl.company, 'Globex');
    assert.match(plain(cl.body), /at Globex/);
    assert.ok(!plain(cl.body).includes('Acme'));
  });

  it('each opening reads the letter afresh: a company typed and cancelled is not what the next opening shows', async () => {
    const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
    const r = person(JANE);
    const view = mount(() => createElement(CoverLetterPanel, { coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template: r.template, updateCoverLetter: () => {} }), {});
    try {
      const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
      const button = (label) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
      const company = () => [...elements(view.container)].find((e) => e.tagName === 'INPUT' && e.getAttribute('placeholder') === 'e.g. Google, Stripe');
      view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
      view.act(() => reactProps(company()).onChange({ target: { value: 'Initech' } }));
      view.act(() => reactProps(button('Cancel')).onClick());
      view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
      assert.equal(reactProps(company()).value, 'Acme');
    } finally {
      await view.unmount();
    }
  });
});
