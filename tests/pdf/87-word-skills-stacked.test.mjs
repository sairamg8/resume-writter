// Skills style "Stacked" in the Word résumé (R2-070). The PDF prints each group's category on a line
// of its own, a thin rule under it in the main column, and its skills under that — the Sidebar's side
// column one skill to a line behind a "• ". Word printed "Category: skills" on one line, as Inline.
// Checked against the PDF itself on every template: the skills start on the category's line in Word
// exactly where they do in the PDF.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, skillsStyle) => resume({
  template,
  personal: { name: 'Robin Sample', title: 'Engineer' },
  sections: [section('skills', [{ category: 'Frontend', skills: 'Reactjs, Csslang' }], { skillsStyle })],
});

/** Does the PDF print "Reactjs" on the category's line. */
function pdfSameLine(items) {
  const [a, b] = ['FRONTEND', 'REACTJS'].map((w) => items.find((t) => t.str.toUpperCase().includes(w))?.y);
  assert.ok(a != null && b != null, 'both in the PDF');
  return Math.abs(a - b) < 3;
}
/** Does Word print "Reactjs" in the category's paragraph, on its line. */
function wordSameLine(texts) {
  const para = texts.find((t) => /frontend/i.test(t));
  return para.includes('Reactjs') && !para.split(/frontend/i)[1].split('Reactjs')[0].includes('\n');
}

describe('Word: Skills style "Stacked" puts each category on a line of its own, as the PDF does (R2-070)', () => {
  it('every template: the skills share the category\'s line in Word exactly where they do in the PDF — Stacked and Inline', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const style of ['stacked', 'inline']) {
        const r = cv(template, style);
        const [pdf, word] = [pdfSameLine(allItems(await read(await render(r)))), wordSameLine((await renderDocx(r)).texts)];
        if (pdf !== word) wrong.push(`${template} ${style}: PDF ${pdf ? 'one line' : 'two lines'}, Word ${word ? 'one line' : 'two lines'}`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('Classic: the category alone, no separator, a thin rule under it; the skills in the paragraph under it', async () => {
    const { texts, xml } = await renderDocx(cv('classic', 'stacked'));
    const at = texts.indexOf('Frontend');
    assert.ok(at >= 0, texts.join(' | '));
    assert.equal(texts[at + 1], 'Reactjs, Csslang');
    const para = [...xml.matchAll(/<w:p>(.*?)<\/w:p>/gs)].map((m) => m[1]).find((p) => p.includes('>Frontend<'));
    assert.match(para, /<w:bottom w:val="single" w:color="e5e7eb" w:sz="4"/);
  });

  it('the Sidebar\'s side column: one skill to a paragraph behind a "• "', async () => {
    const { texts } = await renderDocx(cv('sidebar', 'stacked'));
    const at = texts.indexOf('FRONTEND');
    assert.deepEqual(texts.slice(at, at + 3), ['FRONTEND', '• Reactjs', '• Csslang']);
  });
});
