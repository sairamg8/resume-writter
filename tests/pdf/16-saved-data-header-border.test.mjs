// Header Customization → Header Bottom Border's Thickness as saved data carries it (FIDB-51-VF3-NB1,
// from FIDB-51-VF3's new_bugs[0]). The panel writes 1–12 pt, but an imported .json can carry
// anything, and the PDF (= the preview) drew what was stored: 50 printed a 50 pt accent rule under
// the résumé's header and its letter's, -3 or "abc" drew none with the border on while the box
// showed the raw value. normalizeResume (withDesignNumbers) now stores it in the panel's range — a 0,
// which every build prints as the 2 pt default (`width || 2`), is dropped so it keeps printing so.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, loadModule } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const cv = (settings) => ({ ...resume({ template: 'classic', settings: { accentColor: '#e11d48', showHeaderBorder: true, ...settings }, sections: [] }), updatedAt: 5 });
/** The widest accent rule's width the document draws, pt; null with none. */
async function ruleWidth(bytes) {
  const rules = (await painted(bytes)).filter((p) => p.paint === 'stroke' && p.colour === '#e11d48' && p.x1 - p.x0 > 300);
  return rules.length ? Math.round(rules[0].width * 100) / 100 : null;
}

describe('a stored Header Bottom Border Thickness prints what the panel can set (FIDB-51-VF3-NB1)', () => {
  it('saved data: out of 1–12 pt is that end, text that is a number is that number, no number (or 0) the 2 pt default — résumé and letter', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const [stored, kept] of [[50, 12], [-3, 1], [12.5, 12], ['5', 5], [' 3 ', 3], [2.5, 2.5], ['abc', undefined], [true, undefined], [0, undefined], ['0', undefined]]) {
      const r = normalizeResume(cv({ headerBorderWidth: stored }));
      const at = JSON.stringify(stored);
      assert.equal(r.settings.headerBorderWidth, kept, `${at}: stored as`);
      assert.equal('headerBorderWidth' in r.settings, kept !== undefined, `${at}: dropped, not stored as undefined`);
      assert.equal(r.updatedAt, 5, `${at}: not an edit`);
      assert.equal(await ruleWidth(await render(r)), kept ?? 2, `${at}: the résumé's rule`);
      assert.equal(await ruleWidth(await renderCover(r)), kept ?? 2, `${at}: the letter's rule`);
    }
  });

  it('the same résumé for a Thickness the panel can set, or none (guard)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const width of [1, 2, 12, undefined, null]) {
      const saved = cv({ headerBorderWidth: width });
      if (width === undefined) delete saved.settings.headerBorderWidth;
      const r = normalizeResume(saved);
      assert.equal(normalizeResume(r), r, String(width));
      assert.equal(r.settings.headerBorderWidth, width, String(width));
    }
  });
});
