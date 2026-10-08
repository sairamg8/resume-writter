// Import before the dialog's code has arrived (a slow connection, the idle warm-up not done): the pressed button says
// "Opening…" and is disabled, as "Reading…" does, so the person does not tap again; it is back to Import when the dialog
// arrives. The real Dashboard, loaders.import replaced by a promise that has not settled.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { dashboard, until } from './cyc3-dashboard.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const cv = (id, name) => ({ ...resume({ personal: { name: `${name} Person` } }), id, name, updatedAt: 1000 });

it('Import with the dialog still arriving reads Opening… and is disabled; when it arrives the dialog shows and Import is back', async () => {
  const { _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  const trueImport = _lazyForTest.loaders.import;
  let arrive;
  const slow = new Promise((r) => { arrive = r; });
  const page = await dashboard([cv('resume_a', 'Only CV')], { import: () => slow });
  try {
    page.press('Import');
    await until(() => page.button('Opening…'), 'Opening…');
    const opening = page.button('Opening…');
    assert.ok(opening.disabled || opening.hasAttribute('disabled'), 'disabled');
    assert.equal(page.button('Import'), undefined, 'not offered again');
    arrive(await trueImport());
    await until(() => page.dialog(), 'the dialog');
    await until(() => page.button('Import'), 'Import back');
    assert.equal(page.button('Opening…'), undefined);
  } finally { await page.close(); }
});

it('the dialog\'s code failing: the button is back to Import (the file picker opens, as before)', async () => {
  const page = await dashboard([cv('resume_a', 'Only CV')], { import: () => Promise.reject(new TypeError('offline')) });
  try {
    page.press('Import');
    await until(() => page.button('Import') && !page.button('Opening…'), 'Import back after the failure');
  } finally { await page.close(); }
});
