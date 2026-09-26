// The workspace shell (src/components/shell) around the Job Tracker and Boards pages.
//
// J-40 / R2-073: the app never reset the scroll position on a route change, so a job page opened
// at the offset the list was scrolled to. The pages now scroll inside the shell's <main>, and
// WorkspaceLayout puts it back at the top whenever the path changes — and back where it was when
// the user returns with Back. Mounted with react-dom/client over tests/pdf/fake-dom.mjs, whose
// scroll box keeps its scrollTop as a browser's does; the shell's own onScroll is called the way
// the browser would call it after a scroll.
//
// Also: the routes (AppRoutes) put exactly the workspace pages inside the layout, and the sidebar's
// project list reads v1 boards ({ title }) and v2 boards ({ title, key, starred }) alike.
// Run: node --test tests/unit/ui-shell.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route, useNavigate, createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { mount, elements, reactProps } from '../pdf/fake-dom.mjs';
import { sidebarProjects, orderProjects } from '../../src/components/shell/projects.js';

// JSX and the `@/` alias through Vite's SSR loader, as tests/pdf/harness.mjs does — without the
// PDF modules and font server that harness also starts.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let vite;
before(async () => {
  vite = await createServer({
    root: ROOT, configFile: `${ROOT}vite.config.js`, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
});
after(() => vite?.close());
const loadModule = (id) => vite.ssrLoadModule(id);

/**
 * The shell at `path` over two stand-in pages, /jobs ("LIST") and /jobs/:id ("JOB"). Returns the
 * mount, its <main>, `scroll(y)` (a user scroll), `go(to)` (router navigation, -1 is Back) and
 * the text the page shows.
 */
async function shellAt(path) {
  const { WorkspaceLayout } = await loadModule('/src/components/shell/WorkspaceLayout.jsx');
  let navigate = null;
  function Page({ name }) {
    navigate = useNavigate();
    return createElement('p', null, name);
  }
  function App() {
    return createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null,
        createElement(Route, { element: createElement(WorkspaceLayout, { projects: [] }) },
          createElement(Route, { path: '/jobs', element: createElement(Page, { name: 'LIST' }) }),
          createElement(Route, { path: '/jobs/:id', element: createElement(Page, { name: 'JOB' }) }))));
  }
  const view = mount(App, {});
  const main = () => [...elements(view.container)].find((el) => el.tagName === 'MAIN');
  const scroll = (y) => {
    main().scrollTop = y;
    view.act(() => reactProps(main()).onScroll?.({ currentTarget: main(), target: main() }));
  };
  // The router moves in a React transition, rendered in slices over several tasks (more on a cold
  // first run): let it finish before looking.
  const settle = async () => {
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      view.act(() => {});
    }
  };
  const go = async (to) => {
    view.act(() => navigate(to));
    await settle();
  };
  await settle();
  return { view, main, scroll, go, shown: () => main().textContent };
}

describe('J-40: a route change inside the workspace opens the new page at its top', () => {
  it('the list scrolled down, then a job: the job page opens at the top', async () => {
    const { view, main, scroll, go, shown } = await shellAt('/jobs');
    try {
      assert.ok(main(), 'the shell has a <main> scroll box');
      scroll(900);
      await go('/jobs/job_42');
      assert.match(shown(), /JOB/);
      assert.equal(main().scrollTop, 0, 'the job page kept the list’s scroll offset');
    } finally { await view.unmount(); }
  });

  it('Back returns to the list where it was scrolled', async () => {
    const { view, main, scroll, go, shown } = await shellAt('/jobs');
    try {
      scroll(900);
      await go('/jobs/job_42');
      scroll(120);
      await go(-1);
      assert.match(shown(), /LIST/);
      assert.equal(main().scrollTop, 900);
      await go(1);
      assert.match(shown(), /JOB/);
      assert.equal(main().scrollTop, 120, 'Forward restores the job page’s own offset');
    } finally { await view.unmount(); }
  });

  it('a change of the search only (a filter, ?view=, ?issue=) keeps the scroll', async () => {
    const { view, main, scroll, go } = await shellAt('/jobs');
    try {
      scroll(500);
      await go('/jobs?view=table');
      assert.equal(main().scrollTop, 500);
      await go('/jobs?view=table&q=goo');
      assert.equal(main().scrollTop, 500);
    } finally { await view.unmount(); }
  });

  it('a filter changed before leaving still comes back to its offset', async () => {
    const { view, main, scroll, go } = await shellAt('/jobs');
    try {
      scroll(700);
      await go('/jobs?view=table'); // a new history entry, never scrolled itself
      await go('/jobs/job_7');
      assert.equal(main().scrollTop, 0);
      await go(-1);
      assert.equal(main().scrollTop, 700);
    } finally { await view.unmount(); }
  });

  it('the shell fills the dynamic viewport (h-dvh, not h-screen) and <main> is the scroll box', async () => {
    const { view, main } = await shellAt('/jobs');
    try {
      // The top bar spans the window; the sidebar and <main> share the row under it.
      const root = main().parentNode.parentNode;
      assert.match(root.className, /\bh-dvh\b/);
      assert.match(main().parentNode.className, /\bmin-h-0\b/, 'the row gives <main> the rest of the height');
      assert.doesNotMatch(root.className, /\bh-screen\b/);
      assert.match(main().className, /\boverflow-y-auto\b/);
    } finally { await view.unmount(); }
  });
});

describe('AppRoutes: which pages sit inside the workspace shell', () => {
  it('the Job Tracker and Boards pages do; the résumé pages and legal pages do not', async () => {
    const { AppRoutes, WorkspaceRoute } = await loadModule('/src/AppRoutes.jsx');
    const tree = AppRoutes({ store: {}, auth: {}, sync: {}, seed: { waiting: false } });
    const routesElement = tree.props.children;
    const routes = createRoutesFromChildren(routesElement.props.children);
    const inShell = (path) => (matchRoutes(routes, path) ?? []).some((m) => m.route.element?.type === WorkspaceRoute);
    for (const path of ['/jobs', '/jobs/new', '/jobs/j1/edit', '/jobs/j1', '/boards', '/boards/b1', '/work', '/boards/b1/backlog', '/boards/b1/settings']) {
      assert.ok(inShell(path), `${path} is not inside the workspace shell`);
      assert.notEqual(matchRoutes(routes, path).at(-1).route.path, '*', `${path} falls through to the catch-all`);
    }
    for (const path of ['/', '/new', '/resume/r1', '/terms', '/privacy']) {
      assert.ok(!inShell(path), `${path} should stay outside the shell`);
      assert.notEqual(matchRoutes(routes, path).at(-1).route.path, '*', `${path} falls through to the catch-all`);
    }
  });
});

describe('the sidebar’s projects', () => {
  it('reads v1 boards ({ id, title, color }) and v2 boards ({ key, starred }) alike', () => {
    const v1 = { id: 'b1', title: 'Product launch', color: '#6366f1', lists: [] };
    const v2 = { id: 'b2', title: 'Life admin', key: 'LIFE', color: '#10b981', starred: true, updatedAt: 5 };
    assert.deepEqual(sidebarProjects([v1, v2]), [
      { id: 'b1', name: 'Product launch', key: '', color: '#6366f1', starred: false, updatedAt: 0 },
      { id: 'b2', name: 'Life admin', key: 'LIFE', color: '#10b981', starred: true, updatedAt: 5 },
    ]);
  });

  it('never throws on what a half-migrated or damaged store might hold', () => {
    assert.deepEqual(sidebarProjects(undefined), []);
    assert.deepEqual(sidebarProjects({ boards: [] }), []);
    const out = sidebarProjects([null, 7, { title: 'no id' }, { id: 3, title: '   ', key: 12, color: '', starred: 'yes' }]);
    assert.deepEqual(out, [{ id: '3', name: 'Untitled project', key: '', color: null, starred: true, updatedAt: 0 }]);
  });

  it('lists starred projects first, then the most recently updated, and says how many are left out', () => {
    const p = (id, extra) => ({ id, name: id, key: '', color: null, starred: false, updatedAt: 0, ...extra });
    const list = [p('a', { updatedAt: 1 }), p('b', { updatedAt: 9 }), p('c', { starred: true, name: 'Zeta' }), p('d', { updatedAt: 5 }), p('e', { starred: true, name: 'Alpha' })];
    const { shown, hidden } = orderProjects(list, 4);
    assert.deepEqual(shown.map((x) => x.id), ['e', 'c', 'b', 'd']);
    assert.equal(hidden, 1);
    // Starred projects are never cut, even past the limit.
    assert.deepEqual(orderProjects(list, 1).shown.map((x) => x.id), ['e', 'c']);
  });
});
