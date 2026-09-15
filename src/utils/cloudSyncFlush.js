// Sending the cloud sync's queued changes: one flush, with the Firestore calls passed in (`io`),
// and the queue that runs flushes one at a time. No Firebase here, so tests run both against a
// fake cloud (tests/pdf/18-cloud-sync.test.mjs); useCloudSync passes the real calls.
import { planFlush } from '@/utils/cloudSyncPlan';
import { nextTombstones } from '@/utils/demoSeed';

/**
 * Send one flush of account `uid`'s queue — `writes` (résumés), `deletes` (ids), and
 * `tombstones` (the deletion list as last read or written) — as ONE batch:
 *   io.commit(uid, { sets, flags, hardDeletes, tombstones })   tombstones null = left alone
 * When the deletion list must change (planFlush) it is read first: io.readDeletions(uid) → ids.
 * Resolves to the deletion list written, or null.
 */
export async function flushOnce({ uid, writes, deletes, tombstones }, io) {
  const plan = planFlush(writes, deletes, tombstones);
  const list = plan.rewriteTombstones
    ? nextTombstones(await io.readDeletions(uid), plan.hardDeletes, writes.map((r) => r.id))
    : null;
  await io.commit(uid, { sets: plan.sets, flags: plan.flags, hardDeletes: plan.hardDeletes, tombstones: list });
  return list;
}

/**
 * A queue for async tasks: `run(task)` starts `task` once every task queued before it has
 * settled, and settles as the task does; a failed task does not stop the ones after it.
 *
 * The cloud sync sends every flush through one (R4-3). A flush that must read the deletion list
 * waits on the network before it commits; a later flush used to start and commit meanwhile, so
 * the older one landed last. Deleting a résumé and four sample résumés, then the fifth — which
 * brings the whole set back — left the four flagged as deleted in the cloud, over the restore,
 * and every device's next sync hid them.
 */
export function serialQueue() {
  let tail = Promise.resolve();
  return function run(task) {
    const result = tail.then(() => task());
    tail = result.then(() => {}, () => {});
    return result;
  };
}
