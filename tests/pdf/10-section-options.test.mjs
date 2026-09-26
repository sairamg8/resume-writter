// Section Options (the section editor's "Customize layout") as they print.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, itemsWith, allText, loadModule, MM, TEMPLATES } from './harness.mjs';

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

  // Guard: left alignment already worked; the fix (9e776bb) was the centred one.
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

  // Guard: Word already honoured 'Show dates'; the fix (c5a71ac) was the PDF's.
  it('Word: "Show dates" off hides the date too', async () => {
    const items = [{ title: 'React Performance Patterns', date: 'Spring 2024' }];
    const { texts } = await renderDocx(resume({ sections: [section('custom', items, { showDates: false })] }));
    assert.ok(texts.some((t) => t.includes('React Performance Patterns')));
    assert.ok(!texts.some((t) => t.includes('2024')), texts.join(' | '));
  });
});

describe('experience Order (FIDA-58 / FIDB-72)', () => {
  // With no Order chosen a template prints its own default — the one the section editor shows.
  const DEFAULT_ORDER = { classic: 'company', modern: 'company', minimal: 'company', executive: 'role', sidebar: 'role', timeline: 'role', banner: 'role', academic: 'role', compact: 'role',
    // The designed layouts (R2-138 B2): Classic's entries, but Registry's and Broadsheet's jobs lead with the role.
    gridline: 'company', registry: 'role', bookend: 'company', lectern: 'company', chronicle: 'company', keystone: 'company', banded: 'company', keel: 'company', linen: 'company', broadsheet: 'role' };
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
    // The Sidebar's cards are Stacked: the second field on the line under the first (R2-070).
    assert.match(await lineOf('sidebar', { titleOrder: 'company' }), /^Acme Corp\t[^\n]*\nStaff Engineer/);
  });

  it('a stored null or empty Order (imported data) is no choice: the PDF, Word and the editor all take the template default (R6-5)', async () => {
    const { resolveSection } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');
    const order = (line) => (line.indexOf('Staff Engineer') < line.indexOf('Acme Corp') ? 'role' : 'company');
    const wrong = [];
    for (const template of TEMPLATES) {
      for (const titleOrder of [null, '']) {
        const r = resume({ template, sections: [experience([{ company: 'Acme Corp', role: 'Staff Engineer' }], { titleOrder })] });
        const pdf = order(allText(await read(await render(r))));
        const word = order((await renderDocx(r)).texts.find((t) => t.includes('Acme Corp')));
        // What the Order control highlights (SectionEditorCustomizer: the resolved value, else Co. / Role).
        const editor = resolveSection(r.sections[0], template).settings.titleOrder || 'company';
        const got = { pdf, word, editor };
        if (Object.values(got).some((v) => v !== DEFAULT_ORDER[template])) wrong.push(`${template} ${JSON.stringify(titleOrder)}: ${JSON.stringify(got)}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
});

describe('entry Title layout', () => {
  // Stacked puts the second field under the first; Inline and Side by side keep them on one line.
  async function lineOf(template, type, titleStyle) {
    const items = type === 'experience' ? [{ company: 'Acme Corp', role: 'Staff Engineer', location: 'Pune' }] : [{ org: 'Acme Corp', role: 'Staff Engineer', location: 'Pune' }];
    const pages = await read(await render(resume({ template, sections: [section(type, items, titleStyle !== undefined ? { titleStyle } : {})] })));
    return Math.abs(first(pages, 'Acme Corp').y - first(pages, 'Staff Engineer').y) < 1 ? 'one line' : 'two lines';
  }

  for (const template of TEMPLATES) {
    it(`${template}: experience and volunteering print each Title option (Stacked, Inline, Side by side)`, async () => {
      for (const type of ['experience', 'volunteering']) {
        assert.equal(await lineOf(template, type, 'stacked'), 'two lines', `${type} Stacked`);
        assert.equal(await lineOf(template, type, 'inline'), 'one line', `${type} Inline`);
        assert.equal(await lineOf(template, type, 'sidebyside'), 'one line', `${type} Side by side`);
      }
    });
  }

  it('AUD-21: Executive default titleStyle is inline (one line); Classic default is stacked (two lines)', async () => {
    assert.equal(await lineOf('executive', 'experience'), 'one line', 'executive experience default is inline');
    assert.equal(await lineOf('executive', 'volunteering'), 'one line', 'executive volunteering default is inline');
    assert.equal(await lineOf('classic', 'experience'), 'two lines', 'classic experience default is stacked');
    assert.equal(await lineOf('classic', 'volunteering'), 'two lines', 'classic volunteering default is stacked');
  });

  it('AUD-21: SECTION_TYPE_DEFAULTS and blankSections do not hardcode titleStyle: stacked', async () => {
    const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultDataSectionTypes.js');
    const { blankSections } = await loadModule('/src/utils/defaultDataContent.js');
    for (const [type, factory] of Object.entries(SECTION_TYPE_DEFAULTS)) {
      const sec = factory('test_id');
      assert.equal(sec.settings?.titleStyle, undefined, `${type} factory should not store titleStyle`);
    }
    for (const sec of blankSections()) {
      assert.equal(sec.settings?.titleStyle, undefined, `blankSections ${sec.type} should not store titleStyle`);
    }
  });

  it('AUD-21: Reset style clears custom titleStyle: stacked so Executive inline default takes effect', async () => {
    const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultDataSectionTypes.js');
    const { resolveSection } = await loadModule('/src/templates/pdf/shared/templateSectionDefaults.js');

    const customSection = {
      id: 'exp1',
      type: 'experience',
      settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
    };
    assert.equal(resolveSection(customSection, 'executive').settings.titleStyle, 'stacked', 'customized to stacked');

    const factory = SECTION_TYPE_DEFAULTS[customSection.type] || SECTION_TYPE_DEFAULTS.custom;
    const fresh = factory(customSection.id);
    const resetSection = { ...customSection, settings: { ...fresh.settings } };

    assert.equal(resetSection.settings.titleStyle, undefined, 'reset section has no titleStyle stored');
    assert.equal(resolveSection(resetSection, 'executive').settings.titleStyle, 'inline', 'resolves to executive inline');
    assert.equal(resolveSection(resetSection, 'classic').settings.titleStyle, undefined, 'classic resolves to unset (stacked fallback)');
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

describe('the default gap between items (R2-1)', () => {
  // With no "Between Items" set, entries sit 8 px (6 pt) apart, as every résumé printed before the
  // slider worked (FIDA-53); Spacious is 14 px (10.5 pt), Tight 4 px (3 pt) — the old presets.
  const pitch = async (template, sectionSettings = {}, settings = {}) => {
    const pages = await read(await render(resume({ template, settings, sections: [experience([{}, {}, {}], sectionSettings)] })));
    return first(pages, 'Role 1').y - first(pages, 'Role 2').y;
  };
  const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 0.3, `${what}: ${actual.toFixed(2)} pt, expected ${expected.toFixed(2)}`);

  // Academic brings a denser Between Items, 6 px (T8), Compact 5 px (T9): their presets keep the same proportions.
  const OWN_PT = { academic: 4.5, compact: 3.75 };
  for (const template of TEMPLATES) {
    const own = OWN_PT[template] ?? 6;
    it(`${template}: a new résumé prints the old presets' gaps — Normal ${own} pt, Tight ${own / 2} pt, Spacious ${own * 1.75} pt`, async () => {
      const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
      assert.equal(defaultSettings(template).itemGap * 0.75, own, `${template}: its own Between Items`);
      const none = await pitch(template, { itemGap: 0 });
      near(await pitch(template) - none, own, 'Normal');
      near(await pitch(template, { spacing: 'compact' }) - none, own / 2, 'Tight');
      near(await pitch(template, { spacing: 'relaxed' }) - none, own * 1.75, 'Spacious');
    });
  }

  it('a résumé saved with the old 12 px default prints the 6 pt gap it always printed once loaded', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const saved = resume({ settings: { itemGap: 12 } });
    delete saved.dataVersion;
    saved.updatedAt = Date.UTC(2026, 7, 20); // last edited before 4bc56fe; the rest: 16-saved-data-item-gaps
    const loaded = normalizeResume(saved);
    assert.equal(loaded.settings.itemGap, 8);
    const gapOf = async (r) => {
      const pages = await read(await render({ ...r, sections: [experience([{}, {}])] }));
      return first(pages, 'Role 1').y - first(pages, 'Role 2').y;
    };
    const none = await gapOf({ ...loaded, settings: { ...loaded.settings, itemGap: 0 } });
    near(await gapOf(loaded) - none, 6, 'migrated');
  });
});

describe('Sidebar main column Alignment (R6-1)', () => {
  // Experience and Projects in the Sidebar's main column print as cards; Center must centre
  // their title, header, description and bullets on the card as SectionRouter does elsewhere.
  const EXP = [{ company: 'AcmeCo', role: 'DevRole', location: 'Pune', startDate: '01/2020', endDate: '12/2021', description: '<p>ExpDesc short</p><ul><li>ExpBullet</li></ul>' }];
  const PROJ = [{ name: 'ProjName', url: 'github.com/me/proj', startDate: '2021', endDate: '2022', description: '<p>ProjDesc short</p>' }];
  const pagesOf = (type, items, settings) =>
    render(resume({ template: 'sidebar', sections: [section(type, items, settings)] })).then(read);
  /** Left and right ends of the printed line holding `needle`, in the main column. */
  const line = (pages, needle) => {
    const t = first(pages, needle);
    const row = pages[0].items.filter((o) => Math.abs(o.y - t.y) < 1 && o.x > pages[0].W * 0.3);
    return { x0: Math.min(...row.map((o) => o.x)), x1: Math.max(...row.map((o) => o.x + o.w)) };
  };

  for (const [type, items, needles, heading, date] of [
    ['experience', EXP, ['DevRole', 'AcmeCo', '01/2020', 'ExpDesc'], 'EXPERIENCE', '01/2020'],
    ['projects', PROJ, ['ProjName', 'github.com/me/proj', '2021', 'ProjDesc'], 'PROJECTS', '2021'],
  ]) {
    for (const titleStyle of type === 'experience' ? ['stacked', 'inline', 'sidebyside'] : ['stacked']) {
      it(`${type} (${titleStyle}): Center centres the title, header and description on the card; Left keeps them at its left edge`, async () => {
        const left = await pagesOf(type, items, { titleStyle });
        const centre = await pagesOf(type, items, { titleStyle, alignment: 'center' });
        const edge = first(left, needles[0]).x;
        const right = left[0].W - 18 * MM;
        const mid = (edge + right) / 2;
        for (const needle of needles) {
          // Left: each line starts at the card's edge; the date alone keeps to the right margin.
          const [at, from] = needle === date ? [line(left, needle).x1, right] : [line(left, needle).x0, edge];
          assert.ok(Math.abs(at - from) < 1.5, `left: "${needle}" at x ${at.toFixed(1)}, expected ${from.toFixed(1)}`);
          const { x0, x1 } = line(centre, needle);
          assert.ok(Math.abs((x0 + x1) / 2 - mid) < 1.5 && x0 > edge + 5, `center: "${needle}" at x ${x0.toFixed(1)}–${x1.toFixed(1)}, centred at ${((x0 + x1) / 2).toFixed(1)}; the card's centre ${mid.toFixed(1)}`);
        }
        const title = first(centre, heading);
        assert.ok(title.x > first(left, heading).x + 20, `the section title moves too (x ${first(left, heading).x.toFixed(1)} → ${title.x.toFixed(1)})`);
        if (type === 'experience') assert.ok(first(centre, 'ExpBullet').x > first(left, 'ExpBullet').x + 30, 'the bullet text moves to the centre');
      });
    }
  }
});
