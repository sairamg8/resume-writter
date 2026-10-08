// R4-DPH-07: a workspace page's header (PageHeader) was `sticky top-0` at every width. On a phone the
// shell's <main> is the page's scroll box, and a header with breadcrumbs, a title, actions wrapped
// under it and a row of tabs (a job's page, a project's Summary, Backlog and Settings) stayed pinned
// over about a quarter of it for the whole page. Pinned: the header sticks from md (768 px) up, as
// on desktop, and below md it is static, so the page scrolls it away. The real component is
// rendered through Vite's loader (tests/pdf/harness.mjs) with react-dom/server.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let PageHeader;
before(async () => {
  await setup();
  ({ PageHeader } = await loadModule('/src/components/shell/PageHeader.jsx'));
});
after(teardown);

/** The class tokens of the <header> PageHeader renders with `props`. */
function headerTokens(props) {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PageHeader, props)));
  const found = /<header class="([^"]*)"/.exec(html);
  assert.ok(found, 'PageHeader renders a <header> with a class');
  return found[1].split(/\s+/).filter(Boolean);
}

const full = {
  title: 'Acme',
  subtitle: 'Frontend engineer',
  breadcrumbs: [{ label: 'Job Tracker', to: '/jobs' }, { label: 'Acme' }],
  actions: createElement('button', { type: 'button' }, 'Edit'),
  tabs: createElement('div', { 'data-tabs': '' }),
};

it('a header with breadcrumbs, actions and tabs sticks from md up and is static on a phone', () => {
  const tokens = headerTokens(full);
  assert.ok(tokens.includes('md:sticky'), `sticky from md up: ${tokens.join(' ')}`);
  assert.ok(tokens.includes('md:top-0'), 'at the top of the scroll box from md up');
  assert.ok(!tokens.includes('sticky'), 'a bare `sticky` pins the header on a phone too');
  assert.ok(!tokens.includes('top-0'), 'no bare top-0 either');
  // What it keeps at every width: its layer, its size and its tab border.
  for (const token of ['z-20', 'shrink-0', 'bg-cv-surface', 'border-b', 'border-cv-hairline']) assert.ok(tokens.includes(token), `keeps ${token}`);
});

it('a plain header (a title only) behaves the same', () => {
  const tokens = headerTokens({ title: 'Your work' });
  assert.ok(tokens.includes('md:sticky') && tokens.includes('md:top-0'));
  assert.ok(!tokens.includes('sticky') && !tokens.includes('top-0'));
});
