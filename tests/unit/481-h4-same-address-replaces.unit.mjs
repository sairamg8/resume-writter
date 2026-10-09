// Defect (the parked "double click pushes two history entries"): the app's router renders a navigation in
// a transition, and React Router's Link decides push or replace from the location it last rendered. While a
// page's code was still loading that was still the old page, so the second press of a double click on a link
// was a link to somewhere else and pushed the same page again: Back from it landed on the same page.
// replaceSameAddress (src/utils/replaceSameAddress.js, applied to the router in main.jsx) asks the router's
// own location instead, which is already the new one. The real function over react-router's memory router;
// the presses are router.navigate(to, { replace: false }) as a Link makes them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMemoryRouter } from 'react-router-dom';
import { replaceSameAddress } from '../../src/utils/replaceSameAddress.js';

const wait = () => new Promise((r) => { setTimeout(r, 15); });
const at = (router) => `${router.state.location.pathname}${router.state.location.search}${router.state.location.hash}`;
const open = (start = '/') => replaceSameAddress(createMemoryRouter([{ path: '*', element: null }], { initialEntries: [start] }));
/** Back, once the router has taken the step. */
async function back(router) {
  await router.navigate(-1);
  await wait();
}

test('a second press on the link to the page it is on replaces that entry: one Back leaves the page', async () => {
  const router = open('/');
  await router.navigate('/jobs/new', { replace: false });
  await router.navigate('/jobs/new', { replace: false });
  assert.equal(at(router), '/jobs/new');
  await back(router);
  assert.equal(at(router), '/', 'before: Back landed on the same page again');
});

test('a link to another page, or the same page with another search or hash, still pushes', async () => {
  const router = open('/');
  await router.navigate('/boards', { replace: false });
  await router.navigate('/boards?create=1', { replace: false });
  await router.navigate('/boards?create=1#x', { replace: false });
  await router.navigate('/jobs', { replace: false });
  assert.equal(at(router), '/jobs');
  await back(router);
  assert.equal(at(router), '/boards?create=1#x');
  await back(router);
  assert.equal(at(router), '/boards?create=1');
  await back(router);
  assert.equal(at(router), '/boards');
  await back(router);
  assert.equal(at(router), '/');
});

test('a navigation that carries a state, an explicit replace, a number or an address that is not text is left as it was asked', async () => {
  const router = open('/');
  await router.navigate('/boards', { replace: false });
  await router.navigate('/boards', { replace: false, state: { createFromList: true } });
  assert.deepEqual(router.state.location.state, { createFromList: true });
  await back(router);
  assert.equal(at(router), '/boards', 'a state is a different place: it was pushed');
  await router.navigate('/boards', { replace: true });
  await router.navigate({ pathname: '/boards', search: '?issue=A-1' });
  await back(router);
  assert.equal(at(router), '/boards');
  await back(router);
  assert.equal(at(router), '/');
});

test('main.jsx hands the router through replaceSameAddress', () => {
  const main = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8');
  assert.match(main, /replaceSameAddress\(createHashRouter\(/);
});
