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

/** Whether two copies of an item hold the same content: all but when they were last changed, whatever the order of their fields. */
export const sameContent = (a, b) => JSON.stringify(canon({ ...a, updatedAt: 0 })) === JSON.stringify(canon({ ...b, updatedAt: 0 }));

/** A job's older copy: the same data under a new id, its company (else its role) marked. */
export function jobConflictCopy(job) {
  const copy = { ...job, id: newId('job') };
  if (String(job.company ?? '').trim()) copy.company = `${job.company} ${CONFLICT_MARK}`;
  else if (String(job.role ?? '').trim()) copy.role = `${job.role} ${CONFLICT_MARK}`;
  else copy.company = CONFLICT_MARK;
  return copy;
}

/**
 * A project's older copy: the same board under a new id and a key of its own (`others`: every
 * project it must not share one with — an issue is opened by its project's key and number), named
 * "<title> (conflict copy)".
 */
export function boardConflictCopy(board, others = []) {
  const key = deriveKey(board.title, others.map((b) => b.key));
  return { ...board, id: newId('board'), key, title: `${board.title || 'Untitled project'} ${CONFLICT_MARK}` };
}
