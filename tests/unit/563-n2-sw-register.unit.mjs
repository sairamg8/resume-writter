// How the service worker (public/sw.js) gets onto a page, and how each deploy becomes a new one.
// Defect: nothing registered a worker, so the shell was never kept. src/utils/shellWorker.js registers it
// after the page has loaded and the browser is idle, in a production build only and only on https or
// localhost, and removes every worker of the site if registering fails (a kill switch); vite-plugin-sw-stamp.js
// writes the build's id into the copy of sw.js in the build, so each deploy is a worker with its own cache.
// The start-up path is capped (tests/pdf/71-startup-chunks): the registration module must stay tiny.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shouldRegister, registerShellWorker, unregisterAll } from '../../src/utils/shellWorker.js';
import { buildId, stampWorker, swStamp, BUILD_LINE } from '../../vite-plugin-sw-stamp.js';

const read = (rel) => fs.readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const PROD = { PROD: true, MODE: 'production' };
const here = (over = {}) => ({ protocol: 'https:', hostname: 'cv.example', hasServiceWorker: true, ...over });

test('shouldRegister: a production build, on https or localhost, in a browser that has service workers', () => {
  assert.equal(shouldRegister(PROD, here()), true);
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) assert.equal(shouldRegister(PROD, here({ protocol: 'http:', hostname })), true, hostname);
  assert.equal(shouldRegister(PROD, here({ protocol: 'http:' })), false, 'plain http on another host');
  assert.equal(shouldRegister(PROD, here({ protocol: 'http:', hostname: 'localhost.evil.test' })), false);
  assert.equal(shouldRegister(PROD, here({ hasServiceWorker: false })), false);
  assert.equal(shouldRegister({ PROD: false, MODE: 'development' }, here()), false, 'yarn dev');
  assert.equal(shouldRegister({ PROD: true, MODE: 'e2e' }, here()), false, 'the Cypress build');
  assert.equal(shouldRegister({ PROD: false, MODE: 'production' }, here()), false);
  assert.equal(shouldRegister(undefined, here()), false);
  assert.equal(shouldRegister(PROD, undefined), false);
});

/** A window with a service worker container; `registerWith` decides what register() does. */
function fakeWindow({ readyState = 'loading', idle = true, registerWith = () => Promise.resolve({}), registrations = [] } = {}) {
  const calls = { register: [], unregistered: 0, listeners: {}, timers: [], idle: [] };
  const g = {
    location: { protocol: 'https:', hostname: 'cv.example' },
    document: { readyState },
    navigator: {
      serviceWorker: {
        register: (...args) => { calls.register.push(args); return registerWith(...args); },
        getRegistrations: async () => registrations.map((r) => ({ unregister: async () => { calls.unregistered += 1; return r; } })),
      },
    },
    addEventListener: (type, fn, opts) => { calls.listeners[type] = { fn, opts }; },
    setTimeout: (fn, ms) => { calls.timers.push([fn, ms]); },
  };
  if (idle) g.requestIdleCallback = (fn, opts) => { calls.idle.push([fn, opts]); };
  return { g, calls };
}

test('registerShellWorker: waits for the page to load and the browser to be idle, then registers /sw.js', () => {
  const { g, calls } = fakeWindow();
  assert.equal(registerShellWorker(PROD, g), true);
  assert.deepEqual(calls.register, [], 'not while the page is still loading');
  assert.equal(calls.listeners.load.opts.once, true);
  calls.listeners.load.fn();
  assert.deepEqual(calls.register, [], 'not on the load event itself: only when idle');
  assert.equal(calls.idle.length, 1);
  assert.equal(calls.idle[0][1].timeout, 5000, 'a busy page still registers within a few seconds');
  calls.idle[0][0]();
  assert.deepEqual(calls.register, [['/sw.js', { scope: '/', updateViaCache: 'none' }]]);
});

test('registerShellWorker: a page already loaded registers when idle; a browser with no idle callback after a delay', () => {
  const loaded = fakeWindow({ readyState: 'complete' });
  registerShellWorker(PROD, loaded.g);
  assert.equal(loaded.calls.idle.length, 1);
  assert.deepEqual(loaded.calls.register, []);
  const noIdle = fakeWindow({ readyState: 'complete', idle: false });
  registerShellWorker(PROD, noIdle.g);
  assert.equal(noIdle.calls.timers.length, 1);
  assert.ok(noIdle.calls.timers[0][1] >= 1000);
  noIdle.calls.timers[0][0]();
  assert.equal(noIdle.calls.register.length, 1);
});

test('registerShellWorker: where it may not, it does nothing at all', () => {
  for (const [env, over] of [[{ PROD: false, MODE: 'development' }, {}], [{ PROD: true, MODE: 'e2e' }, {}], [PROD, { protocol: 'http:', hostname: 'cv.example' }]]) {
    const { g, calls } = fakeWindow();
    Object.assign(g.location, over);
    assert.equal(registerShellWorker(env, g), false);
    assert.deepEqual(calls.listeners, {});
    assert.deepEqual(calls.register, []);
  }
  const { g, calls } = fakeWindow();
  delete g.navigator.serviceWorker;
  assert.equal(registerShellWorker(PROD, g), false);
  assert.deepEqual(calls.listeners, {});
});

test('registerShellWorker: a registration that fails removes every worker of the site (the kill switch)', async () => {
  const { g, calls } = fakeWindow({ readyState: 'complete', registerWith: () => Promise.reject(new Error('SecurityError')), registrations: [1, 2] });
  registerShellWorker(PROD, g);
  calls.idle[0][0]();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls.unregistered, 2);
  const thrown = fakeWindow({ readyState: 'complete', registerWith: () => { throw new Error('boom'); }, registrations: [1] });
  registerShellWorker(PROD, thrown.g);
  thrown.calls.idle[0][0]();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(thrown.calls.unregistered, 1);
});

test('unregisterAll: never throws, whatever the browser says', async () => {
  const { g } = fakeWindow();
  g.navigator.serviceWorker.getRegistrations = () => Promise.reject(new Error('no'));
  await unregisterAll(g);
  await unregisterAll({});
});

test('buildId: the same build gives the same id, any changed file name or page gives another', () => {
  const a = buildId(['assets/index-AAAAAAAA.js', 'index.html'], '<html>1</html>');
  assert.match(a, /^[0-9a-f]{10}$/);
  assert.equal(buildId(['index.html', 'assets/index-AAAAAAAA.js'], '<html>1</html>'), a, 'the order of the files does not matter');
  assert.notEqual(buildId(['assets/index-BBBBBBBB.js', 'index.html'], '<html>1</html>'), a);
  assert.notEqual(buildId(['assets/index-AAAAAAAA.js', 'index.html'], '<html>2</html>'), a);
});

test('stampWorker: puts the id on the BUILD line of the real public/sw.js, and nowhere else', () => {
  const source = read('public/sw.js');
  assert.ok(source.includes(BUILD_LINE), 'public/sw.js has the line the plugin stamps');
  const stamped = stampWorker(source, 'abc123def4');
  assert.ok(stamped.includes("var BUILD = 'abc123def4';"));
  assert.ok(!stamped.includes('__BUILD_ID__'));
  assert.equal(stamped.length - source.length, 'abc123def4'.length - '__BUILD_ID__'.length);
  assert.throws(() => stampWorker('// no build line', 'x'), /no .* line to stamp/);
});

test('the plugin stamps the copy of sw.js in the output of a build that writes, and leaves a build that does not alone', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'swstamp-'));
  const sw = path.join(out, 'dist', 'sw.js');
  fs.mkdirSync(path.dirname(sw));
  const run = (write) => {
    fs.writeFileSync(sw, read('public/sw.js'));
    const plugin = swStamp();
    plugin.configResolved({ root: out, build: { outDir: 'dist', write } });
    plugin.generateBundle({}, { 'index.html': { source: '<html></html>' }, 'assets/index-AAAAAAAA.js': {} });
    plugin.closeBundle();
    return fs.readFileSync(sw, 'utf8');
  };
  assert.match(run(true), /var BUILD = '[0-9a-f]{10}';/);
  assert.ok(run(false).includes(BUILD_LINE), 'write: false (the node tests build in memory) changes nothing');
  fs.rmSync(out, { recursive: true, force: true });
});

test('the app, the build and the browser suite are wired to it', () => {
  assert.match(read('src/main.jsx'), /registerShellWorker\(import\.meta\.env\)/);
  assert.match(read('vite.config.js'), /swStamp\(\)/);
  assert.match(read('playwright.config.js'), /serviceWorkers:\s*'block'/, 'the other specs stub the network: a worker would sit between');
});

test('the registration module stays tiny (the start-up path has little room: tests/pdf/71-startup-chunks)', () => {
  assert.ok(read('src/utils/shellWorker.js').length < 3500);
  assert.ok(!/^import /m.test(read('src/utils/shellWorker.js')), 'and imports nothing');
});
