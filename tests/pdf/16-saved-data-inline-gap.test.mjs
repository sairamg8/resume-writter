// Header Customization → Name & Title Spacing (headerInlineGap) as saved data carries it
// (FIDB-51-VF4-NB1, from FIDB-51-VF4's new_bugs[0]). Under Name & Title Layout "Inline" the résumé's
// PDF read it unchecked (resolveTemplateSettings: `(headerInlineGap ?? 8) * 0.75`): "abc" threw
// "Invalid value NaN for setGap" — no preview, no PDF; 1000 flung the title to the foot of the page;
// -50 a negative gap; and the panel's stepper turned a stored "20" into "202". The letter and the
// .docx already clamp it (inlineLayout). normalizeResume (withDesignNumbers) now stores it as a
// number in the panel's 2–48 px, or drops it so the 8 px default prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, read, allItems, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, settings) => ({
  ...resume({ template, settings: { headerLayout: 'inline', ...settings }, personal: { name: 'Pat Sample', title: 'Staff Engineer', hiddenFields: [] }, sections: [] }),
  updatedAt: 5,
});
/** The PDF's gap between the name and the title on their line, pt; and how far below the name the title sits. */
async function inlineGap(r) {
  const items = allItems(await read(await render(r)));
  const name = items.find((t) => t.str.includes('Pat'));
  const title = items.find((t) => t.str.includes('Staff'));
  return { gap: Math.round((title.x - (name.x + name.w)) * 100) / 100, below: Math.round((name.y - title.y) * 100) / 100 };
}

describe('a stored Name & Title Spacing prints what the panel can set (FIDB-51-VF4-NB1)', () => {
  it('saved data: no number is the 8 px default, out of 2–48 px that end, text that is a number that number — and the title stays on the name\'s line', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const template of ['classic', 'executive']) {
      for (const [stored, kept] of [['abc', undefined], [{}, undefined], [1000, 48], [-50, 2], ['20', 20], [' 16 ', 16], [10.5, 10.5]]) {
        const r = normalizeResume(cv(template, { headerInlineGap: stored }));
        const at = `${template} ${JSON.stringify(stored)}`;
        assert.equal(r.settings.headerInlineGap, kept, `${at}: stored as`);
        assert.equal('headerInlineGap' in r.settings, kept !== undefined, `${at}: dropped, not stored as undefined`);
        assert.equal(r.updatedAt, 5, `${at}: not an edit`);
        const { gap, below } = await inlineGap(r);
        assert.ok(Math.abs(gap - (kept ?? 8) * 0.75) < 0.05 && Math.abs(below) < 3, `${at}: printed ${gap} pt beside the name, ${below} pt below it`);
      }
    }
  });

  it('the same résumé for a spacing the panel can set, or none (guard)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const gap of [2, 8, 48, undefined, null]) {
      const saved = cv('classic', { headerInlineGap: gap });
      if (gap === undefined) delete saved.settings.headerInlineGap;
      const r = normalizeResume(saved);
      assert.equal(normalizeResume(r), r, String(gap));
      assert.equal(r.settings.headerInlineGap, gap, String(gap));
    }
  });
});
