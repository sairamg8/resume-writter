// A row of tabs pans sideways (overflow-x-auto) when it is wider than its box. CSS then computes its overflow-y as auto too, and each
// tab draws its underline with an ::after that sticks out 1 px below the tab (after:-bottom-px), which is layout overflow of the row:
// where scrollbars take room (Windows, Linux, a mouse on a Chromebook) every tab row grew a vertical scrollbar for that pixel, over its
// right end. On a Mac's overlay scrollbars nothing shows, which is how it went unseen. The rows now say overflow-y-hidden: the row
// clipped that pixel already (a scroll box paints nothing outside its padding box), so nothing changes on screen but the scrollbar.
// Run: node --test tests/pdf/281-cyc6-tab-row-no-vertical-scrollbar.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** The class tokens of the first tag whose class list holds `needle`. */
function rowTokens(html, needle) {
  const found = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/)).find((t) => t.includes(needle));
  assert.ok(found, `a tag with ${needle} is rendered`);
  return found;
}

describe('a tab row that pans sideways', () => {
  it('Tabs: the tablist clips its underline instead of scrolling for it', async () => {
    const { Tabs } = await loadModule('/src/components/ui/Tabs.jsx');
    const html = renderToStaticMarkup(createElement(Tabs, {
      id: 't', value: 'a', onChange() {}, 'aria-label': 'Views', items: [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }],
    }));
    const tokens = rowTokens(html, 'overflow-x-auto');
    assert.ok(tokens.includes('overflow-y-hidden'), tokens.join(' '));
  });

  it('NavTabs: the nav clips its underline instead of scrolling for it', async () => {
    const { NavTabs } = await loadModule('/src/components/ui/NavTabs.jsx');
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(NavTabs, {
      'aria-label': 'Views', items: [{ to: '/a', label: 'One' }, { to: '/b', label: 'Two' }],
    })));
    const tokens = rowTokens(html, 'overflow-x-auto');
    assert.ok(tokens.includes('overflow-y-hidden'), tokens.join(' '));
  });

  for (const file of ['src/pages/JobDetail.jsx', 'src/pages/JobTracker.jsx']) {
    it(`${file}: its own tab row says overflow-y-hidden beside overflow-x-auto`, () => {
      const text = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
      const rows = [...text.matchAll(/className="([^"]*\boverflow-x-auto\b[^"]*)"/g)].map((m) => m[1].split(/\s+/));
      assert.ok(rows.length >= 1, 'the file has a row that pans sideways');
      for (const tokens of rows) assert.ok(tokens.includes('overflow-y-hidden'), tokens.join(' '));
    });
  }
});
