// UI rebuild B2 (cluster bars): the phone's bottom tab bar (src/components/BottomTabBar.jsx). The real bar
// is mounted with react-dom/client over fake-dom.mjs inside a MemoryRouter. Pinned: one nav fixed to the
// bottom, 72 px tall and hidden from md, three links (Documents "/", Applications "/jobs", Projects
// "/boards", testids bottom-tab-documents|applications|projects) each with an icon, a tap goes to the
// page, the current area (the same rule as the top bar) is marked, and src/index.css styles .cv-tab with
// cv-* tokens.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const tid = (c, id) => [...elements(c)].find((el) => el.getAttribute('data-testid') === id);
const TABS = { documents: ['/', 'Documents'], applications: ['/jobs', 'Applications'], projects: ['/boards', 'Projects'] };

async function bar(path) {
  const { default: BottomTabBar } = await loadModule('/src/components/BottomTabBar.jsx');
  const box = { where: null };
  function Where() { box.where = useLocation().pathname; return null; }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [path], useTransitions: false },
    createElement(Where), createElement(BottomTabBar)), {});
  return {
    view,
    where: () => box.where,
    tab: (id) => tid(view.container, `bottom-tab-${id}`),
    current: () => Object.keys(TABS).filter((id) => tid(view.container, `bottom-tab-${id}`).getAttribute('aria-current') === 'page'),
    tap: (el) => view.act(() => reactProps(el).onClick({ button: 0, preventDefault() {}, stopPropagation() {} })),
  };
}

describe('BottomTabBar', () => {
  it('is a nav fixed to the bottom, 72 px, hidden from md, with three icon tabs', async () => {
    const b = await bar('/');
    try {
      const nav = tid(b.view.container, 'bottom-tab-bar');
      assert.equal(nav.tagName, 'NAV');
      for (const t of ['fixed', 'bottom-0', 'h-[72px]', 'md:hidden']) assert.ok(tokens(nav).includes(t), `the bar has ${t}: ${tokens(nav).join(' ')}`);
      const links = nav.childNodes;
      assert.equal(links.length, 3, 'three tabs');
      for (const [id, [to, label]] of Object.entries(TABS)) {
        const a = b.tab(id);
        assert.equal(a.tagName, 'A');
        assert.equal(a.getAttribute('href'), to);
        assert.equal(text(a), label);
        assert.ok([...elements(a)].some((el) => el.tagName === 'svg' || el.tagName === 'SVG'), `${label} has an icon`);
      }
      assert.deepEqual(links.map((a) => text(a)), ['Documents', 'Applications', 'Projects'], 'in the top bar\'s order');
    } finally { await b.view.unmount(); }
  });

  it('a tap goes to the page', async () => {
    const b = await bar('/');
    try {
      b.tap(b.tab('applications'));
      assert.equal(b.where(), '/jobs');
      b.tap(b.tab('projects'));
      assert.equal(b.where(), '/boards');
      b.tap(b.tab('documents'));
      assert.equal(b.where(), '/');
    } finally { await b.view.unmount(); }
  });

  it('marks the current area by the same rule as the top bar', async () => {
    const CASES = [['/', 'documents'], ['/resume/x', 'documents'], ['/jobs/j1', 'applications'], ['/boards/b1/summary', 'projects'], ['/work', 'projects'], ['/terms', null]];
    for (const [path, want] of CASES) {
      const b = await bar(path);
      try { assert.deepEqual(b.current(), want ? [want] : [], path); } finally { await b.view.unmount(); }
    }
  });

  it('is styled by .cv-tab in index.css, with cv-* tokens and a marked current tab', () => {
    const css = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
    assert.match(css, /\.cv-tab\s*\{[^}]*flex-direction:\s*column[^}]*var\(--color-cv-muted\)/);
    assert.match(css, /\.cv-tab\[aria-current="page"\]\s*\{[^}]*var\(--color-cv-brand-text\)/);
  });
});
