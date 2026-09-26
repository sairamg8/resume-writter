// A page's code, loaded when its route first opens (AppRoutes.jsx, R2-142). Each page is a file the
// build names by its content (Editor-<hash>.js), and a deploy replaces the site's files: a tab opened
// before the deploy asks for a file that is gone. The import fails, and React.lazy keeps that failure
// for good — the ErrorBoundary's Try Again and Back fail again — so the editor stayed out of reach
// until the person thought to reload. Now the first such failure reloads the page once, onto the new
// build's files; a second failure in a row, or one with no network, shows the ErrorBoundary as any
// crash does (a reload loop helps nobody, and offline a reload loses the page). Relative imports
// only, so Node's test runner loads this file as it is.

/** The session key that marks "reloaded once for a page's code". */
export const RELOADED_KEY = 'cpwtcv_chunk_reload';

const browser = () => ({
  storage: globalThis.sessionStorage,
  online: globalThis.navigator?.onLine !== false,
  reload: () => globalThis.location?.reload(),
});

/**
 * `load()` (an import()) as React.lazy wants it: `{ default: <its export name> }`. A load that fails is
 * retried by one reload of the page (`env.reload`), unless this session already did, or the browser
 * is offline, or its session storage cannot be written — then it fails as before. While the page
 * reloads the promise never settles, so the route shows its loading state, not an error.
 */
export function loadPage(load, name, env = browser()) {
  return load().then((m) => {
    try { env.storage?.removeItem(RELOADED_KEY); } catch { /* no storage: nothing to clear */ }
    return { default: m[name] };
  }, (error) => {
    let first = false;
    try {
      first = !env.storage.getItem(RELOADED_KEY);
      if (first) env.storage.setItem(RELOADED_KEY, '1');
    } catch {
      first = false; // no storage: a reload could not tell it had happened, and might loop
    }
    if (first && env.online) {
      env.reload();
      return new Promise(() => {});
    }
    throw error;
  });
}
