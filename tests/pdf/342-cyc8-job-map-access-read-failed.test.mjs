// hasJobMapAccess answered false for ANY error, so an allowed account that was offline (or whose read
// failed) was sent to the Dashboard by the Job Map page with no message. A read that FAILED is now its
// own answer, 'failed' (anything but the rules' clean permission-denied): the page shows a short message
// with a Retry button, and Retry asks again. A clean "no access" is still false, which redirects.
// The pure answer, the hook over a stand-in check, and the page's failed state in a MemoryRouter.
// Run: node --test tests/pdf/342-cyc8-job-map-access-read-failed.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

// No Firebase in this build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };

it('a refusal by the rules is no access; any other failed read is "could not check"', async () => {
  const { accessFromError } = await loadModule('/src/utils/jobMapIo.js');
  assert.equal(accessFromError({ code: 'permission-denied' }), false);
  assert.equal(accessFromError({ code: 'unavailable' }), 'failed', 'offline');
  assert.equal(accessFromError({ code: 'deadline-exceeded' }), 'failed');
  assert.equal(accessFromError(new Error('network down')), 'failed');
  assert.equal(accessFromError(undefined), 'failed');
});

it('the hook gives false for a clean refusal, "failed" for a failed check, and asks again when the attempt changes', async () => {
  const { useJobMapAccess } = await loadModule('/src/hooks/useJobMapAccess.js');
  const answers = [];
  let next = () => Promise.resolve('failed');
  const ask = () => { answers.push('asked'); return next(); };
  const seen = [];
  function Probe({ user, attempt }) { seen.push(useJobMapAccess(user, attempt, ask)); return null; }
  const view = mount(Probe, { user: { uid: 'u1' }, attempt: 0 });
  try {
    await settle();
    assert.equal(seen.at(-1), 'failed', 'the read failed: not false, so the page does not redirect');
    next = () => Promise.reject(new Error('chunk failed to load'));
    view.update({ user: { uid: 'u1' }, attempt: 1 });
    await settle();
    assert.equal(answers.length, 2, 'Retry asks again');
    assert.equal(seen.at(-1), 'failed', 'the check could not even run: failed too');
    next = () => Promise.resolve(true);
    view.update({ user: { uid: 'u1' }, attempt: 2 });
    await settle();
    assert.equal(answers.length, 3);
    assert.equal(seen.at(-1), true, 'the retry got through');
    next = () => Promise.resolve(false);
    view.update({ user: { uid: 'u1' }, attempt: 3 });
    await settle();
    assert.equal(seen.at(-1), false, 'a clean refusal is still false');
  } finally {
    await view.unmount();
  }
});

it('the page\'s failed state says so and offers Retry', async () => {
  const { JobMapAccessFailed } = await loadModule('/src/pages/JobMap.jsx');
  const auth = { user: null, authLoading: false, cloudAvailable: false };
  let retried = 0;
  function App() {
    return createElement(MemoryRouter, { initialEntries: ['/job-map'] },
      createElement(JobMapAccessFailed, { auth, sync: {}, onRetry: () => { retried += 1; } }));
  }
  const view = mount(App, {});
  try {
    assert.match(view.container.textContent, /Could not check whether this account can use the Job Map/);
    const retry = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Retry');
    assert.ok(retry, 'a Retry button');
    view.act(() => reactProps(retry).onClick({ preventDefault() {} }));
    assert.equal(retried, 1);
  } finally {
    await view.unmount();
  }
});

it('the page shows that state for "failed" and still redirects for a clean no access', () => {
  const page = readFileSync(new URL('../../src/pages/JobMap.jsx', import.meta.url), 'utf8');
  assert.match(page, /allowed === false\) return <Navigate to="\/" replace \/>/);
  assert.match(page, /allowed === 'failed'\) return <JobMapAccessFailed/);
  assert.match(page, /useJobMapAccess\(auth\.user, attempt\)/, 'Retry changes the attempt the check is asked for');
});
