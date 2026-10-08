// The workspace's top bar (AppBar with TopBar's search slot) must fit a signed-in account's controls. Beside the
// brand, the three areas, the hamburger, Create, the search button, two sync dots, the shortcuts button and the avatar
// it needs about 430 px on a phone and about 870 px at 768, so with the areas shown from md and a spacer beside the
// search slot (which is flex-1 too) the avatar ran off the right edge at 768 px, and the controls over the wordmark on
// a phone. With a search slot the wordmark waits for sm (sr-only: the link keeps its name), the areas for xl (the
// sidebar and the tab bar lead to the same pages) and the search slot is the one that grows. A bar without a search
// slot (Documents, Terms, Privacy) is as it was. fake-dom has no layout: the classes are read.
// Run: node --test tests/pdf/cyc1-workspace-app-bar-fit.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const tid = (c, id) => [...elements(c)].find((el) => el.getAttribute('data-testid') === id);

async function bar(props) {
  const { default: AppBar } = await loadModule('/src/components/AppBar.jsx');
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/boards'], useTransitions: false },
    createElement(AppBar, props)), {});
  const header = tid(view.container, 'app-bar');
  const row = [...elements(header)].find((el) => tokens(el).includes('h-14'));
  const brand = tid(view.container, 'app-bar-brand');
  return {
    view,
    row,
    nav: tid(view.container, 'app-bar-nav-documents').parentNode,
    wordmark: [...elements(brand)].find((el) => text(el) === 'CPWT-CV'),
    spacers: [...row.childNodes].filter((el) => el.nodeType === 1 && tokens(el).includes('flex-1') && text(el) === ''),
  };
}

const SEARCH = createElement('div', { className: 'flex min-w-0 flex-1 justify-end' }, 'SEARCH');

describe('AppBar with a search slot (the workspace)', () => {
  it('shows the areas from xl, not md: the sidebar and the tab bar carry them below', async () => {
    const b = await bar({ search: SEARCH, account: createElement('b', null, 'ACCOUNT') });
    try {
      assert.ok(tokens(b.nav).includes('xl:flex') && tokens(b.nav).includes('hidden'), tokens(b.nav).join(' '));
      assert.ok(!tokens(b.nav).includes('md:flex'), 'md:flex would put the areas beside Create, search and the account at 768 px');
    } finally { await b.view.unmount(); }
  });

  it('keeps the wordmark for screen readers but takes it out of the phone row', async () => {
    const b = await bar({ search: SEARCH });
    try {
      assert.ok(tokens(b.wordmark).includes('max-sm:sr-only'), tokens(b.wordmark).join(' '));
      assert.ok(!tokens(b.wordmark).includes('hidden'), 'display:none would leave the brand link nameless');
    } finally { await b.view.unmount(); }
  });

  it('has no spacer beside the search slot (two flex-1 siblings halved the room the search needs)', async () => {
    const b = await bar({ search: SEARCH });
    try { assert.equal(b.spacers.length, 0); } finally { await b.view.unmount(); }
  });

  it('closes the row up on a phone: 8 px between the brand, the search slot and the account', async () => {
    const b = await bar({ search: SEARCH });
    try {
      const row = tokens(b.row);
      assert.ok(row.includes('gap-2') && row.includes('sm:gap-4') && row.includes('md:gap-8'), row.join(' '));
      assert.ok(!row.includes('gap-4'), 'gap-4 from the smallest width costs a phone 16 px more');
    } finally { await b.view.unmount(); }
  });
});

describe('AppBar without a search slot (Documents, Terms, Privacy)', () => {
  it('keeps the wordmark at every width, the areas from md and one spacer before the account', async () => {
    const b = await bar({ account: createElement('b', null, 'ACCOUNT') });
    try {
      assert.ok(!tokens(b.wordmark).some((t) => t === 'hidden' || t.startsWith('max-sm:')), tokens(b.wordmark).join(' '));
      assert.ok(tokens(b.nav).includes('md:flex') && !tokens(b.nav).includes('xl:flex'));
      assert.equal(b.spacers.length, 1, 'the spacer pushes the account to the right');
    } finally { await b.view.unmount(); }
  });
});
