// Design → Section Headings (style, Border thickness, Border colour) in the Word résumé (ONB-12-NB1,
// from ONB-12's new_bugs[0]). The PDF (= the preview) prints Ruled, Underline, Left bar, Boxed, Line
// or Plain in each template's colours at the stored Thickness and Border colour; every heading of
// the .docx was the accent over a 0.5 pt accent underline. Word now takes the PDF's look from the
// one table both read (sectionHeadingLook): a bottom border (Ruled, Underline — and Line, whose rules
// beside the title Word cannot draw), a left border (Left bar) or shading (Boxed).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, allItems, drawState, loadModule, TEMPLATES } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const STYLES = ['ruled', 'underline', 'leftbar', 'box', 'line', 'plain'];
const ACCENT = '#e11d48';
const BORDERS = [{}, { sectionBorderColor: '#0d9488', sectionBorderWidth: 4 }];

const cv = (template, settings = {}, sections = [experience([{}])]) => resume({ template, settings: { accentColor: ACCENT, sectionTitleCase: 'upper', ...settings }, sections, personal: { name: 'Pat Sample' } });

/** The .docx paragraph titled `title`: its run colour, bottom and left borders, shading. */
async function wordHeading(r, title = 'PROFESSIONAL EXPERIENCE') {
  const p = (await renderDocx(r)).paragraphs.find((q) => q.text === title);
  assert.ok(p, `a "${title}" heading in Word`);
  const border = (side) => {
    const m = new RegExp(`<w:${side} w:val="single" w:color="([0-9a-fA-F]{6})" w:sz="(\\d+)" w:space="(\\d+)"/>`).exec(p.xml);
    return m ? { colour: `#${m[1].toLowerCase()}`, size: Number(m[2]) } : null;
  };
  return {
    text: `#${(/<w:color w:val="([0-9a-fA-F]{6})"/.exec(p.xml.replace(/<w:pPr>.*?<\/w:pPr>/s, ''))?.[1] || '').toLowerCase()}`,
    bottom: border('bottom'),
    left: border('left'),
    shading: /<w:shd [^>]*w:fill="([0-9a-fA-F]{6})"/.exec(p.xml)?.[1]?.toLowerCase() ?? null,
  };
}
/** The PDF's heading: its title's colour, opaque on the page, and what is painted beside it. */
async function pdfHeading(r) {
  const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const bytes = await render(r);
  const head = allItems(await read(bytes)).find((t) => /PROFESSIONAL|EXPERIENCE/.test(t.str));
  const [ink] = await drawState(bytes, head.str.split(' ')[0]);
  const paints = (await painted(bytes)).filter((p) => p.paint !== 'clip' && Math.abs((p.y0 + p.y1) / 2 - head.y) < 16);
  return { text: solid(ink.fill, ink.alpha).toLowerCase(), paints };
}
const eighths = (pt) => Math.min(96, Math.max(2, Math.round(pt * 8)));

describe('the Word résumé prints Design → Section Headings as the PDF does (ONB-12-NB1)', () => {
  it('every template and style: the title\'s colour, and the rule, bar or box in the PDF\'s colour and Thickness', async () => {
    const { sectionHeadingLook } = await loadModule('/src/templates/pdf/shared/sectionHeadingLook.js');
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const template of TEMPLATES) {
      for (const headingStyle of STYLES) {
        for (const border of BORDERS) {
          const at = `${template} ${headingStyle} ${JSON.stringify(border)}`;
          const r = cv(template, { headingStyle, ...border });
          const width = border.sectionBorderWidth ?? r.settings.sectionBorderWidth ?? 1; // Broadsheet brings 2 pt (R2-138 B2)
          const look = sectionHeadingLook({ template, headingStyle, accent: ACCENT, borderColor: border.sectionBorderColor || '' });
          const opaque = (c) => solid(c).toLowerCase();
          const [word, pdf] = [await wordHeading(r), await pdfHeading(r)];
          assert.equal(word.text, pdf.text, `${at}: the title's colour`);
          const rule = { ruled: look.ruled, underline: look.underline, line: look.line }[headingStyle];
          assert.deepEqual(word.bottom, rule ? { colour: opaque(rule), size: eighths(width) } : null, `${at}: bottom border`);
          assert.deepEqual(word.left, headingStyle === 'leftbar' ? { colour: opaque(look.bar), size: eighths(width + 2) } : null, `${at}: left bar`);
          assert.equal(word.shading, headingStyle === 'box' ? opaque(look.box).slice(1) : null, `${at}: box`);
          // The PDF paints that decoration, in that colour, that thick.
          const [paint] = pdf.paints;
          if (headingStyle === 'plain') assert.deepEqual(pdf.paints, [], `${at}: the PDF paints nothing`);
          if (headingStyle === 'ruled') assert.ok(paint.paint === 'fill' && Math.abs(paint.y1 - paint.y0 - width) < 0.05, `${at}: the PDF's rule ${JSON.stringify(paint)}`);
          if (headingStyle === 'underline') assert.ok(paint.paint === 'stroke' && Math.abs(paint.width - width) < 0.05 && opaque(paint.colour) === word.bottom.colour, `${at}: the PDF's underline ${JSON.stringify(paint)}`);
          if (headingStyle === 'leftbar') assert.ok(Math.abs(paint.x1 - paint.x0 - (width + 2)) < 0.05 && opaque(paint.colour) === opaque(look.bar), `${at}: the PDF's bar ${JSON.stringify(paint)}`);
          if (headingStyle === 'box') assert.ok(paint.paint === 'fill' && paint.x1 - paint.x0 > 100, `${at}: the PDF's box ${JSON.stringify(paint)}`);
        }
      }
    }
  });

  it('a Thickness no rule is drawn at (0, -3): the title alone in Word, but for Boxed\'s shading', async () => {
    for (const template of ['classic', 'minimal', 'modern']) {
      for (const sectionBorderWidth of [0, -3]) {
        for (const headingStyle of ['ruled', 'underline', 'line']) {
          const word = await wordHeading(cv(template, { headingStyle, sectionBorderWidth }));
          assert.deepEqual([word.bottom, word.left, word.shading], [null, null, null], `${template} ${headingStyle} ${sectionBorderWidth}`);
        }
        assert.notEqual((await wordHeading(cv(template, { headingStyle: 'box', sectionBorderWidth }))).shading, null, `${template} box ${sectionBorderWidth}`);
      }
    }
  });

  it('nothing stored (older builds, imported files) and a style the app does not offer: as each template\'s PDF prints it', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const template of TEMPLATES) {
      for (const settings of [{}, { headingStyle: 'fancy' }]) {
        const bare = cv(template, settings);
        if (!settings.headingStyle) delete bare.settings.headingStyle;
        const old = { ...bare, updatedAt: 5 };
        delete old.dataVersion;
        for (const r of [bare, normalizeResume(old)]) {
          const [word, pdf] = [await wordHeading(r), await pdfHeading(r)];
          const at = `${template} ${JSON.stringify(settings)}`;
          assert.equal(word.text, pdf.text, `${at}: the title's colour`);
          assert.equal(!!(word.bottom || word.left || word.shading), pdf.paints.length > 0, `${at}: a decoration where the PDF paints one: ${JSON.stringify(pdf.paints)}`);
        }
      }
    }
  });

  // Guard: the Sidebar's side column prints its own titles (SideSectionTitle), not Section Headings.
  it('the Sidebar\'s side column keeps its titles as before, whatever Section Headings say', async () => {
    const sections = [experience([{}]), section('skills', [{ category: 'Tools', skills: 'Git' }])];
    for (const headingStyle of ['box', 'leftbar', 'plain']) {
      const word = await wordHeading(cv('sidebar', { headingStyle, sectionBorderWidth: 4 }, sections), 'SKILLS');
      assert.deepEqual(word, { text: ACCENT, bottom: { colour: ACCENT, size: 4 }, left: null, shading: null }, `sidebar skills, ${headingStyle}`);
    }
  });
});
