// "Minified React error #306: Element type is invalid. Received a promise that resolves to: undefined" on the
// live site. A React.lazy had resolved to { default: undefined }. Two defects:
//  1. The Job Map route asked its page's module for the name 'JobMap' (AppRoutes.jsx; lazyPage.js loadPage reads
//     m[name]), but src/pages/JobMap.jsx only had `export default function JobMap`: no named JobMap, so opening
//     /job-map handed React undefined, in every build, from the day the page joined the lazy routes.
//  2. loadPage returned { default: m[name] } unchecked, so any module that loaded without the export it was
//     asked for (a tab mixing the files of two builds) crashed React the same way, past the reload-once recovery.
// Now the pages' names are pinned against their files' exports, and a module without the export is a FAILED
// LOAD: one reload of the tab per page, then an Error naming the page and the export for the ErrorBoundary.
// The same check guards the other lazies (lazyPiece, the menu item, the style popover, the sync engine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Component, Suspense, createElement } from 'react';
import { mount } from '../pdf/fake-dom.mjs';
import { isComponent, lazyPage, loadPage, RELOADED_KEY } from '../../src/utils/lazyPage.js';
import { lazyCollectionSync } from '../../src/utils/collectionSyncLazy.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function env({ online = true } = {}) {
  const map = new Map();
  const e = {
    reloads: 0, online, map,
    reload() { e.reloads += 1; },
    storage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); },
    },
  };
  return e;
}
const settled = (p) => Promise.race([
  p.then((v) => ({ resolved: v }), (error) => ({ rejected: error })),
  new Promise((r) => { setTimeout(() => r('pending'), 20); }),
]);

test('every page AppRoutes loads is a named export of its file (the Job Map page had only a default)', () => {
  const routes = read('src/AppRoutes.jsx');
  const pages = [...routes.matchAll(/page\(\(\) => import\('@\/([^']+)'\), '(\w+)'\)/g)].map((m) => ({ file: m[1], name: m[2] }));
  assert.ok(pages.length >= 17, `found ${pages.length} pages in AppRoutes.jsx`);
  for (const { file, name } of pages) {
    const full = ['.jsx', '.js'].map((ext) => `src/${file}${ext}`).find((f) => fs.existsSync(path.join(ROOT, f)));
    assert.ok(full, `${file} exists`);
    const named = new RegExp(`^export (?:async )?(?:function|const|class) ${name}\\b|^export \\{[^}]*\\b${name}\\b[^}]*\\}`, 'm');
    assert.match(read(full), named, `${full} must export ${name} by name: loadPage reads m.${name}`);
  }
});

test('a page whose module lacks the export reloads the tab once, and never resolves { default: undefined }', async () => {
  const e = env();
  const other = async () => ({ Somethingelse: () => null });
  const first = await settled(loadPage(other, 'JobMap', e));
  assert.equal(first, 'pending', 'while the tab reloads the route keeps its loading state: no value, no error');
  assert.equal(e.reloads, 1);
  assert.deepEqual(JSON.parse(e.map.get(RELOADED_KEY)), ['JobMap']);
});

test('after that one reload the error names the page and the export, for the ErrorBoundary', async () => {
  const e = env();
  e.map.set(RELOADED_KEY, JSON.stringify(['JobMap']));
  const r = await settled(loadPage(async () => ({ default: () => null }), 'JobMap', e));
  assert.ok(r.rejected instanceof Error, `got ${JSON.stringify(r)}`);
  assert.match(r.rejected.message, /JobMap page/);
  assert.match(r.rejected.message, /"JobMap" export/);
  assert.equal(e.reloads, 0, 'no reload loop');
  assert.deepEqual(JSON.parse(e.map.get(RELOADED_KEY)), ['JobMap'], 'a load that failed does not clear the mark');
});

test('a module that is empty, null or holds a non-component under the name fails the same way', async () => {
  for (const mod of [{}, null, undefined, { Editor: undefined }, { Editor: 'Editor' }, { Editor: 3 }, { Editor: null }]) {
    const e = env({ online: false }); // offline: no reload, the error itself
    const r = await settled(loadPage(async () => mod, 'Editor', e));
    assert.ok(r.rejected instanceof Error, `${JSON.stringify(mod)} gave ${JSON.stringify(r)}`);
    assert.match(r.rejected.message, /Editor/);
  }
});

test('a function, a class and a memo/forwardRef object are components; nothing else is', () => {
  assert.equal(isComponent(() => null), true);
  assert.equal(isComponent(class A {}), true);
  assert.equal(isComponent({ $$typeof: Symbol.for('react.memo'), type: () => null }), true);
  for (const x of [undefined, null, 0, 'A', {}, [], true]) assert.equal(isComponent(x), false, String(x));
});

test('through lazyPage the route shows the error, not React error 306', async () => {
  const caught = { error: null };
  class Boundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { caught.error = error; }
    render() { return this.state.error ? createElement('p', null, this.state.error.message) : this.props.children; }
  }
  const Page = lazyPage(async () => ({}), 'JobMap', env({ online: false }));
  const log = console.error;
  console.error = () => {};
  const view = mount(() => createElement(Boundary, null, createElement(Suspense, { fallback: createElement('p', null, 'loading') }, createElement(Page))), {});
  try {
    for (let i = 0; i < 300 && !caught.error; i += 1) {
      view.act(() => {});
      await new Promise((r) => { setTimeout(r, 10); });
    }
    assert.ok(caught.error, 'the boundary caught something');
    assert.doesNotMatch(caught.error.message, /Element type is invalid|Minified React error/);
    assert.match(caught.error.message, /"JobMap" export/);
  } finally {
    await view.unmount();
    console.error = log;
  }
});

test('the sync engine module without createListSync is a failed load, tried again later: not a crash with the load stuck', async () => {
  const statuses = [];
  const queued = [];
  const logs = [];
  const sync = lazyCollectionSync(() => Promise.resolve(undefined))({
    cloud: true,
    report: { status: (s) => statuses.push(s) },
    log: (...a) => logs.push(a.join(' ')),
    timers: { set: (fn, ms) => { queued.push([fn, ms]); return queued.length; }, clear: () => {} },
  });
  sync.start({ uid: 'u1' });
  for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); });
  assert.deepEqual(statuses, ['error']);
  assert.equal(queued.length, 1, 'a retry is scheduled');
  assert.match(logs[0], /could not be loaded/);
});

test('every React.lazy in src checks what its module gave: lazyPage, componentOf or isComponent', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true })
    .map((f) => `src/${f}`.replace(/\\/g, '/'))
    .filter((f) => /\.jsx?$/.test(f) && /(?:=|=>)\s*lazy\(/.test(read(f)))
    .sort();
  assert.deepEqual(files, ['src/components/AuthBar.jsx', 'src/components/lazyPiece.jsx', 'src/utils/lazyPage.js'], 'a new React.lazy: guard it and add it here');
  assert.match(read('src/components/AuthBar.jsx'), /isComponent\(m\?\.JobMapMenuItem\)/);
  assert.match(read('src/components/lazyPiece.jsx'), /componentOf\(m, 'default'/);
  assert.match(read('src/pages/JobMap.jsx'), /isComponent\(m\?\.default\)/);
  assert.match(read('src/components/SectionEditor.jsx'), /componentOf\(m, 'default'/);
});
