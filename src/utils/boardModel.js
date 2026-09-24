// The Boards v2 model (the Jira core): projects ("boards") holding columns, labels, sprints and
// issues, and the rules every page and the store share — project keys and issue keys, which
// column means done, the templates a project starts from, and the local-calendar date maths a
// recurring issue repeats by. Pure: its imports have none of their own (ids.js, the constants),
// so Node's test runner loads it as it is (tests/unit/board-model.unit.mjs).
//
// The shapes (data version 2) — see boards-jobs-plan/02-boards.md:
//   Board  { id, key, title, description, color, starred, mode: 'kanban'|'scrum', columns, labels,
//            sprints, issues (ARRAY ORDER IS THE RANK), nextNumber, hideDoneAfterDays, createdAt,
//            updatedAt, dataVersion: 2 }
//   Column { id, title, category: 'todo'|'inprogress'|'done', wipLimit: number|null }
//   Label  { id, name, color }
//   Sprint { id, name, goal, startDate, endDate, state: 'future'|'active'|'closed', completedAt }
//   Issue  { id, number, type, title, description, columnId, priority, labelIds, due, startDate,
//            estimate, epicId, sprintId, checklist, comments, activity, recurrence,
//            recurrenceNextId, createdAt, updatedAt, resolvedAt }
import { newId } from './ids.js';
import {
  BOARD_COLORS, BOARD_DATA_VERSION, BOARD_TEMPLATES, DEFAULT_HIDE_DONE_DAYS, KEY_PATTERN,
} from '../constants/boards.js';

// ── Local calendar dates ──────────────────────────────────────────────────────────────────
// Due and start dates are local calendar days ('YYYY-MM-DD'). `new Date('YYYY-MM-DD')` parses
// UTC midnight — the previous evening west of Greenwich — so every step here builds dates from
// their local parts, and a day is added by the calendar, never as 24 hours (a DST day is 23 or 25).

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `date` (a Date or ms) as its local 'YYYY-MM-DD'. */
export function toLocalISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A 'YYYY-MM-DD' that names a real day, as local midnight; null for anything else ('2026-02-30'). */
export function parseLocalISO(iso) {
  const m = ISO_DAY.exec(typeof iso === 'string' ? iso : '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toLocalISO(d) === iso ? d : null;
}

/** True for a 'YYYY-MM-DD' naming a real day. */
export const isLocalISO = (iso) => parseLocalISO(iso) !== null;

/** Today, locally, as 'YYYY-MM-DD'; `now` in ms (the store and the tests pass their own). */
export const todayISO = (now = Date.now()) => toLocalISO(new Date(now));

/** The day `n` calendar days after `iso` (negative: before); '' when `iso` is not a day. */
export function addDays(iso, n) {
  const d = parseLocalISO(iso);
  return d ? toLocalISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)) : '';
}

const day = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

/** One step of each recurrence rule; `anchor` is the day of the month a monthly issue keeps. */
const STEP = {
  daily: (d) => day(d, 1),
  weekdays: (d) => {
    let next = day(d, 1);
    while (isWeekend(next)) next = day(next, 1);
    return next;
  },
  weekly: (d) => day(d, 7),
  monthly: (d, anchor) => {
    const last = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate(); // the next month's last day
    return new Date(d.getFullYear(), d.getMonth() + 1, Math.min(anchor, last));
  },
};

/**
 * The due date of a recurring issue's next occurrence: one step of `recurrence` from its old
 * `due` (from `today` when it had none), stepped on until it is after `today` — an issue done
 * three weeks late gets one next occurrence, not three already overdue. Weekdays skip Saturday
 * and Sunday; monthly keeps the day of the month, clamped to a shorter month's end (31 Jan →
 * 28/29 Feb). '' for 'none' or an unknown rule.
 */
export function nextDue(due, recurrence, today = todayISO()) {
  const step = STEP[recurrence];
  const floor = parseLocalISO(today);
  if (!step || !floor) return '';
  const start = parseLocalISO(due) ?? floor;
  const anchor = start.getDate();
  let next = step(start, anchor);
  for (let i = 0; next <= floor && i < 5000; i += 1) next = step(next, anchor);
  if (next <= floor) next = step(floor, anchor); // a due date centuries ago: from today
  return toLocalISO(next);
}

// ── Project keys and issue keys ───────────────────────────────────────────────────────────

/** True for a project key: 2–10 characters, a letter A–Z first, then A–Z or 0–9. */
export const isValidKey = (key) => typeof key === 'string' && KEY_PATTERN.test(key);

/** What a key field holds as the user types: capitals, letters and digits only, at most 10. */
export const keyInput = (text) => String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

const sameKey = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();

/**
 * Why `key` cannot be the key of the board `selfId` among `boards` (as a sentence to show under
 * the field), or null when it can. Keys are unique across projects, case aside: `?issue=KEY-12`
 * must name one issue.
 */
export function keyError(key, boards = [], selfId = null) {
  if (!key) return 'Enter a key.';
  if (!isValidKey(key)) return 'Use 2–10 capital letters or digits, starting with a letter.';
  const other = boards.find((b) => b.id !== selfId && sameKey(b.key, key));
  return other ? `${key} is already the key of “${other.title || 'another project'}”.` : null;
}

/** Title words as capitals and digits, accents dropped ('Café Été' → ['CAFE', 'ETE']). */
function keyWords(title) {
  return String(title ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .split(/[^A-Z0-9]+/).filter(Boolean);
}

/**
 * A key for a project titled `title`, not among `takenKeys` (case aside): the initials of its
 * words ('Website Relaunch' → WR), or a one-word title's first letters (Life → LIFE,
 * Groceries → GRO); a number is added when taken (WR2). PROJ when the title has no letters.
 */
export function deriveKey(title, takenKeys = []) {
  const words = keyWords(title).filter((w) => /^[A-Z]/.test(w));
  let base = 'PROJ';
  if (words.length >= 2) base = words.slice(0, 5).map((w) => w[0]).join('');
  else if (words.length === 1) base = words[0].length <= 4 ? words[0] : words[0].slice(0, 3);
  if (base.length === 1) { // one letter ('A 2026' → A202; 'X' → PROJ)
    const padded = keyWords(title).join('').slice(0, 4);
    base = isValidKey(padded) ? padded : 'PROJ';
  }
  const taken = new Set(takenKeys.filter(Boolean).map((k) => String(k).toUpperCase()));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base.slice(0, 10 - String(n).length)}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** An issue's key: its project's key and its number ('LIFE-12'). A key rename re-keys every issue. */
export const issueKey = (board, issue) => `${board.key}-${issue.number}`;

/** 'LIFE-12' (any case, spaces around) as `{ key: 'LIFE', number: 12 }`; null when it is not a key. */
export function parseIssueKey(text) {
  const m = /^\s*([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})\s*$/.exec(typeof text === 'string' ? text : '');
  return m ? { key: m[1].toUpperCase(), number: Number(m[2]) } : null;
}

/** The issue `text` ('LIFE-12', as `?issue=` holds it) names, as `{ board, issue }`; null when none. */
export function findIssueByKey(boards, text) {
  const parsed = parseIssueKey(text);
  if (!parsed) return null;
  const board = boards.find((b) => sameKey(b.key, parsed.key));
  const issue = board?.issues.find((i) => i.number === parsed.number);
  return issue ? { board, issue } : null;
}

// ── Columns, status and lookups ───────────────────────────────────────────────────────────

export const columnById = (board, id) => board.columns.find((c) => c.id === id) ?? null;
export const labelById = (board, id) => board.labels.find((l) => l.id === id) ?? null;
export const sprintById = (board, id) => board.sprints.find((s) => s.id === id) ?? null;
export const issueById = (board, id) => board.issues.find((i) => i.id === id) ?? null;
export const activeSprint = (board) => board.sprints.find((s) => s.state === 'active') ?? null;

/** The column an issue shows in: its own, or the first one when its own is gone. */
export const statusColumn = (board, issue) => columnById(board, issue.columnId) ?? board.columns[0] ?? null;

/** True for a column whose issues are resolved. */
export const isDoneColumn = (column) => column?.category === 'done';

/** True for an issue in a done-category column. */
export const isIssueDone = (board, issue) => isDoneColumn(statusColumn(board, issue));

/** The first column of `category`; null when the board has none. */
export const firstColumnOf = (board, category) => board.columns.find((c) => c.category === category) ?? null;

/** Where a new issue goes when no column is named: the first to-do column, else the first column. */
export const defaultColumnId = (board) => (firstColumnOf(board, 'todo') ?? board.columns[0])?.id ?? null;

/**
 * A title as stored: one line (line breaks become spaces, runs of spaces one), trimmed, at most
 * 255 characters. '' when nothing is left — callers keep the previous title then.
 */
export function cleanTitle(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 255);
}

// ── Projects ──────────────────────────────────────────────────────────────────────────────

export const templateById = (id) => BOARD_TEMPLATES.find((t) => t.id === id) ?? BOARD_TEMPLATES[0];

/**
 * A new project from `template` ('kanban' | 'scrum' | 'personal' | 'blank'): its columns and
 * labels, no issues. `key` is used when it is valid and free; otherwise one is derived from the
 * title (deriveKey) — the create dialog validates first (keyError), so that is a fallback.
 */
export function createBoard({ title, key, template, color, description, mode } = {}, { takenKeys = [], now = Date.now() } = {}) {
  const t = templateById(template);
  const name = cleanTitle(title) || 'Untitled project';
  const free = isValidKey(key) && !takenKeys.some((k) => sameKey(k, key));
  return {
    id: newId('board'),
    key: free ? key : deriveKey(name, takenKeys),
    title: name,
    description: typeof description === 'string' ? description : '',
    color: typeof color === 'string' && color ? color : BOARD_COLORS[0],
    starred: false,
    mode: mode === 'scrum' || mode === 'kanban' ? mode : t.mode,
    columns: t.columns.map(([colTitle, category]) => ({ id: newId('col'), title: colTitle, category, wipLimit: null })),
    labels: t.labels.map(([labelName, labelColor]) => ({ id: newId('label'), name: labelName, color: labelColor })),
    sprints: [],
    issues: [],
    nextNumber: 1,
    hideDoneAfterDays: DEFAULT_HIDE_DONE_DAYS,
    createdAt: now,
    updatedAt: now,
    dataVersion: BOARD_DATA_VERSION,
  };
}
