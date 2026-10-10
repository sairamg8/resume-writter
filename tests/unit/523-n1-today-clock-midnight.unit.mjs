// Stale midnight (N1): "Due today", "3d overdue", the Job Tracker's follow-ups and the boards' Overdue lists read the
// clock while they draw, so a page left open across midnight kept yesterday's words until something else made it draw
// again. src/utils/todayClock.js tells its listeners at the next local midnight and when the tab is shown or the window
// focused again (a timer set before the laptop slept is late), and stops when the last listener goes; useToday.js turns
// it into a day the pages draw with. Pinned here: the clock over a manual clock, timers and page; and that the
// pages that show day-relative words listen.
// Run: node --test tests/unit/523-n1-today-clock-midnight.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTodayClock, untilMidnight } from '../../src/utils/todayClock.js';

/** Timers the test fires by hand, and a clock it sets. */
function world(start = new Date(2026, 9, 10, 23, 30, 0)) {
  let at = start;
  const due = new Map();
  let next = 1;
  const timers = {
    set: (fn, ms) => { const id = next; next += 1; due.set(id, { fn, ms }); return id; },
    clear: (id) => { due.delete(id); },
  };
  const page = () => {
    const handlers = new Map();
    return {
      hidden: false,
      addEventListener: (type, fn) => { handlers.set(type, [...(handlers.get(type) ?? []), fn]); },
      removeEventListener: (type, fn) => { handlers.set(type, (handlers.get(type) ?? []).filter((f) => f !== fn)); },
      emit: (type) => (handlers.get(type) ?? []).forEach((fn) => fn()),
      count: (type) => (handlers.get(type) ?? []).length,
    };
  };
  const win = page();
  const doc = page();
  const clock = createTodayClock({ now: () => at, timers, win, doc });
  return {
    clock, win, doc, timers: { get delays() { return [...due.values()].map((t) => t.ms); }, fire: () => { const fns = [...due.values()].map((t) => t.fn); due.clear(); fns.forEach((fn) => fn()); } },
    set: (d) => { at = d; },
  };
}

test('nothing is set until something listens; one timer is set for the next local midnight, and cleared with the last listener', () => {
  const w = world();
  assert.deepEqual(w.timers.delays, [], 'no timer without a listener');
  const off1 = w.clock.subscribe(() => {});
  const off2 = w.clock.subscribe(() => {});
  assert.deepEqual(w.timers.delays, [30 * 60 * 1000 + 500], 'one timer for two listeners: the half hour to midnight and a margin');
  assert.deepEqual([w.win.count('focus'), w.doc.count('visibilitychange')], [1, 1], 'and one pair of page listeners');
  off1();
  assert.equal(w.timers.delays.length, 1, 'still set for the one left');
  off2();
  assert.deepEqual(w.timers.delays, [], 'cleared with the last');
  assert.deepEqual([w.win.count('focus'), w.doc.count('visibilitychange')], [0, 0], 'and the page listeners removed');
});

test('at midnight the listeners are told, the day has changed, and the next midnight is awaited', () => {
  const w = world();
  const told = [];
  w.clock.subscribe(() => told.push(w.clock.today()));
  assert.equal(w.clock.today(), '2026-10-10');
  w.set(new Date(2026, 9, 11, 0, 0, 1));
  w.timers.fire();
  assert.deepEqual(told, ['2026-10-11']);
  assert.deepEqual(w.timers.delays, [24 * 3600 * 1000 - 1000 + 500], 'the day after is awaited');
});

test('a tab shown or a window focused again re-reads the day at once, and sets the timer anew; a hidden tab does not', () => {
  const w = world();
  let told = 0;
  w.clock.subscribe(() => { told += 1; });
  // The laptop slept through midnight: the timer set before it has not fired.
  w.set(new Date(2026, 9, 11, 8, 0, 0));
  w.doc.hidden = true;
  w.doc.emit('visibilitychange');
  assert.equal(told, 0, 'hidden: nothing');
  w.doc.hidden = false;
  w.doc.emit('visibilitychange');
  assert.equal(told, 1);
  assert.equal(w.clock.today(), '2026-10-11');
  assert.deepEqual(w.timers.delays, [16 * 3600 * 1000 + 500], 'the timer is set for the midnight after 08:00, not the stale one');
  w.win.emit('focus');
  assert.equal(told, 2);
});

test('a listener removed is not told again', () => {
  const w = world();
  const a = [];
  const b = [];
  const offA = w.clock.subscribe(() => a.push(1));
  w.clock.subscribe(() => b.push(1));
  offA();
  w.win.emit('focus');
  assert.deepEqual([a.length, b.length], [0, 1]);
});

test('the day length across a daylight-saving change is the real one (23 or 25 hours), not 24', () => {
  // Not every runner is in a zone with a change: whatever its zone, the wait ends at the next local midnight.
  for (const day of [new Date(2026, 2, 8, 12), new Date(2026, 9, 25, 12), new Date(2026, 10, 1, 12), new Date(2026, 10, 2, 12)]) {
    const midnight = new Date(day.getTime() + untilMidnight(day));
    assert.deepEqual([midnight.getHours(), midnight.getMinutes()], [0, 0], `${day.toString()} -> ${midnight.toString()}`);
    assert.equal(midnight.getDate(), new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getDate());
  }
});

test('what shows day-relative words listens to the clock (useToday) instead of reading it once per draw', () => {
  const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const file of [
    'src/components/ui/DatePill.jsx', 'src/components/job/KanbanView.jsx', 'src/components/job/JobSummary.jsx', 'src/pages/JobTracker.jsx',
    'src/pages/Board.jsx', 'src/pages/YourWork.jsx', 'src/pages/ProjectCalendar.jsx', 'src/pages/ProjectTimeline.jsx',
  ]) assert.match(read(file), /\buseToday\(\)/, `${file} listens to the day`);
  assert.doesNotMatch(read('src/components/job/KanbanView.jsx'), /todayLocalISO\(\)/, 'the Kanban cards are handed the listened day');
});
