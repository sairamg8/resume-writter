// The cloud sync itself — the first sync after sign-in, the write queue and its flushes, the
// read-back of a demo account's originals — as a plain object with everything outside passed
// in: the Firestore calls (`io`, cloudSyncIo.js; null without a cloud), the résumé store, the
// timers, the online flag. What a failure means and when it is tried again: cloudSyncRetry.js; a
// résumé the cloud will not take, held back on its own: cloudSyncHeld.js; the write queue:
// cloudSyncQueue.js; another device's edit told from this one's: cloudSyncLineage.js (R2-004).
// No React and no Firebase, so the tests drive this very code (tests/pdf/18-cloud-sync-*.test.mjs);
// cloudSyncBrowser.js wires it to the page (online flag, hidden tab), useCloudSync to React state.
import { isOriginal } from '@/utils/demoSeed';
import { planInitialSync } from '@/utils/cloudSyncPlan';
import { deletionEntries } from '@/utils/localDeletions';
import { backoff, failureReport } from '@/utils/cloudSyncRetry';
import { createHeld } from '@/utils/cloudSyncHeld';
import { createQueue, emptyQueue } from '@/utils/cloudSyncQueue';
import { createLineage } from '@/utils/cloudSyncLineage';
import { stashOf } from '@/utils/cloudSyncLeave';

/**
 * createCloudSync({ io, store, report, isDemo, ... }):
 *   io        cloudIo(...) — null when this build has no cloud
 *   store     { getState() → the résumé store's state now, applyCloudSync(result) — a first
 *             sync's result (cloudSyncPlan.afterSync), forgetDeletions(ids, before, uid) — that
 *             account's cloud has these deletions (localDeletions.js), restoreResumes(list),
 *             noteCloudVersions(uid, { id: version | null }) — the copies the cloud holds now
 *             (cloudSyncLineage.js), leaveAccount(uid) — its list leaves this browser
 *             (cloudSyncLeave.js) }: useResumeSyncActions.liveStore
 *   report    { status('idle'|'syncing'|'synced'|'offline'|'error'|'stopped'|'off'), synced(Date), account(a),
 *             held([{ id, name }]) } — held: the résumés the cloud will not take ('stopped' while any);
 *             account: { uid, cloud, cloudOriginals, cloudDeleted } once the account's list is
 *             known, else null — whether a cloud holds it (false: this browser's list is the whole
 *             list), the cloud's originals (demoSeed.js), deleted ones included, and its deletion
 *             list, as the first sync read them
 *   isDemo    user → true for a demo account (its deleted originals are flagged, not removed)
 *   online    () → whether the browser says it is online; hidden () → whether the tab is hidden
 *   timers    { set(fn, ms) → id, clear(id) }; flushDelay (ms) before queued changes are sent;
 *             cloudTimeout (ms) readCloudCopies waits for an answer; retryDelay (ms) before a
 *             first sync that failed for a moment is tried again, doubled after each failure up
 *             to maxRetryDelay; refreshAfter (ms) since the account was last read before a tab
 *             shown again reads it again (R2-004); now() → ms
 * Returns { start(user), cancel(), shown(), resumesChanged(resumes), readCloudCopies(ids) }.
 */
export function createCloudSync({
  io, store, report, isDemo = () => false,
  // The default timers call the globals, never as methods of `timers`: a browser's setTimeout and
  // clearTimeout throw "Illegal invocation" on any `this` but the window (the live site went blank).
  online = () => true, hidden = () => false, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  flushDelay = 1500, cloudTimeout = 5000, retryDelay = 30000, maxRetryDelay = 600000, refreshAfter = 10000,
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
    attempts: 0, // failed tries since this account's last first sync that got through (backoff)
    retryOnShow: false, // a retry came due while the tab was hidden
    stopped: null, // the résumés when a batch no résumé can be held for was refused for good
    account: null,
    lineage: createLineage(), // the account's copies this page has seen (R2-004)
    turn: Promise.resolve(), // the last flush's batch handed to Firestore (cloudSyncQueue.js)
    readAt: -Infinity, // when a first sync last read the account (now())
  };
  // The résumés the cloud will not take, left out of every batch until they change (V2VF1S-0).
  const held = createHeld({ io, report, online, resumes: () => store.getState().resumes });
  // The write queue, sending the store's changes after a pause (hoisted: failed, settled, scheduleRetry).
  const queue = createQueue({ s, io, store, report, held, timers, flushDelay, cloudTimeout, now, isDemo, failed, settled, scheduleRetry });
  const { dropQueue } = queue;

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
    // lost: the store keeps the edits and deletions for that account's next first sync. Nor do its
    // failures put off the next account's retry: that one starts from retryDelay (V2VF1S-5).
    // Nor is the next account's list compared with the last one's: a change made before its own
    // first sync got through waits for that sync — else the last list leaving the store (R2-005)
    // was queued as the next account's deletions.
    if ((user?.uid ?? null) !== (s.user?.uid ?? null)) {
      dropQueue(); held.clear(); s.attempts = 0; s.lineage.reset();
      s.initialSyncDone = false;
      s.prevResumes = null;
    }
    // Signed out, or another account signing in while the list is still the last one's: that
    // list leaves this browser, what its cloud lacks kept aside for it (R2-005). It stayed on
    // screen for whoever came next, and their first sync merged it into their own cloud.
    // Without a cloud the list is its only copy, and stays.
    const owner = store.getState().syncedUid;
    if (io && s.user && !user) store.leaveAccount(s.user.uid);
    else if (io && user && owner && owner !== user.uid) store.leaveAccount(owner);
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
      // Off, not "will retry": nothing is tried again until a sign-out or a reload (V2VF1S-2).
      report.status('off');
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

  /**
   * The tab is shown again: a retry that came due while it was hidden runs now — and, the account
   * read longer than refreshAfter ago, it is read again: another device's edits made meanwhile are
   * here before this page's next change (R2-004). A tab left open showed its stale copies until a
   * reload.
   */
  function shown() {
    if (!s.user) return;
    const stale = s.initialSyncDone && !s.stopped && io && !s.cloudDisabled && now() - s.readAt >= refreshAfter;
    if (s.retryOnShow || stale) start(s.user);
  }

  /**
   * A first sync or a flush of `user`'s account failed with `e` (cloudSyncRetry.failureKind).
   * Nothing more is queued until a first sync gets through, and that one sends what failed: the
   * store still has the edits, and the deletions a flush did not send. A failed flush used to
   * say "will retry" while nothing was retried, and its queue was gone (V2W1a-1).
   */
  function failed(e, user, what) {
    s.initialSyncDone = false;
    const { kind, status, log: line } = failureReport(e, online(), what);
    report.status(status);
    if (line) log(...line);
    if (kind === 'config') {
      s.cloudDisabled = true; // local-only until a sign-out or a reload
      setAccount(noCloud(user));
    } else if (kind === 'stop') {
      // Refused for good with no résumé to hold (cloudSyncHeld.js): the same batch fails the same
      // way — nothing until the résumés change (resumesChanged).
      s.stopped = store.getState().resumes;
    } else if (online()) scheduleRetry(); // offline: going online again re-runs the first sync
  }

  /** After a first sync or a flush got through: 'stopped' while a résumé is held back. */
  function settled() {
    report.status(held.size ? 'stopped' : 'synced');
    report.synced(new Date());
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
      // A list still another account's is none of this one's (R2-005: start() had it leave); what
      // this account's list kept aside at its last sign-out is (cloudSyncLeave.js).
      const appState = store.getState();
      const planAt = now();
      const other = appState.syncedUid && appState.syncedUid !== user.uid ? appState.syncedUid : null;
      if (other) store.leaveAccount(other);
      const own = other ? [] : appState.resumes;
      const stash = stashOf(appState, user.uid);
      const local = stash ? [...own, ...stash.resumes.filter((r) => !own.some((o) => o.id === r.id))] : own;
      if (appState.syncedUid === user.uid) s.lineage.base(appState.cloudVersions);
      if (stash) s.lineage.base(stash.versions);
      const plan = planInitialSync({
        local, deletions: deletionEntries(appState), cloud: cloud.docs, cloudDeleted: cloud.deleted,
        demoAccount: isDemo(user), uid: user.uid, lineage: s.lineage,
      });

      // Deletions this browser never sent reach the cloud in the same batch, before the store
      // forgets them (afterSync) — else the next sync restores them (R4-1). A résumé too large
      // for a document is never sent; one refused is held and the rest sent without it.
      await held.commit(user.uid, { ...plan, sets: held.sendable(user.uid, plan.sets) }, own, () => gen === s.gen);
      if (gen !== s.gen) return;
      s.lineage.synced(cloud.docs);
      s.lineage.synced(plan.sets);
      s.readAt = now();

      // Applied to the store as it is now (R8-2). The watcher then compares it with the merged list,
      // so it sends what was edited, added or deleted while the batch was on its way. `versions`:
      // the copies the cloud holds now — a résumé held back keeps the cloud's own.
      const cloudCopy = new Map(cloud.docs.map((r) => [r.id, r.updatedAt]));
      const versions = Object.fromEntries(plan.merged.map((r) => [r.id, held.has(r.id) ? cloudCopy.get(r.id) : r.updatedAt])
        .filter(([, v]) => Number.isFinite(v)));
      store.applyCloudSync({ uid: user.uid, snapshot: own, merged: plan.merged, handled: plan.handled, before: planAt, versions, unstash: Boolean(stash) });
      s.prevResumes = plan.merged;
      s.initialSyncDone = true;
      // A listed id was deleted for good, whatever copy of it a stale device wrote back since
      // (V2OWNER-DATA-0): it is none of the account's originals.
      const listed = new Set(cloud.deleted);
      const cloudOriginals = cloud.docs.filter((r) => isOriginal(r) && !listed.has(r.id)).map(({ deleted: _deleted, ...r }) => r);
      setAccount({ uid: user.uid, cloud: true, cloudOriginals, cloudDeleted: [...cloud.deleted] });
      s.attempts = 0;
      settled();
    } catch (e) {
      if (gen !== s.gen) return;
      failed(e, user, 'sync');
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

  return { start, cancel, shown, resumesChanged: queue.resumesChanged, readCloudCopies };
}
