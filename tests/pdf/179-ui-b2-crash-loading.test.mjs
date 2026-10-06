// UI rebuild B2 (cluster legal-and-states): the page-loading state and the crash fallback in the canvas
// look. Look only: "Loading…" is centred on the cv ground; the crash card is a .cv-card with the message
// in a .cv-notice-bad box, "Go to Home" (a full page load of "/") and "Try Again" (clears the error);
// a new resetKey still clears a caught error. The real ErrorBoundary and AppRoutes' PageLoading over fake-dom.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const find = (view, pick) => [...elements(view.container)].find(pick);
const button = (view, label) => find(view, (el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);

async function crashed(resetKey = 'a') {
  const { ErrorBoundary } = await loadModule('/src/components/ErrorBoundary.jsx');
  const box = { broken: true, assigned: [] };
  function Child() {
    if (box.broken) throw new Error('boom: chunk failed');
    return createElement('p', null, 'the page');
  }
  const quiet = console.error;
  console.error = () => {};
  const view = mount(({ key }) => createElement(ErrorBoundary, { resetKey: key }, createElement(Child)), { key: resetKey });
  // The boundary reads window.location, and mount's fake window is the one it sees.
  view.window.location = { assign: (to) => box.assigned.push(to) };
  return {
    view, box,
    close: async () => { await view.unmount(); console.error = quiet; },
  };
}

describe('crash fallback', () => {
  it('is a centred cv card with the message in a cv notice box and both buttons', async () => {
    const c = await crashed();
    try {
      const card = find(c.view, (el) => tokens(el).includes('cv-card'));
      assert.ok(card, 'the card uses .cv-card');
      assert.match(card.textContent, /Something went wrong/);
      assert.match(card.textContent, /An unexpected error occurred while loading this page\./);
      const note = find(c.view, (el) => el.tagName === 'PRE');
      assert.ok(tokens(note).includes('cv-notice-bad'), 'the message box is .cv-notice-bad');
      assert.equal(note.textContent.trim(), 'boom: chunk failed');
      assert.ok(button(c.view, 'Go to Home') && button(c.view, 'Try Again'), 'both buttons');
      const root = card.parentNode;
      for (const t of ['min-h-screen', 'bg-cv-ground', 'items-center', 'justify-center']) assert.ok(tokens(root).includes(t), t);
    } finally { await c.close(); }
  });

  it('Go to Home loads "/" in full; Try Again renders the page again; a new resetKey clears the error', async () => {
    const c = await crashed();
    try {
      c.view.act(() => reactProps(button(c.view, 'Go to Home')).onClick({}));
      assert.deepEqual(c.box.assigned, ['/']);
      c.box.broken = false;
      c.view.act(() => reactProps(button(c.view, 'Try Again')).onClick({}));
      assert.equal(c.view.container.textContent, 'the page');
    } finally { await c.close(); }
    const d = await crashed('a');
    try {
      assert.match(d.view.container.textContent, /Something went wrong/);
      d.box.broken = false;
      d.view.update({ key: 'b' });
      assert.equal(d.view.container.textContent, 'the page');
    } finally { await d.close(); }
  });
});

describe('page loading state', () => {
  it('is "Loading…" centred over the cv ground, in cv text', async () => {
    const { PageLoading } = await loadModule('/src/AppRoutes.jsx');
    const view = mount(() => createElement(PageLoading), {});
    try {
      const el = find(view, (e) => e !== view.container && e.textContent === 'Loading…');
      for (const t of ['min-h-screen', 'flex', 'items-center', 'justify-center', 'bg-cv-ground', 'text-cv-faint']) assert.ok(tokens(el).includes(t), `${t}: ${tokens(el).join(' ')}`);
      assert.equal(tokens(el).some((t) => /gray/.test(t)), false, 'no raw grey');
    } finally { await view.unmount(); }
  });
});
