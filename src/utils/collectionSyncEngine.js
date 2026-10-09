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
import { backoff, failureKind, failureReport } from './cloudSyncRetry.js';
import { docSize, MAX_DOC_BYTES } from './cloudSyncHeld.js';
import { DELETED, diffLists, leaveList, planFirstSync, stashOf, versionsOf } from './collectionSyncPlan.js';
import { hasTwin, sameContent } from './collectionSyncConflict.js';
import { cloudCanName, isStale, itemPath } from './collectionSyncIo.js';
import { NO_STAMP, movedInCloud, nextStamps, revsOf, revsOfStamps, theirsLater } from './collectionSyncRev.js';
import { newId } from './ids.js';

/**
 * A first sync that waits: storage would not take a sync record — the last account's list set
 * aside, or this account's record naming it the list's owner — tried again later.
 */
const noRoom = (what = 'the last account\'s list could not be set aside') => Object.assign(new Error(`Storage is full: ${what}.`), { code: 'resource-exhausted' });

/** How many times a sync decides again when the cloud's copies change between its read and its write (collectionSyncIo.STALE). */
const STALE_TRIES = 3;

/**
 * The most deletions one request carries. A batch or a transaction takes at most 500 writes (each deletion is
 * one, and the deletion list another): more deletions at once ("Clear all jobs" on a long list) are sent in
 * requests of this many, each recorded as deleted as it lands (sendDeletes).
 */
const DELETE_CHUNK = 400;

/** How many items a write can be for its absent copies to be checked too (expectOf). */
const ABSENT_GUARD = 100;

/** A write that kept finding the cloud's copies changed: tried again later, as any temporary failure is. */
// `stale`: the last STALE it ended on; the SDK's own code behind it (collectionSyncIo.commit), when it gave one, is kept as `cause`.
const keptChanging = (stale) => {
  const cause = stale?.cause ?? stale;
  const last = cause?.code ? ` (last: ${cause.code})` : '';
  return Object.assign(new Error(`The cloud kept changing under this sync${last}.`), { code: 'aborted', ...(cause ? { cause } : {}) });
};

/**
 * createCollectionSync({ name, io, store, meta, report, ... }):
 *   name      the list's collection: 'jobs' or 'boards'
 *   io        collectionIo(...) — null when this build has no cloud
 *   store     { items() → the list now, replace(list), subscribe(fn) → unsubscribe, fromCloud(doc)
 *             → the item as the store holds one (null: not one), label(item) → its name, seed(item)
 *             → whether it is the first visit's demo, untouched (optional), conflictCopy(older, every
 *             item) → the older copy of an item both devices changed, kept beside the newer one under
 *             a new id (collectionSyncConflict.js; optional: none, the older copy is dropped), conflictApart → the fields
 *             whose difference alone is no conflict (optional), leaveRecovery() → the list's
 *             recovery notice and backups forgotten as it leaves this browser (optional), saved() → the
 *             list storage holds, which differs from items() when storage refused a save (optional:
 *             items()) }
 *   meta      { read(), write(m) } — collectionSyncMeta.js
 *   report    { status('idle'|'syncing'|'synced'|'offline'|'error'|'stopped'|'off'), held([{ id, name }]),
 *             conflict([name]) — the items a conflict copy was kept for (null: forget them, as the list leaves or the account changes) }
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
    queue: null, // { writes: Map, deletes: Map (id → the deleted copy's updatedAt), reordered }
    timer: null,
    retry: null,
    attempts: 0,
    retryOnShow: false,
    stopped: false, // refused for good with nothing to hold: waits for the next change
    readAt: -Infinity,
    unsubscribe: null,
    turn: Promise.resolve(), // the last flush's batch handed to Firestore
    sent: new Map(), // id → the updatedAt of the copy this browser last handed to Firestore (its record only has it once acknowledged)
    device: null, // this browser's id as a writer, until its record holds one
  };
  const status = (v) => report.status?.(v);
  /**
   * This browser's id as the writer of a version (collectionSyncRev.js): the one its record holds,
   * else a new one, kept in the record by the next write of it. Every tab of a browser shares it.
   */
  const deviceId = () => meta.read().device || (s.device ??= newId('dev'));

  // Held back: id → the copy the cloud will not take, tried again once it changes or goes.
  const held = new Map();
  const heldChanged = () => report.held?.([...held.values()].map((x) => ({ id: x.id, name: store.label(x) })));
  const tooLarge = (uid, x) => docSize(itemPath(name, uid, x.id), x) > maxBytes;
  /**
   * `list` without what is held, holding first what the cloud cannot take: too large for a
   * document, or an id it cannot name. One with two "/" ("greenhouse/acme/12345") was no refused
   * path but a document nested under the list, written and never read back: gone from every other
   * device, and dropped here by the next first sync as removed from the cloud (R5-HUNT8 review).
   */
  function sendable(uid, list) {
    let changed = false;
    const out = list.filter((x) => {
      if (held.get(x.id) === x) return false;
      if (cloudCanName(x.id) && !tooLarge(uid, x)) return true;
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

  /**
   * What a flush got into account `uid`'s cloud: the versions of `sets`, `deletes` gone, and the
   * `order` it sent (null: none). A deletion is kept as version `DELETED` until the next first
   * sync: an item put back here after it (Undo) is then one changed since this browser saw it, and
   * a first sync keeps it and takes it off the account's deleted list, even when its own write
   * never got there (a reload or a failure within the pause). Its version simply dropped, the
   * first sync took it for a stale copy of a deleted item, and deleted it here too. `revs`: the revs
   * (collectionSyncRev.js) of the copies in `sets`, as just written or as the cloud holds them.
   */
  const noteVersions = (uid, sets, deletes, order, revs = {}) => {
    const m = meta.read();
    if (m.uid !== uid) return;
    const versions = { ...m.versions, ...versionsOf(sets) };
    const seen = { ...m.revs, ...revs };
    deletes.forEach((id) => { versions[id] = DELETED; delete seen[id]; });
    meta.write({ ...m, device: deviceId(), versions: claimed(versions), revs: claimed(seen), ...(order ? { order } : {}) });
  };

  /**
   * A write that landed after a start replaced the sync that sent it (whose result is dropped, record and list alike): the
   * record says so for what this browser's list holds, or those items are ones never seen here at the next sync, and an edit of
   * another device's meanwhile, against one made here since, is settled by the clocks alone with the older dropped. So is an
   * item deleted here meanwhile (`known`: what this browser held when the write was decided): in the account with no version,
   * it came back at the next sync, as one never seen here. Not a conflict copy the plan made (in neither): noted, it would be
   * taken at the next sync for an item deleted here, and deleted from the account.
   */
  function landed(uid, sets, deletes, order, stamps, known = []) {
    if (!sets.length && !deletes.length) return;
    const held = new Set([...store.items().map((x) => x.id), ...known]);
    const mine = sets.filter((x) => held.has(x.id));
    noteVersions(uid, mine, deletes, order, revsOfStamps(new Map(mine.map((x) => [x.id, stamps.get(x.id)]))));
  }

  /**
   * `versions` (or `revs`) without the items shown here that storage refused to hold: the record is saved under
   * its own key, apart from the list. Storage full, the list's save was refused (kept in memory
   * only) while the few bytes of the record fitted, and the record said this browser held items it
   * never stored: at the next reload they were "known here, gone from the list" — deleted here — and
   * the first sync deleted them from the account and every other device. With no version, an item
   * the cloud has and storage lacks is one this browser never saw: the next first sync brings it
   * back (R5-HUNT10-SYNC-RECORD-SAVED-LIST-REFUSED-DELETES-CLOUD). Only those: an item gone from
   * the list and from storage alike was deleted here, and keeps its version until its deletion is
   * sent — dropped with the rest of what storage lacks, a reload or a failed flush before then had
   * the next first sync take it for one never seen here and bring it back from the cloud (review).
   */
  function claimed(versions) {
    if (!store.saved) return versions;
    const saved = new Set(store.saved().map((x) => x.id));
    const refused = new Set(store.items().filter((x) => !saved.has(x.id)).map((x) => x.id));
    return refused.size ? Object.fromEntries(Object.entries(versions).filter(([id]) => !refused.has(id))) : versions;
  }

  /**
   * What a write of `ids` must still find in the cloud (collectionSyncIo.commit's `expect`): each copy as the sync
   * read it (`stamps`: id → stamp). One that was not there is expected not to be for the ids two browsers can both
   * make (the demo's), and for those of `absent` (what the sync read and did not find) when the write is a few: an
   * imported file's jobs have the same ids on every browser that imports it, and another device writing one between
   * the read and here was overwritten — so was this browser's own newer write, by a first sync an earlier start had
   * left on its way, landing late with the copy it had read. A large write (an import of hundreds) is left unchecked for those — each would
   * be a read more in a transaction that holds 500 writes at most — as it is for any id nobody else can make.
   */
  const expectOf = (ids, stamps, absent = []) => new Map(ids.flatMap((id) => {
    if (stamps.has(id)) return [[id, stamps.get(id)]];
    return (store.seedIds ?? []).includes(id) || (ids.length <= ABSENT_GUARD && absent.includes(id)) ? [[id, null]] : [];
  }));
  /** `expect` for `ids` only. */
  const only = (expect, ids) => new Map(ids.filter((id) => expect.has(id)).map((id) => [id, expect.get(id)]));

  /**
   * `deletes` sent ahead of the rest of a write when there are more than one request takes (DELETE_CHUNK): each
   * request is checked and recorded as it lands (the record keeps the deletion, as noteVersions does for any), so
   * a list put back by Undo after some of it went is one changed since, and what is left is sent by the next
   * sync as any deletion not yet sent. Resolves to whether all went (`live()` ended: not all).
   */
  async function sendDeletes(uid, deletes, expect, live) {
    for (let i = 0; i < deletes.length; i += DELETE_CHUNK) {
      if (!live()) return false;
      const chunk = deletes.slice(i, i + DELETE_CHUNK);
      await io.commit(uid, { deletes: chunk, expect: only(expect, chunk) });
      // Recorded even when a start has replaced this sync meanwhile (the request landed whatever became of its result):
      // noteVersions does nothing when the record names another account.
      noteVersions(uid, [], chunk, null);
      if (!live()) return false;
    }
    return true;
  }

  /** `sets` handed to Firestore: a copy of them in the cloud is this browser's own write, whatever its record says yet. */
  const noteSent = (sets) => sets.forEach((x) => { if (Number.isFinite(x.updatedAt)) s.sent.set(x.id, x.updatedAt); });

  /** `list` with each conflict copy (`{ id, copy }`) right after the item it belongs to; one already there is left. */
  function placeCopies(list, copies) {
    const out = [...list];
    for (const { id, copy } of copies) {
      if (out.some((x) => x.id === copy.id)) continue;
      const at = out.findIndex((x) => x.id === id);
      out.splice(at < 0 ? out.length : at + 1, 0, copy);
    }
    return out;
  }

  /**
   * What a flush knows of an item's cloud copy (`stamps`: id → stamp, as read): `synced(id)` whether this
   * browser's record has a copy of it the cloud held (not a deletion), `moved(id, d)` whether copy `d`
   * moved since — by version, not by clock (collectionSyncRev.movedInCloud); what this browser itself
   * handed over (`s.sent`) is no move — and `changed(x)` whether the queued `x` differs from the copy the record
   * holds (its updatedAt is not the recorded one: an item put back by Undo is the copy it was).
   */
  function cloudView(stamps) {
    const m = meta.read();
    const device = deviceId();
    return {
      synced: (id) => Number.isFinite(m.versions[id]) && m.versions[id] > DELETED,
      // Deleted from here, and this copy put back since (Undo): the deletion is the base, any copy in the cloud is a later write.
      undone: (id) => m.versions[id] === DELETED,
      changed: (x) => x.updatedAt !== m.versions[x.id],
      // The cloud's copy `d` of `id` is the later of the two, `x` this browser's (a tie goes to the greater writer id).
      later: (id, d, x) => theirsLater(d.updatedAt, x.updatedAt, (stamps.get(id) ?? NO_STAMP).by, device),
      moved: (id, d) => movedInCloud({
        stamp: stamps.get(id) ?? NO_STAMP, updatedAt: d.updatedAt, baseRev: m.revs?.[id], baseTime: m.versions[id], device, ownTime: s.sent.get(id),
      }),
    };
  }

  /**
   * The older copies to keep for the queued `writes` whose cloud copy (`cloudCopy`: id → document,
   * `docs` all those read) changed since this browser last saw it, to different content:
   * `{ id, copy, name }` each, `name` the item's.
   */
  function conflictCopies(writes, cloudCopy, docs, view) {
    if (!store.conflictCopy) return [];
    const copies = [];
    for (const x of writes) {
      const d = cloudCopy.get(x.id);
      const theirs = d && Number.isFinite(d.updatedAt) ? store.fromCloud(d) : null;
      if (!theirs || !(view.synced(x.id) || view.undone(x.id)) || !view.changed(x) || !view.moved(x.id, d) || sameContent(x, theirs, store.conflictApart)) continue;
      // The first visit's demo, untouched, holds nothing typed: no copy of it (as the first sync makes none).
      if (store.seed?.(theirs)) continue;
      const older = view.later(x.id, d, x) ? x : theirs;
      const copy = store.conflictCopy(older, [...store.items(), ...docs, ...copies.map((c) => c.copy)]);
      if (!hasTwin(copy, [...store.items(), ...docs])) copies.push({ id: x.id, copy, name: store.label(older === x ? theirs : x) });
    }
    return copies;
  }

  /**
   * `own`, this browser's list, with the items kept aside at the last sign-out (`items`) joined to it: `{ list, names }`.
   * An item on both sides under one id (a file imported again while signed out) was this list's alone, and the edit kept
   * aside was dropped. The later of the two stays and the other is kept as a copy (`names`: the items they are of), but
   * for one the account holds already (`docs`: the file's copy is that).
   */
  function withStash(own, items, docs) {
    const list = [...own];
    const copies = [];
    const names = [];
    const at = (x) => (Number.isFinite(x.updatedAt) ? x.updatedAt : 0);
    for (const x of items) {
      const i = list.findIndex((o) => o.id === x.id);
      if (i < 0) { list.push(x); continue; }
      const o = list[i];
      if (o === x || sameContent(o, x, store.conflictApart)) continue;
      const [keep, older] = at(x) > at(o) ? [x, o] : [o, x];
      list[i] = keep;
      if (!store.conflictCopy || docs.some((d) => d.id === older.id && sameContent(d, older, store.conflictApart))) continue;
      const copy = store.conflictCopy(older, [...list, ...docs, ...copies]);
      if (hasTwin(copy, [...list, ...docs, ...copies])) continue;
      copies.push(copy);
      names.push(store.label(keep));
    }
    return { list: [...list, ...copies], names };
  }

  function dropQueue() {
    timers.clear(s.timer);
    s.timer = null;
    s.queue = null;
  }

  /**
   * Account `uid`'s list leaves this browser (collectionSyncPlan.leaveList); nothing when it is not
   * that account's. False when storage would not take the record holding what was kept aside: the
   * list then stays, still that account's — its next sign-in sends it, and another account's first
   * sync waits until it can be set aside (R5-HUNT7-SYNC-LEAVE-META-WRITE-DROPPED).
   */
  function leave(uid) {
    // The list first: loading it may find it damaged and make the record forget what the cloud
    // holds (forgetSynced), which must come before the record is read.
    const list = store.items();
    const left = leaveList(meta.read(), list, uid);
    if (!left) return true;
    // The record before the list goes: gone with nothing kept aside, what was not sent was lost,
    // and the record left behind still listed the account's items — the next first sync took them
    // for deleted here and deleted them from the account. Storage full: the list goes first, to
    // make room; still refused, it comes back.
    const record = { ...left.meta, device: deviceId() };
    const written = meta.write(record);
    store.replace(left.list);
    if (!written && !meta.write(record)) {
      store.replace(list);
      return false;
    }
    // Its recovery notice and backups copy it: they leave with it (storageBackup.forgetRecovery).
    store.leaveRecovery?.();
    report.conflict?.(null); // and the names of its items the notice of a conflict copy holds
    return true;
  }

  /** Whenever the signed-in user (or null) changes, or the browser goes online or offline. */
  function start(user) {
    s.gen += 1;
    // A flush's write that never settles (a cache with no server to answer) must not hold up the ones after it for good:
    // a start (another account, a retry, going online) begins a new line, and what the old one still does is dropped
    // (`current()`), its copies being checked by the write itself (collectionSyncIo.commit).
    s.turn = Promise.resolve();
    timers.clear(s.retry);
    s.retryOnShow = false;
    if ((user?.uid ?? null) !== (s.user?.uid ?? null)) {
      // Another account, or none: the last one's queue is not sent (without its auth it is
      // refused); its next first sync sends what it held.
      dropQueue(); s.attempts = 0; s.ready = false; s.prev = null; s.sent.clear();
      if (held.size) { held.clear(); heldChanged(); }
      // The names of the last account's conflict copies, in this tab too: another tab's sign-out
      // took the list (leave() then finds none) and left them for the next account to be shown.
      report.conflict?.(null);
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
   * turned off (the project refuses this account). Refused for good: the item of that batch
   * (`sets`) is held until it changes, and a first sync sends the rest without it; with none to
   * hold, nothing is sent until the list changes. A flush of several items refused (`apart`) is
   * handed to a first sync after the pause, which takes the batch apart and holds only what the
   * cloud refuses on its own. The first sync that gets through sends what failed: the store still
   * has it, and this browser's record says what the cloud lacks.
   */
  function failed(e, user, what, sets = [], apart = false) {
    const { kind, status: said, log: line } = failureReport(e, online(), `${name} ${what}`);
    // What the SDK said behind a copy that kept changing, if it said (keptChanging): the code in the line is 'aborted'.
    if (line) log(...line, ...(e?.cause?.code ? [`(cause: ${e.cause.code})`] : []));
    s.ready = false;
    status(said);
    if (kind === 'config') s.disabled = true;
    else if (kind === 'stop') {
      if (apart) { scheduleRetry(flushDelay); return; }
      if (!sets.length) { s.stopped = true; return; }
      sets.forEach((x) => held.set(x.id, x));
      heldChanged();
      scheduleRetry(flushDelay);
    } else if (online()) scheduleRetry();
  }

  /**
   * A batch of several items refused for good (one job imported with an id the cloud cannot name,
   * or a value it will not store), taken apart as the résumés' is (cloudSyncHeld.commitHolding):
   * its deletions and order on their own, then each item on its own; one refused on its own is
   * held, and the rest get through. The whole batch used to be held, every item in it named "too
   * large", for the one the cloud refused (R5-HUNT7-SYNC-COLLECTION-BATCH-REFUSED-HOLDS-ALL).
   * Only while `live()`: a first sync the next start replaced sends nothing more. Resolves to the
   * items sent; rejects on any other failure, or when the deletions and order are refused without
   * the items — none to hold, and the sync stops until the list changes, as before.
   */
  async function commitApart(uid, { sets, deletes, order, stamps, expect }, live) {
    const sent = [];
    if (deletes.length || order) await io.commit(uid, { sets: [], deletes, order, expect: only(expect, deletes) });
    for (const x of sets) {
      if (!live()) break;
      try {
        await io.commit(uid, { sets: [x], stamps, expect: only(expect, [x.id]) });
        sent.push(x);
      } catch (e) {
        // The cloud's copy changed since it was read: not a refusal, nothing to hold — the caller decides again.
        if (isStale(e) || failureKind(e, online()) !== 'stop') throw e;
        held.set(x.id, x);
        heldChanged();
      }
    }
    return sent;
  }

  function settled() {
    status(held.size ? 'stopped' : 'synced');
  }

  async function firstSync(user, gen, again = false, stale = 0) {
    status('syncing');
    dropQueue();
    s.ready = false;
    s.stopped = false;
    const { uid } = user;
    let sets = [];
    try {
      // The versions this browser knew BEFORE the read: every tab shares the record, and another
      // tab's flush landing while this one reads writes it ahead of the copy read here. An item that
      // tab had just added then looked known here and removed from the cloud, and was dropped (the
      // other tab took the shorter list and deleted it from the account); one it had just deleted
      // looked changed elsewhere, and came back — as the résumés' engine guards with its `known`
      // (R5-HUNT11-SYNC-COLLECTION-FIRST-SYNC-READS-RECORD-AFTER-CLOUD).
      // So is the order it last saw the cloud hold: another tab's move sent meanwhile wrote its new
      // order to the record, the cloud's old order just read no longer matched it and led, and the
      // move was undone here and then on every device (R5-HUNT11-SYNC-REVIEW-FIRST-SYNC-ORDER-READ-AFTER-CLOUD).
      const early = meta.read();
      const seen = early.uid === uid ? early.versions : {};
      const seenRevs = early.uid === uid ? early.revs ?? {} : {};
      const seenOrder = early.uid === uid ? early.order : null;
      const cloud = await io.read(uid);
      if (gen !== s.gen) return;
      // Another tab's first sync landed during this read: it took the list kept aside at the last
      // sign-out out of the record and named this account. What it did to those items afterwards —
      // restored them and deleted one, say — is in the list and the record now, but the cloud copy just
      // read and the list kept aside (taken from the record as it was, above) are older than that: a
      // job restored from the stash and deleted there was added to this list again and sent to the
      // account, on every device (SL-SYNC-FIRST-SYNC-STASH-CONSUMED). The three no longer make one
      // view: read again, as a steady-state sync — the record names the account, nothing is kept aside.
      if (!again && early.uid !== uid && meta.read().uid === uid) return firstSync(user, gen, true);
      const docs = cloud.docs.map((d) => store.fromCloud(d)).filter(Boolean);
      const m = meta.read();
      // The last account's list could not be set aside (storage full): not merged into this one's.
      if (m.uid && m.uid !== uid && !leave(m.uid)) throw noRoom();
      const record = meta.read();
      const own = store.items();
      // The list kept aside at the last sign-out, too, as it was before the read: two tabs signing
      // in at once, the other tab's first sync landing during this one's read took it out of the
      // record and named the account — a job deleted before that sign-out was no longer one deleted
      // here, came back from the cloud copy read before it went, and the other tab sent it back to
      // the account (R5-HUNT12-SYNC-FIRST-SYNC-STASH-READ-AFTER-CLOUD). The record read now when it
      // does not name the account: it holds what a sign-out meanwhile kept aside.
      const knew = record.uid === uid ? early : record;
      const mine = knew.uid === uid;
      const stash = stashOf(knew, uid);
      const { list: local, names: joined } = withStash(own, stash.items, docs);
      // An id the cloud cannot name is in no copy of it: its version (a nested document an older
      // build wrote) would have the job dropped here as removed from the cloud.
      const versions = Object.fromEntries(Object.entries({ ...stash.versions, ...(mine ? seen : {}) })
        .filter(([id]) => cloudCanName(id)));
      const baseRevs = { ...stash.revs, ...(mine ? seenRevs : {}) };
      const ownIds = new Set(own.map((x) => x.id));
      const localDeletes = [...stash.deletes, ...(mine ? Object.keys(seen).filter((id) => !ownIds.has(id)) : [])]
        .filter((id) => !local.some((x) => x.id === id));
      // The order the cloud held when this browser last synced, so a move made here since (offline,
      // signed out, a failed sync) is told from one made on another device: this account's own
      // record, or the move kept aside when the list left (leaveList).
      const moved = mine ? { baseOrder: seenOrder } : { baseOrder: stash.base, localOrder: stash.order ?? [] };
      const plan = planFirstSync({ local, versions, localDeletes, docs, deleted: cloud.deleted, order: cloud.order, ...moved, seed: store.seed, seedIds: store.seedIds ?? [], copyOf: store.conflictCopy, apart: store.conflictApart, revs: baseRevs, stamps: cloud.stamps, device: deviceId(), fresh: !mine });

      sets = sendable(uid, plan.sets);
      // Each item written is one version above the cloud's copy just read (collectionSyncRev.js).
      const stamps = nextStamps(sets, cloud.stamps, baseRevs, deviceId());
      const sameOrder = plan.order.length === cloud.order.length && plan.order.every((id, i) => cloud.order[i] === id);
      if (sets.length || plan.deletes.length || !sameOrder) {
        // The copies this plan was made from must still be the cloud's when the write lands (another device writing
        // between the read and here is decided again, not overwritten).
        const toWrite = [...sets.map((x) => x.id), ...plan.deletes];
        const expect = expectOf(toWrite, cloud.stamps, toWrite);
        // More deletions than one request takes are sent first, in requests of their own: left in the batch it was
        // refused for good (500 writes), and so was every sync after it, whatever else it carried.
        const many = plan.deletes.length > DELETE_CHUNK;
        if (many) {
          const planned = sets;
          sets = []; // nothing of it is held should a deletion fail
          const all = await sendDeletes(uid, plan.deletes, expect, () => gen === s.gen);
          sets = planned;
          if (!all) return;
        }
        const batch = { sets, deletes: many ? [] : plan.deletes, order: sameOrder ? null : plan.order, stamps, expect: many ? only(expect, sets.map((x) => x.id)) : expect };
        if (batch.sets.length || batch.deletes.length || batch.order) {
          try {
            await io.commit(uid, batch);
            noteSent(sets);
          } catch (e) {
            if (sets.length < 2 || gen !== s.gen || isStale(e) || failureKind(e, online()) !== 'stop') throw e;
            // Nothing of it held should the rest fail: an item refused on its own is held as it goes.
            sets = [];
            sets = await commitApart(uid, batch, () => gen === s.gen);
            noteSent(sets);
          }
        }
        if (gen !== s.gen) {
          landed(uid, sets, plan.deletes, null, stamps, ownIds);
          return;
        }
      }

      // Applied to the list as it is now: what was changed while the batch was on its way stays,
      // and is sent by the queue (the list it compares with is the merged one). Changed is told by
      // content, as changed() tells it, not by object: another tab's save re-reads the whole list,
      // every item a new object, and each item the plan dropped (deleted on another device, not
      // changed here) then counted as edited here and was added back — written by the next flush,
      // which took it off the account's deletion list: that deletion undone on every device
      // (SL-SYNC-FIRST-SYNC-SAVED-MEANWHILE).
      const current = store.items();
      const edited = new Map(diffLists(own, current).writes.map((x) => [x.id, x]));
      const removed = new Set(own.filter((x) => !current.some((c) => c.id === x.id)).map((x) => x.id));
      const result = plan.merged.filter((x) => !removed.has(x.id)).map((x) => edited.get(x.id) || x);
      const added = [...edited.values()].filter((x) => !result.some((r) => r.id === x.id));
      const next = [...result, ...added];

      const cloudVersions = {
        ...versionsOf(docs.filter((d) => !plan.deletes.includes(d.id))),
        ...Object.fromEntries(plan.deletes.map((id) => [id, DELETED])),
        ...versionsOf(sets),
      };
      const cloudRevs = {
        ...revsOf(docs.filter((d) => !plan.deletes.includes(d.id)), cloud.stamps),
        ...revsOfStamps(new Map(sets.map((x) => [x.id, stamps.get(x.id)]))),
      };
      // An item edited here while the sync read the cloud, whose merged copy is the cloud's: the edit was made on the copy
      // before it, which this browser has not seen. The record keeps what it had for it, so the edit's own write finds the
      // cloud's copy moved and this one changed, and keeps the older of the two as a conflict copy — claimed as seen, the
      // edit went over the cloud's copy with no trace.
      for (const id of edited.keys()) {
        if (sets.some((x) => x.id === id) || plan.deletes.includes(id) || !docs.some((d) => d.id === id)) continue;
        if (versions[id] > DELETED) {
          cloudVersions[id] = versions[id];
          if (Number.isFinite(baseRevs[id])) cloudRevs[id] = baseRevs[id];
          else delete cloudRevs[id];
          continue;
        }
        // Never seen here (the first visit's demo, a job from a file): the copy the edit was made on is the base, in no
        // cloud copy, so any copy the account has is a change after it.
        const was = own.find((x) => x.id === id);
        if (Number.isFinite(was?.updatedAt)) {
          cloudVersions[id] = was.updatedAt;
          cloudRevs[id] = 0;
        }
      }
      const { [uid]: _gone, ...stashed } = record.stashed;
      // The record names the account the list now belongs to: refused (storage full), every later
      // guard took the list for no account's — changes were never sent though the icon said
      // "synced", and at sign-out the account's list stayed for the next account to take in. Not
      // done then: the list is left as it was, and the first sync is tried again
      // (R5-HUNT9-SYNC-FIRST-SYNC-RECORD-WRITE-DROPPED).
      const written = { uid, versions: cloudVersions, revs: cloudRevs, device: deviceId(), order: plan.order, stashed };
      if (!meta.write(written) && meta.read().uid !== uid) {
        throw noRoom('this account\'s list could not be recorded');
      }
      s.prev = plan.merged;
      s.ready = true;
      s.readAt = now();
      s.attempts = 0;
      store.replace(next);
      // The merged list refused by storage (full): the record claims only what storage holds
      // (claimed) — a smaller write, which fits where the one before did.
      const onDisk = claimed(cloudVersions);
      if (Object.keys(onDisk).length < Object.keys(cloudVersions).length) meta.write({ ...written, versions: onDisk, revs: claimed(cloudRevs) });
      // The list the store holds now, which is `next` but for what it made addressable on taking it (a project given a
      // key of its own, a copy of one id): `next` queued the project as it was before, over the one that was kept.
      changed(store.items());
      // Both sides changed these since the last sync: the older copies are kept beside them, and said.
      if (joined.length || plan.conflicts.length) report.conflict?.([...joined, ...plan.conflicts.map((c) => store.label(plan.merged.find((x) => x.id === c.id)))]);
      if (!s.timer) settled();
    } catch (e) {
      if (gen !== s.gen) return;
      // The cloud's copies changed between the read and the write: decide again from what is there now.
      if (isStale(e)) {
        if (stale + 1 < STALE_TRIES) return firstSync(user, gen, again, stale + 1);
        failed(keptChanging(e), user, 'sync', []);
        return;
      }
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
    // The copy each deletion removed, as this browser had it: the flush checks the cloud has
    // nothing newer before deleting (R2-140).
    const was = new Map((s.prev || []).map((x) => [x.id, x]));
    s.prev = list;
    if (!writes.length && !deletes.length && !reordered) return;
    const q = s.queue || { writes: new Map(), deletes: new Map(), reordered: false };
    writes.forEach((x) => { q.writes.set(x.id, x); q.deletes.delete(x.id); });
    deletes.forEach((id) => { q.writes.delete(id); q.deletes.set(id, was.get(id)?.updatedAt); });
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
   * sync. So are the copies of the items it deletes: one another device changed later than the
   * copy deleted here was edited where the deletion was never seen, and that edit wins, as it does
   * at a first sync (collectionSyncPlan.planFirstSync, R2-029) — the item is not deleted from the
   * account but comes back here (R2-140). The batch is written only if those copies are still the
   * cloud's (collectionSyncIo.commit, `expect`): another device writing between the read and the
   * write sends the flush back to read again, up to STALE_TRIES times. Flushes go in the order they
   * were made (`s.turn`), each after the one before it has landed, so an older batch never lands
   * after a newer one and each reads what the one before wrote.
   */
  async function flush(user) {
    const q = s.queue;
    s.queue = null;
    s.timer = null;
    // Of the line it began in: a start (a refresh, going online, an account change) begins a new one, and what this
    // flush still has to do is dropped. The first sync that start runs decides from the cloud as it is then — and a
    // retry of this flush's older copy of an item, written after a newer one, put the older over it.
    const gen = s.gen;
    const current = () => s.user?.uid === user.uid && s.ready && s.gen === gen;
    if (!q || !current() || meta.read().uid !== user.uid) return;
    const before = s.turn;
    let handedOver;
    s.turn = new Promise((resolve) => { handedOver = resolve; });
    let sets = [];
    let queued = [];

    /** One read, decision and write of the queue; rejects with STALE when the cloud's copies changed in between. */
    async function send() {
      queued = sendable(user.uid, [...q.writes.values()]);
      // An id the cloud cannot name was never in it (an imported job held for it): nothing to
      // delete there. Read, its path was refused, and the flush — every other deletion with it —
      // stopped the sync (R5-HUNT8-SYNC-DELETE-REFUSED-ID-STOPS).
      const gone = [...q.deletes].filter(([id]) => cloudCanName(id));
      const reading = [...queued.map((x) => x.id), ...gone.map(([id]) => id)];
      const read = reading.length ? await withDeadline(io.readItems(user.uid, reading)) : { docs: [], stamps: new Map() };
      if (!current()) return;
      let docs = read.docs;
      const cloudStamps = new Map(read.stamps);
      // An item deleted here while its copy was being read — another tab's delete, taken through the
      // storage event: changed() queued its deletion — is not written back. The write would also come
      // off the account's deletion list (collectionSyncIo.commit), undoing that tab's deletion on
      // every device (SL-SYNC-FLUSH-WRITES-DELETED-ITEM). The list as it is now; one put back
      // meanwhile (Undo) is in it, and goes.
      const here = new Set(store.items().map((x) => x.id));
      queued = queued.filter((x) => here.has(x.id));
      const cloudCopy = new Map(docs.map((d) => [d.id, d]));
      const view = cloudView(cloudStamps);
      // The cloud's copy replaces this edit when it is later — unless nobody wrote it since this browser last saw
      // it: then this edit is the only change, and it goes whatever the clocks say (a device behind the
      // others stamps its edits earlier than the copy it was made on). Written by another device since and
      // this copy no different from the one the record holds (an Undo put it back): the cloud's copy, whatever the clocks say.
      const newer = queued.map((x) => {
        const d = cloudCopy.get(x.id);
        if (!d || !Number.isFinite(d.updatedAt)) return null;
        if (view.synced(x.id) || view.undone(x.id)) {
          if (!view.moved(x.id, d)) return null;
          if (!view.changed(x)) return store.fromCloud(d);
        }
        const theirs = store.fromCloud(d);
        // The first visit's demo, untouched, holds nothing typed: it never replaces an edit, whatever the clocks say.
        if (theirs && store.seed?.(theirs) && !store.seed?.(x)) return null;
        return view.later(x.id, d, x) ? theirs : null;
      }).filter(Boolean);
      const skip = new Set(newer.map((x) => x.id));
      const decidedOn = new Map(queued.map((x) => [x.id, x.updatedAt]));
      sets = queued.filter((x) => !skip.has(x.id));
      // Changed here AND in the cloud since this browser last saw the cloud's copy (its record, or
      // what it sent itself since): whichever is older would be dropped. Kept as a copy beside the
      // newer, and sent in the same batch.
      let copies = conflictCopies(queued, cloudCopy, docs, view);
      // A copy's id is one more document to look at: another device may hold it already (the same conflict found there, or
      // an edit with one time), and a copy written over it lost what it held. What is found there is taken into account —
      // the same content is the copy already made, another gets the next free id (freeId) — and what is not is expected
      // to be absent when the write lands (below).
      const looked = new Set(reading);
      for (let again = 0; copies.length && again < 3; again += 1) {
        const fresh = copies.map((c) => c.copy.id).filter((id) => !looked.has(id));
        if (!fresh.length) break;
        fresh.forEach((id) => looked.add(id));
        const there = await withDeadline(io.readItems(user.uid, fresh));
        if (!current()) return;
        if (!there.docs.length) break;
        docs = [...docs, ...there.docs];
        there.stamps.forEach((stamp, id) => cloudStamps.set(id, stamp));
        copies = conflictCopies(queued, cloudCopy, docs, view);
      }
      sets = [...sets, ...copies.map((c) => c.copy)];
      // Deleted here, but changed in the cloud since the copy this browser deleted: kept, and taken back.
      const edited = gone.map(([id, at]) => {
        const d = cloudCopy.get(id);
        if (!d || !Number.isFinite(d.updatedAt)) return null;
        return (view.synced(id) ? view.moved(id, d) : d.updatedAt > (at ?? 0)) ? store.fromCloud(d) : null;
      }).filter(Boolean);
      const kept = new Set(edited.map((x) => x.id));
      const deletes = gone.map(([id]) => id).filter((id) => !kept.has(id));
      // One put back here meanwhile (Undo while the batch was read) is in the list already, and
      // its own write is queued: it is not added a second time.
      const prev = copies.length ? placeCopies(s.prev || [], copies) : (s.prev || []);
      const lacking = (list) => edited.filter((x) => !list.some((y) => y.id === x.id));
      const stillHeld = new Set(edited.filter((x) => !lacking(prev).some((y) => y.id === x.id)).map((x) => x.id));
      // The order is sent when this flush changes it: a move, a deletion, an item the cloud lacks (a new one, a copy, one
      // brought back). An edit of items the cloud has changes nothing in it, and the order built from this browser's
      // list, possibly read long ago, put another device's move of those jobs back.
      const adds = queued.some((x) => !cloudCopy.has(x.id));
      const order = q.reordered || q.deletes.size || adds || copies.length || edited.length
        ? [...prev, ...lacking(prev)].map((x) => x.id) : null;
      const stamps = nextStamps(sets, cloudStamps, meta.read().revs, deviceId());
      // Written only if the copies it was decided from are still the cloud's.
      const toWrite = [...sets.map((x) => x.id), ...deletes];
      const expect = expectOf(toWrite, cloudStamps, [...reading, ...copies.map((c) => c.copy.id)]);
      const many = deletes.length > DELETE_CHUNK;
      if (many) {
        // More deletions than one request takes go first, in requests of their own (sendDeletes).
        const decided = sets;
        sets = []; // nothing of it is held should a deletion fail
        const all = await sendDeletes(user.uid, deletes, expect, current);
        sets = decided;
        if (!all) return;
      }
      await io.commit(user.uid, { sets, deletes: many ? [] : deletes, order, stamps, expect: many ? only(expect, sets.map((x) => x.id)) : expect });
      if (!current()) {
        landed(user.uid, sets, deletes, order, stamps, queued.map((x) => x.id));
        return;
      }
      noteSent(sets);
      if (copies.length) {
        // In the list before anything else changes it: the list the queue compares with has them too.
        s.prev = placeCopies(s.prev || [], copies);
        store.replace(placeCopies(store.items(), copies));
        report.conflict?.(copies.map((c) => c.name));
      }
      if (edited.length) {
        // At the end of the list, where the order just sent has them; the list the queue compares
        // with has them too, so they are not sent back as new.
        s.prev = [...(s.prev || []), ...lacking(s.prev || [])];
        store.replace([...store.items(), ...lacking(store.items())]);
      }
      // The cloud's copies the list does not hold after all: an edit typed while the batch read the cloud stays (below).
      let unseen = new Set();
      if (newer.length) {
        // Taken as the cloud has them: the list the queue compares with has them too, so they are not sent back.
        // An item edited here while the batch read the cloud is newer still: that edit stays, and its
        // own write is queued (taken over, it vanished here while the queue still sent it).
        // Only the copy the decision was made on is replaced (by its updatedAt, equal — not a clock: a copy put back by Undo, or queued
        // twice, is that copy and is replaced by the cloud's whatever it is stamped).
        const take = (x) => { const n = newer.find((y) => y.id === x.id); return n && x.updatedAt === decidedOn.get(x.id) ? n : x; };
        // That edit was made on the copy before the cloud's, which this browser has not seen: the record must not say
        // it has, or the queued write is the only change and goes over the other device's edit with no trace.
        unseen = new Set(store.items().filter((x) => decidedOn.has(x.id) && x.updatedAt !== decidedOn.get(x.id)
          && newer.some((y) => y.id === x.id)).map((x) => x.id));
        const list = store.items().map(take);
        s.prev = (s.prev || []).map(take);
        store.replace(list);
      }
      // The record claims the cloud's copy only for what the list holds: an item put back meanwhile (Undo) is still the older copy.
      const brought = edited.filter((x) => !stillHeld.has(x.id));
      const seenNow = newer.filter((x) => !unseen.has(x.id));
      noteVersions(user.uid, [...sets, ...seenNow, ...brought], deletes, order, { ...revsOf([...seenNow, ...brought], cloudStamps), ...revsOfStamps(stamps) });
      if (!s.timer) settled();
    }

    try {
      // Behind a flush that has not landed: a wait that ends in the deadline is a failure like any, tried again later.
      await withDeadline(before);
      for (let tries = 1; ; tries += 1) {
        if (!current()) return;
        try {
          await send();
          return;
        } catch (e) {
          if (!isStale(e)) throw e;
          if (tries >= STALE_TRIES) throw keptChanging(e);
        }
      }
    } catch (e) {
      if (s.user?.uid !== user.uid) return;
      // Several items refused together, or their read refused before any was sent (an id the cloud
      // cannot name): which one the cloud will not take is not known, and a first sync finds it.
      failed(e, user, 'flush', sets, sets.length > 1 || (!sets.length && queued.length > 0));
    } finally {
      handedOver();
    }
  }

  return { start, cancel, shown };
}
