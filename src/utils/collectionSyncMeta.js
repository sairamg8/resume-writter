// What this browser keeps about a synced list (collectionSyncPlan.js) — the account it last synced
// with, the versions that account's cloud holds as last seen here, and what was kept aside for an
// account whose list left — under its own key, next to the list: `cpwtcv_jobs_sync_v1`,
// `cpwtcv_boards_sync_v1`. A browser that never synced has none, and its list is its own. The
// held-back notice (items the cloud will not take) lives here too, as a tiny store the board and
// job pages read.

/** Where each list's record lives. */
export const JOBS_SYNC_KEY = 'cpwtcv_jobs_sync_v1';
export const BOARDS_SYNC_KEY = 'cpwtcv_boards_sync_v1';

const empty = () => ({ uid: null, versions: {}, stashed: {} });
const isMap = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));

/**
 * The record under `key` as { read() → { uid, versions, stashed }, write(meta) }: what cannot be
 * read is an empty record (the list then joins the next account's, and nothing is lost); a write
 * storage refuses is dropped — the next sync finds more to send, never less.
 */
export function localMeta(key, storage = () => globalThis.localStorage) {
  return {
    read() {
      try {
        const saved = JSON.parse(storage()?.getItem(key) ?? 'null');
        if (!isMap(saved)) return empty();
        return {
          uid: typeof saved.uid === 'string' && saved.uid ? saved.uid : null,
          versions: isMap(saved.versions) ? saved.versions : {},
          stashed: isMap(saved.stashed) ? saved.stashed : {},
        };
      } catch {
        return empty();
      }
    },
    write(meta) {
      try {
        storage()?.setItem(key, JSON.stringify(meta));
      } catch {
        // Full or blocked: see above.
      }
    },
  };
}

/**
 * The list under `key`'s sync record forgets which items the cloud holds, keeping the account and
 * what was kept aside: called when the saved list could not be read in full. Without it, every
 * item left out looked deleted here, and the next first sync deleted it from the account — and so
 * from every other device. Forgotten, the first sync merges instead: the cloud's copies come back.
 */
export function forgetSynced(key, storage) {
  const record = localMeta(key, storage);
  const m = record.read();
  if (Object.keys(m.versions).length) record.write({ ...m, versions: {} });
}

/** A record in memory, for a test or a page with no storage. */
export function memoryMeta(start = empty()) {
  let meta = start;
  return { read: () => meta, write: (next) => { meta = next; } };
}

/**
 * The items of each list the cloud will not take (too large for a document, or refused for good):
 * `{ jobs: [{ id, name }], boards: [...] }`, as a store the pages subscribe to (useSyncHeld).
 */
let held = { jobs: [], boards: [] };
const listeners = new Set();

export const syncHeld = {
  get: () => held,
  set(name, list) {
    held = { ...held, [name]: list };
    listeners.forEach((l) => l());
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
