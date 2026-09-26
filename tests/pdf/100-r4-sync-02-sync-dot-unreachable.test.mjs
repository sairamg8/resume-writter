// R4-SYNC-02: on a network where the browser says it is online but Firestore cannot reach its
// server (Wi-Fi with no internet, a captive portal, a blocked host), a failed sync reports status
// 'offline' ("client is offline", cloudSyncRetry.failureReport) while isOnline stays true. The
// header's sync icon matched none of its cases and vanished, so nothing said that edits were not
// reaching the account while the engine kept retrying. It now stays, and says so.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

it("'offline' from the sync with the browser online keeps the icon, saying the account cannot be reached", async () => {
  const { failureReport } = await loadModule('/src/utils/cloudSyncRetry.js');
  const { status } = failureReport(new Error('Failed to get document because the client is offline.'), true, 'First sync');
  assert.equal(status, 'offline', 'what the engine reports');

  const { SyncDot } = await loadModule('/src/components/AuthBar.jsx');
  const view = mount(SyncDot, { syncStatus: status, lastSynced: null, isOnline: true, heldResumes: [] });
  try {
    const dot = [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'sync-status');
    assert.ok(dot, 'the sync icon is shown');
    assert.match(dot.getAttribute('aria-label'), /cannot reach your account/i);
    assert.match(dot.getAttribute('aria-label'), /saved locally/i);
  } finally {
    await view.unmount();
  }
});

it('the browser offline still reads "Offline"', async () => {
  const { SyncDot } = await loadModule('/src/components/AuthBar.jsx');
  const view = mount(SyncDot, { syncStatus: 'offline', lastSynced: null, isOnline: false, heldResumes: [] });
  try {
    const dot = [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'sync-status');
    assert.equal(dot.getAttribute('aria-label'), 'Offline — changes saved locally');
  } finally {
    await view.unmount();
  }
});
