// R4-DVIS-15: the workspace top bar's quick search was hand-rolled and did not match the kit's
// SearchInput in the page toolbars right under it: a pale border-line border where the kit's controls
// have border-[#8590a2]/70 (controlClass), 14 px text where the small kit control has 13 px, and a bare
// <kbd> for its '/' key cap instead of the kit's Kbd, shown at every width where SearchInput hides its
// cap below md (no keyboard on a phone or a tablet). Pinned: the box is drawn with the kit's
// controlClass({ size: 'sm' }), the cap is the kit's Kbd, hidden below md, and it stays hidden from
// screen readers as the bare cap was. The real TopBar is mounted over tests/pdf/fake-dom.mjs through
// Vite's SSR loader, as in tests/unit/r4-lo-25-quick-search-shrunk-list.unit.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, byAttr, elements } from '../unit/ui-dom-harness.mjs';

let kit;
let TopBar;
let controlClass;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
  ({ controlClass } = await kit.load('/src/components/ui/Field.jsx'));
});
after(() => kit?.close());

const tokensOf = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

async function topBar() {
  const App = () => createElement(MemoryRouter, { initialEntries: ['/boards'] },
    createElement(TopBar, { projects: [], search: () => [] }));
  const view = mount(App, {});
  const box = byAttr(view.container, 'aria-label', 'Search issues and projects')[0];
  assert.ok(box, 'the top bar has its search box');
  return { view, box };
}

it('the search box is the kit’s small control: its border and text, 16 px on touch', async () => {
  const { view, box } = await topBar();
  try {
    const tokens = tokensOf(box);
    const kitTokens = controlClass({ size: 'sm' }).split(/\s+/).filter(Boolean);
    const missing = kitTokens.filter((t) => !tokens.includes(t));
    assert.deepEqual(missing, [], `the kit's control classes it lacks (its own: ${tokens.join(' ')})`);
    assert.ok(tokens.includes('border-cv-field'), 'the kit border');
    assert.ok(!tokens.includes('border-line'), 'not the pale hand-rolled border');
    assert.ok(!tokens.includes('text-sm'), 'the small kit control is 13 px, not 14');
    // Its own size and room for the magnifier and the key cap, as before.
    for (const t of ['h-8', 'pl-8', 'pr-8']) assert.ok(tokens.includes(t), `keeps ${t}`);
  } finally { await view.unmount(); }
});

it('its "/" key cap is the kit’s Kbd, hidden below md and to screen readers', async () => {
  const { view, box } = await topBar();
  try {
    const caps = [...elements(box.parentNode)].filter((el) => el.tagName === 'KBD');
    assert.equal(caps.length, 1, 'one key cap beside the box');
    const [cap] = caps;
    assert.equal(cap.textContent, '/');
    assert.ok(tokensOf(cap).includes('h-[18px]'), `the kit's Kbd cap, not a bare <kbd>: ${tokensOf(cap).join(' ')}`);
    let hidden = cap;
    while (hidden && hidden.getAttribute?.('aria-hidden') !== 'true') hidden = hidden.parentNode;
    assert.ok(hidden && box.parentNode.contains(hidden) && hidden !== box.parentNode, 'the cap is silent to screen readers');
    assert.ok(tokensOf(hidden).includes('max-md:hidden'), 'hidden below md, as SearchInput hides its cap');
  } finally { await view.unmount(); }
});
