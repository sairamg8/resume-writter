// Section Headings → Border thickness as saved data carries it (ONB-12-NB2, from ONB-12's
// new_bugs[1]). The panel writes 1–8 pt, but an imported .json, a hand-edited store or a cloud copy
// can carry anything, and the PDF (= the preview) read it unchecked: "abc" under Ruled threw
// "Invalid value abc for setHeight" and under Left bar "Invalid value abc2 for setWidth" — no
// preview, no PDF; "3" under Left bar printed a 32 pt bar ("3" + 2); 0 an invisible rule.
// normalizeResume (withDesignNumbers, src/constants/designNumbers.js) now stores it as a number in
// the panel's range, or drops it so the default prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, loadModule } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const cv = (settings) => ({ ...resume({ template: 'classic', settings: { accentColor: '#e11d48', ...settings }, sections: [experience([{}])] }), updatedAt: 5 });
/** The heading's decoration as the PDF paints it: Ruled's rule height or Left bar's bar width, pt. */
async function decoration(r, headingStyle) {
  const paints = (await painted(await render(r))).filter((p) => p.paint === 'fill' && p.colour !== '#ffffff');
  const hit = headingStyle === 'ruled'
    ? paints.find((p) => p.x1 - p.x0 > 300 && p.y1 - p.y0 < 20)
    : paints.find((p) => p.x1 - p.x0 < 20 && p.y1 - p.y0 > 5);
  assert.ok(hit, `a ${headingStyle} decoration: ${JSON.stringify(paints.slice(0, 4))}`);
  return Math.round((headingStyle === 'ruled' ? hit.y1 - hit.y0 : hit.x1 - hit.x0) * 100) / 100;
}

describe('a stored Section Headings Border thickness prints what the panel can set (ONB-12-NB2)', () => {
  it('saved data: text that is a number is that number, one outside 1–8 pt is that end, one that is no number is the default — and the PDF renders', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const [stored, kept] of [['abc', undefined], [true, undefined], [{}, undefined], ['3', 3], [' 4 ', 4], [0, 1], [-3, 1], [20, 8], ['1e3', 8], [2.5, 2.5]]) {
      const r = normalizeResume(cv({ headingStyle: 'leftbar', sectionBorderWidth: stored }));
      const at = JSON.stringify(stored);
      assert.equal(r.settings.sectionBorderWidth, kept, `${at}: stored as`);
      assert.equal('sectionBorderWidth' in r.settings, kept !== undefined, `${at}: dropped, not stored as undefined`);
      assert.equal(r.updatedAt, 5, `${at}: not an edit`);
      for (const headingStyle of ['leftbar', 'ruled']) {
        const printed = await decoration({ ...r, settings: { ...r.settings, headingStyle } }, headingStyle);
        assert.equal(printed, (kept ?? 1) + (headingStyle === 'leftbar' ? 2 : 0), `${at} ${headingStyle}: printed`);
      }
    }
  });

  it('the same résumé when every value is one the panel can set, or none is stored (guard)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const settings of [{ sectionBorderWidth: 1 }, { sectionBorderWidth: 8 }, { sectionBorderWidth: undefined }, { sectionBorderWidth: null }]) {
      const saved = cv(settings);
      if (settings.sectionBorderWidth === undefined) delete saved.settings.sectionBorderWidth;
      const r = normalizeResume(saved);
      assert.equal(normalizeResume(r), r, JSON.stringify(settings));
      assert.deepEqual(r.settings.sectionBorderWidth, settings.sectionBorderWidth, JSON.stringify(settings));
    }
  });
});
