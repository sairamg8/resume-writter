// The readers normalizeBoard runs over each part of a saved or imported v2 board — its issues,
// columns, labels and sprints, and an issue's checklist, comments and history. Each returns
// `{ kept, lost }`: kept the part with every field the pages use in a shape they can use (fields
// it does not know are kept as they are: a later build's additions survive this one), or null to
// leave it out; lost whether that dropped or replaced something it held. A missing field is
// filled with its default and is not a loss. Ids are only read here; completeBoard makes them
// unique. Pure (tests/unit/normalize-board.unit.mjs).
import {
  ACTIVITY_CAP, CATEGORY_IDS, DEFAULT_HIDE_DONE_DAYS, MODE_IDS, PRIORITY_IDS, RECURRENCE_IDS, SPRINT_STATES, TYPE_IDS,
} from '../constants/boards.js';
import { isLocalISO } from './boardModel.js';

/** True when `v` can be an entry at all: an object that is not an array. */
export const isEntry = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * A reader over one raw object: each method returns the field's value in the shape the pages use
 * and marks `lost` when that replaced something the field held (not when it was only missing).
 */
function fields(raw) {
  const r = {
    lost: false,
    loses(cond) { if (cond) r.lost = true; },
    /** Text: a string; a number as its digits; nothing → ''; anything else → '' (a loss). */
    text(key) {
      const v = raw[key];
      if (typeof v === 'string') return v;
      if (isNumber(v)) return String(v);
      r.loses(v != null);
      return '';
    },
    /** One of `ids`; nothing → `fallback`; another value → `fallback` (a loss). */
    oneOf(key, ids, fallback) {
      const v = raw[key];
      if (ids.includes(v)) return v;
      r.loses(v != null && v !== '');
      return fallback;
    },
    /** A local day 'YYYY-MM-DD' or ''; other text → '' (a loss). */
    day(key) {
      const v = raw[key];
      if (isLocalISO(v)) return v;
      r.loses(v != null && v !== '');
      return '';
    },
    /** A reference to another part by id: a string, else null (a dangling one is completeBoard's). */
    ref: (key) => (typeof raw[key] === 'string' && raw[key] ? raw[key] : null),
    /** A time in ms, else `fallback`. */
    time: (key, fallback = 0) => (isNumber(raw[key]) ? raw[key] : fallback),
    /** A list read entry by entry with `read`; not a list → [] (a loss when it held something). */
    list(key, read) {
      const v = raw[key];
      if (!Array.isArray(v)) {
        r.loses(v != null);
        return [];
      }
      const out = [];
      for (const entry of v) {
        const { kept, lost } = read(entry);
        r.loses(lost);
        if (kept) out.push(kept);
      }
      return out;
    },
  };
  return r;
}

/** Wrap a reader of objects: anything else is left out (a loss when it was not null). */
const entryReader = (read) => (raw) => (isEntry(raw) ? read(raw) : { kept: null, lost: raw != null });

const idOf = (raw) => (typeof raw.id === 'string' ? raw.id : '');

export const readChecklistItem = entryReader((raw) => {
  const text = typeof raw.text === 'string' ? raw.text : isNumber(raw.text) ? String(raw.text) : null;
  if (text === null) return { kept: null, lost: true }; // no text: a blank row nobody can read
  return { kept: { ...raw, id: idOf(raw), text, done: Boolean(raw.done) }, lost: false };
});

export const readComment = entryReader((raw) => {
  const f = fields(raw);
  const text = f.text('text');
  if (!text) return { kept: null, lost: true };
  return { kept: { ...raw, id: idOf(raw), text, createdAt: f.time('createdAt'), editedAt: f.time('editedAt', null) }, lost: f.lost };
});

/** A history entry: kept when it says when (`at`); from / to are shown as they are. */
export const readActivity = entryReader((raw) => {
  if (!isNumber(raw.at) || typeof raw.kind !== 'string') return { kept: null, lost: true };
  const value = (v) => (typeof v === 'string' || isNumber(v) || v === null ? v : v === undefined ? null : String(v));
  const field = typeof raw.field === 'string' ? raw.field : null;
  return { kept: { ...raw, id: idOf(raw), field, from: value(raw.from), to: value(raw.to) }, lost: false };
});

/** An estimate: a number ≥ 0, numeric text as its number; nothing → null; anything else → null (a loss). */
function estimateOf(f, v) {
  if (isNumber(v) && v >= 0) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number(v) >= 0) return Number(v);
  f.loses(v != null && v !== '');
  return null;
}

export const readIssue = entryReader((raw) => {
  const f = fields(raw);
  const labelIds = f.list('labelIds', (id) => ({ kept: typeof id === 'string' && id ? id : null, lost: typeof id !== 'string' }));
  const createdAt = f.time('createdAt');
  const issue = {
    ...raw,
    id: idOf(raw),
    number: Number.isInteger(raw.number) && raw.number > 0 ? raw.number : null,
    type: f.oneOf('type', TYPE_IDS, 'task'),
    title: f.text('title'),
    description: f.text('description'),
    columnId: f.ref('columnId'),
    priority: f.oneOf('priority', PRIORITY_IDS, 'medium'),
    labelIds: [...new Set(labelIds)],
    due: f.day('due'),
    startDate: f.day('startDate'),
    estimate: estimateOf(f, raw.estimate),
    epicId: f.ref('epicId'),
    sprintId: f.ref('sprintId'),
    checklist: f.list('checklist', readChecklistItem),
    comments: f.list('comments', readComment),
    activity: f.list('activity', readActivity).slice(-ACTIVITY_CAP),
    recurrence: f.oneOf('recurrence', RECURRENCE_IDS, 'none'),
    recurrenceNextId: f.ref('recurrenceNextId'),
    createdAt,
    updatedAt: f.time('updatedAt', createdAt),
    resolvedAt: f.time('resolvedAt', null),
  };
  return { kept: issue, lost: f.lost };
});

/** A WIP limit: a whole number ≥ 1 (numeric text too), else none. */
function wipOf(v) {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export const readColumn = entryReader((raw) => {
  const f = fields(raw);
  const column = { ...raw, id: idOf(raw), title: f.text('title'), category: f.oneOf('category', CATEGORY_IDS, 'inprogress'), wipLimit: wipOf(raw.wipLimit) };
  return { kept: column, lost: f.lost };
});

export const readLabel = entryReader((raw) => {
  const f = fields(raw);
  const label = { ...raw, id: idOf(raw), name: f.text('name'), color: typeof raw.color === 'string' && raw.color ? raw.color : '#6b7280' };
  return { kept: label, lost: f.lost };
});

export const readSprint = entryReader((raw) => {
  const f = fields(raw);
  const sprint = {
    ...raw,
    id: idOf(raw),
    name: f.text('name'),
    goal: f.text('goal'),
    startDate: f.day('startDate'),
    endDate: f.day('endDate'),
    state: f.oneOf('state', SPRINT_STATES, 'future'),
    completedAt: f.time('completedAt', null),
  };
  return { kept: sprint, lost: f.lost };
});

/**
 * A board's own fields and its parts, read (not yet completed): `{ kept, lost }`. Its key is only
 * made a string here — completeBoard derives one when it is not a valid key.
 */
export const readBoardFields = entryReader((raw) => {
  const f = fields(raw);
  const createdAt = f.time('createdAt');
  const days = raw.hideDoneAfterDays;
  const board = {
    ...raw,
    id: idOf(raw),
    key: typeof raw.key === 'string' ? raw.key.trim().toUpperCase() : '',
    title: f.text('title'),
    description: f.text('description'),
    color: typeof raw.color === 'string' && raw.color ? raw.color : '#6366f1',
    starred: Boolean(raw.starred),
    mode: f.oneOf('mode', MODE_IDS, 'kanban'),
    columns: f.list('columns', readColumn),
    labels: f.list('labels', readLabel),
    sprints: f.list('sprints', readSprint),
    issues: f.list('issues', readIssue),
    nextNumber: Number.isInteger(raw.nextNumber) && raw.nextNumber > 0 ? raw.nextNumber : 1,
    hideDoneAfterDays: days === null || (Number.isInteger(days) && days >= 0) ? days : DEFAULT_HIDE_DONE_DAYS,
    createdAt,
    updatedAt: f.time('updatedAt', createdAt),
    dataVersion: 2,
  };
  return { kept: board, lost: f.lost };
});
