// A résumé the cloud will not take — over Firestore's 1 MiB document limit (a photo stored whole
// by a build before a4a1f85, or several large contact icons), or refused for good for another
// reason — is held: left out of every batch while it stays as it is, and tried again once it
// changes (the photo taken out, or made smaller by the store: smallerPhotos.js) or goes. Every
// other résumé keeps syncing. Until V2VF1S-0 one such résumé stopped the whole sync: each later
// change read the account again and re-sent it, no other résumé's edit reached the cloud until it
// was fixed, and a demo account's originals waited for an answer the account could give. Plain
// functions, no Firebase: the engine (cloudSyncEngine.js) runs them, and
// tests/pdf/18-cloud-sync-held.test.mjs runs the engine.
import { failureKind } from '@/utils/cloudSyncRetry';

/** Firestore's limit on one document, counted as docSize counts it. */
export const MAX_DOC_BYTES = 1_048_576;

const encoder = new TextEncoder();
const stringSize = (s) => encoder.encode(s).length + 1;

/**
 * The size Firestore counts for a value (firebase.google.com/docs/firestore/storage-size): a
 * string its UTF-8 bytes + 1, a number or a date 8, a boolean or null 1, an array the sum of its
 * values, a map the sum of its keys (as strings) and values. `undefined` counts nothing.
 */
export function storedSize(v) {
  if (v === null) return 1;
  if (typeof v === 'string') return stringSize(v);
  if (typeof v === 'number') return 8;
  if (typeof v === 'boolean') return 1;
  if (v instanceof Date) return 8;
  if (Array.isArray(v)) return v.reduce((n, x) => n + storedSize(x), 0);
  if (typeof v !== 'object') return 0;
  return Object.entries(v).reduce((n, [k, x]) => (x === undefined ? n : n + stringSize(k) + storedSize(x)), 0);
}

/** A document's size: its path's segments (as strings) + 16, its fields, and 32 more. */
export const docSize = (segments, data) => segments.reduce((n, seg) => n + stringSize(String(seg)), 16) + storedSize(data) + 32;

/**
 * The résumés held back from an account's sync, for one visit (id → the copy held), with the
 * engine's `io`, `report` (held([{ id, name }]) after each change of them: the icon names them),
 * `online` and `resumes()` (the store's now):
 *   sendable(uid, list)          `list` as the store holds it now (below), without the copies held;
 *                                one too large for a document is held first, and never sent
 *   commit(uid, plan, source, live)  io.commit, refused résumés held (commitHolding)
 *   hold(r), release(list)       let go of those changed or gone in `list`: tried again
 *   replaced(uid, list)          the copies held that `list` holds replaced in place and that now fit
 *                                in a document: let go, and returned to be sent (below)
 *   size, clear()
 * Replaced in place: the same version (`updatedAt`) as another object — the store made its photo
 * smaller (smallerPhotos.js, ONB-10), which is no edit, so neither the queue nor release sees it.
 * Held until then, a résumé over 1 MiB for a photo an older build stored whole waited for its next
 * edit or the next visit, and one queued before its photo was made smaller was sent (and held) as
 * it was queued.
 */
export function createHeld({ io = null, report = {}, online = () => true, resumes = () => [] } = {}) {
  const held = new Map();
  const isHeld = (r) => held.get(r.id) === r;
  const changed = () => report.held?.([...held.values()].map(({ id, name }) => ({ id, name })));
  function hold(r) {
    if (isHeld(r)) return;
    held.set(r.id, r);
    changed();
  }
  const api = {
    hold,
    get size() { return held.size; },
    commit: (uid, plan, source, live) => commitHolding(io, uid, plan, { held: api, source, resumes, online, live }),
    sendable(uid, list) {
      // The store's copy of the same version: one made smaller since the queue or the plan took it.
      // A copy with no time of its own (a cloud stub) has no version to match: it goes as it is.
      const now = new Map(resumes().map((r) => [r.id, r]));
      const current = (r) => {
        const c = now.get(r.id);
        return c && Number.isFinite(r.updatedAt) && c.updatedAt === r.updatedAt ? c : r;
      };
      return list.map(current).filter((r) => {
        if (isHeld(r)) return false;
        if (docSize(['users', uid, 'resumes', r.id], r) > MAX_DOC_BYTES) {
          hold(r);
          return false;
        }
        if (held.delete(r.id)) changed(); // an older copy held: this one goes
        return true;
      });
    },
    replaced(uid, list) {
      if (!held.size) return [];
      const again = [];
      for (const r of list) {
        const was = held.get(r.id);
        if (!was || was === r || !Number.isFinite(r.updatedAt) || was.updatedAt !== r.updatedAt) continue;
        held.set(r.id, r); // held as the store holds it, while it is still too large
        if (docSize(['users', uid, 'resumes', r.id], r) > MAX_DOC_BYTES) continue;
        held.delete(r.id);
        again.push(r);
      }
      if (again.length) changed();
      return again;
    },
    release(list) {
      const now = new Map(list.map((r) => [r.id, r.updatedAt]));
      const gone = [...held.values()].filter((r) => !now.has(r.id) || now.get(r.id) !== r.updatedAt);
      gone.forEach((r) => held.delete(r.id));
      if (gone.length) changed();
    },
    clear() {
      if (!held.size) return;
      held.clear();
      changed();
    },
  };
  return api;
}

const NOTHING = { sets: [], flags: [], marks: [], hardDeletes: [], listAdd: [] };

/**
 * io.commit(uid, plan) — and when the server refuses the batch for good (failureKind 'stop') and
 * it writes résumés, the batch is taken apart to find the one it will not take: its deletions go
 * on their own first, then each résumé on its own. Only what is unchanged since the plan was made
 * from `source` (the résumés then; `resumes()` → the store's now) is sent: a newer copy, or a
 * deletion or a restore made meanwhile, is on its way already and must not be undone. A résumé
 * refused on its own — or the batch's only one, once its deletions went through without it — is
 * held. Nothing more is sent once `live()` is false (signed out or started again since: that
 * account's next first sync sends it). Resolves to what got through; rejects on any other error,
 * or when the deletions are refused on their own: no résumé to hold, and the engine stops as
 * before.
 */
export async function commitHolding(io, uid, plan, { held, source, resumes, online, live = () => true }) {
  try {
    await io.commit(uid, plan);
    return plan;
  } catch (e) {
    if (!plan.sets.length || failureKind(e, online()) !== 'stop' || !live()) throw e;
  }
  const was = new Map(source.map((r) => [r.id, r.updatedAt]));
  const unchanged = (id) => {
    const now = resumes().find((r) => r.id === id);
    return now ? was.has(id) && was.get(id) === now.updatedAt : !was.has(id);
  };
  const keep = (ids = []) => ids.filter(unchanged);
  const rest = {
    ...NOTHING, flags: keep(plan.flags), marks: keep(plan.marks), hardDeletes: keep(plan.hardDeletes), listAdd: keep(plan.listAdd),
  };
  if (rest.flags.length || rest.hardDeletes.length || rest.listAdd.length) await io.commit(uid, rest);
  if (plan.sets.length === 1) {
    if (unchanged(plan.sets[0].id)) held.hold(plan.sets[0]);
    return rest;
  }
  const sets = [];
  for (const r of plan.sets) {
    if (!live()) break;
    if (!unchanged(r.id)) continue;
    try {
      await io.commit(uid, { ...NOTHING, sets: [r] });
      sets.push(r);
    } catch (e) {
      if (failureKind(e, online()) !== 'stop') throw e;
      held.hold(r);
    }
  }
  return { ...rest, sets };
}
