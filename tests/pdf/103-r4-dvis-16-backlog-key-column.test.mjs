// R4-DVIS-16: a backlog row's issue key in a project with a long key. The key sat in a fixed 64px
// column (w-16) with no rule against wrapping, and a key may be up to ten letters: "ABCDEFGHIJ-1"
// is about 100px at 13px, so the browser broke it after the '-' inside the 40px row, or it ran on
// over the summary. The column is now at least 64px (short keys still line up), never wraps, and
// widens for a long key while the summary (min-w-0 flex-1 truncate) gives way. The key is never
// truncated: its number is what tells the issue apart. The real Backlog page over fake-dom
// (tests/pdf/103-r4-backlog-page.mjs); fake-dom has no layout, so the class tokens are checked.
// Run: node --test tests/pdf/103-r4-dvis-16-backlog-key-column.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useBacklogPage, mountBacklog, project, tokens } from './103-r4-backlog-page.mjs';

useBacklogPage();

it('R4-DVIS-16: a ten-letter key stays on one line and widens its column; the summary gives way', async () => {
  const page = mountBacklog([project({ key: 'ABCDEFGHIJ' })]);
  try {
    const row = page.byLabel('ABCDEFGHIJ-1 Fix the tap', page.section('backlog'));
    assert.ok(row, 'the row of ABCDEFGHIJ-1 is in the backlog');
    const key = page.all(row).find((el) => el.tagName === 'SPAN' && el.textContent === 'ABCDEFGHIJ-1');
    assert.ok(key, 'the row shows its key');
    const got = tokens(key);
    assert.ok(got.has('whitespace-nowrap'), 'the key may break after its "-" onto a second line of the 40px row');
    assert.ok(got.has('min-w-16'), 'short keys no longer line up in a 64px column');
    assert.ok(got.has('shrink-0'), 'the key gives way to the summary');
    assert.equal(got.has('w-16'), false, 'a fixed 64px column: a longer key wraps or runs over the summary');
    assert.equal(got.has('truncate'), false, 'a truncated key hides the number that tells the issue apart');

    // What gives way instead: the summary beside it.
    const summary = page.all(row).find((el) => el.tagName === 'SPAN' && el.textContent === 'Fix the tap');
    for (const t of ['min-w-0', 'flex-1', 'truncate']) assert.ok(tokens(summary).has(t), `the summary lacks ${t}`);
  } finally {
    await page.view.unmount();
  }
});
