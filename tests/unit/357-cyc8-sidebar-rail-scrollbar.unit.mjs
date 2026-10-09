// The collapsed 64 px sidebar rail has 40 px of room (px-3 each side) for its 40 px rows. Its nav scrolls (overflow-y-auto) when the
// project list is long, and a classic 15 px scrollbar then left the rows 25 px: the icons were clipped. The collapsed rail now hides
// its scrollbar (it still scrolls by wheel and touch); the expanded sidebar and the phone drawer keep theirs.
// Run: node --test tests/unit/357-cyc8-sidebar-rail-scrollbar.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let vite;
let shell;
before(async () => {
  vite = await createServer({
    root: ROOT, configFile: `${ROOT}vite.config.js`, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  shell = await vite.ssrLoadModule('/src/components/shell/index.js');
});
after(() => vite?.close());

const html = (element, path = '/jobs') => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, element));
// The server writes "&" in an attribute as "&amp;": read it back.
const navClass = (markup) => (/<nav aria-label="Workspace" class="([^"]*)"/.exec(markup)?.[1] ?? '').replaceAll('&amp;', '&');
const projects = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Project ${i}`, key: `P${i}`, color: null, starred: false, updatedAt: i }));

describe('the sidebar nav scrollbar', () => {
  it('the collapsed rail hides it, so its 40 px rows keep the rail width', () => {
    const tokens = navClass(html(h(shell.SidebarContent, { projects, collapsed: true, onToggleCollapsed: () => {} }))).split(/\s+/);
    assert.ok(tokens.includes('overflow-y-auto'), 'it still scrolls');
    assert.ok(tokens.includes('[scrollbar-width:none]'), 'no scrollbar in Firefox and standards browsers');
    assert.ok(tokens.includes('[&::-webkit-scrollbar]:hidden'), 'no scrollbar in Chromium and Safari');
  });

  it('the expanded sidebar keeps its scrollbar', () => {
    const tokens = navClass(html(h(shell.SidebarContent, { projects, onToggleCollapsed: () => {} }))).split(/\s+/);
    assert.ok(tokens.includes('overflow-y-auto'));
    assert.ok(!tokens.includes('[scrollbar-width:none]'));
  });
});
