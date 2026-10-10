// The local calendar day, and a nudge to whoever shows it when it changes. "Due today", "3d overdue", the Job
// Tracker's follow-ups and the boards' Overdue lists read the clock while they draw, so a page left open across
// midnight kept yesterday's words until something else made it draw again. The clock tells its listeners at the next
// local midnight, and when the tab is shown or the window focused again (a timer set before a laptop slept is late,
// or never fires): each re-reads the day, so a page that listens redraws only when the day really changed (the
// snapshot, useToday.js). One timer and two page listeners for any number of listeners, set when the first listens
// and cleared when the last stops. No React: the tests drive this over a manual clock.
import { todayLocalISO } from './dates.js';

/** Milliseconds from `t` to the next local midnight (a day is 23 or 25 hours across a daylight-saving change). */
export const untilMidnight = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime() - t.getTime();

/** A margin past midnight, and the least a wait is: a timer that fires a moment early re-arms instead of spinning. */
const PAST = 500;
const LEAST = 1000;

/**
 * createTodayClock({ now, timers, win, doc }) → { today(), subscribe(listener) → unsubscribe }. `now` → a Date;
 * `win` and `doc` the page (none: no focus or visibility events, the midnight timer alone).
 */
export function createTodayClock({
  now = () => new Date(),
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  win = globalThis.window,
  doc = globalThis.document,
} = {}) {
  const listeners = new Set();
  let timer = null;
  let detach = null;

  const tell = () => [...listeners].forEach((l) => l());
  function arm() {
    timers.clear(timer);
    timer = timers.set(() => { arm(); tell(); }, Math.max(LEAST, untilMidnight(now()) + PAST));
  }
  /** The tab is shown or the window focused: the day may have changed while it slept, and the timer is set again. */
  function wake() {
    if (doc?.hidden) return;
    arm();
    tell();
  }
  function start() {
    arm();
    win?.addEventListener?.('focus', wake);
    doc?.addEventListener?.('visibilitychange', wake);
    detach = () => {
      win?.removeEventListener?.('focus', wake);
      doc?.removeEventListener?.('visibilitychange', wake);
    };
  }
  function stop() {
    timers.clear(timer);
    timer = null;
    detach?.();
    detach = null;
  }

  return {
    today: () => todayLocalISO(now()),
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) stop();
      };
    },
  };
}
