// A Firestore stand-in for the cloud-sync tests: the SDK functions cloudSyncIo.js calls
// (collection, doc, getDocs, getDoc, writeBatch, …) over an in-memory map of document paths, plus
// the timers, store and report the sync engine needs. The tests then run the app's own io,
// engine and store rules — nothing here re-implements what they decide.
//
// A batch is applied when commit() is CALLED — the order in which the server receives one
// client's batches — and commit()'s promise settles when the test lets it (`cloud.hold`), as the
// server's acknowledgement does. A read can be held or failed the same way.

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export const resumePath = (uid, id) => `users/${uid}/resumes/${id}`;
export const listPath = (uid) => `users/${uid}/meta/deletions`;

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Let every pending promise callback run (a few macrotask turns). */
export async function settle(turns = 5) {
  for (let i = 0; i < turns; i += 1) await new Promise((r) => { setImmediate(r); });
}

/**
 * `docs`: { path: data } to start with. Returns { fs, db, data, commits, hold, fail, doc(path),
 * resumes(uid) }: `hold.read` / `hold.commit` = a promise the next reads / commits wait for;
 * `fail.read` / `fail.commit` = an error they throw instead (cleared by the test).
 */
export function fakeFirestore(docs = {}) {
  const data = new Map(Object.entries(docs).map(([p, v]) => [p, clone(v)]));
  const commits = [];
  const hold = { read: null, commit: null };
  const fail = { read: null, commit: null };
  const db = { fake: true };

  const snap = (path) => {
    const value = data.get(path);
    return { id: path.split('/').at(-1), exists: () => value !== undefined, data: () => clone(value), metadata: { fromCache: false } };
  };
  async function read(get) {
    if (fail.read) throw fail.read;
    if (hold.read) await hold.read;
    if (fail.read) throw fail.read;
    return get();
  }
  const transform = (current, value) => {
    if (!value || typeof value !== 'object' || !value.__transform) return clone(value);
    const list = Array.isArray(current) ? current : [];
    if (value.__transform === 'union') return [...list, ...value.items.filter((v) => !list.includes(v))];
    return list.filter((v) => !value.items.includes(v));
  };
  function apply([op, path, value, options]) {
    if (op === 'delete') { data.delete(path); return; }
    const base = options?.merge ? (data.get(path) || {}) : {};
    const next = { ...base };
    for (const [k, v] of Object.entries(value)) next[k] = transform(base[k], v);
    data.set(path, next);
  }

  const fs = {
    collection: (_db, ...segs) => ({ path: segs.join('/') }),
    doc: (_db, ...segs) => ({ path: segs.join('/'), id: segs.at(-1) }),
    getDocs: (col) => read(() => ({
      docs: [...data.keys()].filter((p) => p.slice(0, p.lastIndexOf('/')) === col.path).map(snap),
      metadata: { fromCache: false },
    })),
    getDoc: (ref) => read(() => snap(ref.path)),
    arrayUnion: (...items) => ({ __transform: 'union', items }),
    arrayRemove: (...items) => ({ __transform: 'remove', items }),
    writeBatch: () => {
      const ops = [];
      return {
        set(ref, value, options) { ops.push(['set', ref.path, clone(value), options]); },
        delete(ref) { ops.push(['delete', ref.path]); },
        commit() {
          if (fail.commit) return Promise.reject(fail.commit);
          ops.forEach(apply);
          commits.push(ops);
          const ack = hold.commit;
          return ack ? ack.then(() => undefined) : Promise.resolve();
        },
      };
    },
  };
  fs.getDocsFromServer = fs.getDocs;
  fs.getDocFromServer = fs.getDoc;

  return {
    fs, db, data, commits, hold, fail,
    doc: (path) => clone(data.get(path)),
    /** The account's résumé documents by id, e.g. { resume_a: {...} }. */
    resumes: (uid) => Object.fromEntries([...data].filter(([p]) => p.startsWith(`users/${uid}/resumes/`))
      .map(([p, v]) => [p.split('/').at(-1), clone(v)])),
  };
}

/** Timers the test fires by hand: `fire()` runs every one due, then lets the promises settle. */
export function manualTimers() {
  const due = new Map();
  let next = 1;
  return {
    set(fn) { const id = next; next += 1; due.set(id, fn); return id; },
    clear(id) { due.delete(id); },
    get count() { return due.size; },
    async fire() {
      const fns = [...due.values()];
      due.clear();
      fns.forEach((fn) => fn());
      await settle();
    },
  };
}

/** What the engine reports, as the React state it would set: { status, account, synced }. */
export function recorder() {
  const seen = { status: 'idle', statuses: [], account: null, synced: null };
  return {
    seen,
    report: {
      status: (v) => { seen.status = v; seen.statuses.push(v); },
      account: (v) => { seen.account = v; },
      synced: (v) => { seen.synced = v; },
    },
  };
}

/**
 * The résumé store the engine talks to, holding `state`: what the app's store does after a first
 * sync (loadResumes: the list replaced, the deletions forgotten).
 */
export function fakeStore(state) {
  const store = {
    state: { deletedIds: [], ...state },
    getState: () => store.state,
    loadResumes(list) { store.state = { ...store.state, resumes: list, deletedIds: [], deletedInfo: {} }; },
  };
  return store;
}

/**
 * A page: the app's sync engine (`mods.engine`) with its Firestore calls (`mods.io`) over `cloud`,
 * and `state` in its store. `page.sync.start(user)` signs in; `page.change(next)` changes the
 * store as a click would, and runs the watcher as React would after it.
 */
export function syncPage(mods, cloud, state, { isDemo = () => false, online = () => true } = {}) {
  const store = fakeStore(state);
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = mods.engine.createCloudSync({ io: mods.io.cloudIo(cloud.fs, cloud.db), store, report, isDemo, online, timers });
  const change = (next) => { store.state = { ...store.state, ...next }; sync.resumesChanged(store.state.resumes); };
  return { store, timers, seen, sync, change };
}
