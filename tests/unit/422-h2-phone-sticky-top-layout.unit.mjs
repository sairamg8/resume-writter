// H2 hunt, followPhoneStickyTop (src/hooks/usePhoneStickyTop.js; the offset maths and wiring: 391-cycA-phone-sticky-top.unit.mjs):
//   - --stuck was read only at a scroll, a resize or a media change. The page above the box can change height with no scroll
//     (a storage notice appearing, the toolbar's filters opening, a title wrapping), which moves the box under the header and left
//     the header held off the top of <main> until the next scroll. The page the box sits in is now watched with a ResizeObserver.
//   - The value is rounded down, not to the nearest: a header a fraction of a pixel below the top of <main> shows a sliver of
//     the rows scrolling by above it.
//   - The property is inherited (every row below the box restyles on a write), so an unchanged value is not written again.
//   - The observer is disconnected with the rest on cleanup.
// Run: node --test tests/unit/422-h2-phone-sticky-top-layout.unit.mjs
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { followPhoneStickyTop } from '../../src/hooks/usePhoneStickyTop.js';

function target(extra = {}) {
  const on = new Map();
  return {
    on,
    addEventListener(type, fn) { on.set(type, fn); },
    removeEventListener(type, fn) { if (on.get(type) === fn) on.delete(type); },
    fire(type) { on.get(type)?.(); },
    ...extra,
  };
}

const observers = [];
class FakeObserver {
  constructor(fn) { this.fn = fn; this.watched = new Set(); observers.push(this); }
  observe(el) { this.watched.add(el); }
  disconnect() { this.watched.clear(); }
}

function setup() {
  const main = target({ top: 56, getBoundingClientRect() { return { top: this.top }; } });
  const page = {};
  const box = {
    top: 300,
    vars: {},
    writes: 0,
    parentElement: page,
    getBoundingClientRect() { return { top: this.top }; },
    closest(sel) { return sel === 'main' ? main : null; },
    style: { setProperty: (k, v) => { box.vars[k] = v; box.writes += 1; } },
  };
  const media = target({ matches: true });
  globalThis.window = target({ matchMedia: () => media });
  globalThis.ResizeObserver = FakeObserver;
  return { main, box, page };
}

afterEach(() => {
  delete globalThis.window;
  delete globalThis.ResizeObserver;
  observers.length = 0;
});

test('the page above the box changing height with no scroll moves --stuck', () => {
  const { box, page } = setup();
  box.top = 56 - 300; // scrolled 300 px past the box top
  followPhoneStickyTop(box);
  assert.equal(box.vars['--stuck'], '300px');
  assert.equal(observers.length, 1, 'one observer');
  assert.ok(observers[0].watched.has(page), 'it watches the page the box sits in');
  box.top += 50; // a notice appeared above the box: no scroll event
  observers[0].fn();
  assert.equal(box.vars['--stuck'], '250px', 'the header is held where the top of <main> now is');
});

test('a fraction of a pixel rounds down, so no row shows above the header', () => {
  const { main, box } = setup();
  followPhoneStickyTop(box);
  box.top = 56 - 240.6;
  main.fire('scroll');
  assert.equal(box.vars['--stuck'], '240px');
});

test('an unchanged value is not written again', () => {
  const { main, box } = setup();
  followPhoneStickyTop(box);
  const first = box.writes;
  for (let i = 0; i < 5; i += 1) main.fire('scroll');
  assert.equal(box.writes, first, 'five scrolls that moved nothing wrote nothing');
  box.top -= 10;
  main.fire('scroll');
  assert.equal(box.writes, first + 1);
});

test('the cleanup stops the observer; a window without ResizeObserver still works', () => {
  const { box } = setup();
  const stop = followPhoneStickyTop(box);
  stop();
  assert.equal(observers[0].watched.size, 0, 'nothing left observed');
  delete globalThis.ResizeObserver;
  const again = setup();
  delete globalThis.ResizeObserver;
  assert.equal(typeof followPhoneStickyTop(again.box), 'function');
});
