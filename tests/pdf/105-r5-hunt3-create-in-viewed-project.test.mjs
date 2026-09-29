// R5-HUNT3-create-shortcut-opens-first-project: on a project's page the top bar's Create (and the
// `c` key, which runs the same handler) opened the create-issue dialog with no project, so the
// dialog fell back to the first project listed and the new issue landed there instead of in the
// project being viewed. Pinned: the workspace shell opens the dialog with `boardId` = the project
// of the /boards/:id page (Board, List, Backlog, …), and with no project off a project page. The
// shell is mounted with react-dom/client over tests/pdf/fake-dom.mjs. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

const settle = async (view) => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    view.act(() => {});
  }
};

/** The shell at `path`; returns the defaults the create dialog opens with after the top bar's Create. */
async function createDefaultsAt(path) {
  const opened = [];
  const renderCreate = ({ open, defaults }) => { if (open) opened.push(defaults); return null; };
  const page = createElement('p', null, 'PAGE');
  const App = () => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null,
      createElement(Route, { element: createElement(WorkspaceLayout, { projects: [], renderCreate }) },
        createElement(Route, { path: '/work', element: page }),
        createElement(Route, { path: '/boards/:id', element: page }),
        createElement(Route, { path: '/boards/:id/list', element: page }),
        createElement(Route, { path: '/boards/:id/backlog', element: page }))));
  const view = mount(App, {});
  try {
    await settle(view);
    const create = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Create an issue (c)');
    assert.ok(create, 'the top bar has Create');
    view.act(() => { reactProps(create).onClick({}); });
    await settle(view);
    assert.ok(opened.length > 0, 'Create opens the dialog');
    return opened.at(-1);
  } finally { await view.unmount(); }
}

describe('R5-HUNT3: the top bar’s Create opens in the project being viewed', () => {
  for (const path of ['/boards/b_web', '/boards/b_web/list', '/boards/b_web/backlog']) {
    it(`on ${path} the dialog opens in that project`, async () => {
      const defaults = await createDefaultsAt(path);
      assert.equal(defaults.boardId, 'b_web', 'the new issue goes to the project on screen, not the first one listed');
    });
  }

  it('off a project page no project is forced', async () => {
    const defaults = await createDefaultsAt('/work');
    assert.equal(defaults.boardId, undefined);
  });
});
