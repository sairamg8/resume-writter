// Section Options (the section editor's "Customize layout") as they print.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, itemsWith, allText, MM, TEMPLATES } from './harness.mjs';

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

describe('experience Order (FIDA-58 / FIDB-72)', () => {
  // With no Order chosen a template prints its own default — the one the section editor shows.
  const DEFAULT_ORDER = { classic: 'company', modern: 'company', minimal: 'company', executive: 'role', sidebar: 'role' };
  const bold = (t) => /Bold/.test(t.font);
  /** Which field leads the entry: the bold primary, printed before the other one. */
  async function lead(template, titleOrder) {
    const pages = await read(await render(resume({ template, sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer' }], titleOrder ? { titleOrder } : {})] })));
    const [company, role] = [first(pages, 'Acme Corp'), first(pages, 'Staff Engineer')];
    const text = allText(pages);
    const order = text.indexOf('Staff Engineer') < text.indexOf('Acme Corp') ? 'role' : 'company';
    assert.equal(bold(order === 'role' ? role : company), true, `${template}: the leading ${order} is bold`);
    assert.equal(bold(order === 'role' ? company : role), false, `${template}: the other field is not`);
    return order;
  }

  for (const template of TEMPLATES) {
    it(`${template}: unset prints the template default; "Co. / Role" and "Role / Co." each change the PDF`, async () => {
      assert.equal(await lead(template), DEFAULT_ORDER[template], 'no Order chosen');
      assert.equal(await lead(template, 'company'), 'company', 'Co. / Role');
      assert.equal(await lead(template, 'role'), 'role', 'Role / Co.');
    });
  }

  it('Word follows the same order as the PDF', async () => {
    const lineOf = async (template, settings = {}) => {
      const { texts } = await renderDocx(resume({ template, sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer' }], settings)] }));
      return texts.find((t) => t.includes('Acme Corp'));
    };
    for (const template of TEMPLATES) {
      const line = await lineOf(template);
      assert.equal(line.indexOf('Staff Engineer') < line.indexOf('Acme Corp') ? 'role' : 'company', DEFAULT_ORDER[template], `${template}: ${line}`);
    }
    assert.match(await lineOf('sidebar', { titleOrder: 'company' }), /^Acme Corp — Staff Engineer/);
  });
});

describe('item spacing (FIDA-53)', () => {
  // Distance between two entries' matching lines: the entry's height plus the item gap.
  const pitch = async (template, itemGap, sectionSettings = {}) => {
    const pages = await read(await render(resume({ template, settings: { itemGap }, sections: [experience([{}, {}, {}], sectionSettings)] })));
    return first(pages, 'Role 1').y - first(pages, 'Role 2').y;
  };
  const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 0.3, `${what}: ${actual.toFixed(2)} pt, expected ${expected.toFixed(2)}`);

  for (const template of TEMPLATES) {
    it(`${template}: Design → "Between Items" moves the entries; the section preset scales it; an item-gap override wins`, async () => {
      const base = await pitch(template, 12);
      near(await pitch(template, 40) - base, (40 - 12) * 0.75, 'Between Items 12 → 40 px');
      near(await pitch(template, 12, { spacing: 'compact' }) - base, (6 - 12) * 0.75, 'Tight is half the global gap');
      near(await pitch(template, 12, { spacing: 'relaxed' }) - base, (21 - 12) * 0.75, 'Spacious is 1.75× the global gap');
      near(await pitch(template, 40, { spacing: 'relaxed', itemGap: 5 }) - base, (5 - 12) * 0.75, 'a section\'s own item gap (px) wins');
    });
  }
});
