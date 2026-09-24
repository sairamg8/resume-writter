// The cover letter's signature, photo and preview hint (R2-043, R2-044, R2-092, R2-134).
// R2-043: the Smart Cover Letter Generator saved 'Candidate' / 'Professional' as the letter's own
// signature for a résumé with no name or title, and its Apply stored whatever it wrote as the
// letter's own signature, so a name or title filled in later reached the letterhead but never the
// signature. R2-044: a Signature Name or Designation typed and deleted again ('') printed no
// signature, though the panel then shows the same empty field and résumé-name placeholder as the
// untouched state, which prints the résumé's name. R2-092: the letterhead printed the résumé photo
// the user hid under Personal Info → Photo, and the panel said "Using resume photo". R2-134: the
// empty-letter preview hint signed "Best regards, <name>" above the closing that really prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useState } from 'react';
import { setup, teardown, resume, renderCover, read, allText, loadModule, readDocx } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

async function coverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}
/** The printed letter's words: the PDF's text and the .docx's paragraphs. */
async function printed(r, opts) {
  return { pdf: allText(await read(await renderCover(r, opts))), docx: (await coverDocx(r)).texts.join(' | ') };
}

/** How many images page 1 of `bytes` paints. */
async function images(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  return ops.fnArray.filter((fn) => fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject).length;
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/**
 * The Cover Letter panel over `r`, its updateCoverLetter patching the letter as the store's does.
 * `act(view, api)` drives it; returns the stored letter.
 */
async function withPanel(r, act) {
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
    const button = (label) => {
      const b = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
      assert.ok(b, `a button reads "${label}"`);
      return b;
    };
    await act({ view, button });
    return letter;
  } finally {
    await view.unmount();
  }
}

const generate = (r) => withPanel(r, ({ view, button }) => {
  view.act(() => reactProps(button('Auto-Generate from Resume')).onClick());
  view.act(() => reactProps(button('Apply to Cover Letter')).onClick());
});

describe('the generated letter\'s signature (R2-043)', () => {
  it('a résumé with no name or title: Apply stores no placeholder signature, and the letter prints none', async () => {
    const r = resume({ personal: { name: '', title: '' }, coverLetter: {} });
    const cl = await generate(r);
    assert.ok(cl.body, 'the body was applied');
    for (const v of [cl.signatureName, cl.signatureDesignation, cl.subject]) {
      assert.ok(!/Candidate|Professional/.test(v || ''), `stored: ${JSON.stringify(cl)}`);
    }
    const { pdf, docx } = await printed({ ...r, coverLetter: cl });
    for (const out of [pdf, docx]) assert.ok(!/Candidate|Professional/.test(out), out);
  });

  it('after Apply, a name and title filled in later reach the signature — the letterhead\'s and the signature\'s agree', async () => {
    for (const before of [{ name: '', title: '' }, { name: 'Old Name', title: 'Old Title' }]) {
      // A letter a previous Apply locked to the name of the time: this Apply replaces it too.
      const r = resume({ personal: before, coverLetter: { signatureName: 'Candidate', signatureDesignation: 'Professional' } });
      const cl = await generate(r);
      const later = { ...r, personal: { name: 'Jane Doe', title: 'Staff Engineer' }, coverLetter: cl };
      // The body is text written at Apply (it may name the old title); the signature is not.
      const { pdf, docx } = await printed(later);
      assert.ok(pdf.startsWith('Jane Doe Staff Engineer') && pdf.endsWith('Sincerely, Jane Doe Staff Engineer'), pdf);
      assert.ok(docx.startsWith('Jane Doe | Staff Engineer') && docx.endsWith('Sincerely, | Jane Doe | Staff Engineer'), docx);
    }
  });
});

describe('a cleared signature field prints what the panel shows (R2-044)', () => {
  it('Signature Name and Designation typed and deleted (\'\', or only spaces) print the résumé\'s name and title, as the untouched fields do', async () => {
    const personal = { name: 'Jane Doe', title: 'Staff Engineer' };
    const untouched = await printed(resume({ personal, coverLetter: { body: '<p>Hello</p>' } }));
    for (const blank of ['', '   ']) {
      const cleared = await printed(resume({ personal, coverLetter: { body: '<p>Hello</p>', signatureName: blank, signatureDesignation: blank } }));
      assert.equal(cleared.pdf, untouched.pdf, JSON.stringify(blank));
      assert.equal(cleared.docx, untouched.docx, JSON.stringify(blank));
      assert.equal(cleared.pdf.split('Jane Doe').length - 1, 2, cleared.pdf);
    }
  });

  it('the panel shows that same name as the field\'s placeholder', async () => {
    const r = resume({ personal: { name: 'Jane Doe', title: 'Staff Engineer' }, coverLetter: { signatureName: '', signatureDesignation: '' } });
    await withPanel(r, ({ view }) => {
      const inputs = [...elements(view.container)].filter((el) => el.tagName === 'INPUT');
      assert.ok(inputs.some((el) => el.getAttribute('placeholder') === 'Jane Doe' && !reactProps(el).value));
      assert.ok(inputs.some((el) => el.getAttribute('placeholder') === 'Staff Engineer' && !reactProps(el).value));
    });
  });

  it('a typed signature still prints as typed', async () => {
    const { pdf, docx } = await printed(resume({ personal: { name: 'Jane Doe' }, coverLetter: { body: '<p>Hello</p>', signatureName: 'J. Doe', signatureDesignation: 'Engineer' } }));
    for (const out of [pdf, docx]) assert.ok(out.includes('J. Doe') && out.includes('Engineer'), out);
  });
});

describe('a résumé photo the user hid (R2-092)', () => {
  const personal = (hiddenFields) => ({ name: 'Jane Doe', photo: PNG, hiddenFields });

  it('the letter prints no photo for a hidden résumé photo, in every template', async () => {
    const { TEMPLATES } = await import('./harness.mjs');
    for (const template of TEMPLATES) {
      const shown = await images(await renderCover(resume({ template, personal: personal([]), coverLetter: { body: '<p>Hello</p>' } })));
      const hidden = await images(await renderCover(resume({ template, personal: personal(['photo']), coverLetter: { body: '<p>Hello</p>' } })));
      assert.equal(shown, 1, `${template}: a shown photo prints`);
      assert.equal(hidden, 0, `${template}: a hidden one does not`);
    }
  });

  it('the letter\'s own photo still prints over a hidden résumé photo', async () => {
    const r = resume({ personal: personal(['photo']), coverLetter: { body: '<p>Hello</p>', clPhoto: PNG } });
    assert.equal(await images(await renderCover(r)), 1);
  });

  it('the panel no longer says it uses the hidden résumé photo', async () => {
    const r = resume({ personal: personal(['photo']), coverLetter: {} });
    await withPanel(r, ({ view }) => {
      const note = [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'letter-photo-note');
      assert.ok(note && !/Using resume photo/.test(text(note)), note && text(note));
      assert.ok(![...elements(view.container)].some((el) => el.tagName === 'IMG'), 'no faded résumé photo in the upload target');
    });
  });
});

describe('the empty letter\'s preview (R2-134)', () => {
  it('signs off once: with the closing that prints, not a second "Best regards"', async () => {
    const r = resume({ personal: { name: 'Jane Doe', title: 'Staff Engineer' }, coverLetter: {} });
    const pdf = allText(await read(await renderCover(r, { preview: true })));
    assert.ok(!pdf.includes('Best regards'), pdf);
    assert.equal(pdf.split('Jane Doe').length - 1, 2, `the letterhead and the one signature: ${pdf}`);
    assert.ok(pdf.includes('Sincerely,'), pdf);
  });
});

// R2-130: the generated paragraphs printed 2 pt apart, one block, in the PDF and Word.
describe('the generated letter prints its paragraphs apart (R2-130)', () => {
  it('a blank line between the salutation and each paragraph, in the PDF and in Word', async () => {
    const { generateCoverLetter } = await loadModule('/src/utils/coverLetterGenerator.js');
    const r = resume({ personal: { name: 'Jane Doe', title: 'Engineer' } });
    r.coverLetter = generateCoverLetter({ resume: r, company: 'Globex', recipientName: 'Sam' });
    const items = (await read(await renderCover(r))).flatMap((p) => p.items);
    const y = (start) => items.find((t) => t.str.startsWith(start)).y;
    const line = y('Dear Sam,') - y('I am writing');
    // At 11 pt and Line Height 1.5 one line is 16.5 pt: a blank line between makes it two or more.
    assert.ok(line > 30, `the salutation's baseline sits ${line} pt above the first paragraph's`);
    const texts = (await coverDocx(r)).texts;
    const at = texts.indexOf('Dear Sam,');
    assert.ok(at >= 0 && texts[at + 1].trim() === '' && texts[at + 2].startsWith('I am writing'), texts.join(' | '));
  });
});
