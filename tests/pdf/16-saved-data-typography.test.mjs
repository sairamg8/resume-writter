import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, render, read, loadModule } from './harness.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

before(setup);
after(teardown);

const cv = (template, settings) => ({
  ...resume({ template, settings, sections: [experience([{}, {}]), section('skills', [{ category: 'Tools', skills: 'Git, SQL' }])] }),
  updatedAt: 5,
});
/** Each printed text with the size it printed at (pdf.js reads a -2 pt run as 2 pt high). */
const sized = (pages) => pages.flatMap((p) => p.items.filter((i) => i.str.trim()).map((i) => `${i.str}@${i.h.toFixed(1)}`)).sort();

describe('stored Typography numbers print within the panel\'s ranges (VF2-3.2-NB1-NB1-NB1)', () => {
  it('each size alone: no number is dropped, text that is one becomes it, out of range is clamped (base 11)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    // [key, stored, stored as, prints as]: the rows print Full Name base–36, Section Title and Entry Header 6–24.
    const cases = [
      ['fontSizeBase', 'abc', undefined, 11],
      ['fontSizeBase', true, undefined, 11],
      ['fontSizeBase', {}, undefined, 11],
      ['fontSizeBase', '12', 12, 12],
      ['fontSizeBase', ' 12 ', 12, 12],
      ['fontSizeBase', 50, 16, 16],
      ['fontSizeBase', 2, 8, 8],

      ['fontSizeNameDelta', 'abc', undefined, 8],
      ['fontSizeNameDelta', '12', 12, 12],
      ['fontSizeNameDelta', 50, 25, 25], // 36 pt on base 11
      ['fontSizeNameDelta', -50, 0, 0], // the base

      ['fontSizeSectionDelta', 'abc', undefined, 1],
      ['fontSizeSectionDelta', '5', 5, 5],
      ['fontSizeSectionDelta', 50, 13, 13], // 24 pt
      ['fontSizeSectionDelta', -50, -5, -5], // 6 pt

      ['fontSizeEntryDelta', 'abc', undefined, 0],
      ['fontSizeEntryDelta', '5', 5, 5],
      ['fontSizeEntryDelta', 50, 13, 13],
      ['fontSizeEntryDelta', -50, -5, -5],

      ['iconSize', 'abc', undefined, 11],
      ['iconSize', '12', 12, 12],
      ['iconSize', 50, 20, 20],
      ['iconSize', 2, 9, 9], // Contact Icons starts at 9 px: 8 printed as 9 does (R2-123)
    ];

    for (const template of ['classic', 'sidebar']) {
      for (const [key, stored, kept, printedAs] of cases) {
        const at = `${template} ${key} ${JSON.stringify(stored)}`;
        const r = normalizeResume(cv(template, { [key]: stored }));
        assert.equal(r.settings[key], kept, `${at}: stored as`);
        assert.equal(r.updatedAt, 5, `${at}: not an edit`);
        const [pages, end] = [await read(await render(r)), await read(await render(normalizeResume(cv(template, { [key]: printedAs }))))];
        assert.equal(pages.length, end.length, `${at}: pages`);
        assert.deepEqual(sized(pages), sized(end), `${at}: every text, at the size the panel's end prints`);
      }
    }
  });

  it('a size delta is clamped against its own résumé\'s base: base 8 with Section Title -10 printed -2 pt headings', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    // [stored, stored as — a key it does not name keeps the harness résumé's own]
    const cases = [
      [{ fontSizeBase: 8, fontSizeSectionDelta: -10, fontSizeEntryDelta: -10 }, { fontSizeBase: 8, fontSizeSectionDelta: -2, fontSizeEntryDelta: -2 }],
      [{ fontSizeBase: 16, fontSizeNameDelta: 28, fontSizeSectionDelta: 16, fontSizeEntryDelta: 16 }, { fontSizeBase: 16, fontSizeNameDelta: 20, fontSizeSectionDelta: 8, fontSizeEntryDelta: 8 }],
      [{ fontSizeBase: '8', fontSizeNameDelta: '-5' }, { fontSizeBase: 8, fontSizeNameDelta: 0 }],
      [{ fontSizeBase: 'abc', fontSizeSectionDelta: -10 }, { fontSizeBase: undefined, fontSizeSectionDelta: -5 }],
      [{ fontSizeBase: 50, fontSizeNameDelta: 25 }, { fontSizeBase: 16, fontSizeNameDelta: 20 }],
    ];
    for (const template of ['classic', 'sidebar']) {
      for (const [stored, keptAs] of cases) {
        const at = `${template} ${JSON.stringify(stored)}`;
        const r = normalizeResume(cv(template, stored));
        const [pages, end] = [await read(await render(r)), await read(await render(cv(template, keptAs)))];
        assert.equal(pages.length, end.length, `${at}: pages`);
        assert.deepEqual(sized(pages), sized(end), `${at}: every text, at the size the rows' ends print`);
        for (const key of ['fontSizeBase', 'fontSizeNameDelta', 'fontSizeSectionDelta', 'fontSizeEntryDelta']) {
          const expected = key in keptAs ? keptAs[key] : cv(template, {}).settings[key];
          assert.equal(r.settings[key], expected, `${at}: ${key} stored as`);
        }
        assert.equal(r.updatedAt, 5, `${at}: not an edit`);
      }
    }
  });

  it('the same résumé for sizes the panel can set, at each end of the base (guard)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const settings of [
      { fontSizeBase: 11, fontSizeNameDelta: 8, fontSizeSectionDelta: 1, fontSizeEntryDelta: 0, iconSize: 11 },
      { fontSizeBase: 8, fontSizeNameDelta: 28, fontSizeSectionDelta: -2, fontSizeEntryDelta: 16, iconSize: 9 },
      { fontSizeBase: 16, fontSizeNameDelta: 0, fontSizeSectionDelta: 8, fontSizeEntryDelta: -10, iconSize: 20 },
    ]) {
      const stored = { ...cv('classic', settings), dataVersion: DATA_VERSION };
      assert.equal(normalizeResume(stored), stored, JSON.stringify(settings));
    }
  });
});
