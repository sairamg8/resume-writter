// The recovery notice on a phone, on the real RecoveryNotice (react-dom/client over tests/pdf/fake-dom.mjs,
// loaded through Vite). J-39: the notice was one flex row — the message beside unbreakable buttons
// ("Download the copy", "Download the earlier copy", Dismiss) — so at 375 px the buttons squeezed the
// message into a column a few words wide and the row overflowed. The tracker, the dashboard and the
// boards all show it. Without a layout engine the test reads the classes that decide it: the notice
// stacks (flex-col) below sm and is a row only from sm up, and the buttons are one wrapping row of
// their own, apart from the message, whose one long word (the backup key) may break.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const BACKUP = 'cpwtcv_jobs_v1_backup_1790000000000';
const EARLIER = 'cpwtcv_jobs_v1_backup_1780000000000';

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const classes = (el) => (el.getAttribute('class') ?? '').split(/\s+/);

it('J-39: on a phone the message is on top and the buttons wrap in a row of their own below it', async () => {
  const { RecoveryNotice } = await loadModule('/src/components/RecoveryNotice.jsx');
  globalThis.localStorage = memoryStorage([[BACKUP, '{"jobs": [ cut'], [EARLIER, '{"jobs": [ cut']]);
  const recovery = { backupKey: BACKUP, earlier: [EARLIER] };
  const view = mount(() => createElement(RecoveryNotice, { what: 'job list', recovery, onDismiss() {} }), {});
  try {
    const all = [...elements(view.container)];
    const alert = all.find((el) => el.getAttribute('role') === 'alert');
    const buttons = all.filter((el) => el.tagName === 'BUTTON');
    assert.deepEqual(buttons.map((b) => b.textContent), ['Download the copy', 'Download the earlier copy', 'Dismiss']);

    const own = classes(alert);
    assert.ok(own.includes('flex-col'), `the notice stacks on a phone: ${alert.getAttribute('class')}`);
    assert.ok(own.includes('sm:flex-row'), 'and is a row from sm up');
    assert.ok(!own.includes('flex-row') && !own.includes('flex-wrap'), 'not a row below sm');

    // The buttons share one parent, a wrapping row that holds nothing else — not the notice itself.
    const row = buttons[0].parentNode;
    assert.notEqual(row, alert, 'the buttons are not items of the notice\'s own row beside the message');
    for (const b of buttons) assert.equal(b.parentNode, row);
    assert.ok(classes(row).includes('flex-wrap'), `the buttons wrap: ${row.getAttribute('class')}`);
    assert.equal(row.childNodes.length, buttons.length, 'the row holds only the buttons');

    const message = alert.childNodes.find((el) => el !== row);
    assert.match(message.textContent, /could not be read in full/);
    assert.ok(message.textContent.includes(BACKUP));
    assert.ok(classes(message).includes('[overflow-wrap:anywhere]'), 'the backup key, one long word, may break');
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
