// The Word résumé prints the name in the weight its PDF does (R2-128). Minimal's PDF prints a light
// name (fontWeight 300), and its Word cover letter a regular one (letterheadLook's name.weight), but
// the Word résumé printed every template's name bold (wordExportHeader.js: `bold: true`).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, read, itemsWith, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const NAME = 'Quinn Example';

const cv = (template, settings = {}) => resume({ template, settings, personal: { name: NAME, title: 'Engineer', email: 'quinn@example.com' } });

/** Is the name bold in the PDF: the font its first word is drawn in is a bold face. */
async function pdfBold(r) {
  const [item] = itemsWith(await read(await render(r)), 'Quinn');
  assert.ok(item, `${r.template}: the name in the PDF`);
  return /Bold/i.test(item.font);
}

/** Is the name bold in Word: its run carries <w:b/>. */
async function wordBold(r) {
  const doc = await renderDocx(r);
  const run = doc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes(`>${NAME}<`));
  assert.ok(run, `${r.template}: the name in the .docx`);
  return /<w:b\/>/.test(run);
}

describe('Word résumé: the name\'s weight is the PDF\'s (R2-128)', () => {
  it('every template: bold in Word exactly where the PDF prints it bold — Minimal\'s light name regular', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const r = cv(template);
      const [pdf, word] = [await pdfBold(r), await wordBold(r)];
      if (pdf !== word) wrong.push(`${template}: pdf ${pdf ? 'bold' : 'regular'}, word ${word ? 'bold' : 'regular'}`);
    }
    assert.deepEqual(wrong, []);
  });

  it('Minimal\'s name is regular in Word, a centred or inline header too; the Sidebar\'s Single · ATS-safe prints Classic\'s bold name', async () => {
    assert.equal(await wordBold(cv('minimal')), false);
    assert.equal(await wordBold(cv('minimal', { headerAlign: 'center', headerLayout: 'inline' })), false);
    assert.equal(await wordBold(cv('classic')), true);
    assert.equal(await wordBold(cv('sidebar', { sidebarSingleColumn: true })), true);
  });
});
