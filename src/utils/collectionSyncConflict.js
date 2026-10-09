// What a job or a project becomes when two devices changed it since they last synced
// (collectionSyncPlan.planFirstSync, collectionSyncEngine's flush). The newer copy stays the
// item; the older one is kept next to it as a copy with an id of its own, marked, so nothing
// typed on either device is lost — as the résumés' conflict copies are (cloudSyncLineage.js).
import { newId } from './ids.js';
import { deriveKey } from './boardModel.js';
import { BY_FIELD, REV_FIELD } from './collectionSyncRev.js';

/**
 * The fields of a project that are only looks (the starred flag, the colour): a difference in them
 * alone is no conflict — the newer copy wins them — so no whole-project copy is made for a star.
 * Everything else (title, description, columns, sprints, labels, mode, issues, key) is typed work.
 */
export const BOARD_COSMETIC = ['starred', 'color'];

/** What a conflict copy's name ends with. */
export const CONFLICT_MARK = '(conflict copy)';

const canon = (v) => (Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);

/**
 * Whether two items hold the same content: all but their id, when they were last changed, the sync's own version and
 * writer (collectionSyncRev.js: a list the previous site wrote can carry them) and the fields named in `apart`,
 * whatever the order of their fields.
 */
export const sameContent = (a, b, apart = []) => {
  const plain = (x) => JSON.stringify(canon({ ...x, id: 0, updatedAt: 0, [REV_FIELD]: 0, [BY_FIELD]: 0, ...Object.fromEntries(apart.map((k) => [k, 0])) }));
  return plain(a) === plain(b);
};

/**
 * Whether `items` hold `copy` already, under another id (and, for a project, another key): a
 * conflict copy made before — its sync failed after it was kept here — is not made a second time
 * from the same older copy.
 */
export const hasTwin = (copy, items) => items.some((x) => x.id === copy.id || sameContent(x, copy, ['key']));

/**
 * The id of the conflict copy of `item` (the older side): from its id and its updatedAt, so two
 * tabs or devices that find the same conflict make the one copy, not each their own (as the
 * résumés' conflictId does). Keeps the `prefix_` and the characters ids use; a new id without a time.
 */
const copyId = (item, prefix) => {
  if (!Number.isFinite(item.updatedAt) || typeof item.id !== 'string' || !item.id) return newId(prefix);
  const clean = item.id.replace(/[^\w-]/g, '_');
  // Ids that differ only in the characters this replaced (an imported file's "ジョブ" and "仕事", "job.1" and "job_1") would
  // share a copy's id when their times are equal, and the second copy was taken for the first and never made: a mark of
  // the id as it was keeps them apart. An id with nothing replaced is unchanged, as every device has always made it.
  const base = clean === item.id ? clean : `${clean}-${shortHash(item.id)}`;
  return `${base.startsWith(`${prefix}_`) ? base : `${prefix}_${base}`}-conflict-${item.updatedAt}`;
};

/** A short text that follows `text` (FNV-1a, 32 bits, base 36): the same on every device. */
function shortHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * `copy` under an id no other item of `others` has with other content. The id follows the copied item and its time,
 * so a copy found twice is one; but two devices' different edits of one item can carry one time (two clocks, an
 * import), and the second copy then met the first's id, was taken for it (hasTwin) and never made: its edit was
 * dropped. Another content takes the next free id; the same content keeps its own, and hasTwin skips it.
 */
function freeId(copy, others) {
  let id = copy.id;
  for (let n = 2; others.some((x) => x.id === id && !sameContent(x, copy, ['key'])); n += 1) id = `${copy.id}-${n}`;
  return id === copy.id ? copy : { ...copy, id };
}

/**
 * A job's older copy: the same data under an id made from the job's, its company (else its role) marked. `others`:
 * every item it must not be taken for (freeId).
 */
export function jobConflictCopy(job, others = []) {
  const copy = { ...job, id: copyId(job, 'job') };
  if (String(job.company ?? '').trim()) copy.company = `${job.company} ${CONFLICT_MARK}`;
  else if (String(job.role ?? '').trim()) copy.role = `${job.role} ${CONFLICT_MARK}`;
  else copy.company = CONFLICT_MARK;
  return freeId(copy, others);
}

/**
 * A project's older copy: the same board under an id made from the project's and a key of its own (`others`: every
 * project it must not share one with — an issue is opened by its project's key and number), named
 * "<title> (conflict copy)".
 */
export function boardConflictCopy(board, others = []) {
  const key = deriveKey(board.title, others.map((b) => b.key));
  return freeId({ ...board, id: copyId(board, 'board'), key, title: `${board.title || 'Untitled project'} ${CONFLICT_MARK}` }, others);
}
