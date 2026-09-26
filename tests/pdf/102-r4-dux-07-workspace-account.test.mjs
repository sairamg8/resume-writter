// R4-DUX-07: the Job Tracker and Boards pages had no sign-in, account or sign-out control, though
// their jobs and boards sync with the account: `auth` reached only the Dashboard and the Editor, and
// the workspace's top bar showed only the jobs' and boards' cloud icon, which is nothing while signed
// out. Pinned: the routes hand the account to the workspace shell, and its top bar shows the
// Dashboard's AuthBar (compact) — Sign in with Google while signed out, the account menu with
// Sign out while signed in — without a second cloud icon. The shell is mounted with
// react-dom/client over tests/pdf/fake-dom.mjs. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route, createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

let WorkspaceLayout;
before(async () => {
  await setup();
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  ({ WorkspaceLayout } = await loadModule('/src/components/shell/WorkspaceLayout.jsx'));
});
after(teardown);

// The router and React render over several tasks: let them finish before looking.
const settle = async (view) => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    view.act(() => {});
  }
};
const buttons = (view) => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');

/** The workspace shell at /jobs over a stand-in page, with the account `auth`. */
async function shellWith(auth) {
  const App = () => createElement(MemoryRouter, { initialEntries: ['/jobs'] },
    createElement(Routes, null,
      createElement(Route, { element: createElement(WorkspaceLayout, { projects: [], auth }) },
        createElement(Route, { path: '/jobs', element: createElement('p', null, 'LIST') }))));
  const view = mount(App, {});
  await settle(view);
  return view;
}

const account = (over = {}) => ({
  user: null, authLoading: false, cloudAvailable: true,
  signInWithGoogle: async () => {}, signOut: () => {},
  ...over,
});

describe('R4-DUX-07: the workspace top bar signs in and out', () => {
  it('signed out: the top bar has Sign in with Google, and it signs in', async () => {
    let signIns = 0;
    const view = await shellWith(account({ signInWithGoogle: async () => { signIns += 1; } }));
    try {
      const header = [...elements(view.container)].find((el) => el.tagName === 'HEADER');
      assert.ok(header, 'the top bar is there');
      const signIn = [...elements(header)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Sign in with Google');
      assert.ok(signIn, 'no sign-in control in the workspace top bar');
      view.act(() => { reactProps(signIn).onClick({}); });
      await settle(view);
      assert.equal(signIns, 1, 'the button signs in');
    } finally { await view.unmount(); }
  });

  it('signed in: the account menu signs out, with no second cloud icon', async () => {
    let signOuts = 0;
    const user = { uid: 'uid_riley', displayName: 'Riley Quinn', email: 'riley.quinn@example.test', photoURL: null };
    const view = await shellWith(account({ user, signOut: () => { signOuts += 1; } }));
    try {
      const avatar = buttons(view).find((el) => el.textContent.includes('Riley'));
      assert.ok(avatar, 'no account button in the workspace top bar');
      assert.equal([...elements(view.container)].filter((el) => el.getAttribute?.('data-testid') === 'sync-status').length, 0,
        'the jobs’ and boards’ icon alone tells their sync; the résumés’ icon stays away');
      view.act(() => { reactProps(avatar).onClick({}); });
      const signOut = buttons(view).find((el) => el.textContent.trim() === 'Sign out');
      assert.ok(signOut, 'the account menu has Sign out');
      view.act(() => { reactProps(signOut).onClick({}); });
      assert.equal(signOuts, 1, 'Sign out signs out');
    } finally { await view.unmount(); }
  });

  it('the routes hand the account to the workspace shell', async () => {
    const { AppRoutes, WorkspaceRoute } = await loadModule('/src/AppRoutes.jsx');
    const auth = account();
    const tree = AppRoutes({ store: {}, auth, sync: {}, seed: { waiting: false } });
    const routes = createRoutesFromChildren(tree.props.children.props.children);
    for (const path of ['/jobs', '/boards', '/boards/b1']) {
      const shell = matchRoutes(routes, path).find((m) => m.route.element?.type === WorkspaceRoute);
      assert.ok(shell, `${path} is inside the workspace shell`);
      assert.equal(shell.route.element.props.auth, auth, `${path}: the shell has the account`);
    }
  });
});
