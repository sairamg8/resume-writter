/*
 * The app shell's service worker: CPWT-CV opens with no network once it has been opened online.
 *
 * Small on purpose, and safe to ship — what it does and, as much, what it never does:
 *  - A page (navigation) is NETWORK-FIRST: the network's index.html is always what opens, so a deploy shows
 *    at once and a stale page is never served while the site is up. The copy kept under SHELL is used only
 *    when the network cannot be reached at all.
 *  - A built file (/assets/<name>-<hash>.<ext>, named by its content, so it never changes) is CACHE-FIRST.
 *  - Nothing else is touched: no other path of this site, no other origin (Firebase Auth, Firestore, the
 *    Google sign-in, jsDelivr fonts), no request but a GET, no /__/ path (Firebase's hosted sign-in
 *    handler), no Range request. Those go to the network as if there were no worker.
 *  - A response is kept only if it is a plain 200 from this site, not a redirect, and is the right kind: HTML
 *    for the shell, not HTML for an asset (this site answers a path that is no file with index.html, 200).
 *  - The cache name carries the build (vite.config.js stamps BUILD with a hash of the build's files), so every
 *    deploy is a new worker with a new cache, and activation deletes the old ones.
 *  - skipWaiting and clients.claim are safe here: the worker holds no state the pages depend on, serves
 *    nothing stale (HTML from the network, assets by content hash), and speaks no messages.
 *  - Kill switch: if /sw-kill exists on the site (any file that is not HTML; the site answers a missing path
 *    with index.html), the worker deletes its caches and unregisters itself, at activation and at most every
 *    10 minutes on a page load. Deploying a sw.js that unregisters itself does the same. The page also
 *    unregisters everything if registering fails (src/utils/shellWorker.js).
 *
 * The decisions are plain functions, exposed as globalThis.__cpwtShell so tests/unit can import this file in
 * Node (tests/unit/562-n2-sw-routing.unit.mjs); the worker's listeners are added only inside a service worker.
 */
(function () {
  'use strict';

  var BUILD = '__BUILD_ID__';
  var PREFIX = 'cpwtcv-shell-';
  var CACHE = PREFIX + BUILD;
  var SHELL = '/index.html';
  var KILL = '/sw-kill';
  var KILL_EVERY_MS = 10 * 60 * 1000;
  var ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;

  /**
   * What to do with a request: 'navigate' (network first, the shell offline), 'asset' (cache first) or null
   * (leave it to the browser). `req` is { method, url, mode, range }; `origin` is this site's.
   */
  function route(req, origin) {
    if (!req || req.method !== 'GET' || req.range) return null;
    var url;
    try { url = new URL(req.url, origin); } catch (e) { return null; }
    if (url.origin !== origin) return null;
    var path = url.pathname;
    if (path === '/__' || path.indexOf('/__/') === 0) return null;
    if (req.mode === 'navigate') {
      return path === '/index.html' || !/\.[A-Za-z0-9]+$/.test(path) ? 'navigate' : null;
    }
    return ASSET.test(path) ? 'asset' : null;
  }

  /** Is `res` one to keep, as kind 'navigate' (HTML) or 'asset' (anything but HTML)? */
  function cacheable(res, kind) {
    if (!res || res.status !== 200 || !res.ok || res.type !== 'basic' || res.redirected) return false;
    var html = /text\/html/i.test((res.headers && res.headers.get('content-type')) || '');
    return kind === 'navigate' ? html : !html;
  }

  /** The built files an HTML page names (its scripts, preloads and stylesheets), once each. */
  function assetUrls(html) {
    var out = [];
    var re = /\b(?:src|href)\s*=\s*["'](\/assets\/[^"'?#]+)["']/g;
    var m;
    while ((m = re.exec(String(html))) !== null) if (out.indexOf(m[1]) < 0 && ASSET.test(m[1])) out.push(m[1]);
    return out;
  }

  /** Does the answer to a request for KILL mean "switch off"? A real file, not the site's index.html fallback. */
  function killAnswer(res) {
    return !!res && res.status === 200 && res.ok && !/text\/html/i.test((res.headers && res.headers.get('content-type')) || '');
  }

  var api = { BUILD: BUILD, PREFIX: PREFIX, CACHE: CACHE, SHELL: SHELL, KILL: KILL, KILL_EVERY_MS: KILL_EVERY_MS, route: route, cacheable: cacheable, assetUrls: assetUrls, killAnswer: killAnswer };
  globalThis.__cpwtShell = api;

  if (typeof ServiceWorkerGlobalScope === 'undefined' || !(self instanceof ServiceWorkerGlobalScope)) return;

  var killed = false;
  var lastKillCheck = 0;

  function killRequested() {
    return fetch(KILL, { cache: 'no-store' }).then(killAnswer, function () { return false; });
  }

  function switchOff() {
    killed = true;
    return caches.keys()
      .then(function (names) {
        return Promise.all(names.filter(function (n) { return n.indexOf(PREFIX) === 0; }).map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.registration.unregister(); })
      .catch(function () {});
  }

  /** Asks for KILL (at most every KILL_EVERY_MS unless `force`) and switches off if it is there. */
  function checkKill(force) {
    var now = Date.now();
    if (killed || (!force && now - lastKillCheck < KILL_EVERY_MS)) return Promise.resolve();
    lastKillCheck = now;
    return killRequested().then(function (yes) { return yes ? switchOff() : undefined; });
  }

  function keep(cacheKey, res) {
    if (killed) return Promise.resolve();
    return caches.open(CACHE).then(function (cache) { return cache.put(cacheKey, res); }).catch(function () {});
  }

  /** The shell and the built files it names, kept for offline. Never rejects: a worker with nothing kept is harmless. */
  function precache() {
    return fetch('/', { cache: 'reload' })
      .then(function (res) {
        if (!cacheable(res, 'navigate')) return undefined;
        return res.clone().text().then(function (html) {
          return keep(SHELL, res).then(function () {
            return Promise.all(assetUrls(html).map(function (u) {
              return fetch(u).then(function (r) { return cacheable(r, 'asset') ? keep(u, r) : undefined; }).catch(function () {});
            }));
          });
        });
      })
      .catch(function () {});
  }

  function navigate(event) {
    return fetch(event.request).then(function (res) {
      if (cacheable(res, 'navigate')) event.waitUntil(keep(SHELL, res.clone()));
      return res;
    }, function (error) {
      // No network at all: the kept shell, if there is one; otherwise the browser's own error, as without a worker.
      return caches.open(CACHE).then(function (cache) { return cache.match(SHELL); }).then(function (hit) {
        if (hit) return hit;
        throw error;
      });
    });
  }

  function asset(event) {
    var key = new URL(event.request.url).pathname;
    return caches.open(CACHE).then(function (cache) { return cache.match(key); }).then(function (hit) {
      if (hit) return hit;
      return fetch(event.request).then(function (res) {
        if (cacheable(res, 'asset')) event.waitUntil(keep(key, res.clone()));
        return res;
      });
    });
  }

  self.addEventListener('install', function (event) {
    event.waitUntil(precache().then(function () { return self.skipWaiting(); }));
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys()
        .then(function (names) {
          return Promise.all(names.filter(function (n) { return n.indexOf(PREFIX) === 0 && n !== CACHE; }).map(function (n) { return caches.delete(n); }));
        })
        .then(function () { return checkKill(true); })
        .then(function () { return killed ? undefined : self.clients.claim(); })
        .catch(function () {}),
    );
  });

  self.addEventListener('fetch', function (event) {
    if (killed) return;
    var request = event.request;
    var kind = route({ method: request.method, url: request.url, mode: request.mode, range: request.headers.has('range') }, self.location.origin);
    if (kind === 'navigate') {
      event.waitUntil(checkKill(false));
      event.respondWith(navigate(event));
    } else if (kind === 'asset') {
      event.respondWith(asset(event));
    }
  });
})();
