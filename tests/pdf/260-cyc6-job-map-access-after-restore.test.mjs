// The Job Map page opened by a reload (or a link) sees the account signed out until the account is
// restored, and useJobMapAccess stored `false` for that. When the account arrived, the first render
// still read that stale false, and the page sent an allowed account to the Dashboard (Navigate "/")
// before the check could run. The hook now answers null (unknown) for a render whose account it has
// not asked about yet, and false only for no account.
// Run: node --test tests/pdf/260-cyc6-job-map-access-after-restore.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };

it('the render when the account arrives is unknown (null), not the signed-out false', async () => {
  const { useJobMapAccess } = await loadModule('/src/hooks/useJobMapAccess.js');
  const { mount } = await import('./fake-dom.mjs');
  const seen = [];
  function Probe({ user }) { seen.push(useJobMapAccess(user)); return null; }
  const view = mount(Probe, { user: null });
  try {
    await settle();
    assert.equal(seen.at(-1), false, 'signed out: no access');
    seen.length = 0;
    view.update({ user: { uid: 'u1' } });
    assert.equal(seen[0], null, 'the account just arrived: the page waits for the server, it does not redirect');
    await settle();
    seen.length = 0;
    view.update({ user: { uid: 'u2' } });
    assert.equal(seen[0], null, 'another account is asked about again, not given the last one\'s answer');
    seen.length = 0;
    view.update({ user: null });
    assert.equal(seen[0], false, 'signed out again: false at once');
  } finally {
    await view.unmount();
  }
});
