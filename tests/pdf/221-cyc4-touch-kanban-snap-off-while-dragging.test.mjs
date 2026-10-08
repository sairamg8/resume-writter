// Cycle 4, touch: on a phone the Applications board (Job Tracker, Board view) scrolls its columns with
// `snap-x snap-mandatory`, one column per swipe. A finger drags a card after a 200 ms hold, and to reach a column off the
// screen dnd-kit scrolls this same container a few pixels a frame; with mandatory snapping each step was pulled back to the
// column it started on, so a card could not be carried to the next column but one that was already in view. The Projects board
// (pages/Board.jsx) turns the snap off while a card is dragged for this reason; the job board did not. It does now.
// fake-dom has no layout and no drag: the source is read.
// Run: node --test tests/pdf/221-cyc4-touch-kanban-snap-off-while-dragging.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

it('the job board\'s column scroller snaps only while no card is being dragged', () => {
  const s = source('components/job/KanbanView.jsx');
  const scroller = /<div ref=\{containerRef\} className=\{`([^`]*)\$\{([^}]*)\}`\}>/.exec(s);
  assert.ok(scroller, 'the scroller\'s class list is built from the drag state');
  const [, always, snapping] = scroller;
  assert.match(always, /\boverflow-x-auto\b/);
  assert.ok(!/snap-/.test(always), `the always-on classes hold no snap: ${always}`);
  assert.match(snapping, /^activeId === null \?/, 'the snap classes are chosen by the drag state');
  assert.match(snapping, /snap-x snap-mandatory md:snap-none/, 'phones only, as before');
  assert.match(s, /const \[activeId, setActiveId\] = useState\(null\)/);
  assert.match(s, /onDragStart=\{\(\{ active \}\) => setActiveId\(active\.id\)\}/);
  assert.match(s, /onDragCancel=\{\(\) => setActiveId\(null\)\}/);
  assert.match(s, /setActiveId\(null\);\s*if \(!over\) return;/, 'a drop ends it too');
});

it('the cards still snap to their centre, and the Projects board keeps the same rule', () => {
  assert.match(source('components/job/KanbanView.jsx'), /shrink-0 snap-center flex-col/);
  assert.match(source('pages/Board.jsx'), /!grouped && !active && 'snap-x snap-mandatory md:snap-none'/);
});
