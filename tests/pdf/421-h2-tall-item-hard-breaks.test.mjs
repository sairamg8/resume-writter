// H2 hunt: a list item is kept whole on one page only while a page can hold it (keepTogether.js: fitsPage). The lines were
// counted from the item's words as one run, but a <br> in a list item (Shift+Enter, or a pasted block) is a "\n" that ends a line
// whatever the width: sixty short lines were counted as six, the item was kept whole, and being taller than a page its tail ran
// off the foot and was lost. fitsPage now lays each piece between two breaks out on lines of its own (a blank one is a line).
// Pinned: an item of 60 hard-broken lines splits, every line above the bottom margin and the last one printed; a few
// hard-broken lines are still kept whole; fitsPage's own count.
// Run: node --test tests/pdf/421-h2-tall-item-hard-breaks.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, render, read, allItems, allText, loadModule, MM,
} from './harness.mjs';

before(setup);
after(teardown);

const MARGIN_V = 40;
const lines = (n) => Array.from({ length: n }, (_, i) => `Row ${String(i + 1).padStart(2, '0')} of the list`);

const belowMargin = (pages) => allItems(pages)
  .filter((t) => t.y < MARGIN_V * MM - 3)
  .map((t) => `p${t.page}: "${t.str.slice(0, 24)}" at y=${t.y.toFixed(1)}`);

const withBullet = (rows) => resume({
  template: 'classic',
  settings: { fontSizeBase: 12, marginV: MARGIN_V },
  sections: [section('experience', [
    { company: 'Acme', role: 'Engineer', startDate: '2020', endDate: '2021', description: `<ul><li>${rows.join('<br>')}</li></ul>` },
  ])],
});

describe('a list item of many hard-broken lines is counted line by line (H2)', () => {
  it('60 lines in one bullet are taller than a page: it splits, nothing is cut off', async () => {
    const pages = await read(await render(withBullet(lines(60))));
    assert.ok(pages.length >= 2, `the bullet runs over ${pages.length} pages`);
    assert.deepEqual(belowMargin(pages), [], 'nothing below the bottom margin');
    assert.match(allText(pages), /Row 60 of the list/, 'the last line of the bullet prints');
    assert.match(allText(pages), /Row 01 of the list/);
  });

  it('fitsPage counts a line for each break; a few short lines are still kept whole', async () => {
    const { fitsPage } = await loadModule('/src/templates/pdf/shared/keepTogether.js');
    const room = { fontSize: 12, lineHeight: 1.5, width: 493, height: 616 };
    assert.equal(fitsPage({ ...room, text: lines(4).join('\n') }), true, 'four lines');
    assert.equal(fitsPage({ ...room, text: lines(60).join('\n') }), false, 'sixty lines are taller than the page');
    assert.equal(fitsPage({ ...room, text: `${'a\n'.repeat(60)}a` }), false, 'sixty one-letter lines');
    assert.equal(fitsPage({ ...room, text: `x${'\n'.repeat(60)}y` }), false, 'blank lines are lines');
    assert.equal(fitsPage({ ...room, text: lines(60).join(' ') }), true, 'the same words as running text fit in a dozen lines');
  });
});
