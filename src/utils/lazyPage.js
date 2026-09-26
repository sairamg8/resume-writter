// A page's code, loaded when its route first opens (AppRoutes.jsx, R2-142). Each page is a file the
// build names by its content (Editor-<hash>.js), and a deploy replaces the site's files: a tab opened
// before the deploy asks for a file that is gone. The import fails, and React.lazy keeps that failure
// for good — the ErrorBoundary's Try Again and Back fail again — so the editor stayed out of reach
// until the person thought to reload. Now the first such failure reloads the page once, onto the new
// build's files; a second failure in a row, or one with no network, shows the ErrorBoundary as any
// crash does (a reload loop helps nobody, and offline a reload loses the page). Relative imports
// only, so Node's test runner loads this file as it is.

/** The session key that marks "reloaded once for a page's code": the names of the pages that did. */
export const RELOADED_KEY = 'cpwtcv_chunk_reload';

const browser = () => ({
  storage: globalThis.sessionStorage,
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
  return load().then((m) => {
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
