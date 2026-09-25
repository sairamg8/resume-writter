// R2-147 (part 3) — Design → Page numbers (settings.pageNumbers): on, "Page n of N" prints at the foot of
// every page of the résumé, inside the bottom margin, on every template, with nothing else on the page
// moved, and Word's footer prints Word's own page and page-count fields. Off (every résumé storing none),
// the pages print as before; the cover letter never prints them. There were no page numbers.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, read, loadModule, unzipEntry, MM, TEMPLATES } from './harness.mjs';

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

  it('the cover letter prints no page number, and its page is as before', async () => {
    const letter = { body: '<p>Dear team, I would like to join.</p>' };
    const [off, on] = [await read(await renderCover(resume({ coverLetter: letter }))), await read(await renderCover(resume({ coverLetter: letter, settings: { pageNumbers: true } })))];
    assert.equal(on.flatMap(footers).length, 0);
    assert.deepEqual(content(on), content(off));
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
});
