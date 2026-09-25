// R2-147 (part 3) — Design → Page numbers (settings.pageNumbers): on, "Page n of N" prints at the foot of
// every page of the résumé, inside the bottom margin, on every template, with nothing else on the page
// moved, and Word's footer prints Word's own page and page-count fields. Off (every résumé storing none),
// the pages print as before; the cover letter never prints them. There were no page numbers.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, read, loadModule, unzipEntry, MM, TEMPLATES } from './harness.mjs';
import { hasPdftotext, pdftotext } from './extractors.mjs';

before(setup);
after(teardown);

const LONG = `<ul>${Array.from({ length: 5 }, (_, i) => `<li>Delivered the quarterly platform milestone number ${i + 1} across four regional teams on schedule</li>`).join('')}</ul>`;
const cv = (template, settings = {}) => resume({
  template,
  settings,
  sections: [experience(Array.from({ length: 12 }, () => ({ description: LONG })))],
});
const FOOTER = /^Page \d+ of \d+$/;
const footers = (page) => page.items.filter((t) => FOOTER.test(t.str.trim()));
const content = (pages) => pages.flatMap((p, i) => p.items.filter((t) => !FOOTER.test(t.str.trim())).map((t) => `${i}:${t.str}@${t.x.toFixed(1)},${t.y.toFixed(1)}`));

describe('Design → Page numbers prints "Page n of N" on every page (R2-147)', () => {
  it('every template: each page\'s own number, below its content, and nothing else moves', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const [off, on] = [await read(await render(cv(template))), await read(await render(cv(template, { pageNumbers: true })))];
      if (off.length < 2) wrong.push(`${template}: the fixture is one page`);
      if (off.some((p) => footers(p).length)) wrong.push(`${template}: off prints a page number`);
      if (on.length !== off.length) wrong.push(`${template}: ${off.length} pages became ${on.length}`);
      on.forEach((p, i) => {
        const [f, ...more] = footers(p);
        if (!f || more.length) return wrong.push(`${template} page ${i + 1}: ${f ? 'two' : 'no'} page number(s)`);
        if (f.str.trim() !== `Page ${i + 1} of ${on.length}`) wrong.push(`${template} page ${i + 1}: "${f.str.trim()}"`);
        if (p.items.some((t) => t !== f && t.y - 1 <= f.y + f.h)) wrong.push(`${template} page ${i + 1}: not below the content`);
        if (f.y > 14 * MM) wrong.push(`${template} page ${i + 1}: above the bottom margin (${f.y.toFixed(1)} pt)`);
      });
      if (content(on).join('|') !== content(off).join('|')) wrong.push(`${template}: the content moved`);
    }
    assert.deepEqual(wrong, []);
  });

  it('a bottom margin under 10 mm grows to hold the number: it never prints over the last line', async () => {
    const pages = await read(await render(cv('classic', { pageNumbers: true, marginV: 0 })));
    for (const p of pages) {
      const [f] = footers(p);
      assert.ok(f, 'the page number prints');
      assert.ok(p.items.every((t) => t === f || t.y - 1 > f.y + f.h), 'below the content');
    }
  });

  it('the cover letter prints no page number, and its page is as before — nor does its Word file', async () => {
    const letter = { body: '<p>Dear team, I would like to join.</p>' };
    const [off, on] = [await read(await renderCover(resume({ coverLetter: letter }))), await read(await renderCover(resume({ coverLetter: letter, settings: { pageNumbers: true } })))];
    assert.equal(on.flatMap(footers).length, 0);
    assert.deepEqual(content(on), content(off));
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const docx = Buffer.from(await (await renderCoverLetterDocx(resume({ coverLetter: letter, settings: { pageNumbers: true } }))).arrayBuffer());
    assert.doesNotMatch(unzipEntry(docx, 'word/document.xml') || '', /<w:footerReference /, 'the letter\'s .docx has no footer');
  });

  // A résumé saved before Page numbers existed stores no pageNumbers key, and loading it adds none
  // (normalizeResume): it prints as it did, with no number on any page, and its .docx has no footer.
  it('a résumé stored with no pageNumbers key prints as before, in the PDF and in Word', async () => {
    const stored = cv('classic');
    delete stored.settings.pageNumbers;
    const [was, off] = [await read(await render(stored)), await read(await render(cv('classic', { pageNumbers: false })))];
    assert.equal(was.flatMap(footers).length, 0, 'no page number');
    assert.equal(was.length, off.length);
    assert.deepEqual(content(was), content(off));
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const docx = Buffer.from(await (await renderResumeDocx(stored)).arrayBuffer());
    assert.doesNotMatch(unzipEntry(docx, 'word/document.xml') || '', /<w:footerReference /, 'no footer in Word');
  });

  it('Word: a footer with the PAGE and NUMPAGES fields when on, none when off', async () => {
    const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
    const parts = async (settings) => {
      const buffer = Buffer.from(await (await renderResumeDocx(cv('classic', settings))).arrayBuffer());
      return { xml: unzipEntry(buffer, 'word/document.xml') || '', footer: unzipEntry(buffer, 'word/footer1.xml') || '' };
    };
    const on = await parts({ pageNumbers: true });
    assert.match(on.xml, /<w:footerReference /);
    assert.match(on.footer, /PAGE/);
    assert.match(on.footer, /NUMPAGES/);
    assert.match(on.footer, />Page </);
    const off = await parts({});
    assert.doesNotMatch(off.xml, /<w:footerReference /);
  });

  // Text readers take a page's words in drawing order: the number, drawn last, must not come before the
  // name on page 1 (a first-line parser would take "Page 1 of 3" for it) nor before the running header
  // (ATS-7) that opens the pages after.
  it('every template: the page number is the page\'s last text drawn; readers still open page 1 with the name', async (t) => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const bytes = await render(cv(template, { pageNumbers: true }));
      (await read(bytes)).forEach((p, i) => {
        const last = p.items[p.items.length - 1];
        if (!last || !FOOTER.test(last.str.trim())) wrong.push(`${template} page ${i + 1}: last drawn "${last?.str}"`);
      });
      if (!hasPdftotext) continue;
      const [, raw] = pdftotext(bytes).find(([name]) => name.includes('-raw'));
      const pages = raw.split('\f');
      if (!pages[0].trimStart().startsWith('Test Person')) wrong.push(`${template}: -raw page 1 opens "${pages[0].trimStart().slice(0, 40)}"`);
      if (!pages[1].trimStart().startsWith('Test Person · Page 2')) wrong.push(`${template}: -raw page 2 opens "${pages[1].trimStart().slice(0, 40)}"`);
    }
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: the drawing order was checked with pdf.js only');
    assert.deepEqual(wrong, []);
  });
});
