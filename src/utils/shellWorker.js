// Registers the app shell's service worker (public/sw.js), so the app opens with no network once it was
// opened online. Kept tiny — it is on the start-up path — and lazy: it registers after the page has loaded,
// when the browser is idle, so it never competes with the first paint. Only a production build does
// (not `yarn dev`, not the e2e build), and only where the browser allows a worker: https, or localhost.
// A registration that fails removes whatever workers this site has (the kill switch, with /sw-kill and a
// self-unregistering sw.js; see public/sw.js). Plain parameters, so Node's test runner loads this file as it is.

/** Is this a page that may have the worker? `env` is Vite's import.meta.env. */
export function shouldRegister(env, where) {
  if (!env || !env.PROD || env.MODE !== 'production' || !where || !where.hasServiceWorker) return false;
  return where.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(where.hostname);
}

/** Removes every service worker registered for this site. */
export function unregisterAll(g = globalThis) {
  return Promise.resolve()
    .then(() => g.navigator.serviceWorker.getRegistrations())
    .then((all) => Promise.all(all.map((r) => r.unregister())))
    .catch(() => {});
}

/** Registers the worker once the page has loaded and the browser is idle; false (and nothing) where it may not. */
export function registerShellWorker(env, g = globalThis) {
  const where = { protocol: g.location?.protocol, hostname: g.location?.hostname, hasServiceWorker: !!g.navigator?.serviceWorker };
  if (!shouldRegister(env, where)) return false;
  const start = () => {
    try {
      g.navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => unregisterAll(g));
    } catch {
      unregisterAll(g);
    }
  };
  const later = () => (g.requestIdleCallback ? g.requestIdleCallback(start, { timeout: 5000 }) : g.setTimeout(start, 2000));
  if (g.document?.readyState === 'complete') later();
  else g.addEventListener('load', later, { once: true });
  return true;
}
