// Cycle 4, touch: a backlog row is dragged by a finger after a 200 ms hold (TouchSensor on the whole row). The board's
// cards (IssueCard) and the job cards (KanbanCard) are `select-none` so that hold does not start the browser's text
// selection (Android's word selection, iOS's callout and magnifier) on the title under the finger; the backlog row was
// the one draggable that was not, and it had no touch-action either. On a touch screen (hover: none) it is `select-none`
// now and `touch-manipulation`; a mouse keeps selecting the issue's text to copy it. fake-dom has no layout and no touch:
// the source is read.
// Run: node --test tests/pdf/222-cyc4-touch-backlog-row-no-select.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

/** The class tokens of the first string literal after `anchor` that holds `needle`. */
function classesAfter(text, anchor, needle) {
  const from = text.indexOf(anchor);
  assert.ok(from >= 0, `${anchor} is in the source`);
  const m = new RegExp(`'([^']*${needle}[^']*)'`).exec(text.slice(from));
  assert.ok(m, `a class string with ${needle}`);
  return m[1].split(/\s+/);
}

it('the backlog row is select-none on a touch screen and touch-manipulation', () => {
  const tokens = classesAfter(source('components/board/BacklogParts.jsx'), 'export function BacklogRow', 'group/row');
  assert.ok(tokens.includes('no-hover:select-none'), `select-none where there is no hover: ${tokens.join(' ')}`);
  assert.ok(tokens.includes('touch-manipulation'), 'no double-tap zoom on a row');
  assert.ok(!tokens.includes('select-none'), 'a mouse still selects the title');
  assert.ok(tokens.includes('cursor-pointer') && tokens.includes('group/row'), 'what it had stays');
});

it('the other draggable cards already are select-none (the rule the row now follows)', () => {
  assert.match(source('components/board/IssueCard.jsx'), /group\/card relative flex flex-col gap-2 rounded-cv-control bg-cv-surface p-3 text-left select-none/);
  assert.match(source('components/job/KanbanView.jsx'), /rounded bg-cv-surface p-3 select-none/);
  assert.match(source('index.css'), /@custom-variant no-hover \(@media \(hover: none\)\)/);
});
