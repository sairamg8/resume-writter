// R5-HUNT12-VANITY-PHONE-TEL-LINK-DROPS-LETTERS: a vanity phone number ("1-800-FLOWERS") linked to
// tel:1800 in every export, as contactHref dropped its letters. The PDF's contact lines (five templates
// and the cover letter), its reference cards (main column and Sidebar) and the Word file's contact line
// and reference card all link through contactHref, so each now holds the same tel:18003569377 and prints
// the number as typed; a reference phone that is no number ("Room 101") is text, not a link.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderCover, renderDocx, read, allText, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const squash = (s) => s.replace(/\s+/g, '');
const telOf = (list) => [...new Set(list.filter((u) => /^tel:/i.test(u || '')))];
const pdfTels = (pages) => telOf(pages.flatMap((p) => p.links.map((l) => l.url)));
const printed = (pages, s) => squash(allText(pages)).includes(squash(s));

describe('a vanity phone in the contact line', () => {
  const personal = { name: 'Robin Sample', phone: '1-800-FLOWERS' };
  const DOCUMENTS = [
    ...TEMPLATES.map((template) => [template, () => render(resume({ template, personal }))]),
    ['cover letter', () => renderCover(resume({ personal }))],
  ];
  for (const [name, make] of DOCUMENTS) {
    it(`${name}: links its keypad digits and prints as typed`, async () => {
      const pages = await read(await make());
      assert.deepEqual(pdfTels(pages), ['tel:18003569377']);
      assert.ok(printed(pages, '1-800-FLOWERS'), allText(pages));
    });
  }

  it('Word: links its keypad digits and prints as typed', async () => {
    const docx = await renderDocx(resume({ personal }));
    assert.deepEqual(telOf(docx.links), ['tel:18003569377']);
    assert.ok(docx.texts.some((t) => t.includes('1-800-FLOWERS')), docx.texts.join(' | '));
  });
});

describe('a vanity phone on a reference card', () => {
  const references = (phone) => [section('references', [{ name: 'Pat Referee', phone }])];

  for (const template of TEMPLATES) {
    it(`${template}: links its keypad digits, and a phone that is no number is text`, async () => {
      const pages = await read(await render(resume({ template, sections: references('1-800-GO-FEDEX') })));
      assert.deepEqual(pdfTels(pages), ['tel:18004633339']);
      assert.ok(printed(pages, '1-800-GO-FEDEX'), allText(pages));
      const text = await read(await render(resume({ template, sections: references('Room 101') })));
      assert.deepEqual(pdfTels(text), []);
      assert.ok(printed(text, 'Room 101'), allText(text));
    });
  }

  it('Word: links its keypad digits, and a phone that is no number is text', async () => {
    const docx = await renderDocx(resume({ personal: { name: 'Robin Sample' }, sections: references('1-800-GO-FEDEX') }));
    assert.deepEqual(telOf(docx.links), ['tel:18004633339']);
    assert.ok(docx.texts.some((t) => t.includes('1-800-GO-FEDEX')), docx.texts.join(' | '));
    const text = await renderDocx(resume({ personal: { name: 'Robin Sample' }, sections: references('Room 101') }));
    assert.deepEqual(telOf(text.links), []);
    assert.ok(text.texts.some((t) => t.includes('Room 101')), text.texts.join(' | '));
  });
});
