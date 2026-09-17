import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, section, render, read, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const cv = (template, settings) => ({
  ...resume({ template, settings, sections: [experience([{}, {}]), section('skills', [{ category: 'Tools', skills: 'Git, SQL' }])] }),
  updatedAt: 5,
});
const texts = (pages) => pages.flatMap((p) => p.items.map((i) => i.str)).filter((s) => s.trim()).sort();

describe('stored Typography numbers print within the panel\'s ranges (VF2-3.2-NB1-NB1-NB1)', () => {
  it('out of range is clamped to that end, and prints as the panel\'s end does: the same pages, every text', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const cases = [
      ['fontSizeBase', 'abc', undefined, 11],
      ['fontSizeBase', '12', 12, 12],
      ['fontSizeBase', 50, 16, 16],
      ['fontSizeBase', 2, 8, 8],
      
      ['fontSizeNameDelta', 'abc', undefined, 8],
      ['fontSizeNameDelta', '12', 12, 12],
      ['fontSizeNameDelta', 50, 28, 28], // max size 36, min base 8 -> max delta 28
      ['fontSizeNameDelta', -50, 0, 0], // min size 8, max base 16 -> min delta -8
      
      ['fontSizeSectionDelta', 'abc', undefined, 1],
      ['fontSizeSectionDelta', '5', 5, 5],
      ['fontSizeSectionDelta', 50, 16, 16], // max size 24, min base 8 -> max delta 16
      ['fontSizeSectionDelta', -50, -10, -10], // min size 6, max base 16 -> min delta -10
      
      ['fontSizeEntryDelta', 'abc', undefined, 0],
      ['fontSizeEntryDelta', '5', 5, 5],
      ['fontSizeEntryDelta', 50, 16, 16],
      ['fontSizeEntryDelta', -50, -10, -10],
      
      ['iconSize', 'abc', undefined, 11],
      ['iconSize', '12', 12, 12],
      ['iconSize', 50, 20, 20],
      ['iconSize', 2, 8, 8],
    ];

    for (const template of ['classic', 'sidebar']) {
      for (const [key, stored, kept, printedAs] of cases) {
        const at = `${template} ${key} ${JSON.stringify(stored)}`;
        const r = normalizeResume(cv(template, { [key]: stored }));
        assert.equal(r.settings[key], kept, `${at}: stored as`);
        assert.equal(r.updatedAt, 5, `${at}: not an edit`);
        const [pages, end] = [
          await read(await render(r)), 
          await read(await render(normalizeResume(cv(template, { [key]: printedAs }))))
        ];
        assert.equal(pages.length, end.length, `${at}: pages`);
        assert.deepEqual(texts(pages), texts(end), `${at}: every text`);
      }
    }
  });

  it('the same résumé for values the panel can set (guard)', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    for (const settings of [{ fontSizeBase: 11, fontSizeNameDelta: 8, fontSizeSectionDelta: 1, fontSizeEntryDelta: 0, iconSize: 11 }, { fontSizeBase: 16, fontSizeNameDelta: 20, fontSizeSectionDelta: 5, fontSizeEntryDelta: 5, iconSize: 20 }]) {
      const r = normalizeResume(cv('classic', settings));
      assert.equal(normalizeResume(r), r, JSON.stringify(settings));
      for (const [key, v] of Object.entries(settings)) assert.equal(r.settings[key], v, `${JSON.stringify(settings)} ${key}`);
    }
  });
});
