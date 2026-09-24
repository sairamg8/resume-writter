// useMediaQuery / useIsMobile decide whether the editor shows its phone layout (R2-162): below
// 768 px the Edit | Preview switch replaces the split view and the preview is hidden until asked
// for. The old "test" here only checked the two exports were functions — it never called the hook.
// Now the hook runs in a component: mounted with react-dom/client over tests/pdf/fake-dom.mjs, on a
// window whose matchMedia answers for a width the test sets and fires `change` as a browser does
// when a resize crosses the query; and through the server renderer, where there is no window.
// The browser end of it — the tabbed layout at 375 × 812 — is cypress/e2e/26-mobile-layout.cy.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { mount } from '../pdf/fake-dom.mjs';
import { useMediaQuery, useIsMobile } from '../../src/hooks/useMediaQuery.js';

/**
 * A matchMedia over a viewport `width` for the (min-width) and (max-width) queries the app uses.
 * `resize(w)` changes the width and fires `change` at every list whose answer flips — only those,
 * as a browser does. `listeners()` counts the change listeners still attached.
 */
function fakeMatchMedia(width) {
  let viewport = width;
  const lists = [];
  const answer = (query) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+)px\)/.exec(query);
    return (!min || viewport >= Number(min[1])) && (!max || viewport <= Number(max[1]));
  };
  function matchMedia(query) {
    const handlers = new Set();
    const list = {
      media: query,
      matches: answer(query),
      addEventListener: (type, fn) => { if (type === 'change') handlers.add(fn); },
      removeEventListener: (type, fn) => { if (type === 'change') handlers.delete(fn); },
      handlers,
    };
    lists.push(list);
    return list;
  }
  return {
    matchMedia,
    queries: () => lists.map((l) => l.media),
    listeners: () => lists.reduce((n, l) => n + l.handlers.size, 0),
    resize(w) {
      viewport = w;
      for (const list of lists) {
        const now = answer(list.media);
        if (now === list.matches) continue;
        list.matches = now;
        // The handlers as the event fires, as a browser takes them: one removed meanwhile still runs.
        for (const fn of Array.from(list.handlers)) fn({ matches: now, media: list.media });
      }
    },
  };
}

/** Both hooks in one component, printed as text: `query <bool> · mobile <bool>`. */
function Probe({ query = '(min-width: 768px)', breakpoint }) {
  const matches = useMediaQuery(query);
  const mobile = breakpoint === undefined ? useIsMobile() : useIsMobile(breakpoint);
  return createElement('p', null, `query ${matches} · mobile ${mobile}`);
}

/**
 * Probe mounted on a fake page at `width` px. fake-dom makes its window as it mounts, so the page
 * starts empty, gets its matchMedia, and only then renders the Probe — its first render (the
 * useState initializer) already reads the viewport.
 */
function mountAt(width, props = {}) {
  const media = fakeMatchMedia(width);
  const view = mount(({ show, ...rest }) => (show ? createElement(Probe, rest) : null), { show: false });
  view.window.matchMedia = media.matchMedia;
  view.update({ show: true, ...props });
  return { view, media, text: () => view.container.textContent };
}

/** Lets React run the re-render an effect scheduled (a scheduler task: setImmediate in Node). */
const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); }); };

describe('useMediaQuery and useIsMobile answer for the viewport (R2-162)', () => {
  it('a 375 px phone is mobile; a 1440 px desktop is not; 768 px (Tailwind md) is the first desktop width', async () => {
    for (const [width, expected] of [[375, 'query false · mobile true'], [767, 'query false · mobile true'], [768, 'query true · mobile false'], [1440, 'query true · mobile false']]) {
      const { view, text } = mountAt(width);
      try {
        assert.equal(text(), expected, `${width} px`);
      } finally { await view.unmount(); }
    }
  });

  it('the answer is right on the first render, before any effect has run', () => {
    // The server renderer runs the useState initializer and never the effects.
    const saved = globalThis.window;
    globalThis.window = { matchMedia: fakeMatchMedia(375).matchMedia };
    try {
      assert.equal(renderToString(createElement(Probe)), '<p>query false · mobile true</p>');
    } finally {
      if (saved === undefined) delete globalThis.window;
      else globalThis.window = saved;
    }
  });

  it('turning a tablet across 768 px switches the layout both ways, with no reload', async () => {
    const { view, media, text } = mountAt(1024);
    try {
      assert.equal(text(), 'query true · mobile false');
      view.act(() => media.resize(600));
      assert.equal(text(), 'query false · mobile true');
      view.act(() => media.resize(900));
      assert.equal(text(), 'query true · mobile false');
    } finally { await view.unmount(); }
  });

  it('a new breakpoint is listened to from then on, and the old query is let go', async () => {
    const { view, media, text } = mountAt(1000);
    try {
      assert.equal(text(), 'query true · mobile false');
      view.update({ show: true, breakpoint: 1200 });
      await settle();
      assert.equal(text(), 'query true · mobile true', 'the answer for the new breakpoint');
      assert.ok(media.queries().includes('(min-width: 1200px)'));
      // One listener per hook call — the one for 768 px is gone, not left behind next to 1200 px's.
      assert.equal(media.listeners(), 2);
      view.act(() => media.resize(1300));
      assert.equal(text(), 'query true · mobile false');
    } finally { await view.unmount(); }
  });

  it('unmounting removes every change listener it added', async () => {
    const { view, media } = mountAt(375);
    assert.equal(media.listeners(), 2);
    await view.unmount();
    assert.equal(media.listeners(), 0);
  });

  it('without a window (the server renderer) or without matchMedia it answers false and does not throw', async () => {
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(renderToString(createElement(Probe)), '<p>query false · mobile true</p>');

    const view = mount(Probe, {});
    try {
      assert.equal(typeof view.window.matchMedia, 'undefined');
      assert.equal(view.container.textContent, 'query false · mobile true');
    } finally { await view.unmount(); }
  });
});
