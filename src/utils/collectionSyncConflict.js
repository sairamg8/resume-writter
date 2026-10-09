// What a job or a project becomes when two devices changed it since they last synced
// (collectionSyncPlan.planFirstSync, collectionSyncEngine's flush). The newer copy stays the
// item; the older one is kept next to it as a copy with an id of its own, marked, so nothing
// typed on either device is lost — as the résumés' conflict copies are (cloudSyncLineage.js).
import { newId } from './ids.js';
import { deriveKey } from './boardModel.js';

/** What a conflict copy's name ends with. */
export const CONFLICT_MARK = '(conflict copy)';

const canon = (v) => (Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);

/**
 * Whether two items hold the same content: all but their id, when they were last changed and the
 * fields named in `apart`, whatever the order of their fields.
 */
export const sameContent = (a, b, apart = []) => {
  const plain = (x) => JSON.stringify(canon({ ...x, id: 0, updatedAt: 0, ...Object.fromEntries(apart.map((k) => [k, 0])) }));
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
  const base = item.id.replace(/[^\w-]/g, '_');
  return `${base.startsWith(`${prefix}_`) ? base : `${prefix}_${base}`}-conflict-${item.updatedAt}`;
};

/** A job's older copy: the same data under an id made from the job's, its company (else its role) marked. */
export function jobConflictCopy(job) {
  const copy = { ...job, id: copyId(job, 'job') };
  if (String(job.company ?? '').trim()) copy.company = `${job.company} ${CONFLICT_MARK}`;
  else if (String(job.role ?? '').trim()) copy.role = `${job.role} ${CONFLICT_MARK}`;
  else copy.company = CONFLICT_MARK;
  return copy;
}

/**
 * A project's older copy: the same board under an id made from the project's and a key of its own (`others`: every
 * project it must not share one with — an issue is opened by its project's key and number), named
 * "<title> (conflict copy)".
 */
export function boardConflictCopy(board, others = []) {
  const key = deriveKey(board.title, others.map((b) => b.key));
  return { ...board, id: copyId(board, 'board'), key, title: `${board.title || 'Untitled project'} ${CONFLICT_MARK}` };
}
