// A Firestore stand-in for the cloud-sync tests: the SDK functions cloudSyncIo.js calls
// (collection, doc, getDocs, getDoc, writeBatch, …) over an in-memory map of document paths, plus
// the timers, store and report the sync engine needs. The tests then run the app's own io,
// engine, store updaters and demo restore — nothing here re-implements what they decide.
//
// A batch is applied when commit() is CALLED — the order in which the server receives one
// client's batches — and commit()'s promise settles when the test lets it (`cloud.hold`), as the
// server's acknowledgement does. A read can be held or failed the same way; `cloud.afterRead`
// runs once a read has its answer (another device writing before this one's batch), and
// `cloud.goOffline()` makes getDocs/getDoc answer from a stale cache, as the SDK does when it
// cannot reach the server, while getDocsFromServer/getDocFromServer fail. Set `cloud.auth` to the
// signed-in uid (null: nobody) and the security rules apply: another account's documents are
// permission-denied, as firestore.rules has it. `cloud.refuse` refuses chosen batches, as the
// server refuses one writing a document over 1 MiB. As the SDK, set() throws on a value holding
// `undefined` (invalid-argument).

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Does `v` hold `undefined` anywhere — a field, or an item of a list? */
const holdsUndefined = (v) => v === undefined
  || (Array.isArray(v) ? v.some(holdsUndefined) : Boolean(v) && typeof v === 'object' && Object.values(v).some(holdsUndefined));
/**
 * What the SDK throws, synchronously, from set() given a value with `undefined` in it — the app's
 * Firestore is not created with ignoreUndefinedProperties. The fake used to drop such fields as it
 * cloned them, so no test saw a résumé the real server would never take.
 */
const undefinedField = (path) => Object.assign(new Error(`Function WriteBatch.set() called with invalid data. Unsupported field value: undefined (found in document ${path})`), { code: 'invalid-argument' });
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
 * `docs`: { path: data } to start with. Returns { fs, db, data, commits, reads, hold, fail,
 * refuse, refused, afterRead, goOffline(), doc(path), resumes(uid) }: `hold.read` / `hold.commit`
 * = a promise the next reads / commits wait for; `fail.read` / `fail.commit` = an error they throw
 * instead (cleared by the test); `refuse` = (ops) → the error the server refuses that batch with,
 * or null — held by `hold.commit` like an acknowledgement; `refused` = the batches refused;
 * `reads` = the paths read, in order.
 */
export function fakeFirestore(docs = {}) {
  const data = new Map(Object.entries(docs).map(([p, v]) => [p, clone(v)]));
  const commits = [];
  const refused = [];
  const reads = [];
  const hold = { read: null, commit: null };
  const fail = { read: null, commit: null };
  const db = { fake: true };
  let cache = null; // set by goOffline(): what the SDK's cache holds

  const snapFrom = (source, fromCache) => (path) => {
    const value = source.get(path);
    return { id: path.split('/').at(-1), exists: () => value !== undefined, data: () => clone(value), metadata: { fromCache } };
  };
  const unavailable = () => Object.assign(new Error('Failed to get documents from server. (However, these documents may exist in the local cache.)'), { code: 'unavailable' });
  const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const allowed = (path) => api.auth === undefined || (api.auth !== null && path.startsWith(`users/${api.auth}/`));
  async function read(path, get, { server = false } = {}) {
    reads.push(path);
    if (!allowed(path)) throw denied();
    if (fail.read) throw fail.read;
    if (hold.read) await hold.read;
    if (fail.read) throw fail.read;
    if (cache && server) throw unavailable();
    const answer = get(cache ? snapFrom(cache, true) : snapFrom(data, false), cache || data);
    api.afterRead?.(path);
    return answer;
  }
  const queryDocs = (col) => (snap, source) => ({
    docs: [...source.keys()].filter((p) => p.slice(0, p.lastIndexOf('/')) === col.path).map(snap),
    metadata: { fromCache: Boolean(cache) },
  });
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
    getDocs: (col) => read(col.path, queryDocs(col)),
    getDoc: (ref) => read(ref.path, (snap) => snap(ref.path)),
    getDocsFromServer: (col) => read(col.path, queryDocs(col), { server: true }),
    getDocFromServer: (ref) => read(ref.path, (snap) => snap(ref.path), { server: true }),
    arrayUnion: (...items) => ({ __transform: 'union', items }),
    arrayRemove: (...items) => ({ __transform: 'remove', items }),
    writeBatch: () => {
      const ops = [];
      return {
        set(ref, value, options) {
          if (holdsUndefined(value)) throw undefinedField(ref.path);
          ops.push(['set', ref.path, clone(value), options]);
        },
        delete(ref) { ops.push(['delete', ref.path]); },
        commit() {
          if (ops.some(([, path]) => !allowed(path))) return Promise.reject(denied());
          if (fail.commit) return Promise.reject(fail.commit);
          const ack = hold.commit;
          const refusal = api.refuse?.(ops);
          if (refusal) {
            refused.push(ops);
            return ack ? ack.then(() => { throw refusal; }) : Promise.reject(refusal);
          }
          ops.forEach(apply);
          commits.push(ops);
          return ack ? ack.then(() => undefined) : Promise.resolve();
        },
      };
    },
  };
  const api = {
    fs, db, data, commits, reads, hold, fail, refused,
    refuse: null,
    afterRead: null,
    auth: undefined,
    /** From now on the server cannot be reached; the cache holds the account as it is now. */
    goOffline() { cache = new Map([...data].map(([p, v]) => [p, clone(v)])); },
    doc: (path) => clone(data.get(path)),
    /** The account's résumé documents by id, e.g. { resume_a: {...} }. */
    resumes: (uid) => Object.fromEntries([...data].filter(([p]) => p.startsWith(`users/${uid}/resumes/`))
      .map(([p, v]) => [p.split('/').at(-1), clone(v)])),
  };
  return api;
}

/**
 * Timers the test fires by hand: `fire()` runs every one due, then lets the promises settle;
 * `delays` are the pauses (ms) the waiting ones were set for, in the order they were set.
 */
export function manualTimers() {
  const due = new Map();
  let next = 1;
  return {
    set(fn, ms) { const id = next; next += 1; due.set(id, { fn, ms }); return id; },
    clear(id) { due.delete(id); },
    get count() { return due.size; },
    get delays() { return [...due.values()].map((t) => t.ms); },
    async fire() {
      const fns = [...due.values()].map((t) => t.fn);
      due.clear();
      fns.forEach((fn) => fn());
      await settle();
    },
  };
}

/**
 * What the engine reports, as the React state it would set: { status, account, synced, held } —
 * and `waiting`, the demo restore's (useDemoSeed's) "the originals come back once the cloud answers".
 */
export function recorder() {
  const seen = { status: 'idle', statuses: [], account: null, synced: null, held: [], waiting: false };
  return {
    seen,
    report: {
      status: (v) => { seen.status = v; seen.statuses.push(v); },
      account: (v) => { seen.account = v; },
      synced: (v) => { seen.synced = v; },
      held: (v) => { seen.held = v; },
    },
  };
}

/**
 * The app's sync modules, loaded through the harness's `loadModule` (Vite SSR, so `@/` imports
 * work): the Firestore calls, the engine, the plans, the store's updaters and the demo restore.
 */
export async function syncModules(loadModule) {
  return {
    io: await loadModule('/src/utils/cloudSyncIo.js'),
    engine: await loadModule('/src/utils/cloudSyncEngine.js'),
    plan: await loadModule('/src/utils/cloudSyncPlan.js'),
    actions: await loadModule('/src/hooks/useResumeSyncActions.js'),
    restore: await loadModule('/src/utils/demoRestore.js'),
  };
}

/**
 * The résumé store the engine talks to, holding `state`, with the store's own updaters
 * (src/hooks/useResumeSyncActions.js, as useResumeStore makes them): Delete, restoreResumes,
 * applyCloudSync, forgetDeletions. `store.now` (ms) stands in for the clock of a deletion.
 * `onChange` runs after every change, a turn later — as React runs the effects after the render;
 * an updater that returns the state unchanged changes nothing, as with React.
 */
export function fakeStore(state, mods) {
  const store = {
    state: { deletedIds: [], ...state },
    now: null,
    onChange: () => {},
    getState: () => store.state,
    set(next) {
      store.state = next;
      queueMicrotask(() => store.onChange());
    },
  };
  const setAppState = (update) => { const next = update(store.state); if (next !== store.state) store.set(next); };
  return Object.assign(store, mods.actions.createSyncActions(setAppState, () => store.now ?? Date.now()));
}

/**
 * A page: the app's sync engine (`mods.engine`) with its Firestore calls (`mods.io`) over `cloud`
 * (null: a build with no cloud)
 * and `state` in its store, wired as useCloudSync wires them (liveStore; `hidden` () → whether the
 * tab is hidden); with `demo`
 * ({ accounts, ownerResume?, now? }) also the demo restore, run after every change as
 * useDemoSeed runs it; with `ownTimers` the engine's default timers, as the app runs it; with `now`
 * (() → ms) the engine's clock. `page.sync.start(user)` signs in; `page.change(next)` changes the store as
 * a click would, `page.remove(id)` deletes a résumé — the effects run after each, as React's would.
 */
export function syncPage(mods, cloud, state, { isDemo = () => false, online = () => true, hidden = () => false, demo = null, ownTimers = false, now } = {}) {
  const store = fakeStore(state, mods);
  // ownTimers: none passed in, as useCloudSync passes none — the engine then uses its own default.
  const timers = ownTimers ? undefined : manualTimers();
  const { seen, report } = recorder();
  const restore = demo ? mods.restore.createDemoRestore({ ...demo, onWaiting: (v) => { seen.waiting = v; } }) : null;
  let user = null;
  // useDemoSeed's effect: after a render that changed the user, the account or the résumés.
  let last = {};
  const render = () => {
    const deps = { user, account: seen.account, resumes: store.state.resumes };
    if (!restore || Object.keys(deps).every((k) => deps[k] === last[k])) return;
    last = deps;
    restore.update({ user, account: seen.account, appState: store.state, sync, store });
  };
  const onAccount = report.account;
  report.account = (a) => { onAccount(a); queueMicrotask(render); };
  const sync = mods.engine.createCloudSync({
    io: cloud ? mods.io.cloudIo(cloud.fs, cloud.db) : null, store: mods.actions.liveStore(() => ({ appState: store.state, store })),
    report, isDemo, online, hidden, timers, now,
  });
  const start = sync.start;
  sync.start = (u) => { user = u || null; start(u); queueMicrotask(render); };
  store.onChange = () => { sync.resumesChanged(store.state.resumes); render(); };
  const change = async (next) => { store.set({ ...store.state, ...next }); await settle(1); };
  // Delete, as the dashboard calls it: with the account signed in (V2W1a-3).
  const remove = async (id) => { store.deleteResume(id, user?.uid); await settle(1); };
  const restoreList = async (list) => { store.restoreResumes(list); await settle(1); };
  return { store, timers, seen, sync, change, remove, restore: restoreList };
}
