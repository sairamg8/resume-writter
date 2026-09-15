// The cloud sync itself — the first sync after sign-in, the write queue and its flushes, the
// read-back of a demo account's originals — as a plain object with everything outside passed
// in: the Firestore calls (`io`, cloudSyncIo.js; null without a cloud), the résumé store, the
// timers, the online flag. What a failure means and when it is tried again: cloudSyncRetry.js.
// No React and no Firebase, so the tests drive this very code (tests/pdf/18-cloud-sync-*.test.mjs);
// useCloudSync only wires it to React state and the browser.
import { isOriginal } from '@/utils/demoSeed';
import { planInitialSync, queueChanges } from '@/utils/cloudSyncPlan';
import { flushOnce } from '@/utils/cloudSyncFlush';
import { deletionEntries } from '@/utils/localDeletions';
import { backoff, failureKind } from '@/utils/cloudSyncRetry';

/** Nothing waiting to be sent: queueChanges adds to it, a flush takes it whole. */
const emptyQueue = () => ({ writes: new Map(), deletes: new Set(), kept: new Set(), marked: new Set() });

/**
 * createCloudSync({ io, store, report, isDemo, ... }):
 *   io        cloudIo(...) — null when this build has no cloud
 *   store     { getState() → the résumé store's state now, applyCloudSync(result) — a first
 *             sync's result (cloudSyncPlan.afterSync), forgetDeletions(ids, before) — the
 *             cloud has these deletions (localDeletions.js) }: useResumeSyncActions.liveStore
 *   report    { status('idle'|'syncing'|'synced'|'offline'|'error'|'stopped'), synced(Date), account(a) } —
 *             account: { uid, cloud, cloudOriginals, cloudDeleted } once the account's list is
 *             known, else null — whether a cloud holds it (false: this browser's list is the whole
 *             list), the cloud's originals (demoSeed.js), deleted ones included, and its deletion
 *             list, as the first sync read them
 *   isDemo    user → true for a demo account (its deleted originals are flagged, not removed)
 *   online    () → whether the browser says it is online; hidden () → whether the tab is hidden
 *   timers    { set(fn, ms) → id, clear(id) }; flushDelay (ms) before queued changes are sent;
 *             cloudTimeout (ms) readCloudCopies waits for an answer; retryDelay (ms) before a
 *             first sync that failed for a moment is tried again, doubled after each failure up
 *             to maxRetryDelay; now() → ms
 * Returns { start(user), cancel(), shown(), resumesChanged(resumes), readCloudCopies(ids) }.
 */
export function createCloudSync({
  io, store, report, isDemo = () => false,
  online = () => true, hidden = () => false, timers = { set: setTimeout, clear: clearTimeout },
  flushDelay = 1500, cloudTimeout = 5000, retryDelay = 30000, maxRetryDelay = 600000,
  now = () => Date.now(), log = () => {},
}) {
  const s = {
    user: null,
    gen: 0, // bumped by every start/cancel: a first sync from an older one drops its result
    initialSyncDone: false,
    cloudDisabled: false,
    prevResumes: null,
    queue: emptyQueue(), // the changes since the last flush (queueChanges)
    timer: null,
    retry: null,
    attempts: 0, // failed tries since the last first sync that got through (backoff)
    retryOnShow: false, // a retry came due while the tab was hidden
    stopped: null, // the résumés when a batch was refused for good: tried again once they change
    account: null,
  };

  function setAccount(account) {
    s.account = account;
    report.account(account);
  }

  /** Whenever the signed-in user (or null) changes, or the browser goes online or offline. */
  function start(user) {
    s.gen += 1;
    timers.clear(s.retry);
    s.retryOnShow = false;
    s.stopped = null;
    // Signed out, or another account: the last one's queue is not sent — without its auth it was
    // refused, and that refusal turned sync off for whoever signed in next (R8-5). Nothing is
    // lost: the store keeps the edits and deletions for that account's next first sync.
    if ((user?.uid ?? null) !== (s.user?.uid ?? null)) dropQueue();
    s.user = user || null;

    if (!user) {
      s.initialSyncDone = false;
      s.cloudDisabled = false;
      s.prevResumes = null;
      report.status('idle');
      setAccount(null);
      return;
    }

    if (!io || s.cloudDisabled) {
      report.status('error');
      // Nothing to wait for: this browser's résumés are the whole list.
      if (s.account?.uid !== user.uid) setAccount(noCloud(user));
      return;
    }

    if (!online()) {
      s.initialSyncDone = false;
      report.status('offline');
      return;
    }

    initialSync(user, s.gen);
  }

  function dropQueue() {
    timers.clear(s.timer);
    s.timer = null;
    s.queue = emptyQueue();
  }

  /** The account when there is no cloud to read: this browser's résumés are the whole list. */
  const noCloud = (user) => ({ uid: user.uid, cloud: false, cloudOriginals: [], cloudDeleted: [] });

  /** Drop the result of a first sync still running (the page is going away). */
  function cancel() {
    s.gen += 1;
    timers.clear(s.retry);
  }

  /**
   * Try the first sync again later — the sync icon says "will retry": retryDelay after the first
   * failure, twice as long after each next one (at most maxRetryDelay), and not while the tab is
   * hidden: a retry due then runs once it is shown (V2W1a-1).
   */
  function scheduleRetry(delay) {
    timers.clear(s.retry);
    const wait = delay ?? backoff(s.attempts++, retryDelay, maxRetryDelay);
    const { gen, user } = s;
    s.retry = timers.set(() => {
      if (s.gen !== gen || s.user !== user) return;
      if (hidden()) s.retryOnShow = true;
      else start(user);
    }, wait);
  }

  /** The tab is shown again: a retry that came due while it was hidden runs now. */
  function shown() {
    if (s.retryOnShow && s.user) start(s.user);
  }

  /**
   * A first sync or a flush of `user`'s account failed with `e` (cloudSyncRetry.failureKind).
   * Nothing more is queued until a first sync gets through, and that one sends what failed: the
   * store still has the edits, and the deletions a flush did not send. A failed flush used to
   * say "will retry" while nothing was retried, and its queue was gone (V2W1a-1).
   */
  function failed(e, user, what) {
    s.initialSyncDone = false;
    const kind = failureKind(e, online());
    if (kind === 'config') {
      s.cloudDisabled = true;
      report.status('error');
      setAccount(noCloud(user));
      // One clear message — app keeps working on localStorage only
      log(
        '[CloudSync] Cloud sync disabled (local-only). '
        + 'Signed-in user cannot read/write Firestore — check rules are published '
        + 'and a "(default)" database exists. Resume data still saves in this browser.',
      );
      return;
    }
    if (kind === 'stop') {
      // The same batch fails the same way: nothing until the résumés change (resumesChanged).
      s.stopped = store.getState().resumes;
      report.status('stopped');
      log(`[CloudSync] ${what} refused (${e?.code}); stopped until the next change:`, e?.message || e);
      return;
    }
    report.status(kind === 'offline' ? 'offline' : 'error');
    if (kind === 'retry') log(`[CloudSync] ${what} unavailable:`, e?.code || e?.message || e);
    // Offline: going online again re-runs the first sync.
    if (online()) scheduleRetry();
  }

  /**
   * The cloud did not answer while signed in: nothing more is sent until a first sync gets
   * through again — the flush used to write a restore made meanwhile over the cloud's copies,
   * newer edits from another device included (VM4-6). No restore is made without the answer
   * (demoRestore.js, V2W1a-0): the retry's first sync reports the account again, and the restore
   * runs from the cloud's copies.
   */
  function unreachable() {
    s.initialSyncDone = false;
    report.status(online() ? 'error' : 'offline');
    scheduleRetry();
  }

  async function initialSync(user, gen) {
    report.status('syncing');
    try {
      const cloud = await io.readCloud(user.uid);
      if (gen !== s.gen) return;

      // The store as it is once the account is known: what was done while it was read counts.
      const appState = store.getState();
      const planAt = now();
      const plan = planInitialSync({
        local: appState.resumes, deletions: deletionEntries(appState), cloud: cloud.docs, cloudDeleted: cloud.deleted,
        demoAccount: isDemo(user), uid: user.uid,
      });

      // Deletions this browser never sent reach the cloud in the same batch, before the store
      // forgets them (afterSync) — else the next sync restores them (R4-1).
      await io.commit(user.uid, plan);
      if (gen !== s.gen) return;

      // Applied to the store as it is now (R8-2). The watcher then compares it with the merged list,
      // so it sends what was edited, added or deleted while the batch was on its way.
      store.applyCloudSync({ uid: user.uid, snapshot: appState.resumes, merged: plan.merged, handled: plan.handled, before: planAt });
      s.prevResumes = plan.merged;
      s.initialSyncDone = true;
      // A listed id was deleted for good, whatever copy of it a stale device wrote back since
      // (V2OWNER-DATA-0): it is none of the account's originals.
      const listed = new Set(cloud.deleted);
      const cloudOriginals = cloud.docs.filter((r) => isOriginal(r) && !listed.has(r.id)).map(({ deleted: _deleted, ...r }) => r);
      setAccount({ uid: user.uid, cloud: true, cloudOriginals, cloudDeleted: [...cloud.deleted] });
      s.attempts = 0;
      report.status('synced');
      report.synced(new Date());
    } catch (e) {
      if (gen !== s.gen) return;
      failed(e, user, 'sync');
    }
  }

  /** The store's résumés after every change: what changed is queued and sent after a pause. */
  function resumesChanged(current) {
    if (s.stopped && s.user && current !== s.stopped) {
      // Refused for good: a change (a photo taken out) is tried once, after the pause.
      s.stopped = current;
      scheduleRetry(flushDelay);
      return;
    }
    if (!s.user || !s.initialSyncDone || s.cloudDisabled || !io) return;
    const queued = queueChanges(s.queue, s.prevResumes || [], current);
    if (!queued.dirty) return;
    s.queue = queued;
    s.prevResumes = current;

    timers.clear(s.timer);
    report.status('syncing');
    const { user } = s;
    s.timer = timers.set(() => sendPending(user), flushDelay);
  }

  /** Send the changes waiting: handed to Firestore at once, in order (cloudSyncFlush.js). */
  async function sendPending(user) {
    const current = () => s.user?.uid === user.uid;
    if (!current() || s.cloudDisabled || !io) return; // signed out or switched since (R8-5)

    const { kept, marked } = s.queue;
    const writes = [...s.queue.writes.values()];
    const deletes = [...s.queue.deletes];
    s.queue = emptyQueue();

    if (!writes.length && !deletes.length) return;

    const sentAt = now();
    try {
      // In a demo account a deleted original is flagged, not removed: its last copy stays in the
      // cloud so that restoring the originals on any device brings back the edited version.
      // Writing it again (a restore) replaces the whole document, flag included.
      await flushOnce({ uid: user.uid, writes, deletes, kept, marked, demoAccount: isDemo(user) }, io);
      // The cloud has them: the store stops keeping them for the next first sync, which would send
      // them again — over a restore another device made since (R8-1).
      if (deletes.length) store.forgetDeletions(deletes, sentAt);
      // Not "synced" while a first sync is still owed (offline, or the cloud stopped answering).
      if (!current() || !s.initialSyncDone) return;
      report.status('synced');
      report.synced(new Date());
    } catch (e) {
      // An account signed out since: its refusal says nothing about the one signed in now (R8-5).
      if (!current()) return;
      failed(e, user, 'flush');
    }
  }

  /**
   * `{ docs, deleted }`: the account's résumés with these `ids` as the cloud holds them now,
   * flagged ones included — a restore of the originals then brings back an edit another device
   * made after this one's first sync (R4-4) — and its deletion list now, so none deleted for good
   * since comes back (V2OWNER-DATA-0). null when there is no cloud to ask, or it gives no answer
   * within cloudTimeout — the sync then sends nothing until a first sync gets through again
   * (unreachable, VM4-6). It stops before this resolves, so a restore made on a null answer is
   * never queued.
   */
  function readCloudCopies(ids) {
    if (!s.user || !io || s.cloudDisabled || !s.initialSyncDone || !online()) return Promise.resolve(null);
    const { gen, user } = s;
    const read = io.readCopies(user.uid, ids);
    const timeout = new Promise((resolve) => { timers.set(() => resolve(null), cloudTimeout); });
    return Promise.race([read, timeout]).catch(() => null).then((answer) => {
      if (answer === null && s.gen === gen && s.user === user && s.initialSyncDone) unreachable();
      return answer;
    });
  }

  return { start, cancel, shown, resumesChanged, readCloudCopies };
}
