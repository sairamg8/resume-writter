// Word résumé: the contact line prints at the size the PDF prints it (R2-067).
// The Word header's contacts were always 9 pt (wordExportHeader.js: `size: 18`), whatever Design →
// Typography → Base said: at Base 14 the PDF printed them at 13.5 pt and Word still at 9. The PDF's
// contact values follow Base — half a point under it, never under 8 pt, in every header that prints
// PdfContactRow; 1.5 pt under it on Modern's banner — and the Word cover letter already followed it.
// Measured here against the PDF itself, on every template: what the PDF draws is the reference.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allItems, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const EMAIL = 'jordan@example.com';
const PHONE = '+1 555 010 0199';
/** A value as printed: both files keep a contact whole on its line with no-break spaces. */
const plain = (s) => s.replace(/\u00a0/g, ' ');

const cv = (template, settings = {}) => resume({
  template,
  settings: { accentColor: '#2563eb', textColor: '#111111', ...settings },
  sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer' }])],
  personal: { name: 'Jordan Rivera', title: 'Staff Engineer', email: EMAIL, phone: PHONE },
});

/** The size the PDF draws `value` at, pt (pdf.js's item height is the font size). */
async function pdfSize(r, value) {
  const items = allItems(await read(await render(r))).filter((t) => plain(t.str).includes(value));
  assert.ok(items.length, `${r.template}: "${value}" is in the PDF`);
  return Math.round(items[0].h * 100) / 100;
}

/** The size Word prints `value` at, pt: the w:sz of the run that holds it (half-points). */
async function wordSize(r, value) {
  const doc = await renderDocx(r);
  const run = doc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => plain(x).includes(`>${value}<`));
  assert.ok(run, `${r.template}: "${value}" is in the .docx`);
  const sz = run.match(/<w:sz w:val="(\d+)"/)?.[1];
  assert.ok(sz, `${r.template}: "${value}" has a size`);
  return Number(sz) / 2;
}

describe('Word export: the contact line follows Design → Base, as the PDF (R2-067)', () => {
  it('every template: Word prints the email and the phone at the PDF\'s size, at Base 8, 11 and 14', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const fontSizeBase of [8, 11, 14]) {
        const r = cv(template, { fontSizeBase });
        for (const value of [EMAIL, PHONE]) {
          const pdf = await pdfSize(r, value);
          const word = await wordSize(r, value);
          if (word !== pdf) wrong.push(`${template} Base ${fontSizeBase} "${value}": Word ${word} pt, PDF ${pdf} pt`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('Classic at Base 14 prints its contacts at 13.5 pt (27 half-points), not 9 pt', async () => {
    assert.equal(await wordSize(cv('classic', { fontSizeBase: 14 }), EMAIL), 13.5);
    assert.equal(await wordSize(cv('classic', { fontSizeBase: 11 }), EMAIL), 10.5);
  });

  it('the Sidebar\'s Single · ATS-safe page prints Classic\'s contacts, at Classic\'s size', async () => {
    const r = cv('sidebar', { fontSizeBase: 14, sidebarSingleColumn: true });
    assert.equal(await wordSize(r, EMAIL), await pdfSize(r, EMAIL));
    assert.equal(await wordSize(r, EMAIL), 13.5);
  });
});
