// The summary's look in the Word résumé (FIDB-51-VF3-NB2-NB1). The .docx printed every summary
// italic in a fixed #374151. The PDF (= the preview) prints Classic's and Executive's upright in the
// Text colour's body shade, Minimal's italic in its sub shade beside a 2 pt accent bar at 40 %, the
// Sidebar's upright in the Text colour, Modern's on its banner (Word has none: as Classic's).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, read, allItems, drawState, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const WORD = 'Summarising';
const cv = (template, settings = {}) => resume({
  template,
  settings: { accentColor: '#e11d48', ...settings },
  personal: { name: 'Pat Sample', title: 'Engineer', summary: `<p>${WORD} ten years of shipping</p><p>Second line</p>`, hiddenFields: [] },
});

/** The Word summary: its runs' colour and italics, and each paragraph's left border. */
async function wordSummary(r) {
  const paras = (await renderDocx(r)).paragraphs.filter((p) => p.text.includes(WORD) || p.text === 'Second line');
  assert.equal(paras.length, 2, 'two summary paragraphs');
  const run = paras[0].xml.replace(/<w:pPr>.*?<\/w:pPr>/s, '');
  const bar = (p) => /<w:left w:val="single" w:color="([0-9a-fA-F]{6})" w:sz="(\d+)" w:space="(\d+)"\/>/.exec(p.xml)?.slice(1).join('/') ?? null;
  return { colour: `#${/<w:color w:val="([0-9a-fA-F]{6})"/.exec(run)?.[1]?.toLowerCase()}`, italic: /<w:i\/>/.test(run), bars: paras.map(bar) };
}
/** The PDF summary: its colour, opaque, and whether its font is italic. */
async function pdfSummary(r) {
  const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const bytes = await render(r);
  const [ink] = await drawState(bytes, WORD);
  const item = allItems(await read(bytes)).find((t) => t.str.includes(WORD));
  return { colour: solid(ink.fill, ink.alpha).toLowerCase(), italic: /italic/i.test(item.font) };
}

describe('the Word résumé prints the summary as the PDF does (FIDB-51-VF3-NB2-NB1)', () => {
  it('Classic, Minimal, Executive and Sidebar: the PDF\'s colour and italics, for the template\'s own and a custom Text colour', async () => {
    for (const template of TEMPLATES.filter((t) => t !== 'modern')) {
      for (const textColor of [undefined, '#7c2d12']) {
        const r = cv(template, textColor ? { textColor } : {});
        if (!textColor) delete r.settings.textColor;
        const [word, pdf] = [await wordSummary(r), await pdfSummary(r)];
        assert.deepEqual([word.colour, word.italic], [pdf.colour, pdf.italic], `${template} ${textColor}`);
      }
    }
  });

  it('Minimal: the accent bar at 40 % beside every summary paragraph; no other template has one', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const template of TEMPLATES) {
      const bar = template === 'minimal' ? `${solid('#e11d48', 0.4).slice(1)}/16/8` : null;
      assert.deepEqual((await wordSummary(cv(template))).bars, [bar, bar], template);
    }
  });

  it('Modern: no banner in Word — the summary prints upright as Classic\'s does, in the same Text colour', async () => {
    for (const textColor of ['#1f2937', '#7c2d12']) {
      const word = await wordSummary(cv('modern', { textColor }));
      const classic = await pdfSummary(cv('classic', { textColor }));
      assert.deepEqual([word.colour, word.italic], [classic.colour, false], textColor);
    }
  });
});
