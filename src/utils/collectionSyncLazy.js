// The jobs' and the boards' sync engine, loaded when it is first needed instead of at start-up.
// The engine, its plan, its Firestore calls, its version rules and the conflict copies
// (collectionSync*.js) sat on the start-up path, which has a 1.1 MB cap (tests/pdf/71-startup-chunks),
// though a visitor who never signs in never runs any of it. This is the small piece that stays: it has
// createCollectionSync's calls (start, cancel, shown), keeps them in order until the engine's module
// has loaded, then makes the engine and hands them over, so the engine sees the calls it would have
// seen at start-up. The stores need nothing of it: a list edited before the engine is there is in the
// store, and the engine's first sync reads the store then, as it does for a list typed before signing in.
import { backoff } from './cloudSyncRetry.js';

/**
 * lazyCollectionSync(load) → a `create` for browserCloudSync (cloudSyncBrowser.js), taking the options
 * createCollectionSync takes plus:
 *   cloud     false when the build has no cloud (no Firebase keys): the engine would only say 'off', so it is never loaded
 * `load()` → a promise of the real `create` (a dynamic import of the engine's module).
 *
 * The engine is wanted by the first start(user) with a user. Signed out with nothing started, the engine would do
 * nothing but say 'idle', and is not loaded: a list leaves the browser at a sign-out only after a sign-in made the
 * engine in this page (collectionSyncEngine.start). From the first call that loads it on, every call is passed on in
 * the order it was made, a sign-in and a sign-out within the load included.
 *
 * A load that fails (offline, a chunk gone after a deploy) reports 'error' and is tried again after a pause, doubling
 * up to ten minutes, and when the tab is shown or the next start comes, as a sync that failed is.
 */
export function lazyCollectionSync(load, { retryDelay = 30000, maxRetryDelay = 600000 } = {}) {
  return (options) => {
    const { cloud = true, report = {}, log = () => {} } = options;
    const timers = options.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
    const status = (v) => report.status?.(v);
    let engine = null;
    let loading = false;
    let waiting = []; // [call, args] made since the first start with a user, until the engine takes them
    let retry = null;
    let attempts = 0;

    function fetchEngine() {
      if (loading || engine) return;
      loading = true;
      timers.clear(retry);
      const failed = (e) => {
        loading = false;
        log('The sync engine could not be loaded:', e?.message ?? e);
        status('error');
        retry = timers.set(fetchEngine, backoff(attempts++, retryDelay, maxRetryDelay));
      };
      Promise.resolve().then(load).then((create) => {
        // A module without the engine (a tab mixing two builds' files) is a failed load, not a crash later.
        if (typeof create !== 'function') { failed(new Error('the sync engine module has no createListSync')); return; }
        engine = create(options);
        loading = false;
        attempts = 0;
        const calls = waiting;
        waiting = [];
        for (const [name, args] of calls) engine[name](...args);
      }, failed);
    }

    return {
      start(user) {
        if (engine) { engine.start(user); return; }
        if (!cloud || (!user && !waiting.length)) {
          // What the engine would do: nothing but say so.
          status(user ? 'off' : 'idle');
          return;
        }
        waiting.push(['start', [user]]);
        fetchEngine();
      },
      cancel() {
        if (engine) engine.cancel();
        else if (waiting.length) waiting.push(['cancel', []]);
      },
      shown() {
        if (engine) engine.shown();
        else if (waiting.length) fetchEngine(); // a load that failed, tried again as the tab is shown
      },
    };
  };
}
