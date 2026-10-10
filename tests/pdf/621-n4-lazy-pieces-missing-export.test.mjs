// "Minified React error #306" (a React.lazy that resolved to { default: undefined }): the Documents page's pieces
// (components/lazyPiece.jsx) and the Job Map's access panel slot (pages/JobMap.jsx) take a module's default export.
// A module that loaded without it (a tab mixing the files of two builds) must be the failure those places already
// handle: a piece shows its fallback with Try again, the slot draws nothing. It reached React as undefined before.
// The real lazyPiece and JobMap over tests/pdf/fake-dom.mjs; the loaders are replaced by ones that resolve oddly.
// Run: node --test tests/pdf/621-n4-lazy-pieces-missing-export.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

// No Firebase in this build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

let lazyPiece;
let jobMap;
before(async () => {
  patchFakeDom();
  await setup();
  lazyPiece = await loadModule('/src/components/lazyPiece.jsx');
  jobMap = await loadModule('/src/pages/JobMap.jsx');
});
after(teardown);

const settle = async () => { for (let i = 0; i < 25; i += 1) await new Promise((r) => { setTimeout(r, 5); }); };
// React holds back the reveal of a lazy piece for a moment after the pending line showed (its Suspense
// throttle): wait on what the view shows, not on a count of ticks.
async function until(view, text) {
  for (let i = 0; i < 500; i += 1) {
    view.act(() => {});
    if (view.container.textContent === text) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  assert.equal(view.container.textContent, text);
}
const fallback = (retry, tries) => createElement('button', { onClick: retry }, `fallback ${tries}`);

it('a piece whose module has no default shows its fallback, and Try again loads it once it is there', async () => {
  const { Lazy, loaders } = lazyPiece;
  const real = loaders.letter;
  const state = { good: false, asked: 0 };
  loaders.letter = () => { state.asked += 1; return Promise.resolve(state.good ? { default: () => createElement('p', null, 'the piece') } : { Other: () => null }); };
  const log = console.error;
  console.error = () => {};
  const view = mount(Lazy, { load: 'letter', fallback, pending: createElement('i', null, 'pending') });
  try {
    await until(view, 'fallback 0');
    assert.equal(state.asked, 1);
    state.good = true;
    const retry = [...elements(view.container)].find((el) => el.tagName === 'BUTTON');
    view.act(() => reactProps(retry).onClick({}));
    await until(view, 'the piece');
    assert.equal(state.asked, 2, 'asked again, not kept as a failure');
  } finally {
    await view.unmount();
    loaders.letter = real;
    console.error = log;
  }
});

it('the Job Map access panel slot draws nothing for a module whose default is not a component', async () => {
  const { AccessPanelSlot } = jobMap;
  const log = console.error;
  console.error = () => {};
  const view = mount(AccessPanelSlot, { email: 'a@example.org', load: () => Promise.resolve({ default: { not: 'a component' } }) });
  try {
    await settle();
    assert.equal(view.container.textContent, '');
  } finally {
    await view.unmount();
    console.error = log;
  }
});

it('the Job Map page is a named export as well as the default: the route loads it by name', () => {
  assert.equal(typeof jobMap.JobMap, 'function');
  assert.equal(jobMap.default, jobMap.JobMap);
});
