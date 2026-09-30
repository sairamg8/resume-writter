// R5-HUNT11-CUSTOM-FONT-NOT-TEXT-BREAKS-WORD: a stored settings.customFont that is not text (5 or true
// from a hand-edited or third-party .json; normalizeResume leaves it). The editor, the preview and the
// PDF read it as String(customFont), a name; Word's font lookup did `settings?.customFont?.trim()`, which
// throws for a number or a boolean ("customFont.trim is not a function"), so Export → Word failed every
// time, on the résumé and on its cover letter, and Typography's Word stand-in note went silent. Now
// Word reads it as the PDF does. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const cv = (customFont) => resume({
  settings: { font: 'inter', customFont },
  personal: { name: 'Ann Vale', title: 'Pilot', email: 'ann@example.com' },
  sections: [experience([{ company: 'Harbor Works', role: 'Pilot' }])],
  coverLetter: { body: '<p>Dear team, I would like to join.</p>' },
});

describe('Word export with a customFont that is not text', () => {
  for (const bad of [5, true]) {
    it(`customFont ${JSON.stringify(bad)}: the résumé and its cover letter export, in that name`, async () => {
      const doc = await renderDocx(cv(bad));
      assert.ok(doc.texts.some((t) => t.includes('Harbor Works')), doc.texts.join(' | '));
      assert.match(doc.stylesXml, new RegExp(`<w:rFonts[^>]*w:ascii="${String(bad)}"`));
      const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
      const letter = await renderCoverLetterDocx(cv(bad));
      assert.ok(letter.size > 0, 'the cover letter exports');
      const { wordFontStandIns, resolveWordFont } = await loadModule('/src/utils/wordFonts.js');
      assert.equal(resolveWordFont({ customFont: bad }), String(bad));
      const note = await wordFontStandIns({ font: 'inter', customFont: bad });
      assert.equal(note[0].font, String(bad));
    });
  }

  it('one that names no font (false, blank) prints the picker font, as the PDF does', async () => {
    const { resolveWordFont } = await loadModule('/src/utils/wordFonts.js');
    assert.equal(resolveWordFont({ font: 'georgia', customFont: false }), 'Georgia');
    assert.equal(resolveWordFont({ font: 'georgia', customFont: '  ' }), 'Georgia');
  });
});
