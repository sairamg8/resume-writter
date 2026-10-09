// Defect (the parked "offline failed route chunk crash screen"): a route's page whose file could not be
// fetched (offline, a flaky connection) showed the crash screen, and React.lazy kept that failure for good:
// Try Again, and every link back to the page, failed again without asking for the file, even once the
// connection was back. Only a reload of the tab helped. lazyPage (src/utils/lazyPage.js) makes a page
// that asks for its file again the next time it mounts after a failure (Try Again, or the route left and
// opened again), never within one mount (no loop), and keeps a page that loaded.
// The real lazyPage over tests/pdf/fake-dom.mjs, with a boundary written here (createElement only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Component, Suspense, createElement } from 'react';
import { mount } from '../pdf/fake-dom.mjs';
import { lazyPage } from '../../src/utils/lazyPage.js';

// React holds back the reveal of a page for a moment after it showed the loading line (its Suspense
// throttle): wait on what the page shows, not on a count of ticks.
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
async function until(view, text) {
  for (let i = 0; i < 500; i += 1) {
    view.act(() => {});
    if (view.container.textContent === text) return;
    await wait(10);
  }
  assert.fail(`never showed "${text}", it shows "${view.container.textContent}"`);
}
/** Time enough for a loop in the background to show itself. */
const still = async (view) => {
  for (let i = 0; i < 40; i += 1) {
    view.act(() => {});
    await wait(10);
  }
};

/** An error boundary as the app's: the crash is a line of text, and `again()` is its Try Again. */
let boundary = null;
class Boundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  again() { this.setState({ crashed: false }); }
  render() { return this.state.crashed ? createElement('p', null, 'crashed') : this.props.children; }
}
const hold = (b) => { if (b) boundary = b; };

/** A route that loads `Page`: a Suspense under the boundary, as AppRoutes' RouteFrame lays it out. */
function open(Page) {
  return mount(() => createElement(Boundary, { ref: hold },
    createElement(Suspense, { fallback: createElement('p', null, 'loading') }, createElement(Page))), {});
}

/** A page loader the test controls: `net.up` is whether its file can be fetched, `net.attempts` how often it was asked. */
function network() {
  const net = {
    up: false,
    attempts: 0,
    load() {
      net.attempts += 1;
      return net.up
        ? Promise.resolve({ Editor: () => createElement('p', null, 'the editor') })
        : Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Editor-abc.js'));
    },
  };
  return net;
}
/** loadPage's environment: offline, so a failure is an error to show, never a reload of the tab. */
const offline = () => ({ online: false, reload() { throw new Error('the tab must not reload'); } });

test('Try Again after a failed load asks for the page again, and shows it once the network is back', async () => {
  const log = console.error;
  console.error = () => {};
  const net = network();
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const view = open(Page);
  try {
    await until(view, 'crashed');
    assert.equal(net.attempts, 1);
    net.up = true;
    view.act(() => boundary.again());
    await until(view, 'the editor'); // before: the failed load was kept, and the crash came back
    assert.equal(net.attempts, 2);
  } finally {
    await view.unmount();
    console.error = log;
  }
});

test('a page that keeps failing shows its error and asks once per Try Again: no loop in the background', async () => {
  const log = console.error;
  console.error = () => {};
  const net = network();
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const view = open(Page);
  try {
    await until(view, 'crashed');
    await still(view);
    assert.equal(view.container.textContent, 'crashed');
    assert.equal(net.attempts, 1, 'a failure must not make the page ask again by itself');
    view.act(() => boundary.again());
    await still(view);
    assert.equal(view.container.textContent, 'crashed');
    assert.equal(net.attempts, 2, 'one more ask for the one Try Again');
  } finally {
    await view.unmount();
    console.error = log;
  }
});

test('a page that loaded stays loaded: a later mount does not fetch it again', async () => {
  const net = network();
  net.up = true;
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const first = open(Page);
  await until(first, 'the editor');
  await first.unmount();
  const second = open(Page);
  try {
    await until(second, 'the editor');
    assert.equal(net.attempts, 1);
  } finally {
    await second.unmount();
  }
});

test('a page whose load failed while nobody was looking is asked for again by the next mount', async () => {
  const net = network();
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const log = console.error;
  console.error = () => {};
  const first = open(Page);
  await first.unmount(); // left before the answer came: the load fails with nobody to show it to
  await wait(30);
  assert.equal(net.attempts, 1);
  net.up = true;
  const second = open(Page);
  try {
    await until(second, 'the editor');
    assert.equal(net.attempts, 2);
  } finally {
    await second.unmount();
    console.error = log;
  }
});
