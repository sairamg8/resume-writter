// A board from this browser's saved list or an imported .json, made safe for every board page —
// the board grid, the board itself, the card detail sheet. Both ways a board comes in go through
// readBoard() then completeBoard() (useBoardStore's load), so they cannot disagree on what a
// board is, or on what a repair lost. Mirrors normalizeJob.js — the same never-destroy-what-
// cannot-be-read contract, one level deeper (board → lists → cards → checklist). Its only import
// is newId, so Node's test runner loads this file as it is (tests/unit/normalize-board.unit.mjs).
import { newId } from './ids.js';

/** True when `v` can be an entry at all: an object that is not an array. */
export function isBoardEntry(v) {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v));
}

/** Text the pages can print as it is: a string, or nothing (null / undefined). */
const isText = (v) => typeof v === 'string' || v == null;

/** A number that reads back as its digits, and loses nothing as them. */
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** A value that is not text, as text: a number as its digits, anything else ''. */
const asText = (v) => (isNumber(v) ? String(v) : '');

/**
 * `entries` (objects), each with an id no earlier one in the same list has — a new `<prefix>_…`
 * where it has none or one already taken; the same array when they all do. Cards, lists and
 * checklist items are addressed and dragged by id, so two sharing one id (a hand-edited file, or
 * ids minted in the same millisecond by an old build) would move or delete together.
 */
function withOwnIds(entries, prefix) {
  const seen = new Set();
  const out = entries.map((e) => {
    const id = typeof e.id === 'string' && e.id && !seen.has(e.id) ? e.id : newId(prefix);
    seen.add(id);
    return id === e.id ? e : { ...e, id };
  });
  return out.every((e, i) => e === entries[i]) ? entries : out;
}

/** The labels a card can show; the same array when every one is readable (a string `color`). */
function readLabels(labels) {
  if (!Array.isArray(labels)) return { value: [], lost: labels != null };
  const kept = labels
    .filter((l) => isBoardEntry(l) && typeof l.color === 'string')
    .map((l) => (isText(l.name) ? l : { ...l, name: asText(l.name) }));
  const lost = kept.length !== labels.length;
  const same = !lost && kept.every((l, i) => l === labels[i]);
  return { value: same ? labels : kept, lost };
}

/** The checklist items a card can show; the same array when every one is readable. */
function readChecklist(items) {
  if (!Array.isArray(items)) return { value: [], lost: items != null };
  const kept = items
    .filter((t) => isBoardEntry(t) && (typeof t.text === 'string' || isNumber(t.text)))
    .map((t) => {
      const text = typeof t.text === 'string' ? t.text : String(t.text);
      const done = Boolean(t.done);
      return text === t.text && done === t.done ? t : { ...t, text, done };
    });
  const lost = kept.length !== items.length; // a number kept as its digits, or done coerced, is not a loss
  const same = !lost && kept.every((t, i) => t === items[i]);
  return { value: same ? items : kept, lost };
}

/** The fields a card prints as text. */
const CARD_TEXT = ['title', 'description', 'due'];

/**
 * `card` in a shape every board page can use, as `{ kept, lost }`: the same object when it is
 * readable already, else a repaired copy; kept null when it is not an object at all.
 *   a text field holding a number → its digits; anything else → ''
 *   labels / checklist not a list → []; entries that are not objects (or a label with no
 *                                   string color, or a checklist item with no text) are left out
 */
function readCard(card) {
  if (!isBoardEntry(card)) return { kept: null, lost: card != null };
  let out = card;
  let lost = false;
  const set = (key, value, loses) => {
    if (out === card) out = { ...card };
    if (value === undefined) delete out[key]; else out[key] = value;
    if (loses) lost = true;
  };
  for (const key of CARD_TEXT) {
    if (!isText(card[key])) set(key, asText(card[key]), !isNumber(card[key]));
  }
  if (card.labels != null) {
    const { value, lost: l } = readLabels(card.labels);
    if (value !== card.labels) set('labels', value, l);
  }
  if (card.checklist != null) {
    const { value, lost: l } = readChecklist(card.checklist);
    if (value !== card.checklist) set('checklist', value, l);
  }
  return { kept: out, lost };
}

/** Read the entries of `arr` with `readEntry`, as `{ value, lost }`: the same array when unchanged. */
function readEntries(arr, readEntry) {
  const read = arr.map(readEntry);
  const kept = read.map((r) => r.kept).filter(Boolean);
  const same = kept.length === arr.length && kept.every((e, i) => e === arr[i]);
  const lost = read.some((r) => r.lost) || kept.length !== arr.length;
  return { value: same ? arr : kept, lost };
}

/** `list` in a shape every board page can use, as `{ kept, lost }`. */
function readList(list) {
  if (!isBoardEntry(list)) return { kept: null, lost: list != null };
  let out = list;
  let lost = false;
  const set = (key, value, loses) => {
    if (out === list) out = { ...list };
    if (value === undefined) delete out[key]; else out[key] = value;
    if (loses) lost = true;
  };
  if (!isText(list.title)) set('title', asText(list.title), !isNumber(list.title));
  // No cards (missing or null) is an empty list, and held nothing: every page iterates
  // list.cards, and both board pages crashed on it at every load (B-02).
  if (!Array.isArray(list.cards)) set('cards', [], list.cards != null);
  else {
    const { value, lost: l } = readEntries(list.cards, readCard);
    if (value !== list.cards) set('cards', value, l);
  }
  return { kept: out, lost };
}

/**
 * normalizeBoard, and whether its repair lost anything, as `{ kept, lost }` — the entry reader
 * useBoardStore hands storageBackup.readSavedList. lost is false for a board that was readable, or
 * needed only repairs that keep what it held (a number in a text field as its digits); true when
 * anything was left out or replaced by ''.
 */
export function readBoard(board) {
  if (!isBoardEntry(board)) return { kept: null, lost: board != null };
  let out = board;
  let lost = false;
  const set = (key, value, loses) => {
    if (out === board) out = { ...board };
    if (value === undefined) delete out[key]; else out[key] = value;
    if (loses) lost = true;
  };
  if (!isText(board.title)) set('title', asText(board.title), !isNumber(board.title));
  if (!isText(board.color)) set('color', asText(board.color), !isNumber(board.color));
  if (board.lists != null) {
    if (!Array.isArray(board.lists)) set('lists', [], true);
    else {
      const { value, lost: l } = readEntries(board.lists, readList);
      if (value !== board.lists) set('lists', value, l);
    }
  }
  return { kept: out, lost };
}

/**
 * `board` in a shape every board page can use — the same object when it already is, else a
 * repaired copy; null when it is not a board at all.
 */
export function normalizeBoard(board) {
  return readBoard(board).kept;
}

/** Cards (readable) each with an id, and each with a checklist whose items each have an id. */
function completeCards(cards) {
  const withIds = withOwnIds(cards, 'card');
  const out = withIds.map((c) => {
    if (!Array.isArray(c.checklist)) return c;
    const checklist = withOwnIds(c.checklist, 'chk');
    return checklist === c.checklist ? c : { ...c, checklist };
  });
  return out.every((c, i) => c === withIds[i]) ? withIds : out;
}

/** Lists (readable) each with an id, and each with cards made addressable (completeCards). */
function completeLists(lists) {
  const withIds = withOwnIds(lists, 'list');
  const out = withIds.map((l) => {
    if (!Array.isArray(l.cards)) return { ...l, cards: [] }; // B-02: what readList repairs, for any caller
    const cards = completeCards(l.cards);
    return cards === l.cards ? l : { ...l, cards };
  });
  return out.every((l, i) => l === withIds[i]) ? withIds : out;
}

/**
 * `board` (readable: readBoard) with what the pages address it by, where it has none — the same
 * object when it has it all. Nothing is lost here, so it is not reported as a repair:
 *   no id, or not a string → a new one (the router opens a board by its id)
 *   no lists array         → []; lists / cards / checklist items with no id, or a shared one → new
 */
export function completeBoard(board) {
  let out = board;
  const set = (key, value) => {
    if (out === board) out = { ...board };
    out[key] = value;
  };
  if (typeof board.id !== 'string' || !board.id) set('id', newId('board'));
  if (!Array.isArray(board.lists)) set('lists', []);
  else {
    const lists = completeLists(board.lists);
    if (lists !== board.lists) set('lists', lists);
  }
  return out;
}

/**
 * `boards` (each completeBoard's), each with an id no earlier board has — the first keeps it, the
 * one a link opens; the same array when they all do. Nothing is lost, so it is not a repair.
 */
export function addressableBoards(boards) {
  return withOwnIds(boards, 'board');
}
