// public/sw.js, the app shell's service worker: what it does with each request, and what it never does.
// Defect: the app needed the network for every open — a lost connection, a train tunnel, left a blank page.
// The worker keeps the shell and the built files for offline, and must do it safely: a page is network-first
// (a deploy shows at once, never a stale page while online), only content-hashed /assets files are
// cache-first, nothing cross-origin (Firebase Auth, Firestore, Google sign-in), non-GET or /__/ is touched,
// a response is kept only if it is a plain 200 of the right kind (the site answers a path that is no file with
// index.html), old caches are deleted on activation, and /sw-kill switches the worker off. The file is a
// classic script; here it runs in Node against a fake service-worker scope (each import is a fresh copy).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ORIGIN = 'https://cv.example';
const realFetch = globalThis.fetch;
const realNow = Date.now;
const copies = { n: 0 };

const res = (body, { status = 200, type = 'basic', ct = 'text/html; charset=utf-8', redirected = false } = {}) => ({
  status, ok: status >= 200 && status < 300, type, redirected, body,
  headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? ct : null) },
  clone() { return { ...this }; },
  async text() { return this.body; },
});
const JS = (body = 'export {}') => res(body, { ct: 'text/javascript' });
const pathOf = (input) => new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname;
const HTML = '<!doctype html><link rel="modulepreload" href="/assets/react-AbCd1234.js"><link rel="stylesheet" href="/assets/index-Zy9_x-12.css"><script type="module" src="/assets/index-Q1w2E3r4.js"></script>';

/** Loads public/sw.js as a service worker would: `site(path, request)` answers the network; returns the fakes. */
async function load(site) {
  const listeners = {};
  const stores = new Map();
  const calls = { fetches: [], skipWaiting: 0, claim: 0, unregister: 0 };
  class ServiceWorkerGlobalScope {}
  const scope = new ServiceWorkerGlobalScope();
  Object.assign(scope, {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { calls.skipWaiting += 1; return Promise.resolve(); },
    clients: { claim: () => { calls.claim += 1; return Promise.resolve(); } },
    registration: { unregister: () => { calls.unregister += 1; return Promise.resolve(true); } },
  });
  const open = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return Promise.resolve({
      match: async (k) => m.get(typeof k === 'string' ? k : pathOf(k)),
      put: async (k, r) => { m.set(typeof k === 'string' ? k : pathOf(k), r); },
    });
  };
  globalThis.ServiceWorkerGlobalScope = ServiceWorkerGlobalScope;
  globalThis.self = scope;
  globalThis.caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  globalThis.fetch = async (input, init) => {
    const p = pathOf(input);
    calls.fetches.push(p);
    const answer = await site(p, input, init);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  await import(`../../public/sw.js?copy=${++copies.n}`);
  const api = globalThis.__cpwtShell;
  const run = async (type, event = {}) => {
    const e = { waits: [], waitUntil(p) { this.waits.push(p); }, respondWith(p) { this.answer = p; this.responded = true; }, ...event };
    listeners[type](e);
    await Promise.all(e.waits);
    const out = e.responded ? await e.answer : undefined;
    await Promise.all(e.waits);
    return { e, out };
  };
  const request = (path, { method = 'GET', mode = 'cors', range = false, origin = ORIGIN } = {}) => ({
    url: `${origin}${path}`, method, mode, headers: { has: (h) => range && h === 'range' },
  });
  return { api, run, request, stores, calls, listeners };
}

afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
  for (const k of ['self', 'caches', 'ServiceWorkerGlobalScope', '__cpwtShell']) delete globalThis[k];
});

const online = (extra = {}) => (p) => {
  if (p in extra) return extra[p];
  if (p === '/sw-kill') return res(HTML); // this site's answer to a path that is no file
  if (p.startsWith('/assets/')) return JS(`file ${p}`);
  return res(HTML);
};

test('route: pages are network-first, hashed /assets files cache-first, everything else is left alone', async () => {
  const { api } = await load(online());
  const r = (url, extra = {}) => api.route({ method: 'GET', url, mode: 'cors', range: false, ...extra }, ORIGIN);
  assert.equal(r(`${ORIGIN}/`, { mode: 'navigate' }), 'navigate');
  assert.equal(r(`${ORIGIN}/index.html`, { mode: 'navigate' }), 'navigate');
  assert.equal(r(`${ORIGIN}/some/page`, { mode: 'navigate' }), 'navigate');
  assert.equal(r(`${ORIGIN}/favicon.svg`, { mode: 'navigate' }), null, 'a file opened in a tab is not the shell');
  assert.equal(r(`${ORIGIN}/assets/Editor-AbCd1234.js`), 'asset');
  assert.equal(r(`${ORIGIN}/assets/react-pdf-x_-Y1234.js`), 'asset');
  assert.equal(r(`${ORIGIN}/assets/pdf.worker.min-Zz09_-aB.mjs`), 'asset');
  assert.equal(r(`${ORIGIN}/assets/noto-sans-latin-400-normal-AbCd1234.woff`), 'asset');
  assert.equal(r(`${ORIGIN}/assets/unhashed.js`), null, 'a name with no hash can change under the same name');
  assert.equal(r(`${ORIGIN}/favicon.svg`), null);
  assert.equal(r(`${ORIGIN}/sw.js`), null, 'the worker is never served by itself');
  assert.equal(r(`${ORIGIN}/sw-kill`), null);
  assert.equal(r(`${ORIGIN}/_headers`), null);
});

test('route: never a POST, a Range request, another origin, or Firebase\'s /__/ paths', async () => {
  const { api } = await load(online());
  const r = (url, req = {}) => api.route({ method: 'GET', url, mode: 'cors', range: false, ...req }, ORIGIN);
  assert.equal(r(`${ORIGIN}/`, { mode: 'navigate', method: 'POST' }), null);
  assert.equal(r(`${ORIGIN}/assets/Editor-AbCd1234.js`, { method: 'POST' }), null);
  assert.equal(r(`${ORIGIN}/assets/Editor-AbCd1234.js`, { range: true }), null);
  for (const url of [
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8',
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
    'https://securetoken.googleapis.com/v1/token',
    'https://apis.google.com/js/api.js',
    'https://accounts.google.com/o/oauth2/auth',
    'https://my-app.firebaseapp.com/__/auth/handler',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/metadata.json',
    'https://cv.example.evil.test/assets/Editor-AbCd1234.js',
    `http://cv.example/assets/Editor-AbCd1234.js`,
  ]) {
    assert.equal(r(url), null, url);
    assert.equal(r(url, { mode: 'navigate' }), null, `${url} as a navigation`);
  }
  assert.equal(r(`${ORIGIN}/__/auth/handler`, { mode: 'navigate' }), null, 'a same-origin hosted sign-in handler (a custom auth domain)');
  assert.equal(r(`${ORIGIN}/__/auth/iframe`), null);
  assert.equal(r('http://['), null, 'an address that does not parse');
});

test('cacheable: only a plain 200 of this site, not a redirect, and of the right kind', async () => {
  const { api } = await load(online());
  assert.equal(api.cacheable(res(HTML), 'navigate'), true);
  assert.equal(api.cacheable(JS(), 'asset'), true);
  assert.equal(api.cacheable(JS(), 'navigate'), false, 'a script is not a shell');
  assert.equal(api.cacheable(res(HTML), 'asset'), false, 'the single-page fallback (index.html for a file that is gone) is no asset');
  assert.equal(api.cacheable(res(HTML, { status: 404 }), 'navigate'), false);
  assert.equal(api.cacheable(res(HTML, { status: 500 }), 'navigate'), false);
  assert.equal(api.cacheable(res('', { status: 206, ct: 'text/javascript' }), 'asset'), false);
  assert.equal(api.cacheable(res(HTML, { type: 'opaque' }), 'navigate'), false);
  assert.equal(api.cacheable(res(HTML, { type: 'cors' }), 'navigate'), false);
  assert.equal(api.cacheable(res(HTML, { redirected: true }), 'navigate'), false);
  assert.equal(api.cacheable(null, 'navigate'), false);
});

test('assetUrls: the built files a page names, once each, in order', async () => {
  const { api } = await load(online());
  assert.deepEqual(api.assetUrls(HTML), ['/assets/react-AbCd1234.js', '/assets/index-Zy9_x-12.css', '/assets/index-Q1w2E3r4.js']);
  assert.deepEqual(api.assetUrls(`${HTML}${HTML}<a href="/other.html"><img src="/assets/unhashed.png"><script src="https://x.test/assets/a-AbCd1234.js">`), api.assetUrls(HTML));
  assert.deepEqual(api.assetUrls(''), []);
});

test('killAnswer: a real file switches it off, the site\'s index.html fallback, an error or nothing does not', async () => {
  const { api } = await load(online());
  assert.equal(api.killAnswer(res('off', { ct: 'text/plain' })), true);
  assert.equal(api.killAnswer(res('', { ct: 'application/octet-stream' })), true);
  assert.equal(api.killAnswer(res(HTML)), false, 'index.html with 200 is how the site answers a missing path');
  assert.equal(api.killAnswer(res('', { status: 404, ct: 'text/plain' })), false);
  assert.equal(api.killAnswer(res('', { status: 503, ct: 'text/plain' })), false);
  assert.equal(api.killAnswer(null), false);
});

test('the cache is named for the build, under a prefix only this worker uses', async () => {
  const { api } = await load(online());
  assert.equal(api.CACHE, `${api.PREFIX}${api.BUILD}`);
  assert.equal(api.PREFIX, 'cpwtcv-shell-');
  assert.equal(api.KILL, '/sw-kill');
});

test('install: keeps the shell and its built files, then takes over at once (skipWaiting)', async () => {
  const w = await load(online());
  await w.run('install');
  const cache = w.stores.get(w.api.CACHE);
  assert.deepEqual([...cache.keys()].sort(), ['/assets/index-Q1w2E3r4.js', '/assets/index-Zy9_x-12.css', '/assets/react-AbCd1234.js', '/index.html']);
  assert.equal(w.calls.skipWaiting, 1);
});

test('install: with no network, or a shell that is not HTML, the worker still installs and keeps nothing', async () => {
  const down = await load(() => new TypeError('Failed to fetch'));
  await down.run('install');
  assert.equal(down.calls.skipWaiting, 1);
  assert.equal(down.stores.get(down.api.CACHE)?.size ?? 0, 0);
  const odd = await load(() => res('Service Unavailable', { status: 503, ct: 'text/plain' }));
  await odd.run('install');
  assert.equal(odd.stores.get(odd.api.CACHE)?.size ?? 0, 0);
});

test('install: a built file that fails to load is skipped, the rest are kept', async () => {
  const w = await load(online({ '/assets/react-AbCd1234.js': new TypeError('reset'), '/assets/index-Zy9_x-12.css': res(HTML) }));
  await w.run('install');
  assert.deepEqual([...w.stores.get(w.api.CACHE).keys()].sort(), ['/assets/index-Q1w2E3r4.js', '/index.html']);
});

test('activate: the caches of other builds are deleted, other caches are not, and open pages are claimed', async () => {
  const w = await load(online());
  await w.run('install');
  w.stores.set('cpwtcv-shell-oldbuild', new Map([['/index.html', res(HTML)]]));
  w.stores.set('cpwtcv-shell-older', new Map());
  w.stores.set('someone-elses-cache', new Map());
  await w.run('activate');
  assert.deepEqual([...w.stores.keys()].sort(), [w.api.CACHE, 'someone-elses-cache'].sort());
  assert.equal(w.calls.claim, 1);
  assert.equal(w.calls.unregister, 0);
});

test('a page: the network answers, so the network\'s page is served (never the kept one), and it is kept for later', async () => {
  const w = await load(online({ '/': res('<p>new deploy</p>') }));
  w.stores.set(w.api.CACHE, new Map([['/index.html', res('<p>old deploy</p>')]]));
  const { out } = await w.run('fetch', { request: w.request('/', { mode: 'navigate' }) });
  assert.equal(out.body, '<p>new deploy</p>');
  assert.equal(w.stores.get(w.api.CACHE).get('/index.html').body, '<p>new deploy</p>', 'the next offline open shows the latest');
});

test('a page: with no network the kept shell opens; with none kept the browser\'s own error stands', async () => {
  const w = await load(online({ '/': new TypeError('Failed to fetch') }));
  w.stores.set(w.api.CACHE, new Map([['/index.html', res('<p>kept shell</p>')]]));
  const { out } = await w.run('fetch', { request: w.request('/jobs', { mode: 'navigate' }) });
  assert.equal(out.body, '<p>kept shell</p>');
  const empty = await load(() => new TypeError('Failed to fetch'));
  await assert.rejects(empty.run('fetch', { request: empty.request('/', { mode: 'navigate' }) }), /Failed to fetch/);
});

test('a page: a server error is shown as it is and does not replace the kept shell', async () => {
  const w = await load(online({ '/': res('Bad gateway', { status: 502, ct: 'text/plain' }) }));
  w.stores.set(w.api.CACHE, new Map([['/index.html', res('<p>kept shell</p>')]]));
  const { out } = await w.run('fetch', { request: w.request('/', { mode: 'navigate' }) });
  assert.equal(out.status, 502);
  assert.equal(w.stores.get(w.api.CACHE).get('/index.html').body, '<p>kept shell</p>');
});

test('a built file: the first request goes to the network and is kept, the next is served from the cache', async () => {
  const w = await load(online());
  const request = w.request('/assets/Editor-AbCd1234.js');
  const first = await w.run('fetch', { request });
  assert.equal(first.out.body, 'file /assets/Editor-AbCd1234.js');
  assert.equal(w.calls.fetches.filter((p) => p === '/assets/Editor-AbCd1234.js').length, 1);
  const second = await w.run('fetch', { request });
  assert.equal(second.out.body, 'file /assets/Editor-AbCd1234.js');
  assert.equal(w.calls.fetches.filter((p) => p === '/assets/Editor-AbCd1234.js').length, 1, 'no second request');
});

test('a built file that is gone (the site answers index.html), or fails, is never kept', async () => {
  const gone = await load(online({ '/assets/Old-AbCd1234.js': res(HTML) }));
  const a = await gone.run('fetch', { request: gone.request('/assets/Old-AbCd1234.js') });
  assert.equal(a.out.body, HTML, 'the page still gets the answer, so its import() fails as before and lazyPage reloads it');
  assert.equal(gone.stores.get(gone.api.CACHE)?.has('/assets/Old-AbCd1234.js') ?? false, false);
  const bad = await load(online({ '/assets/Bad-AbCd1234.js': res('oops', { status: 500, ct: 'text/javascript' }) }));
  const b = await bad.run('fetch', { request: bad.request('/assets/Bad-AbCd1234.js') });
  assert.equal(b.out.status, 500);
  assert.equal(bad.stores.get(bad.api.CACHE)?.has('/assets/Bad-AbCd1234.js') ?? false, false);
});

test('a built file with no network and no copy fails as it would without a worker', async () => {
  const w = await load(online({ '/assets/Editor-AbCd1234.js': new TypeError('Failed to fetch') }));
  await assert.rejects(w.run('fetch', { request: w.request('/assets/Editor-AbCd1234.js') }), /Failed to fetch/);
});

test('requests it must not touch are not answered by the worker and never reach its fetch', async () => {
  const w = await load(online());
  for (const request of [
    w.request('/', { method: 'POST', mode: 'navigate' }),
    w.request('/v1/accounts:lookup', { origin: 'https://identitytoolkit.googleapis.com' }),
    w.request('/google.firestore.v1.Firestore/Listen/channel', { origin: 'https://firestore.googleapis.com' }),
    w.request('/js/api.js', { origin: 'https://apis.google.com' }),
    w.request('/__/auth/handler', { mode: 'navigate' }),
    w.request('/__/auth/iframe'),
    w.request('/assets/Editor-AbCd1234.js', { range: true }),
    w.request('/favicon.svg'),
    w.request('/sw.js'),
    w.request('/assets/Editor-AbCd1234.js', { method: 'DELETE' }),
  ]) {
    const { e } = await w.run('fetch', { request });
    assert.equal(e.responded ?? false, false, request.url);
  }
  assert.deepEqual(w.calls.fetches, [], 'the worker asked the network for nothing of them');
});

test('kill switch: a real /sw-kill file at activation deletes the caches, unregisters and claims nothing', async () => {
  const w = await load(online({ '/sw-kill': res('off', { ct: 'text/plain' }) }));
  w.stores.set(w.api.CACHE, new Map([['/index.html', res(HTML)]]));
  w.stores.set('cpwtcv-shell-other', new Map());
  w.stores.set('someone-elses-cache', new Map());
  await w.run('activate');
  assert.deepEqual([...w.stores.keys()], ['someone-elses-cache']);
  assert.equal(w.calls.unregister, 1);
  assert.equal(w.calls.claim, 0);
  const { e } = await w.run('fetch', { request: w.request('/', { mode: 'navigate' }) });
  assert.equal(e.responded ?? false, false, 'once switched off, every request goes to the network');
});

test('kill switch: the index.html the site answers for a missing /sw-kill does not switch it off', async () => {
  const w = await load(online());
  await w.run('install');
  await w.run('activate');
  assert.equal(w.calls.unregister, 0);
  assert.equal(w.stores.has(w.api.CACHE), true);
  assert.equal(w.calls.claim, 1);
});

test('kill switch: asked on a page load at most every 10 minutes, with no cache, and then it switches off', async () => {
  let t = 1_000_000;
  Date.now = () => t;
  let killFile = false;
  const w = await load((p) => (p === '/sw-kill' && killFile ? res('off', { ct: 'text/plain' }) : online()(p)));
  const nav = () => w.run('fetch', { request: w.request('/', { mode: 'navigate' }) });
  await nav();
  await nav();
  const asked = () => w.calls.fetches.filter((p) => p === '/sw-kill').length;
  assert.equal(asked(), 1, 'the second page load, a moment later, does not ask again');
  t += w.api.KILL_EVERY_MS + 1;
  killFile = true;
  await nav();
  assert.equal(asked(), 2);
  assert.equal(w.calls.unregister, 1);
  assert.equal(w.stores.has(w.api.CACHE), false);
  await nav();
  assert.equal(asked(), 2, 'switched off: not asked again');
});

test('kill switch: the question is sent with no cache, so a stale answer cannot keep it on', async () => {
  let init;
  const w = await load((p, _req, i) => { if (p === '/sw-kill') init = i; return online()(p); });
  await w.run('activate');
  assert.equal(init.cache, 'no-store');
});
