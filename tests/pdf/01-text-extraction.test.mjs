import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allText, loadModule, TEMPLATES } from './harness.mjs';
import { hasPdftotext, splitWords } from './extractors.mjs';

before(setup);
after(teardown);

// Every render in a session shares react-pdf's font objects, so the order below matters: the
// first document embeds composite glyphs ("·" is built from the period, "é" from "e") before
// the second one ever lays out their components.
it('text copies out intact after composite glyphs were embedded earlier in the session', async () => {
  await render(resume({ personal: { title: 'Role · City' }, sections: [experience([{ description: '<p>Café résumé</p>' }])] }));
  const pages = await read(await render(resume({
    personal: { email: 'me@example.com' },
    sections: [experience([{ description: '<p>Ends with a period. Then more.</p>' }])],
  })));
  const text = allText(pages);
  assert.ok(text.includes('me@example.com'), text);
  assert.ok(text.includes('Ends with a period. Then more.'), text);
});

describe('spaced capitals extract as whole words at every size the Design panel offers', () => {
  // Section titles are tracked 0.7 pt and skill categories 0.5 pt — fixed widths that grew past
  // what pdf.js and pdftotext read as one word when the Section Title or Entry Header size went
  // down to the panel's 6 pt minimum. A pangram title puts every letter into the heading style.
  const PANGRAM = 'Jackdaws Love My Big Sphinx Of Quartz';
  const WORDS = ['PROFESSIONAL', 'EXPERIENCE', ...PANGRAM.toUpperCase().split(' '), 'SKILLS', 'CORE', 'TECHNOLOGY', 'WAVY', 'AVATAR'];
  const doc = (template, settings) => resume({ template, settings: { sectionTitleCase: 'upper', ...settings }, sections: [
    experience([{}]),
    section('custom', [{ title: 'Entry' }], {}, { title: PANGRAM }),
    section('skills', [{ category: 'Core Technology', skills: 'React, Go' }, { category: 'Wavy Avatar', skills: 'Figma' }], { skillsStyle: 'tags' }),
  ] });
  /** Section Title and Entry Header at `size` pt (the panel's range starts at 6). */
  const sized = (size, font) => ({ font, fontSizeBase: 8, fontSizeSectionDelta: size - 8, fontSizeEntryDelta: size - 8 });

  it('every template, Section Title and Entry Header 6–12 pt', async (t) => {
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: Poppler not checked');
    const found = [];
    for (const template of TEMPLATES) {
      for (let size = 6; size <= 12; size += 1) {
        for (const s of await splitWords(await render(doc(template, sized(size))), WORDS)) found.push(`${template} ${size} pt, ${s}`);
      }
    }
    assert.deepEqual(found, []);
  });

  it('every offered font family at 6 and 7 pt (fonts from jsDelivr; skipped offline)', async (t) => {
    const online = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/metadata.json', { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
    if (!online) return t.skip('offline');
    if (!hasPdftotext) t.diagnostic('pdftotext not installed: Poppler not checked');
    const { FONT_MAP } = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    const found = [];
    for (const font of Object.keys(FONT_MAP)) {
      for (const size of [6, 7]) {
        for (const s of await splitWords(await render(doc('classic', sized(size, font))), WORDS)) found.push(`${font} ${size} pt, ${s}`);
      }
    }
    assert.deepEqual(found, []);
  });
});
