// Sending the cloud sync's queued changes: one flush, with the Firestore calls passed in (`io`),
// and the queue that runs flushes one at a time. No Firebase here, so tests run both against a
// fake cloud (tests/pdf/18-cloud-sync.test.mjs); useCloudSync passes the real calls.
import { planFlush } from '@/utils/cloudSyncPlan';

/**
 * Send one flush of account `uid`'s queue — `writes` (résumés), `deletes` (ids), `listed` (the
 * deletion list as this browser knows it), `demoAccount` (planFlush) — as ONE batch:
 * io.commit(uid, plan). Nothing is read first: the batch adds to and takes off the deletion list
 * itself (R8-4). Resolves to the plan sent once the server has it.
 */
export async function flushOnce({ uid, writes, deletes, listed, demoAccount = false }, io) {
  const plan = planFlush(writes, deletes, listed, { demoAccount });
  await io.commit(uid, plan);
  return plan;
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
