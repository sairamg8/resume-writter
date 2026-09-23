// The Smart Cover Letter Generator's Apply filled the letter's recipient block with words the user
// never typed (AUD-31). generateCoverLetter always returned the title 'Hiring Team' (the modal has
// no title input) and turned a blank name into 'Hiring Manager', while the salutation it wrote for
// that same blank name said "Dear Hiring Team,". So the modal's default printed
// "Hiring Manager / Hiring Team" above "Dear Hiring Manager,", a cleared name printed
// "Hiring Manager / Hiring Team" above "Dear Hiring Team,", and a real person got an invented title.
// The panel's Apply wrote only truthy fields as well, so once the generator stops inventing values a
// blank name could not clear the last letter's recipient: the block would still name Sarah Smith
// over "Dear Hiring Team,".
//
// The real Cover Letter panel is mounted (react-dom/client through tests/pdf/fake-dom.mjs) with an
// updateCoverLetter that patches the letter the way the store's does, the generator is driven
// through its own controls, and the stored letter is printed to PDF and .docx: the block must name
// exactly whom the body greets, and no one else.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, experience, renderCover, read, allItems, allText, loadModule, readDocx } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A letter already addressed to someone, as a user who wrote to Sarah before would have it. */
const TO_SARAH = { recipientName: 'Sarah Smith', recipientTitle: 'Engineering Manager', body: '<p>Hello</p>' };
/** Words the generator used to invent for the recipient block. */
const INVENTED = ['Hiring Team', 'Hiring Manager'];

const person = (coverLetter = {}) => resume({
  personal: { name: 'Test Person', title: 'Engineer', email: 'test@example.com' },
  sections: [experience([{ role: 'Staff Engineer', company: 'Globex', description: '' }])],
  coverLetter,
});

/**
 * The Cover Letter panel over `r`, its updateCoverLetter patching the letter as useResumeStore's
 * does. Opens the generator, sets its Recipient Name input to `recipient` (undefined: leaves the
 * modal's own starting value), clicks Apply, and returns the résumé with the letter it stored and
 * the value the input held when the modal opened.
 */
async function generateOver(r, recipient) {
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
    view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
    const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('placeholder') === 'e.g. Hiring Manager');
    assert.ok(input, 'the generator\'s Recipient Name input is open');
    const opened = reactProps(input).value;
    if (recipient !== undefined) view.act(() => reactProps(input).onChange({ target: { value: recipient } }));
    view.act(() => reactProps(button('Apply to Cover Letter')).onClick());
    return { r: { ...r, coverLetter: letter }, opened };
  } finally {
    await view.unmount();
  }
}

/** The stored letter printed: every PDF text item and every .docx paragraph, trimmed. */
async function printed(r) {
  const pages = await read(await renderCover(r));
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  const docx = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  return {
    pdf: allItems(pages).map((t) => t.str.trim()).filter(Boolean),
    pdfText: allText(pages).replace(/\s+/g, ' '),
    docx: docx.texts.map((t) => t.trim()).filter(Boolean),
  };
}

/** How many lines of `lines` read exactly `s`. */
const count = (lines, s) => lines.filter((l) => l === s).length;

describe('the generator\'s Apply writes only the recipient the user typed (AUD-31)', () => {
  it('the modal\'s own "Hiring Manager" prints once in the block, with no "Hiring Team" title, in the PDF and the .docx', async () => {
    const { r, opened } = await generateOver(person({ body: '<p>Hello</p>' }));
    assert.equal(opened, 'Hiring Manager', 'the modal still starts at its default');
    assert.equal(r.coverLetter.recipientName, 'Hiring Manager');
    assert.equal(r.coverLetter.recipientTitle, '', 'the generator asks for no title, so it stores none');
    const out = await printed(r);
    for (const [where, lines] of [['PDF', out.pdf], ['docx', out.docx]]) {
      assert.equal(count(lines, 'Hiring Team'), 0, `${where}: no invented title — ${lines.join(' | ')}`);
      assert.equal(count(lines, 'Hiring Manager'), 1, `${where}: the block names the recipient once — ${lines.join(' | ')}`);
    }
    assert.ok(out.pdfText.includes('Dear Hiring Manager,'), out.pdfText);
    assert.ok(!out.pdfText.includes('Hiring Team'), out.pdfText);
  });

  it('a cleared recipient clears the last letter\'s name and title, so the block agrees with "Dear Hiring Team,"', async () => {
    const { r } = await generateOver(person(TO_SARAH), '');
    assert.equal(r.coverLetter.recipientName, '');
    assert.equal(r.coverLetter.recipientTitle, '');
    const out = await printed(r);
    for (const [where, lines] of [['PDF', out.pdf], ['docx', out.docx]]) {
      for (const s of [...INVENTED, 'Sarah Smith', 'Engineering Manager']) {
        assert.equal(count(lines, s), 0, `${where}: no "${s}" line — ${lines.join(' | ')}`);
      }
    }
    assert.ok(out.pdfText.includes('Dear Hiring Team,'), out.pdfText);
    assert.ok(!out.pdfText.includes('Hiring Manager') && !out.pdfText.includes('Sarah Smith'), out.pdfText);
    assert.ok(out.docx.includes('Dear Hiring Team,'), out.docx.join(' | '));
  });

  it('a new recipient prints alone: no invented title and no title left from the last person', async () => {
    const { r } = await generateOver(person(TO_SARAH), 'Jane Smith');
    assert.deepEqual([r.coverLetter.recipientName, r.coverLetter.recipientTitle], ['Jane Smith', '']);
    const out = await printed(r);
    for (const [where, lines] of [['PDF', out.pdf], ['docx', out.docx]]) {
      assert.equal(count(lines, 'Jane Smith'), 1, `${where}: ${lines.join(' | ')}`);
      for (const s of [...INVENTED, 'Sarah Smith', 'Engineering Manager']) {
        assert.equal(count(lines, s), 0, `${where}: no "${s}" line — ${lines.join(' | ')}`);
      }
    }
    assert.ok(out.pdfText.includes('Dear Jane Smith,'), out.pdfText);
  });

  it('regenerating for the same person keeps the title the user typed for them', async () => {
    const { r } = await generateOver(person(TO_SARAH), '  Sarah Smith ');
    assert.deepEqual([r.coverLetter.recipientName, r.coverLetter.recipientTitle], ['Sarah Smith', 'Engineering Manager']);
    const out = await printed(r);
    for (const [where, lines] of [['PDF', out.pdf], ['docx', out.docx]]) {
      assert.equal(count(lines, 'Engineering Manager'), 1, `${where}: ${lines.join(' | ')}`);
      assert.equal(count(lines, 'Hiring Team'), 0, `${where}: ${lines.join(' | ')}`);
    }
  });
});
