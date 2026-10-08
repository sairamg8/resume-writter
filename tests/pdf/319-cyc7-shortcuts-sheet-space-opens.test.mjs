// CYC7 project-manager: the Keyboard shortcuts sheet ("?" or the help button in the workspace top
// bar) said Space picks a card up to move it ("arrows, then Space to drop"). No board or job board
// has a keyboard sensor (cardKeys.js, R2-039): Space on a focused card or backlog row opens the
// issue, as Enter does. The sheet now says what Space does. The real TopBar is mounted over
// tests/pdf/fake-dom.mjs through Vite's SSR loader, as tests/pdf/103-r4-dph-04-phone-search.test.mjs does.
// Run: node --test tests/pdf/319-cyc7-shortcuts-sheet-space-opens.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, elements } from '../unit/ui-dom-harness.mjs';

let kit;
let TopBar;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
});
after(() => kit?.close());

it('the shortcuts sheet lists Space as opening the focused issue, and promises no keyboard drag', async () => {
  const App = () => createElement(MemoryRouter, { initialEntries: ['/boards'] }, createElement(TopBar, { projects: [], search: () => [] }));
  const view = mount(App, {});
  try {
    const help = byAttr(view.container, 'aria-label', 'Keyboard shortcuts')[0];
    assert.ok(help, 'the top bar has its help button');
    view.act(() => reactProps(help).onClick(ev()));
    const sheet = [...elements(view.document.body)].find((el) => el.getAttribute('role') === 'dialog');
    assert.ok(sheet, 'the button opened the sheet');
    const rows = [...elements(sheet)].filter((el) => el.tagName === 'DIV' && [...el.childNodes].some((c) => c.tagName === 'DT'));
    const label = (row) => [...row.childNodes].find((c) => c.tagName === 'DT').textContent.trim();
    const space = rows.find((row) => [...row.childNodes].find((c) => c.tagName === 'DD').textContent.includes('Space'));
    assert.ok(space, 'the sheet has a Space row');
    assert.equal(label(space), 'Open the focused issue', 'Space opens the focused card, as Enter does');
    assert.ok(!/Pick up a card/.test(sheet.textContent), 'no card is picked up with the keyboard');
  } finally {
    await view.unmount();
  }
});
