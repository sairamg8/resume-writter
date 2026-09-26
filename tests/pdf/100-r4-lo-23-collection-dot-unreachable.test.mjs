// R4-LO-23: the workspace top bar's cloud icon for the jobs and the boards (CollectionSyncDot) took
// any 'offline' status for the browser being offline and said "Offline". But a failed sync reports
// 'offline' with the browser online too (failureReport: "client is offline" — Wi-Fi with no
// internet, a captive portal, a blocked host), where the résumés' icon says the account cannot be
// reached (R4-SYNC-02). The top bar now reads the browser's own online flag, as the résumés' icon
// does: the same status says the same thing in both icons, and "Offline" only when it is.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

async function dotAt(path) {
  const { CollectionSyncDot } = await loadModule('/src/components/shell/CollectionSyncDot.jsx');
  const App = () => createElement(MemoryRouter, { initialEntries: [path] }, createElement(CollectionSyncDot));
  const view = mount(App, {});
  const label = () => [...elements(view.container)].find((el) => el.getAttribute?.('data-testid') === 'sync-status')?.getAttribute('aria-label');
  return { view, label };
}

it("a job sync that cannot reach the server, the browser online, says so rather than 'Offline'", async () => {
  const { failureReport } = await loadModule('/src/utils/cloudSyncRetry.js');
  const { collectionSyncStatus: status } = await loadModule('/src/utils/collectionSyncMeta.js');
  const { status: said } = failureReport(new Error('Failed to get document because the client is offline.'), true, 'jobs first sync');
  assert.equal(said, 'offline', 'what the engine reports');
  status.set('jobs', said);
  status.set('boards', 'synced');
  const { view, label } = await dotAt('/jobs');
  try {
    assert.equal(label(), 'Cannot reach your account — changes saved locally, will retry', "before: 'Offline — changes saved locally'");

    // The browser going offline: now it is "Offline", as on the résumés' icon.
    view.window.navigator.onLine = false;
    view.act(() => view.window.dispatchEvent({ type: 'offline' }));
    assert.equal(label(), 'Offline — changes saved locally');
  } finally {
    await view.unmount();
    status.set('jobs', 'idle');
    status.set('boards', 'idle');
  }
});
