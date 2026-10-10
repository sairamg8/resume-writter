// A page's code, loaded when its route first opens (AppRoutes.jsx, R2-142). Each page is a file the
// build names by its content (Editor-<hash>.js), and a deploy replaces the site's files: a tab opened
// before the deploy asks for a file that is gone. The import fails, and React.lazy keeps that failure
// for good — the ErrorBoundary's Try Again and Back fail again — so the editor stayed out of reach
// until the person thought to reload. Now the first such failure reloads the page once, onto the new
// build's files; a second failure in a row, or one with no network, shows the ErrorBoundary as any
// crash does (a reload loop helps nobody, and offline a reload loses the page). Relative imports
// only (and React), so Node's test runner loads this file as it is.
import { createElement, lazy, useState } from 'react';

/** The session key that marks "reloaded once for a page's code": the names of the pages that did. */
export const RELOADED_KEY = 'cpwtcv_chunk_reload';

/**
 * Is `x` something React can draw as an element type: a function or class component, or a memo/forwardRef
 * object? A lazy that resolves to `{ default: undefined }` reaches React as "Element type is invalid"
 * (error #306 in a production build), so every lazy here checks what its module gave before it hands it on.
 */
export const isComponent = (x) => typeof x === 'function' || (typeof x === 'object' && x !== null && '$$typeof' in x);

/**
 * `m`'s `name` export as a component, or a thrown Error that names the file's export: a module that loaded
 * but lacks it (a tab mixing the files of two builds, or a page whose export was renamed) is a failed load.
 * `name` 'default' is the module's default export.
 */
export function componentOf(m, name, what = name) {
  const x = m?.[name];
  if (!isComponent(x)) throw new Error(`The ${what} loaded without its "${name}" export (the page's files may be from two versions of the app): reload the page.`);
  return x;
}

const browser = () => ({
  // Read where it is used, inside the callers' try blocks: a browser that blocks site data throws
  // SecurityError from the property read itself, and read here it made every page's load throw.
  get storage() { return globalThis.sessionStorage; },
  online: globalThis.navigator?.onLine !== false,
  reload: () => globalThis.location?.reload(),
});

/** The pages that reloaded the tab this session (an older build's '1', or anything else, names none). */
function reloadedPages(storage) {
  const raw = storage.getItem(RELOADED_KEY); // storage that cannot be read throws, to the caller
  try {
    const pages = JSON.parse(raw);
    return Array.isArray(pages) ? pages : [];
  } catch {
    return [];
  }
}

/**
 * `load()` (an import()) as React.lazy wants it: `{ default: <its export name> }`. A load that fails is
 * retried by one reload of the page (`env.reload`), unless this session already did for that page, or
 * the browser is offline, or its session storage cannot be written — then it fails as before. While
 * the page reloads the promise never settles, so the route shows its loading state, not an error.
 *
 * Each page keeps its own mark, cleared only by its own load (R4-APP-05): a workspace page loads after
 * its shell (WorkspaceRoute, a lazy layout route), and with one mark that any load cleared, the shell
 * cleared it after every reload and a page whose file failed on every load reloaded the tab for good.
 */
export function loadPage(load, name, env = browser()) {
  // A module that loaded without the page's export is a failed load like a file that did not arrive: it
  // takes the reload-once path below, then the ErrorBoundary, and never reaches React as `undefined`.
  return load().then((m) => { componentOf(m, name, `${name} page`); return m; }).then((m) => {
    try {
      const pages = reloadedPages(env.storage);
      if (pages.includes(name)) {
        const rest = pages.filter((page) => page !== name);
        if (rest.length) env.storage.setItem(RELOADED_KEY, JSON.stringify(rest));
        else env.storage.removeItem(RELOADED_KEY);
      } else if (!pages.length && env.storage.getItem(RELOADED_KEY) !== null) {
        env.storage.removeItem(RELOADED_KEY); // an older build's mark
      }
    } catch { /* no storage: nothing to clear */ }
    return { default: m[name] };
  }, (error) => {
    if (!env.online) throw error; // offline a reload loses the page, and marks nothing
    let first = false;
    try {
      const pages = reloadedPages(env.storage);
      first = !pages.includes(name);
      if (first) env.storage.setItem(RELOADED_KEY, JSON.stringify([...pages, name]));
    } catch {
      first = false; // no storage: a reload could not tell it had happened, and might loop
    }
    if (first) {
      env.reload();
      return new Promise(() => {});
    }
    throw error;
  });
}

/** How many crash screens an error boundary has put up: a page that failed is asked for again once one was shown. */
let crashes = 0;
/** For ErrorBoundary: it has just put its crash screen up. */
export const crashShown = () => { crashes += 1; };

/**
 * A route's page as a component: React.lazy over loadPage, that tries its file again after a failure. A lazy
 * keeps a failed load for good, so a page whose file could not be fetched (offline, a flaky connection) stayed
 * on the crash screen, with Try Again and every link back to it failing too, until the tab was reloaded. Now
 * the next time the page mounts after its failure was shown (Try Again, or the route left and opened again)
 * it asks for its file anew; so does a mount `staleMs` after a failure nobody saw. Never straight after the
 * failure: React renders the page again at once to see whether the error was a fluke, and a page that asked
 * again for each of those would load, fail and load again in a loop no one sees, before the error showed.
 * `env` is loadPage's.
 */
export function lazyPage(load, name, env, { staleMs = 3000, now = Date.now } = {}) {
  let Inner;
  let failure = null; // when the last load failed, and how many crash screens had been shown by then
  const fresh = () => lazy(() => loadPage(load, name, env).catch((error) => {
    failure = { crashes, at: now() };
    throw error;
  }));
  Inner = fresh();
  // One lazy per mount (a state initializer, so StrictMode's second call gets the same one back).
  const take = () => {
    if (failure && (crashes > failure.crashes || now() - failure.at >= staleMs)) {
      Inner = fresh();
      failure = null;
    }
    return Inner;
  };
  return function Page(props) {
    const [Loaded] = useState(take);
    return createElement(Loaded, props);
  };
}
