// R2-046: a summary longer than a page. The header block that holds it could not break, so its last
// sentences were clipped or printed into the bottom margin. Every template, and the Sidebar's ATS-safe
// single column, must print every sentence inside the margins and nothing on top of anything else.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allItems, overlaps, MM, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const N = 60;
const summary = `<p>${Array.from({ length: N }, (_, i) => `Sentence mark${i + 1}z tells a reader about this person here now.`).join(' ')}</p>`;
const cases = [...TEMPLATES.map((t) => [t, {}]), ['sidebar', { sidebarSingleColumn: true }]];

for (const [template, extra] of cases) {
  it(`${template}${extra.sidebarSingleColumn ? ' (single column)' : ''}: a summary longer than a page prints whole, inside the margins`, async () => {
    const r = resume({
      template,
      settings: { fontSizeBase: 12, lineHeightValue: 1.8, ...extra },
      personal: { summary },
      sections: [experience([{ description: '<p>Body text of the first job.</p>' }])],
    });
    const pages = await read(await render(r));
    const items = allItems(pages);
    const seen = new Set();
    for (const t of items) for (const m of t.str.matchAll(/mark(\d+)z/g)) seen.add(+m[1]);
    const missing = Array.from({ length: N }, (_, i) => i + 1).filter((n) => !seen.has(n));
    assert.deepEqual(missing, [], `sentences missing from the PDF (${pages.length} pages)`);
    const m = (r.settings.marginV ?? 14) * MM;
    const low = items.filter((t) => t.y < m - 3).map((t) => `p${t.page} "${t.str.slice(0, 20)}" y=${t.y.toFixed(1)}`);
    assert.deepEqual(low, [], 'text below the bottom margin');
    assert.deepEqual(pages.flatMap(overlaps), [], 'overprinted text');
    assert.ok(items.some((t) => t.str.includes('Body text of the first job')), 'the section after the summary prints');
  });
}
