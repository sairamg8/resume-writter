// The cover letter's letterhead follows the résumé template (FIDB-51) where the user meets it: the
// Cover Letter panel names the template the letter takes its look from, and under a centred résumé
// header it says the letterhead is centred instead of offering Fields Position and Text Position;
// the PDF and the Word letter centre it exactly there. For every template, and for an id the app
// does not offer (the old seed's 'dark', an import's), which prints Classic's letter.
// These are the fail-before tests for the two rules tests/unit/letterhead.unit.mjs guards
// (templateLabel, letterheadCentered): those helpers came with FIDB-51, so at its parent (0b83cb1)
// that file dies at import and proves nothing (V2FIDB-51-5). This file fails there on behaviour:
// the panel named no template and offered Fields Position under a centred header, and neither
// letter took the header's alignment.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, renderCover, read, allItems, loadModule, readDocx, TEMPLATES } from './harness.mjs';
import { drawing, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

/** Each template's name as the editor shows it, written out rather than read from the table under test. */
const NAMES = { classic: 'Classic', modern: 'Modern', minimal: 'Minimal', executive: 'Executive', sidebar: 'Sidebar', timeline: 'Timeline', banner: 'Banner', academic: 'Academic', compact: 'Compact',
  gridline: 'Gridline', registry: 'Registry', bookend: 'Bookend', lectern: 'Lectern', chronicle: 'Chronicle', keystone: 'Keystone', banded: 'Banded', keel: 'Keel', linen: 'Linen', broadsheet: 'Broadsheet' };
/** Template ids the app does not offer: each prints Classic's letter (22-cover-letter-looks-options). */
const UNKNOWN = ['dark', 'aurora', ''];
/** Text Alignment as the résumé stores it: Center, Left, and unset (Left) in a résumé that never picked one. */
const ALIGNS = ['center', 'left', undefined];
/** Is a letter on `template` centred under `headerAlign`? Where its résumé's header is: Modern and Sidebar take no alignment. */
const centres = (template, headerAlign) => headerAlign === 'center' && !['modern', 'sidebar'].includes(template);

// The name and title stacked, as every template stacks them but Compact, which prints them Inline (T9).
const letter = (template, headerAlign, photo = PNG) => resume({
  template,
  settings: { headerAlign, headerLayout: 'stack' },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', phone: '+1 555 0100', photo, hiddenFields: [] },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});

/** The Cover Letter panel, as the editor renders it for a résumé on `template`, read as the user reads it. */
async function panel(template, headerAlign) {
  const { default: CoverLetterPanel } = await loadModule('/src/components/CoverLetterPanel.jsx');
  const r = letter(template, headerAlign); // the harness's resume() makes an undefined id Classic; the panel gets it as stored
  const html = renderToString(createElement(CoverLetterPanel, {
    coverLetter: r.coverLetter, personal: r.personal, settings: r.settings, template, updateCoverLetter: () => {},
  }));
  const text = html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ');
  return {
    named: /Header style follows your résumé template \( ?([^)]*?) ?\)/.exec(text)?.[1] ?? 'no template named',
    centred: text.includes('Centred like your résumé\'s header'),
    fieldsPosition: text.includes('Fields Position'),
    textPosition: text.includes('Text Position'),
    photoAbove: text.includes('the photo sits above the name'),
  };
}

describe('the letterhead follows the résumé template where the user meets it (FIDB-51, V2FIDB-51-5)', () => {
  it('the Cover Letter panel names the résumé\'s template; an id the app does not offer is Classic, whose letter it prints', async () => {
    for (const template of TEMPLATES) assert.equal((await panel(template)).named, NAMES[template], template);
    for (const template of [...UNKNOWN, undefined]) assert.equal((await panel(template)).named, 'Classic', JSON.stringify(template));
  });

  it('under a centred résumé header the panel says the letterhead is centred instead of offering Fields Position and Text Position — not in Modern or Sidebar', async () => {
    for (const template of [...TEMPLATES, ...UNKNOWN, undefined]) {
      for (const headerAlign of ALIGNS) {
        const { named, ...offered } = await panel(template, headerAlign);
        const c = centres(template, headerAlign);
        assert.deepEqual(offered, { centred: c, fieldsPosition: !c, textPosition: !c, photoAbove: c }, `${JSON.stringify(template)} (${named}), ${headerAlign ?? 'unset'}`);
      }
    }
  });

  it('the PDF centres the letterhead exactly where the panel says so; an id the app does not offer centres as Classic does', async () => {
    for (const template of [...TEMPLATES, ...UNKNOWN]) {
      for (const headerAlign of ALIGNS) {
        const at = `${JSON.stringify(template)}, ${headerAlign ?? 'unset'}`;
        const [page] = await read(await renderCover(letter(template, headerAlign)));
        const name = allItems([page]).find((t) => t.str.replace(/ /g, ' ').includes('Pat Sample'));
        const offCentre = Math.abs(name.x + name.w / 2 - page.W / 2);
        assert.equal(offCentre <= 1, centres(template, headerAlign), `${at}: the name ${offCentre.toFixed(1)} pt off the page's centre line`);
        assert.equal(offCentre <= 1, (await panel(template, headerAlign)).centred, `${at}: as the panel says`);
      }
    }
    // drawing() makes pdf.js's per-document font ids neutral, or no two renders compare equal.
    const classic = await drawing(await renderCover(letter('classic', 'center')));
    assert.notEqual(await drawing(await renderCover(letter('classic', 'left'))), classic, 'the comparison sees the alignment');
    for (const template of UNKNOWN) assert.equal(await drawing(await renderCover(letter(template, 'center'))), classic, JSON.stringify(template));
  });

  it('so does the Word letter: its name, title and contacts are centred exactly there', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    for (const template of [...TEMPLATES, ...UNKNOWN]) {
      for (const headerAlign of ALIGNS) {
        const doc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(letter(template, headerAlign, ''))).arrayBuffer()));
        const head = doc.paragraphs.slice(0, doc.texts.indexOf('15 January 2026'));
        assert.deepEqual(head.map((p) => p.text), ['Pat Sample', 'Staff Engineer', doc.texts[2]], `${JSON.stringify(template)}: the letterhead's lines`);
        assert.match(head[2].text, /pat@example\.com/);
        for (const p of head) assert.equal(/<w:jc w:val="center"\/>/.test(p.xml), centres(template, headerAlign), `${JSON.stringify(template)}, ${headerAlign ?? 'unset'}: "${p.text}"`);
        assert.doesNotMatch(doc.paragraphs[head.length].xml, /<w:jc w:val="center"\/>/, `${JSON.stringify(template)}: the letter itself stays left`);
      }
    }
  });
});
