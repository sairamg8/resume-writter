// The app's routes (src/AppRoutes.jsx) and the legal pages' back arrow:
//  - R2-072: the page-wide ErrorBoundary never reset, so after one page crashed, Back or any link
//    kept "Something went wrong" on screen until a reload. Now a new path gets a fresh try.
//  - R2-073: nothing reset the window's scroll on a route change (HashRouter), so the Privacy
//    Policy opened from the dashboard's footer opened near its end, and Terms from Privacy's footer
//    at its bottom. Now a new page (a link, not Back / Forward) opens at the top; a change of the
//    search alone (the editor's ?tab=) leaves the scroll alone.
//  - R2-074: the Terms and Privacy back arrow was navigate(-1): on a direct visit there is no app
//    page to go back to (nothing happened, or it left the site). Now it goes to the dashboard then.
// The real AppRoutes in a MemoryRouter, mounted with react-dom/client over tests/pdf/fake-dom.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const settle = async (view) => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };

/**
 * The app's routes at `entries` (a MemoryRouter's history, the last one shown). The dashboard gets
 * a store it cannot read, so '/' crashes. `scrolls` logs window.scrollTo.
 */
async function openApp(entries) {
  const { AppRoutes } = await loadModule('/src/AppRoutes.jsx');
  const { MemoryRouter, useNavigate, useLocation } = await import('react-router-dom');
  let nav = null;
  let loc = null;
  function Probe() {
    nav = useNavigate();
    loc = useLocation();
    return null;
  }
  function App({ ready }) {
    if (!ready) return null;
    return createElement(MemoryRouter, { initialEntries: entries, initialIndex: entries.length - 1 },
      createElement(Probe),
      createElement(AppRoutes, { store: {}, auth: {}, sync: {}, seed: { waiting: false } }));
  }
  const quiet = console.error;
  console.error = () => {};
  const view = mount(App, { ready: false });
  const scrolls = [];
  view.window.scrollTo = (x, y) => scrolls.push([x, y]);
  view.update({ ready: true });
  await settle(view);
  return {
    view,
    scrolls,
    text: () => view.container.textContent,
    path: () => `${loc.pathname}${loc.search}`,
    async go(to) { view.act(() => nav(to)); await settle(view); },
    async close() { await view.unmount(); console.error = quiet; },
  };
}

const backArrow = (view) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Back');

describe('a page that crashed (R2-072)', () => {
  it('another path renders again: Back or a link leaves the error screen', async () => {
    const app = await openApp(['/terms', '/']);
    try {
      assert.match(app.text(), /Something went wrong/);
      await app.go(-1);
      assert.match(app.text(), /Terms and Conditions/, 'before: "Something went wrong" stayed after Back');
      await app.go('/privacy');
      assert.match(app.text(), /Privacy Policy/);
      await app.go('/');
      assert.match(app.text(), /Something went wrong/, 'the page that crashes still shows the error screen');
    } finally { await app.close(); }
  });
});

describe('the window’s scroll on a route change (R2-073)', () => {
  it('a new page opens at the top; the same page with another search does not move', async () => {
    const app = await openApp(['/terms']);
    try {
      app.scrolls.length = 0;
      await app.go('/privacy');
      assert.deepEqual(app.scrolls, [[0, 0]], 'before: no scroll reset — Privacy opened at Terms’ offset');
      await app.go('/terms');
      assert.deepEqual(app.scrolls, [[0, 0], [0, 0]]);
      await app.go('/terms?x=1');
      assert.deepEqual(app.scrolls, [[0, 0], [0, 0]], 'a search change alone is not a new page');
    } finally { await app.close(); }
  });
});

describe('the window’s scroll on Back (R2-073)', () => {
  it('Back and Forward leave the scroll to the browser', async () => {
    const app = await openApp(['/terms', '/privacy']);
    try {
      app.scrolls.length = 0;
      await app.go(-1);
      assert.match(app.text(), /Terms and Conditions/);
      assert.deepEqual(app.scrolls, [], 'Back scrolled the page it went back to to the top');
    } finally { await app.close(); }
  });
});

describe('the Terms and Privacy back arrow (R2-074)', () => {
  for (const [page, heading, other] of [['/terms', /Terms and Conditions/, '/privacy'], ['/privacy', /Privacy Policy/, '/terms']]) {
    it(`${page} visited directly: the arrow goes to the dashboard`, async () => {
      const app = await openApp([page]);
      try {
        assert.match(app.text(), heading);
        const arrow = backArrow(app.view);
        assert.ok(arrow, 'the arrow has no accessible name "Back"');
        app.view.act(() => reactProps(arrow).onClick({}));
        await settle(app.view);
        assert.equal(app.path(), '/', 'before: navigate(-1) with no app page behind it — nothing happened');
      } finally { await app.close(); }
    });

    it(`${page} opened from another page: the arrow goes back to it`, async () => {
      const app = await openApp([other, page]);
      try {
        app.view.act(() => reactProps(backArrow(app.view)).onClick({}));
        await settle(app.view);
        assert.equal(app.path(), other);
      } finally { await app.close(); }
    });
  }
});
