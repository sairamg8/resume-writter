// Design → Spacing's Line Height, Between Sections and Between Items as saved data carries them
// (VF2-3.2-NB1-NB1-NB2, from VF2-3.2-NB1-NB1's new_bugs[1]). The panel sets 1–3, 0–60 px and 0–40 px
// on every build, but an imported .json can carry any number and the PDF (= the preview) printed it:
// Line Height 50 ran a one-page résumé to three, Between Sections -200 pulled a section up over the
// header and lost text, 5000 made three pages, and the panel's −/+ then jumped to the range's end.
// normalizeResume (withSpacingNumbers) now clamps each into its control's range, as the margins are.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, render, read, overlaps, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, settings) => ({
  ...resume({ template, settings, sections: [experience([{}, {}]), section('skills', [{ category: 'Tools', skills: 'Git, SQL' }])] }),
  updatedAt: 5,
});
const texts = (pages) => pages.flatMap((p) => p.items.map((i) => i.str)).filter((s) => s.trim()).sort();

describe('stored Spacing numbers print within the panel\'s ranges (VF2-3.2-NB1-NB1-NB2)', () => {
  it('out of range is clamped to that end, and prints as the panel\'s end does: the same pages, every text, nothing overlapping', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const cases = [
      ['lineHeightValue', 50, 3], ['lineHeightValue', 0.2, 1], ['lineHeightValue', '9', 3],
      ['sectionGap', -200, 0], ['sectionGap', 5000, 60], ['sectionGap', '75', 60],
      ['itemGap', -100, 0], ['itemGap', 99, 40],
    ];
    for (const template of ['classic', 'sidebar']) {
      for (const [key, stored, kept] of cases) {
        const at = `${template} ${key} ${JSON.stringify(stored)}`;
        const r = normalizeResume(cv(template, { [key]: stored }));
        assert.equal(r.settings[key], kept, `${at}: stored as`);
        assert.equal(r.updatedAt, 5, `${at}: not an edit`);
        const [pages, end] = [await read(await render(r)), await read(await render(normalizeResume(cv(template, { [key]: kept }))))];
        assert.equal(pages.length, end.length, `${at}: pages`);
        assert.deepEqual(texts(pages), texts(end), `${at}: every text`);
        assert.deepEqual(pages.flatMap(overlaps), [], `${at}: nothing overlaps`);
      }
    }
  });

  it('the same résumé for values the panel can set (guard)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const settings of [{ lineHeightValue: 1, sectionGap: 0, itemGap: 0 }, { lineHeightValue: 3, sectionGap: 60, itemGap: 40 }, { lineHeightValue: 1.5, sectionGap: 16, itemGap: 8 }]) {
      const r = normalizeResume(cv('classic', settings));
      assert.equal(normalizeResume(r), r, JSON.stringify(settings));
      for (const [key, v] of Object.entries(settings)) assert.equal(r.settings[key], v, `${JSON.stringify(settings)} ${key}`);
    }
  });
});
