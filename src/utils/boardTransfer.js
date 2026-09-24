// The boards as a .json file, out and back in. Until sync ships the boards live only in this
// browser's storage, so this file is the one copy a user can keep, or carry to another browser
// (B-04). An export is versioned (`format`, `version`, `dataVersion`) and imports back exactly.
// An import reads every project like a saved one (readBoard → completeBoard, a v1 project
// migrated first) and merges it by id: a new project is added; one already here takes the newer
// copy of each issue and keeps every issue, column, label and sprint it has, so importing the
// same file twice adds nothing and an older backup never overwrites a later edit. Pure: no React,
// no '@/' aliases (tests/unit/board-transfer.unit.mjs).
import { BOARD_DATA_VERSION } from '../constants/boards.js';
import { todayISO } from './boardModel.js';
import { migrateV1 } from './boardMigrate.js';
import { isEntry } from './boardReaders.js';
import { addressableBoards, completeBoard, readBoard } from './normalizeBoard.js';

export const BOARDS_FILE_FORMAT = 'cpwtcv-boards';
export const BOARDS_FILE_VERSION = 1;

const NOT_JSON = 'Could not import that file: it is not a JSON file.';
const NOT_BOARDS = 'Could not import that file: it is not a boards export.';
const TOO_NEW = 'That file was exported by a newer version of CPWT-CV. Update the app, then import it again.';
const NONE = 'No projects found in that file.';

/** The file's text for `boards`: pretty JSON, with what made it and when. */
export function exportBoards(boards, now = Date.now()) {
  const file = {
    format: BOARDS_FILE_FORMAT,
    version: BOARDS_FILE_VERSION,
    dataVersion: BOARD_DATA_VERSION,
    exportedAt: new Date(now).toISOString(),
    boards,
  };
  return JSON.stringify(file, null, 2);
}

/** The export's file name, dated by the local day ('cpwtcv-boards-2026-09-24.json'). */
export const exportFileName = (now = Date.now()) => `cpwtcv-boards-${todayISO(now)}.json`;

/** An entry that can be a project: an object with columns or issues (v2), or lists (v1). */
const looksLikeBoard = (v) => isEntry(v) && [v.columns, v.issues, v.lists].some(Array.isArray);
const isV1Board = (v) => Array.isArray(v.lists) && v.columns === undefined && v.issues === undefined;
const newer = (v, current) => typeof v === 'number' && v > current;

/**
 * The project entries in a file's text, as `{ list }` — this export, the saved value itself
 * (`{ boards }`, v1 or v2), a bare list, or one project — else `{ error }`, the reason to show.
 */
export function boardsFromText(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return { error: NOT_JSON }; }
  let list = null;
  if (Array.isArray(parsed)) list = parsed;
  else if (isEntry(parsed) && Array.isArray(parsed.boards)) {
    if (parsed.format !== undefined && parsed.format !== BOARDS_FILE_FORMAT) return { error: NOT_BOARDS };
    if (newer(parsed.version, BOARDS_FILE_VERSION) || newer(parsed.dataVersion, BOARD_DATA_VERSION)) return { error: TOO_NEW };
    list = parsed.boards;
  } else if (looksLikeBoard(parsed)) list = [parsed];
  return list?.some(looksLikeBoard) ? { list } : { error: NONE };
}

/** JSON with every object's keys in order: two copies compare equal however they were written. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** `first`'s entries, each replaced by `pick(entry, other's same-id entry)`, then `second`'s others. */
function unionById(first, second, pick = (a) => a) {
  const other = new Map(second.map((x) => [x.id, x]));
  const ids = new Set(first.map((x) => x.id));
  return [...first.map((x) => (other.has(x.id) ? pick(x, other.get(x.id)) : x)), ...second.filter((x) => !ids.has(x.id))];
}

/**
 * `mine` with the file's copy `theirs` merged in, as `{ board, issuesAdded, issuesUpdated }` —
 * board `mine` itself when that changes nothing. The newer copy (updatedAt) gives the project's
 * own fields and the order; columns, labels and sprints are the union, the newer's version of
 * each; issues are the union too, each the copy edited last (a tie: mine). Issues keep the
 * numbers they have here — one of theirs whose number an issue here holds gets a new one — so a
 * link on this device still opens what it did. Its key stays when the newer one is another
 * project's (`boards`).
 */
function mergeBoard(mine, theirs, boards) {
  const same = { board: mine, issuesAdded: 0, issuesUpdated: 0 };
  if (stable(mine) === stable(theirs)) return same;
  const theirsNewer = theirs.updatedAt > mine.updatedAt;
  const [first, second] = theirsNewer ? [theirs, mine] : [mine, theirs];
  const mineById = new Map(mine.issues.map((i) => [i.id, i]));
  const numbers = new Set(mine.issues.map((i) => i.number));
  const lastEdited = (a, b) => {
    const [m, t] = a === mineById.get(a.id) ? [a, b] : [b, a];
    return t.updatedAt > m.updatedAt ? t : m;
  };
  const issues = unionById(first.issues, second.issues, lastEdited)
    .map((i) => (!mineById.has(i.id) && numbers.has(i.number) ? { ...i, number: null } : i));
  const key = first.key !== mine.key && boards.some((b) => b.id !== mine.id && b.key === first.key) ? mine.key : first.key;
  const board = completeBoard({
    ...second,
    ...first,
    key,
    columns: unionById(first.columns, second.columns),
    labels: unionById(first.labels, second.labels),
    sprints: unionById(first.sprints, second.sprints),
    issues,
    nextNumber: Math.max(mine.nextNumber, theirs.nextNumber),
  });
  if (stable(board) === stable(mine)) return same;
  const issuesAdded = board.issues.filter((i) => !mineById.has(i.id)).length;
  const issuesUpdated = board.issues.filter((i) => mineById.has(i.id) && stable(i) !== stable(mineById.get(i.id))).length;
  return { board, issuesAdded, issuesUpdated };
}

/**
 * `current` with the projects of an imported file (`incoming`, boardsFromText's list) merged in,
 * as `{ boards, added, updated, skipped, lossy, rekeyed, issues: { added, updated } }`:
 *   an id not here        → added as it is (after the projects here)
 *   the same project here → skipped when nothing is new, else merged (mergeBoard) and stamped `now`
 * A new project whose key a project here holds gets another (`rekeyed` `[{ title, from, to }]`).
 * `lossy`: an entry, or a part of one, could not be read and was left out. `boards` is `current`
 * itself when nothing was added or updated. The input is never changed.
 */
export function mergeBoards(current, incoming, now = Date.now()) {
  const boards = [...current];
  const at = new Map(boards.map((b, n) => [b.id, n]));
  const added = new Set();
  const out = { added: 0, updated: 0, skipped: 0, lossy: false, rekeyed: [], issues: { added: 0, updated: 0 } };
  for (const entry of Array.isArray(incoming) ? incoming : []) {
    if (!looksLikeBoard(entry)) {
      out.lossy = out.lossy || entry != null;
      continue;
    }
    const { kept, lost } = readBoard(isV1Board(entry) ? migrateV1(entry) : entry);
    out.lossy = out.lossy || lost;
    if (!kept) continue;
    const theirs = completeBoard(kept);
    const n = at.get(theirs.id);
    if (n === undefined) {
      at.set(theirs.id, boards.length);
      boards.push(theirs);
      added.add(theirs.id);
      out.added += 1;
      continue;
    }
    const { board, issuesAdded, issuesUpdated } = mergeBoard(boards[n], theirs, boards);
    if (board === boards[n]) {
      out.skipped += 1;
      continue;
    }
    boards[n] = { ...board, updatedAt: now };
    out.updated += 1;
    out.issues.added += issuesAdded;
    out.issues.updated += issuesUpdated;
  }
  if (!out.added && !out.updated) return { ...out, boards: current };
  const keyed = addressableBoards(boards);
  // addressableBoards keeps the order, so `boards[n]` is `keyed[n]` before its key was changed.
  out.rekeyed = keyed.flatMap((b, n) => (added.has(b.id) && b.key !== boards[n].key ? [{ title: b.title, from: boards[n].key, to: b.key }] : []));
  return { ...out, boards: keyed };
}

/**
 * Import a file's text into `current`: mergeBoards' result, or — for a file that is not a
 * boards file, or holds no project that can be read — `{ error }` with `boards` `current`.
 */
export function importBoards(current, text, now = Date.now()) {
  const empty = { boards: current, added: 0, updated: 0, skipped: 0, lossy: false, rekeyed: [], issues: { added: 0, updated: 0 } };
  const { list, error } = boardsFromText(text);
  if (error) return { ...empty, error };
  const result = mergeBoards(current, list, now);
  return result.added || result.updated || result.skipped ? result : { ...empty, lossy: result.lossy, error: NONE };
}

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** '(2 issues added, 1 updated)' for a merge that changed issues; '' when none. */
function issueDetail({ added = 0, updated = 0 } = {}) {
  const bits = [];
  if (added) bits.push(`${count(added, 'issue')} added`);
  if (updated) bits.push(added ? `${updated} updated` : `${count(updated, 'issue')} updated`);
  return bits.length ? ` (${bits.join(', ')})` : '';
}

/**
 * What the projects page says after an import, as `{ kind, text }` — 'success' (a status),
 * 'warning' (part of the file could not be read: an alert) or 'error' (nothing imported).
 */
export function importMessage({ error, added = 0, updated = 0, skipped = 0, lossy = false, rekeyed = [], issues } = {}) {
  if (error) return { kind: 'error', text: error };
  if (!added && !updated && !skipped) return { kind: 'error', text: NONE };
  let text;
  if (!added && !updated) {
    text = skipped === 1
      ? 'Nothing new: the project in that file is already here'
      : `Nothing new: the ${count(skipped, 'project')} in that file are already here`;
  } else {
    const parts = [];
    if (added) parts.push(`Imported ${count(added, 'project')}`);
    if (updated) parts.push(`${added ? 'updated' : 'Updated'} ${added ? updated : count(updated, 'project')}${issueDetail(issues)}`);
    if (skipped) parts.push(`skipped ${skipped} already up to date`);
    text = parts.join(', ');
  }
  if (lossy) text += '; what could not be read in the file was left out';
  text += '.';
  for (const r of rekeyed) text += ` ${r.from} was taken here, so “${r.title}” is now ${r.to}.`;
  return { kind: lossy ? 'warning' : 'success', text };
}
