// The Word letter's letterhead takes the résumé template's look too (FIDB-51): its colours and
// alignment, Modern's and the Sidebar's band as paragraph shading, Classic's, Minimal's and
// Executive's rules as the last line's bottom border.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule, readDocx, renderCover, read, itemsWith, MM, TEMPLATES } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const ACCENT = '#e11d48';

const letter = (template, { settings } = {}) => resume({
  template,
  settings: { accentColor: ACCENT, ...settings },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', phone: '+1 555 0100', hiddenFields: [] },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});

describe('the Word letter\'s letterhead takes the look too (FIDB-51)', () => {
  const coverDocx = async (template, settings) => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    return readDocx(new Uint8Array(await (await renderCoverLetterDocx(letter(template, { settings }))).arrayBuffer()));
  };
  /** The letterhead's paragraphs (name, title, contacts) and the date's, as XML. */
  const parts = (doc) => {
    const at = doc.texts.indexOf('15 January 2026');
    assert.equal(at, 3, doc.texts.join(' | '));
    return { head: doc.paragraphs.slice(0, 3).map((p) => p.xml), date: doc.paragraphs[3].xml };
  };
  /** The colour of the run that prints `text`. */
  const colourOf = (xml, text) => (xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '').match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
  /** The attributes of a paragraph's bottom border, or null. */
  const bottom = (xml) => {
    const m = /<w:bottom ([^>]*)\/>/.exec(xml.split('</w:pBdr>')[0]);
    return m && Object.fromEntries([...m[1].matchAll(/w:(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
  };
  /** A paragraph's left and right indents and its side borders' space, pt (0 where unset). */
  const sides = (xml) => {
    const ind = /<w:ind ([^>]*)\/>/.exec(xml)?.[1] || '';
    const indent = (k) => Number(new RegExp(`w:${k}="(-?\\d+)"`).exec(ind)?.[1] || 0) / 20;
    const space = (k) => Number(new RegExp(`<w:${k} [^>]*w:space="(\\d+)"`).exec(xml.split('</w:pBdr>')[0])?.[1] || 0);
    return { indent: [indent('left'), indent('right')], space: [space('left'), space('right')] };
  };

  it('Modern and Sidebar: the letterhead is one shaded band in the accent or the panel colour, its text in the band\'s colours', async () => {
    const { sidebarShades } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const [template, fill, contact] of [['modern', ACCENT.slice(1), 'ffffff'], ['sidebar', '1e293b', sidebarShades('#1e293b').value.slice(1)]]) {
      const { head, date } = parts(await coverDocx(template));
      for (const xml of head) assert.match(xml, new RegExp(`<w:shd [^>]*w:fill="${fill}"`), `${template}: shaded`);
      assert.doesNotMatch(date, /<w:shd /, `${template}: the date is not in the band`);
      assert.equal(colourOf(head[0], 'Pat Sample'), 'ffffff', `${template}: the name`);
      assert.equal(colourOf(head[2], 'pat@example.com'), contact, `${template}: the contacts`);
    }
  });

  it('Modern and Sidebar: the band\'s text sits where the PDF\'s does — inset by Modern\'s padding, on the page margin on the Sidebar\'s, as the letter below (VFIDB-51-4)', async () => {
    for (const [template, fill] of [['modern', ACCENT], ['sidebar', '#1e293b']]) {
      const bytes = await renderCover(letter(template));
      const pages = await read(bytes);
      const x = (text) => itemsWith(pages, text)[0].x;
      // The PDF: the name's inset from the letter's left edge (the date), and the band's left
      // edge from the page margin (0 on Modern; the Sidebar's runs to the paper's edge).
      const inset = Math.round(x('Pat Sample') - x('15 January 2026'));
      const [band] = (await painted(bytes)).filter((p) => p.paint === 'fill' && p.colour === fill && p.x1 - p.x0 > 100);
      const bleeds = band.x0 < 18 * MM - 0.5;
      const { head, date } = parts(await coverDocx(template));
      assert.deepEqual(sides(date).indent, [0, 0], `${template}: the date on the margin`);
      for (const xml of head) {
        const { indent, space } = sides(xml);
        assert.deepEqual(indent, [inset, inset], `${template}: the letterhead's text inset as in the PDF`);
        // Word draws a side border `space` outside the indent, and the shading reaches it: the
        // fill runs past the text on both sides — to the margin on Modern, into it on the Sidebar.
        for (const i of [0, 1]) {
          assert.ok(space[i] > 0, `${template}: the band runs past the text`);
          assert.equal(Math.sign(indent[i] - space[i]), bleeds ? -1 : 0, `${template}: the band's edge ${indent[i] - space[i]} pt from the margin`);
        }
      }
    }
  });

  it('Classic keeps its 2.5 pt accent rule; Minimal has a 0.75 pt pale rule and a regular name; Executive a double rule', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const expected = {
      classic: { val: 'single', sz: '20', color: ACCENT.slice(1), space: '12' },
      minimal: { val: 'single', sz: '6', color: solid(ACCENT, 0.4).slice(1), space: '12' },
      executive: { val: 'double', sz: '6', color: ACCENT.slice(1), space: '12' },
    };
    for (const [template, rule] of Object.entries(expected)) {
      const { head } = parts(await coverDocx(template));
      assert.deepEqual(bottom(head[2]), rule, `${template}: the rule under the contacts`);
      assert.deepEqual([bottom(head[0]), bottom(head[1])], [null, null], `${template}: only under the last line`);
      assert.equal(/<w:b\/>/.test(head[0]), template !== 'minimal', `${template}: bold name`);
      assert.doesNotMatch(head.join(''), /<w:shd /, `${template}: no band`);
    }
  });

  it('a centred résumé header centres Word\'s letterhead too; Modern and Sidebar take no alignment', async () => {
    for (const template of TEMPLATES) {
      const { head, date } = parts(await coverDocx(template, { headerAlign: 'center' }));
      const centred = ['classic', 'minimal', 'executive'].includes(template);
      for (const xml of head) assert.equal(/<w:jc w:val="center"\/>/.test(xml), centred, template);
      assert.doesNotMatch(date, /<w:jc w:val="center"\/>/, `${template}: the letter itself stays left`);
    }
  });

  it('Design → Name and Job title colours reach Word\'s letterhead in every look', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const template of TEMPLATES) {
      const { head } = parts(await coverDocx(template, { nameColor: '#7c3aed', jobTitleColor: '#0d9488' }));
      // Modern's title prints at 90 % on its band (below), the others as picked.
      const title = template === 'modern' ? solid('#0d9488', 0.9, ACCENT).slice(1) : '0d9488';
      assert.deepEqual([colourOf(head[0], 'Pat Sample'), colourOf(head[1], 'Staff Engineer')], ['7c3aed', title], template);
    }
  });

  it('Modern: the title is the colour the PDF draws — 90 % of the title colour on the band, its own alpha multiplied in (R5-9)', async () => {
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    for (const jobTitleColor of ['', '#fde68a', 'rgba(255,255,255,0.5)']) {
      const { head } = parts(await coverDocx('modern', { jobTitleColor }));
      // react-pdf draws it at opacity 0.9 × its alpha over the accent band: that blend, opaque.
      assert.equal(colourOf(head[1], 'Staff Engineer'), solid(jobTitleColor || '#ffffff', 0.9, ACCENT).slice(1), jobTitleColor || 'the header text colour');
    }
  });
});
