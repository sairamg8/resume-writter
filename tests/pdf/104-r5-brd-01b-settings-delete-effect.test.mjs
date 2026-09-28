// R5-BRD-01b (Project settings' column delete): its "Its N issues move to [column]" panel let the
// user pick a column of another done state and said nothing, so Delete column silently marked the
// issues done (a repeating one making its next occurrence) or reopened them — the board's own
// delete says " and be marked done" / " and be reopened". columnDeletion worked the change out for
// the nearest column only. Now it takes the column picked, and the panel says what the move to it
// does, updating as the pick changes. (The delete's toast with Undo is R4-SW-B-01's.)
// columnDeletion directly; the real Settings page over tests/pdf/fake-dom.mjs (103-r4-board-settings-helpers.mjs).
// Run: node --test tests/pdf/104-r5-brd-01b-settings-delete-effect.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { columnDeletion } from '../../src/utils/boardView.js';
import { mountSettings } from './103-r4-board-settings-helpers.mjs';

let dom;
let store;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);

const col = (id, title, category) => ({ id, title, category, wipLimit: null });
const COLUMNS = [col('todo', 'To Do', 'todo'), col('doing', 'In Progress', 'inprogress'), col('review', 'Review', 'inprogress'), col('done', 'Done', 'done')];
const board = (columns) => ({ id: 'p1', columns, issues: [{ id: 'a', columnId: 'doing' }, { id: 'b', columnId: 'done' }] });

it('columnDeletion works the change out for the column picked; with none picked, for the nearest', () => {
  const b = board(COLUMNS);
  assert.deepEqual([columnDeletion(b, 'doing').target.id, columnDeletion(b, 'doing').change], ['review', null], 'the nearest: another in-progress column');
  assert.deepEqual([columnDeletion(b, 'doing', 'done').target.id, columnDeletion(b, 'doing', 'done').change], ['done', 'resolve'], 'Done picked: the issues are marked done');
  assert.equal(columnDeletion(b, 'done', 'todo').change, 'reopen', 'out of Done into To Do: reopened');
  assert.equal(columnDeletion(b, 'doing', 'nope').target.id, 'review', 'a pick that is not a column: the nearest');
  assert.equal(columnDeletion(b, 'doing', 'doing').target.id, 'review', 'the column itself is never its target');
});

it('Settings: the panel says the issues will be marked done when Done is picked, and nothing for an open column', async () => {
  const page = await mountSettings();
  try {
    page.openDeleteStrip(); // To Do, holding "Fix the tap"; the nearest target is Doing
    const row = page.find('data-column', 'c1');
    const effect = () => page.all(row).find((el) => el.hasAttribute('data-effect'))?.textContent ?? '';
    const select = () => page.byLabel('Move its issues to', row);
    assert.equal(dom.reactProps(select()).value, 'c2');
    assert.equal(effect(), '', 'into Doing: no change to say');
    page.view.act(() => dom.reactProps(select()).onChange({ target: { value: 'c3' } }));
    assert.match(row.textContent, /Its 1 issue move to.*and will be marked done/s);
    page.view.act(() => dom.reactProps(select()).onChange({ target: { value: 'c2' } }));
    assert.equal(effect(), '', 'the pick changed back: the warning goes');
    page.view.act(() => dom.reactProps(select()).onChange({ target: { value: 'c3' } }));
    page.click(page.button('Delete column', row));
    const fixed = store.snapshot().boards.find((b) => b.id === 'p1').issues.find((i) => i.id === 'i1');
    assert.equal(fixed.columnId, 'c3');
    assert.ok(fixed.resolvedAt, 'moved into Done, as the panel said: resolved');
  } finally { await page.close(); }
});
