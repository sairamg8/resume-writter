// The words and colours the workspace UI kit formats with — what a DatePill says about a due day,
// "3d ago", a name's initials and its avatar colour, a shortcut's key glyphs. Pure (no React, no
// `@/` alias) so node tests import it directly, and every function that reads the clock takes a
// `now`, so a test pins it. Day dates are the job tracker's and the boards' local calendar days
// ('YYYY-MM-DD', dates.js): never `new Date('YYYY-MM-DD')`, which is UTC midnight.
import { deadlineState } from './dates.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A 'YYYY-MM-DD' day as { y, m, d } when the calendar has it (2026-02-31 does not), else null. */
export function parseISODay(iso) {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof iso === 'string' ? iso.trim() : '');
  if (!x) return null;
  const [y, m, d] = [Number(x[1]), Number(x[2]), Number(x[3])];
  const real = new Date(y, m - 1, d);
  return real.getFullYear() === y && real.getMonth() === m - 1 && real.getDate() === d ? { y, m, d } : null;
}

/**
 * Whole calendar days from `now`'s local day to `iso`'s: 0 today, 1 tomorrow, -3 three days ago;
 * null for a blank or unreadable day. Counted on UTC dates of both days, because the gap between
 * two local midnights is 23 or 25 hours across a daylight-saving change.
 */
export function daysFromToday(iso, now = new Date()) {
  const day = parseISODay(iso);
  if (!day) return null;
  return Math.round((Date.UTC(day.y, day.m - 1, day.d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
}

/** "Sep 24" — with ", 2027" when the day is in another year than `now`'s; '' when unreadable. */
export function formatShortDay(iso, now = new Date()) {
  const day = parseISODay(iso);
  if (!day) return '';
  const base = `${MONTHS_SHORT[day.m - 1]} ${day.d}`;
  return day.y === now.getFullYear() ? base : `${base}, ${day.y}`;
}

/** "Wed, Sep 24, 2026" — the whole day, for a tooltip or a title; '' when unreadable. */
export function formatLongDay(iso) {
  const day = parseISODay(iso);
  if (!day) return '';
  const weekday = WEEKDAYS_SHORT[new Date(day.y, day.m - 1, day.d).getDay()];
  return `${weekday}, ${MONTHS_SHORT[day.m - 1]} ${day.d}, ${day.y}`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * What a DatePill shows for the day `iso`: `{ label, tone, title, days }`, or null for a blank or
 * unreadable day (the pill then shows nothing).
 *
 * - label: "Today", "Tomorrow", "Yesterday", "3d overdue" (a due day two or more days gone), else
 *   "Sep 24" ("Sep 24, 2027" in another year).
 * - tone, for `kind: 'due'` (a deadline, a follow-up, an issue's due day): 'danger' once the day
 *   is over, 'warning' within dates.js's 3 days of its end ('soon'), otherwise 'neutral'. A `done`
 *   item, and `kind: 'plain'` (a day that is only a fact — applied on, created on), is never late:
 *   'neutral', and never "overdue" in its words. Colour is never the only signal: the title says it.
 */
export function datePillInfo(iso, now = new Date(), { kind = 'due', done = false } = {}) {
  const days = daysFromToday(iso, now);
  if (days === null) return null;
  const judged = kind === 'due' && !done;
  const state = judged ? deadlineState(iso.trim(), now) : null;
  let label;
  if (days === 0) label = 'Today';
  else if (days === 1) label = 'Tomorrow';
  else if (days === -1) label = 'Yesterday';
  else if (state === 'past') label = `${-days}d overdue`;
  else label = formatShortDay(iso, now);
  const long = formatLongDay(iso);
  let title = long;
  if (state === 'past') title = `${long} · overdue by ${plural(Math.max(1, -days), 'day')}`;
  else if (state === 'soon') title = `${long} · due soon`;
  const tone = state === 'past' ? 'danger' : state === 'soon' ? 'warning' : 'neutral';
  return { label, tone, title, days };
}

/** `n` of a `unit` into "3d": floor, so 3 days 23 hours is still "3d". */
function ago(ms) {
  const abs = Math.abs(ms);
  if (abs < MINUTE) return null;
  if (abs < HOUR) return `${Math.floor(abs / MINUTE)}m`;
  if (abs < DAY) return `${Math.floor(abs / HOUR)}h`;
  const days = Math.floor(abs / DAY);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** A timestamp (ms or Date) as a finite number of ms, else null. */
function toMs(value) {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * A moment relative to `now`: "just now" (under a minute either way), "5m ago", "3h ago",
 * "3d ago", "2w ago", "4mo ago", "1y ago", or "in 3d" for the future; '' when not a time.
 * For a stored day ('YYYY-MM-DD') use relativeDay, which counts calendar days.
 */
export function relativeTime(value, now = new Date()) {
  const ms = toMs(value);
  if (ms === null) return '';
  const diff = now.getTime() - ms;
  const unit = ago(diff);
  if (!unit) return 'just now';
  return diff >= 0 ? `${unit} ago` : `in ${unit}`;
}

/**
 * A stored day relative to `now`'s day: "today", "yesterday", "tomorrow", "3d ago", "2w ago",
 * "in 5d"; '' when unreadable. "Applied 3d ago" means three calendar days, whatever the hour.
 */
export function relativeDay(iso, now = new Date()) {
  const days = daysFromToday(iso, now);
  if (days === null) return '';
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days === 1) return 'tomorrow';
  const unit = ago(days * DAY);
  return days < 0 ? `${unit} ago` : `in ${unit}`;
}

/** "Sep 24, 2026, 3:45 PM" in local time — the absolute moment behind a relative one; '' when not a time. */
export function formatDateTime(value) {
  const ms = toMs(value);
  if (ms === null) return '';
  const t = new Date(ms);
  const h = t.getHours();
  const minutes = String(t.getMinutes()).padStart(2, '0');
  return `${MONTHS_SHORT[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}, ${h % 12 || 12}:${minutes} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "1 issue", "3 issues" — `pluralWord` for the irregular ones ("2 activities"). */
export function countLabel(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

/**
 * Up to `max` initials of a name: "Sarah Kim" → "SK", "Google" → "G", "ámbar labs" → "ÁL";
 * words start at a letter or digit, so "— Acme" is "A". '?' for a name with none.
 */
export function initials(name, max = 2) {
  const words = String(name ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letters = words.slice(0, max).map((w) => Array.from(w)[0].toUpperCase()).join('');
  return letters || '?';
}

/**
 * The avatar colours, each a light background with its own dark text (≥ 4.5:1). Written out in
 * full: Tailwind generates only the class names it finds in the source.
 */
export const AVATAR_TONES = Object.freeze([
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-lime-100', text: 'text-lime-800' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
].map((t) => Object.freeze(t)));

/** The colour of a nameless avatar: neutral, so it does not look like someone's. */
export const AVATAR_NEUTRAL = Object.freeze({ bg: 'bg-slate-100', text: 'text-slate-600' });

/** 32-bit FNV-1a: a small, well-spread string hash (the same everywhere, unlike Math.random). */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A name's avatar colour, the same on every visit and device: one of AVATAR_TONES picked by a
 * hash of the name, case and surrounding spaces ignored ("Google" and " google " match).
 */
export function avatarTone(seed) {
  const key = String(seed ?? '').trim().toLowerCase();
  return key ? AVATAR_TONES[hash(key) % AVATAR_TONES.length] : AVATAR_NEUTRAL;
}

const KEY_WORDS = {
  mod: ['⌘', 'Ctrl'], meta: ['⌘', 'Meta'], ctrl: ['⌃', 'Ctrl'], alt: ['⌥', 'Alt'], shift: ['⇧', 'Shift'],
  enter: ['↵', 'Enter'], escape: ['Esc', 'Esc'], esc: ['Esc', 'Esc'], space: ['Space', 'Space'],
  backspace: ['⌫', 'Backspace'], delete: ['Del', 'Del'], tab: ['Tab', 'Tab'],
  arrowup: ['↑', '↑'], arrowdown: ['↓', '↓'], arrowleft: ['←', '←'], arrowright: ['→', '→'],
};

/**
 * A shortcut as the key caps to draw: 'mod+k' → ['⌘', 'K'] on a Mac, ['Ctrl', 'K'] elsewhere;
 * 'shift+?' → ['⇧', '?']; '/' → ['/']. `mod` is ⌘ on a Mac and Ctrl elsewhere, as useHotkeys reads it.
 */
export function shortcutKeys(combo, isMac = false) {
  return String(combo ?? '').split(/\+(?!$)/).filter(Boolean).map((part) => {
    const word = KEY_WORDS[part.toLowerCase()];
    if (word) return word[isMac ? 0 : 1];
    return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
  });
}
