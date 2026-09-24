// R3-002: an entry title whose one word is wider than the room its date leaves printed over the
// date — EndRow gave the title `flex: 1` and the date its whole width, and textkit cannot break a
// word. Now the title keeps at least its widest word's width, and the date wraps under it when
// the two do not fit side by side. Every header that puts a field at a title's right end: ItemHeader
// (Stacked, Inline, Side by side, the sub line's location), Projects and Certifications, the
// Sidebar's cards, Timeline's sub line.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allText, overlaps } from './harness.mjs';

before(setup);
after(teardown);

const DATES = /\d\d\/\d{4} – (\d\d\/\d{4}|Present)/;

/** Every overlap of a run with a date or location run, in "a × b" form. */
function fieldOverlaps(pages, fields = [DATES]) {
  return pages.flatMap((p) => overlaps(p))
    .filter(([a, b]) => fields.some((f) => f.test(a) || f.test(b)))
    .map(([a, b]) => `"${a}" × "${b}"`);
}

async function assertApart(r, words, fields) {
  const pages = await read(await render(r));
  assert.deepEqual(fieldOverlaps(pages, fields), [], 'no title prints over its date or location');
  const text = allText(pages);
  for (const w of words) assert.ok(text.includes(w), `${w} in: ${text}`);
  return pages;
}

const projects = (settings = {}) => section('projects', [
  { name: 'Ledgerline', technologies: 'React', startDate: '02/2022', endDate: '08/2022' },
  { name: 'Queuebird', technologies: 'Go', startDate: '02/2022', endDate: '08/2022' },
], { columns: 2, ...settings });

describe('a title word wider than the room beside the date wraps the date under it (R3-002)', () => {
  it('Sidebar, Projects in 2 columns (the card header)', async () => {
    const pages = await assertApart(resume({ template: 'sidebar', sections: [projects()] }), ['Ledgerline', 'Queuebird', '02/2022 – 08/2022']);
    // The date on a line of its own under the name, at the card's right end: the name's right, or further.
    const [name] = pages[0].items.filter((t) => t.str === 'Ledgerline');
    const [date] = pages[0].items.filter((t) => DATES.test(t.str));
    assert.ok(date.y < name.y - 5, `the date under the name: ${date.y} vs ${name.y}`);
    assert.ok(date.x + date.w >= name.x + name.w, `the date at the right end: ${date.x + date.w} vs ${name.x + name.w}`);
  });

  it('Sidebar, the largest entry size (the card header)', async () => {
    await assertApart(resume({
      template: 'sidebar', settings: { fontSizeEntryDelta: 13 },
      sections: [experience([{ role: 'Staff Engineer', company: 'Northwind' }], { titleOrder: 'role' })],
    }), ['Staff', 'Engineer', '01/2020 – 12/2021']);
  });

  // Wider than the room a half-page column leaves beside a date, narrower than the column, and
  // under breakLongWords' 48 letters, so never broken.
  const LONG = 'Reliabilityarchitect';
  for (const titleStyle of ['stacked', 'inline', 'sidebyside']) {
    it(`Classic, a one-word role, Title ${titleStyle} (ItemHeader)`, async () => {
      await assertApart(resume({
        settings: { fontSizeEntryDelta: 6 },
        sections: [experience([{ role: LONG, company: '' }], { titleOrder: 'role', titleStyle, columns: 2 }),
        ],
      }), [LONG, '01/2020 – 12/2021']);
    });
  }

  it('Classic, a one-word company beside its location (the sub line)', async () => {
    const company = 'Hyperconvergedinfrastructureconsult';
    await assertApart(resume({
      sections: [experience([{ role: 'Engineer', company, location: 'Springfield' }], { titleOrder: 'role', columns: 2 })],
    }), [company, 'Springfield'], [/Springfield/]);
  });

  it('Classic, Projects and Certifications in 2 columns (PdfSectionsTwo)', async () => {
    await assertApart(resume({
      settings: { fontSizeEntryDelta: 8 },
      sections: [projects(), section('certifications', [
        { name: 'CNCF Kubernetesadministrator', date: '02/2022', expiry: '08/2024' },
        { name: 'Cloudpractitioner', issuer: 'AWS', date: '02/2022', expiry: '08/2024' },
      ], { columns: 2 })],
    }), ['Ledgerline', 'Kubernetesadministrator'], [/\d\d\/\d{4}/]);
  });

  it('Timeline, a one-word company beside a long location', async () => {
    const company = 'Hyperconvergedinfrastructureconsultancygroupltd'; // 47 letters
    await assertApart(resume({
      template: 'timeline',
      sections: [experience([{ role: 'Engineer', company, location: 'Springfield, Massachusetts, United States of America' }], { titleOrder: 'role', titleStyle: 'stacked' })],
    }), [company], [/Springfield/]);
  });

  it('a title that fits keeps its date on its own line (unchanged)', async () => {
    const pages = await read(await render(resume({ sections: [experience([{ role: 'Engineer', company: 'Fabrikam' }], { titleOrder: 'role' })] })));
    const items = pages[0].items;
    const role = items.findLast((t) => t.str === 'Engineer'); // the entry's, not the header's title
    const date = items.find((t) => DATES.test(t.str));
    assert.ok(role && date, items.map((t) => t.str).join(' | '));
    assert.ok(Math.abs(role.y - date.y) < 1, `the date on the title's baseline: ${role.y} vs ${date.y}`);
  });
});
