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

const settle = async (view) => {
  for (let i = 0; i < 12; i += 1) {
    await new Promise((r) => { setImmediate(r); });
    view.act(() => {});
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
  const quiet = console.error;
  console.error = () => {};
  const net = network();
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const view = open(Page);
  try {
    await settle(view);
    assert.equal(view.container.textContent, 'crashed');
    assert.equal(net.attempts, 1);
    net.up = true;
    view.act(() => boundary.again());
    await settle(view);
    assert.equal(view.container.textContent, 'the editor', 'before: the failed load was kept, and the crash came back');
    assert.equal(net.attempts, 2);
  } finally {
    await view.unmount();
    console.error = quiet;
  }
});

test('a page that keeps failing shows its error and asks once per Try Again: no loop in the background', async () => {
  const quiet = console.error;
  console.error = () => {};
  const net = network();
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const view = open(Page);
  try {
    await settle(view);
    await settle(view);
    assert.equal(view.container.textContent, 'crashed');
    assert.equal(net.attempts, 1, 'a failure must not make the page ask again by itself');
    view.act(() => boundary.again());
    await settle(view);
    assert.equal(view.container.textContent, 'crashed');
    assert.equal(net.attempts, 2, 'one more ask for the one Try Again');
    await settle(view);
    assert.equal(net.attempts, 2);
  } finally {
    await view.unmount();
    console.error = quiet;
  }
});

test('a page that loaded stays loaded: a later mount does not fetch it again', async () => {
  const net = network();
  net.up = true;
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const first = open(Page);
  await settle(first);
  assert.equal(first.container.textContent, 'the editor');
  await first.unmount();
  const second = open(Page);
  try {
    await settle(second);
    assert.equal(second.container.textContent, 'the editor');
    assert.equal(net.attempts, 1);
  } finally {
    await second.unmount();
  }
});

test('a page whose load failed while nobody was looking is asked for again by the next mount', async () => {
  const net = network();
  const Page = lazyPage(() => net.load(), 'Editor', offline());
  const quiet = console.error;
  console.error = () => {};
  const first = open(Page);
  await first.unmount(); // left before the answer came: the load fails with nobody to show it to
  await new Promise((r) => { setImmediate(r); });
  assert.equal(net.attempts, 1);
  net.up = true;
  const second = open(Page);
  try {
    await settle(second);
    assert.equal(second.container.textContent, 'the editor');
    assert.equal(net.attempts, 2);
  } finally {
    await second.unmount();
    console.error = quiet;
  }
});
