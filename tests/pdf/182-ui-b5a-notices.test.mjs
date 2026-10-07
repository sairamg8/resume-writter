// UI rebuild B5a: the notices above the Documents grid keep their texts and actions, drawn with the canvas's
// notice classes: storage full / blocked, the recovery notice (Dismiss), originals waiting.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { cv, dashboard, text } from './182-ui-b5a-mount.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const list = () => [cv('resume_a', 'A CV', 1000)];
const alerts = (page) => page.all().filter((el) => el.getAttribute('role') === 'alert');

it('storage full and storage blocked say what happened and what to do (SHEL-052)', async () => {
  const { notSavedMessage } = await import('../../src/utils/storageBackup.js');
  for (const reason of ['full', 'blocked']) {
    const page = await dashboard(list(), { persistError: reason });
    try {
      const expected = notSavedMessage('dashboard', reason);
      assert.ok(expected.length > 20, 'the live text');
      const found = alerts(page).find((el) => text(el) === expected);
      assert.ok(found, `the ${reason} notice shows the live text`);
      assert.match(String(found.getAttribute('class') ?? found.className), /cv-notice-bad/);
    } finally { await page.close(); }
  }
});

it('the recovery notice names what could not be read and Dismiss clears it', async () => {
  const page = await dashboard(list(), { recovery: { backupKey: null, earlier: [] } });
  try {
    assert.match(page.text(), /Your saved résumés could not be read in full/);
    assert.match(page.text(), /Browser storage is full, so no copy of the original could be kept/);
    page.press(page.button('Dismiss'));
    assert.equal(page.calls.dismissed, 1);
  } finally { await page.close(); }
});

it('originals waiting says they come back when the account can be reached', async () => {
  const page = await dashboard(list(), { originalsWaiting: true });
  try {
    assert.match(page.text(), /Your originals come back as soon as your account can be reached again\./);
  } finally { await page.close(); }
});

it('no notice shows when nothing is wrong', async () => {
  const page = await dashboard(list());
  try {
    assert.equal(alerts(page).length, 0);
    assert.doesNotMatch(page.text(), /could not be read|originals come back/);
  } finally { await page.close(); }
});
