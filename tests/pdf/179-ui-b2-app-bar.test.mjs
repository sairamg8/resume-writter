// UI rebuild B2 (cluster bars): the top bar every start-up page shares (src/components/AppBar.jsx). The real
// AppBar is mounted with react-dom/client over fake-dom.mjs inside a MemoryRouter at a given address.
// Pinned: the brand is a link to "/" (CV mark, "CPWT-CV", the name from sm), the three areas are links to
// "/", "/jobs" and "/boards" (testids app-bar-nav-documents|applications|projects), the one for the
// address is marked current (Documents on "/", "/new" and "/resume/:id"; Applications on "/jobs" and
// "/jobs/:id"; Projects on "/boards", "/boards/:id/summary" and "/work"; none on Terms and Privacy), the
// "active" prop overrides it, the nav is hidden below md, the account and the search slot render where
// they are given and there is no search when none is passed, and children make a second row.
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
const NAV = ['documents', 'applications', 'projects'];

async function bar(path, props = {}) {
  const { default: AppBar } = await loadModule('/src/components/AppBar.jsx');
  const box = { where: null };
  function Where() { box.where = useLocation().pathname; return null; }
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [path], useTransitions: false },
    createElement(Where), createElement(AppBar, props)), {});
  return {
    view,
    where: () => box.where,
    nav: (id) => tid(view.container, `app-bar-nav-${id}`),
    current: () => NAV.filter((id) => tid(view.container, `app-bar-nav-${id}`).getAttribute('aria-current') === 'page'),
    click: (el) => view.act(() => reactProps(el).onClick({ button: 0, preventDefault() {}, stopPropagation() {} })),
  };
}

describe('AppBar: the three areas and the brand', () => {
  it('is one header with a brand link to "/" and three nav links to "/", "/jobs" and "/boards"', async () => {
    const b = await bar('/jobs');
    try {
      const header = tid(b.view.container, 'app-bar');
      assert.equal(header.tagName, 'HEADER');
      const brand = [...elements(header)].find((el) => el.tagName === 'A' && text(el) === 'CVCPWT-CV');
      assert.ok(brand, 'the brand link: the CV mark and the name');
      assert.equal(brand.getAttribute('href'), '/');
      const name = [...elements(brand)].find((el) => text(el) === 'CPWT-CV');
      assert.ok(!tokens(name).some((t) => t === 'hidden' || t.endsWith(':inline')), 'the name shows at every width, a phone bar too (the canvas phone bar draws it)');
      const links = { documents: ['/', 'Documents'], applications: ['/jobs', 'Applications'], projects: ['/boards', 'Projects'] };
      for (const id of NAV) {
        const a = b.nav(id);
        assert.equal(a.tagName, 'A');
        assert.equal(a.getAttribute('href'), links[id][0], `${id} goes to ${links[id][0]}`);
        assert.equal(text(a), links[id][1]);
        assert.ok(tokens(a).includes('cv-pill-nav'), 'the sunken-pill nav look');
      }
      const nav = b.nav('documents').parentNode;
      assert.equal(nav.tagName, 'NAV');
      assert.ok(tokens(nav).includes('hidden') && tokens(nav).includes('md:flex'), 'the nav is hidden below md (the tab bar replaces it)');
      assert.ok(tokens(header).includes('bg-cv-surface'), 'a cv-* surface, not a raw colour');
    } finally { await b.view.unmount(); }
  });

  it('a click on a nav link goes to its page; the brand goes to "/"', async () => {
    const b = await bar('/boards');
    try {
      b.click(b.nav('applications'));
      assert.equal(b.where(), '/jobs');
      b.click(b.nav('projects'));
      assert.equal(b.where(), '/boards');
      b.click(b.nav('documents'));
      assert.equal(b.where(), '/');
      b.click(b.nav('projects'));
      b.click([...elements(b.view.container)].find((el) => el.tagName === 'A' && el.getAttribute('href') === '/' && !el.getAttribute('data-testid')));
      assert.equal(b.where(), '/', 'the brand');
    } finally { await b.view.unmount(); }
  });
});

describe('AppBar: the current area follows the address', () => {
  const CASES = [
    ['/', 'documents'], ['/new', 'documents'], ['/resume/abc', 'documents'],
    ['/jobs', 'applications'], ['/jobs/new', 'applications'], ['/jobs/j1', 'applications'], ['/jobs/j1/edit', 'applications'],
    ['/boards', 'projects'], ['/boards/b1', 'projects'], ['/boards/b1/summary', 'projects'], ['/work', 'projects'],
    ['/terms', null], ['/privacy', null],
  ];
  for (const [path, want] of CASES) {
    it(`${path}: ${want ?? 'none'} is current`, async () => {
      const b = await bar(path);
      try { assert.deepEqual(b.current(), want ? [want] : []); } finally { await b.view.unmount(); }
    });
  }

  it('the active prop overrides the address, and null marks none', async () => {
    const one = await bar('/jobs', { active: 'projects' });
    try { assert.deepEqual(one.current(), ['projects']); } finally { await one.view.unmount(); }
    const none = await bar('/', { active: null });
    try { assert.deepEqual(none.current(), []); } finally { await none.view.unmount(); }
  });

  it('activeTab is a pure function of the path', async () => {
    const { activeTab } = await loadModule('/src/components/AppBar.jsx');
    assert.equal(activeTab('/jobsearch'), null, 'a path that only starts with /jobs is not Applications');
    assert.equal(activeTab('/boardsX'), null);
    assert.equal(activeTab('/r/share1'), null, 'the public page belongs to none');
  });
});

describe('AppBar: the current pill is heavier', () => {
  it('the nav links leave the weight to .cv-pill-nav (a font-medium utility would beat its heavier current rule)', async () => {
    const b = await bar('/jobs');
    try {
      for (const id of NAV) assert.ok(!tokens(b.nav(id)).includes('font-medium'), `${id} sets no weight of its own`);
    } finally { await b.view.unmount(); }
    const css = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
    assert.match(css, /\.cv-pill-nav\s*\{[^}]*font-weight:\s*500/, 'the resting weight');
    assert.match(css, /\.cv-pill-nav\[aria-current="page"\][^{]*\{[^}]*font-weight:\s*600/, 'the current weight');
  });
});

describe('AppBar: slots', () => {
  it('renders the account at the far right, a search left of it only when given, and children in a second row', async () => {
    const plain = await bar('/', { account: createElement('b', { id: 'acct' }, 'ACCOUNT') });
    try {
      assert.ok(![...elements(plain.view.container)].some((el) => el.tagName === 'INPUT'), 'no search control by default');
      assert.ok(text(plain.view.container).includes('ACCOUNT'));
    } finally { await plain.view.unmount(); }
    const full = await bar('/', {
      account: createElement('b', null, 'ACCOUNT'), search: createElement('i', null, 'SEARCH'), children: createElement('p', null, 'ROW'),
    });
    try {
      const header = tid(full.view.container, 'app-bar');
      const t = text(header);
      assert.ok(t.indexOf('SEARCH') > -1 && t.indexOf('SEARCH') < t.indexOf('ACCOUNT'), 'search sits left of the account');
      assert.ok(t.indexOf('ROW') > t.indexOf('ACCOUNT'), 'children come after the bar row');
      const row = [...elements(header)].find((el) => el.tagName === 'P');
      assert.equal(row.parentNode, header, 'the children are a second row of the header');
    } finally { await full.view.unmount(); }
  });
});
