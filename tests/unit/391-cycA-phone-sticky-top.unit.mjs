// U1 follow-up: on a phone <main> scrolls the project pages as one page, and the box under the header (overflow-x: auto) is
// content-high, so a `sticky top-0` header inside it stuck to a box that never moves: the List's table header, the Timeline's day
// header and the swimlane header scrolled away. followPhoneStickyTop keeps `--stuck` on the box as how far its top has passed the
// top of <main> (0 from md up), and each header takes `max-md:top-[var(--stuck,0px)]`. Node has no layout: this pins the offset
// maths and the wiring; the real geometry after a scroll is tests/playwright/ui-cycA-phone-sticky-headers.spec.mjs.
// Run: node --test tests/unit/391-cycA-phone-sticky-top.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { followPhoneStickyTop } from '../../src/hooks/usePhoneStickyTop.js';

/** A target that records its listeners; `fire` runs the one for a type. */
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

function setup({ phone }) {
  const main = target({ top: 56, getBoundingClientRect() { return { top: this.top }; } });
  const box = {
    top: 300,
    vars: {},
    getBoundingClientRect() { return { top: this.top }; },
    closest(sel) { return sel === 'main' ? main : null; },
    style: { setProperty: (k, v) => { box.vars[k] = v; } },
  };
  const media = target({ matches: phone });
  const win = target({ matchMedia: () => media });
  globalThis.window = win;
  return { main, box, media, win };
}

test('on a phone --stuck is how far the box top has gone above the top of <main>, and follows each scroll', () => {
  const { main, box } = setup({ phone: true });
  followPhoneStickyTop(box);
  assert.equal(box.vars['--stuck'], '0px', 'the box is below the top of <main>: nothing to hold');
  box.top = 56 - 240; // the page scrolled 240 px beyond the box top
  main.fire('scroll');
  assert.equal(box.vars['--stuck'], '240px');
  box.top = 56;
  main.fire('scroll');
  assert.equal(box.vars['--stuck'], '0px', 'scrolled back up');
});

test('from md up --stuck stays 0: the box scrolls itself and top-0 does the work', () => {
  const { main, box, media } = setup({ phone: false });
  followPhoneStickyTop(box);
  box.top = -500;
  main.fire('scroll');
  assert.equal(box.vars['--stuck'], '0px');
  media.matches = true; // turned to a phone
  media.fire('change');
  assert.equal(box.vars['--stuck'], '556px', 'a change of the media query re-reads it');
});

test('the cleanup removes every listener; a box outside <main> or a window without matchMedia is left alone', () => {
  const { main, box, media, win } = setup({ phone: true });
  const stop = followPhoneStickyTop(box);
  assert.equal(typeof stop, 'function');
  stop();
  assert.equal(main.on.size + media.on.size + win.on.size, 0, 'nothing left listening');
  assert.equal(followPhoneStickyTop({ closest: () => null }), undefined, 'no <main>');
  globalThis.window = {};
  assert.equal(followPhoneStickyTop({ closest: () => main }), undefined, 'no matchMedia');
  delete globalThis.window;
});

test('the List, Timeline and Board (swimlane) headers hold --stuck below md, and their scroll box has the ref', () => {
  const src = (n) => fs.readFileSync(new URL(`../../src/pages/${n}`, import.meta.url), 'utf8');
  const cases = [
    ['ProjectList.jsx', '<thead className="sticky top-0 z-10 max-md:top-[var(--stuck,0px)]">'],
    ['ProjectTimeline.jsx', '<div className="sticky top-0 z-20 flex border-b border-cv-hairline bg-cv-surface max-md:top-[var(--stuck,0px)]">'],
    ['Board.jsx', '<div className="sticky top-0 z-10 flex gap-2 bg-cv-surface pb-1 max-md:top-[var(--stuck,0px)]">'],
  ];
  for (const [name, header] of cases) {
    const text = src(name);
    assert.ok(text.includes(header), `${name}: the sticky header takes its top from --stuck below md`);
    assert.match(text, /const stickyRef = usePhoneStickyTop\(\);/, `${name}: asks for the ref`);
    assert.match(text, /<div ref=\{stickyRef\} className=\{?(?:cx\()?['"][^'"]*overflow-auto/, `${name}: the overflow-auto box carries it`);
  }
});
