// The cloud sync of a plain list — the Job Tracker's jobs (R2-145), the boards (R2-140) — as a
// plain object with everything outside passed in, like the résumés' (cloudSyncEngine.js): the
// Firestore calls (`io`, collectionSyncIo.js; null without a cloud), the list's store, this
// browser's record of it (collectionSyncMeta.js), the timers and the online flag. It shares the
// résumés' failure handling (cloudSyncRetry.js), their document-size count (cloudSyncHeld.js) and
// their page wiring (cloudSyncBrowser.js); what it decides is collectionSyncPlan.js. No React and
// no Firebase, so the tests drive this very code (tests/unit/*-sync.unit.mjs).
//
// Signed in: a first sync merges this browser's list with the account's, item by item (the newer
// wins, nothing typed is lost), then every change is sent after a pause. A failure is tried again
// later, as the résumés' is; offline, going online runs the first sync again, which sends what
// was changed meanwhile. An item too large for a document is held back on its own, and named.
// Signed out, or another account signing in: the list leaves this browser, what its cloud lacks
// kept aside for its next sign-in (collectionSyncPlan.leaveList). Never signed in: nothing
// happens — the list is this browser's, as before.
import { backoff, failureReport } from './cloudSyncRetry.js';
import { docSize, MAX_DOC_BYTES } from './cloudSyncHeld.js';
import { diffLists, leaveList, planFirstSync, stashOf, versionsOf } from './collectionSyncPlan.js';
import { itemPath } from './collectionSyncIo.js';

/**
 * createCollectionSync({ name, io, store, meta, report, ... }):
 *   name      the list's collection: 'jobs' or 'boards'
 *   io        collectionIo(...) — null when this build has no cloud
 *   store     { items() → the list now, replace(list), subscribe(fn) → unsubscribe, fromCloud(doc)
 *             → the item as the store holds one (null: not one), label(item) → its name, seed(item)
 *             → whether it is the first visit's demo, untouched (optional) }
 *   meta      { read(), write(m) } — collectionSyncMeta.js
 *   report    { status('idle'|'syncing'|'synced'|'offline'|'error'|'stopped'|'off'), held([{ id, name }]) }
 *   online, hidden, timers, flushDelay, retryDelay, maxRetryDelay, refreshAfter, now, log — as
 *             createCloudSync's (cloudTimeout: how long a flush waits for its read); maxBytes the document limit (Firestore's 1 MiB)
 * Returns { start(user), cancel(), shown() }: the same calls cloudSyncBrowser.js and the hook make.
 */
export function createCollectionSync({
  name, io, store, meta, report = {},
  online = () => true, hidden = () => false, timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  flushDelay = 1500, cloudTimeout = 5000, retryDelay = 30000, maxRetryDelay = 600000, refreshAfter = 10000, maxBytes = MAX_DOC_BYTES,
  now = () => Date.now(), log = () => {},
}) {
  const s = {
    user: null,
    gen: 0, // bumped by every start/cancel: a first sync from an older one drops its result
    ready: false, // the account's first sync got through: changes are sent
    disabled: false, // the project refuses this account (rules, no database): local-only until a reload
    prev: null, // the list the queue last compared with
    queue: null, // { writes: Map, deletes: Set, reordered }
    timer: null,
    retry: null,
    attempts: 0,
    retryOnShow: false,
    stopped: false, // refused for good with nothing to hold: waits for the next change
    readAt: -Infinity,
    unsubscribe: null,
    turn: Promise.resolve(), // the last flush's batch handed to Firestore
  };
  const status = (v) => report.status?.(v);

  // Held back: id → the copy the cloud will not take, tried again once it changes or goes.
  const held = new Map();
  const heldChanged = () => report.held?.([...held.values()].map((x) => ({ id: x.id, name: store.label(x) })));
  const tooLarge = (uid, x) => docSize(itemPath(name, uid, x.id), x) > maxBytes;
  /** `list` without what is held, holding first what is too large for a document. */
  function sendable(uid, list) {
    let changed = false;
    const out = list.filter((x) => {
      if (held.get(x.id) === x) return false;
      if (!tooLarge(uid, x)) return true;
      held.set(x.id, x);
      changed = true;
      return false;
    });
    if (changed) heldChanged();
    return out;
  }
  /** A held item changed or gone is let go: tried again. */
  function release(list) {
    if (!held.size) return;
    const byId = new Map(list.map((x) => [x.id, x]));
    let changed = false;
    for (const [id, x] of held) if (byId.get(id) !== x) { held.delete(id); changed = true; }
    if (changed) heldChanged();
  }

  const noteVersions = (uid, sets, deletes) => {
    const m = meta.read();
    if (m.uid !== uid) return;
    const versions = { ...m.versions, ...versionsOf(sets) };
    deletes.forEach((id) => { delete versions[id]; });
    meta.write({ ...m, versions });
  };

  function dropQueue() {
    timers.clear(s.timer);
    s.timer = null;
    s.queue = null;
  }

  /** Account `uid`'s list leaves this browser (collectionSyncPlan.leaveList); nothing when it is not that account's. */
  function leave(uid) {
    // The list first: loading it may find it damaged and make the record forget what the cloud
    // holds (forgetSynced), which must come before the record is read.
    const list = store.items();
    const left = leaveList(meta.read(), list, uid);
    if (!left) return;
    meta.write(left.meta);
    store.replace(left.list);
  }

  /** Whenever the signed-in user (or null) changes, or the browser goes online or offline. */
  function start(user) {
    s.gen += 1;
    timers.clear(s.retry);
    s.retryOnShow = false;
    if ((user?.uid ?? null) !== (s.user?.uid ?? null)) {
      // Another account, or none: the last one's queue is not sent (without its auth it is
      // refused); its next first sync sends what it held.
      dropQueue(); s.attempts = 0; s.ready = false; s.prev = null;
      if (held.size) { held.clear(); heldChanged(); }
    }
    const owner = meta.read().uid;
    if (io && s.user && !user) leave(s.user.uid);
    else if (io && user && owner && owner !== user.uid) leave(owner);
    s.user = user || null;

    if (!user) {
      s.ready = false;
      s.disabled = false;
      status('idle');
      return;
    }
    if (!io || s.disabled) { status('off'); return; }
    if (!s.unsubscribe) s.unsubscribe = store.subscribe(() => changed(store.items()));
    if (!online()) { s.ready = false; status('offline'); return; }
    firstSync(user, s.gen);
  }

  /** Drop the result of a first sync still running (the page is going away). */
  function cancel() {
    s.gen += 1;
    timers.clear(s.retry);
  }

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

  /** The tab is shown again: a retry due meanwhile runs, and a list read long ago is read again (another device's edits). */
  function shown() {
    if (!s.user) return;
    const stale = s.ready && io && !s.disabled && now() - s.readAt >= refreshAfter;
    if (s.retryOnShow || stale) start(s.user);
  }

  /**
   * A first sync or a flush failed with `e` (cloudSyncRetry.failureKind): tried again later, or
   * turned off (the project refuses this account). Refused for good: the items of that batch
   * (`sets`) are held until they change, and a first sync sends the rest without them; with none
   * to hold, nothing is sent until the list changes. The first sync that gets through sends what
   * failed: the store still has it, and this browser's record says what the cloud lacks.
   */
  function failed(e, user, what, sets = []) {
    const { kind, status: said, log: line } = failureReport(e, online(), `${name} ${what}`);
    if (line) log(...line);
    s.ready = false;
    status(said);
    if (kind === 'config') s.disabled = true;
    else if (kind === 'stop') {
      if (!sets.length) { s.stopped = true; return; }
      sets.forEach((x) => held.set(x.id, x));
      heldChanged();
      scheduleRetry(flushDelay);
    } else if (online()) scheduleRetry();
  }

  function settled() {
    status(held.size ? 'stopped' : 'synced');
  }

  async function firstSync(user, gen) {
    status('syncing');
    dropQueue();
    s.ready = false;
    s.stopped = false;
    const { uid } = user;
    let sets = [];
    try {
      const cloud = await io.read(uid);
      if (gen !== s.gen) return;
      const docs = cloud.docs.map((d) => store.fromCloud(d)).filter(Boolean);
      const m = meta.read();
      if (m.uid && m.uid !== uid) leave(m.uid);
      const record = meta.read();
      const own = store.items();
      const mine = record.uid === uid;
      const stash = stashOf(record, uid);
      const local = [...own, ...stash.items.filter((x) => !own.some((o) => o.id === x.id))];
      const versions = { ...stash.versions, ...(mine ? record.versions : {}) };
      const ownIds = new Set(own.map((x) => x.id));
      const localDeletes = [...stash.deletes, ...(mine ? Object.keys(record.versions).filter((id) => !ownIds.has(id)) : [])]
        .filter((id) => !local.some((x) => x.id === id));
      const plan = planFirstSync({ local, versions, localDeletes, docs, deleted: cloud.deleted, order: cloud.order, seed: store.seed });

      sets = sendable(uid, plan.sets);
      const sameOrder = plan.order.length === cloud.order.length && plan.order.every((id, i) => cloud.order[i] === id);
      if (sets.length || plan.deletes.length || !sameOrder) {
        await io.commit(uid, { sets, deletes: plan.deletes, order: sameOrder ? null : plan.order });
        if (gen !== s.gen) return;
      }

      // Applied to the list as it is now: what was changed while the batch was on its way stays,
      // and is sent by the queue (the list it compares with is the merged one).
      const current = store.items();
      const before = new Map(own.map((x) => [x.id, x]));
      const edited = new Map(current.filter((x) => before.get(x.id) !== x).map((x) => [x.id, x]));
      const removed = new Set(own.filter((x) => !current.some((c) => c.id === x.id)).map((x) => x.id));
      const result = plan.merged.filter((x) => !removed.has(x.id)).map((x) => edited.get(x.id) || x);
      const added = [...edited.values()].filter((x) => !result.some((r) => r.id === x.id));
      const next = [...result, ...added];

      const cloudVersions = { ...versionsOf(docs.filter((d) => !plan.deletes.includes(d.id))), ...versionsOf(sets) };
      const { [uid]: _gone, ...stashed } = record.stashed;
      meta.write({ uid, versions: cloudVersions, stashed });
      s.prev = plan.merged;
      s.ready = true;
      s.readAt = now();
      s.attempts = 0;
      store.replace(next);
      changed(next);
      if (!s.timer) settled();
    } catch (e) {
      if (gen !== s.gen) return;
      failed(e, user, 'sync', sets);
    }
  }

  /** The store's list after every change: what changed is queued and sent after a pause. */
  function changed(list) {
    release(list);
    if (s.stopped && s.user) {
      // Refused for good with nothing to hold: a change is tried once, after the pause.
      s.stopped = false;
      scheduleRetry(flushDelay);
      return;
    }
    if (!s.user || !s.ready || s.disabled || !io) return;
    // Another tab took the list off this browser (its sign-out, collectionSyncPlan.leaveList) and
    // this one has not heard of it yet: the empty list is no deletion of the account's items.
    if (meta.read().uid !== s.user.uid) { dropQueue(); s.ready = false; return; }
    const { writes, deletes, reordered } = diffLists(s.prev || [], list);
    s.prev = list;
    if (!writes.length && !deletes.length && !reordered) return;
    const q = s.queue || { writes: new Map(), deletes: new Set(), reordered: false };
    writes.forEach((x) => { q.writes.set(x.id, x); q.deletes.delete(x.id); });
    deletes.forEach((id) => { q.writes.delete(id); q.deletes.add(id); });
    q.reordered ||= reordered;
    s.queue = q;
    timers.clear(s.timer);
    status('syncing');
    const { user } = s;
    s.timer = timers.set(() => flush(user), flushDelay);
  }

  /** `promise`, or a deadline-exceeded failure (retried) once cloudTimeout passes without its answer. */
  function withDeadline(promise) {
    let id;
    const late = () => Object.assign(new Error('The cloud did not answer in time.'), { code: 'deadline-exceeded' });
    const deadline = new Promise((_, reject) => { id = timers.set(() => reject(late()), cloudTimeout); });
    return Promise.race([promise, deadline]).finally(() => timers.clear(id));
  }

  /**
   * Send the queued changes as one batch. The cloud's copies of the items it writes are read
   * first: one another device changed later than this one's copy (its flush got there first) is
   * kept, and taken here — per-item last-writer-wins holds for every write, not only at a first
   * sync. Flushes hand their batches over in the order they were made (`s.turn`), each after the
   * one before it has read, so an older batch never lands after a newer one.
   */
  async function flush(user) {
    const q = s.queue;
    s.queue = null;
    s.timer = null;
    const current = () => s.user?.uid === user.uid && s.ready;
    if (!q || !current() || meta.read().uid !== user.uid) return;
    const before = s.turn;
    let handedOver;
    s.turn = new Promise((resolve) => { handedOver = resolve; });
    let sets = [];
    try {
      await before;
      if (!current()) return;
      const queued = sendable(user.uid, [...q.writes.values()]);
      const docs = queued.length ? await withDeadline(io.readItems(user.uid, queued.map((x) => x.id))) : [];
      if (!current()) return;
      const cloudCopy = new Map(docs.map((d) => [d.id, d]));
      const newer = queued.map((x) => {
        const d = cloudCopy.get(x.id);
        return d && Number.isFinite(d.updatedAt) && d.updatedAt > (x.updatedAt ?? 0) ? store.fromCloud(d) : null;
      }).filter(Boolean);
      const skip = new Set(newer.map((x) => x.id));
      sets = queued.filter((x) => !skip.has(x.id));
      const deletes = [...q.deletes];
      const order = q.reordered || deletes.length || q.writes.size ? (s.prev || []).map((x) => x.id) : null;
      const sending = io.commit(user.uid, { sets, deletes, order });
      handedOver();
      if (newer.length) {
        // Taken as the cloud has them: the list the queue compares with has them too, so they are not sent back.
        const list = store.items().map((x) => newer.find((n) => n.id === x.id) || x);
        s.prev = (s.prev || []).map((x) => newer.find((n) => n.id === x.id) || x);
        store.replace(list);
      }
      await sending;
      if (!current()) return;
      noteVersions(user.uid, [...sets, ...newer], deletes);
      if (!s.timer) settled();
    } catch (e) {
      if (s.user?.uid !== user.uid) return;
      failed(e, user, 'flush', sets);
    } finally {
      handedOver();
    }
  }

  return { start, cancel, shown };
}
