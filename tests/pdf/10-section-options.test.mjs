// Section Options (the section editor's "Customize layout") as they print.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, itemsWith, allText, MM, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

// Sidebar prints Languages in its dark column, with its own components.
const MAIN_COLUMN = ['classic', 'modern', 'minimal', 'executive'];

const first = (pages, needle) => {
  const hit = itemsWith(pages, needle)[0];
  assert.ok(hit, `"${needle}" is printed`);
  return hit;
};

describe('languages (FIDA-34 / FIDB-71)', () => {
  const LANGS = [{ language: 'English', proficiency: 'Native' }, { language: 'German', proficiency: 'Fluent' }, { language: 'French', proficiency: 'Basic' }];
  const pairCentre = (pages, lang, prof) => {
    const l = first(pages, lang);
    const p = first(pages, prof);
    return (l.x + p.x + p.w) / 2;
  };

  for (const template of MAIN_COLUMN) {
    it(`${template}: Alignment Center centres each language–proficiency pair in its column`, async () => {
      const left = 18 * MM;
      for (const columns of [1, 2]) {
        const pages = await read(await render(resume({ template, sections: [section('languages', LANGS, { alignment: 'center', columns })] })));
        const right = pages[0].W - 18 * MM;
        const cell = (right - left) * (columns === 2 ? 0.48 : 1);
        const centres = columns === 2 ? [left + cell / 2, right - cell / 2, left + cell / 2] : [(left + right) / 2, (left + right) / 2, (left + right) / 2];
        LANGS.forEach(({ language, proficiency }, i) => {
          const c = pairCentre(pages, language, proficiency);
          assert.ok(Math.abs(c - centres[i]) < 1.5, `${columns} col: ${language} pair centred at ${c.toFixed(1)}, column centre ${centres[i].toFixed(1)}`);
        });
        assert.ok(first(pages, 'Native').x - (first(pages, 'English').x + first(pages, 'English').w) < 12, 'the proficiency sits next to its language');
      }
    });

    it(`${template}: rows are one line apart plus the item gap — no extra margin`, async () => {
      for (const itemGap of [0, 20]) {
        const pages = await read(await render(resume({ template, sections: [section('languages', LANGS, { columns: 1, itemGap })] })));
        const [a, b, c] = ['English', 'German', 'French'].map((s) => first(pages, s));
        const gap = itemGap * 0.75;
        assert.ok(Math.abs((a.y - b.y) - (b.y - c.y)) < 0.1, 'even pitch');
        assert.ok(a.y - b.y - gap < a.h * 1.45, `gap ${itemGap}px: pitch ${(a.y - b.y).toFixed(2)} for ${a.h}pt text`);
      }
    });
  }

  it('left alignment keeps language at the left edge and proficiency on the right', async () => {
    const pages = await read(await render(resume({ sections: [section('languages', LANGS, { columns: 1 })] })));
    assert.ok(Math.abs(first(pages, 'English').x - 18 * MM) < 0.5);
    assert.ok(first(pages, 'Native').x > pages[0].W / 2);
  });
});

describe('custom section', () => {
  for (const template of TEMPLATES) {
    it(`${template}: "Show dates" off hides the date (FIDA-35)`, async () => {
      const items = [{ title: 'React Performance Patterns', subtitle: 'Tech Blog', date: 'Spring 2024' }];
      const shown = allText(await read(await render(resume({ template, sections: [section('custom', items)] }))));
      assert.ok(shown.includes('Spring 2024'), shown);
      const hidden = allText(await read(await render(resume({ template, sections: [section('custom', items, { showDates: false })] }))));
      assert.ok(hidden.includes('React Performance Patterns'), hidden);
      assert.ok(!hidden.includes('2024'), hidden);
    });
  }

  it('Word: "Show dates" off hides the date too', async () => {
    const items = [{ title: 'React Performance Patterns', date: 'Spring 2024' }];
    const { texts } = await renderDocx(resume({ sections: [section('custom', items, { showDates: false })] }));
    assert.ok(texts.some((t) => t.includes('React Performance Patterns')));
    assert.ok(!texts.some((t) => t.includes('2024')), texts.join(' | '));
  });
});
