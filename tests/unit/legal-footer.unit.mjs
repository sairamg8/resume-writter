// R4-APP-08: the Terms and Privacy pages' footer links called navigate() even for the page already
// shown. That pushed a second entry of the same page — Back (the page's arrow too) needed one more
// press to leave — and, the path unchanged, RouteFrame kept the scroll at the footer: the link
// seemed to do nothing. Now the link to the page shown goes back to its top and adds no entry; the
// other link still opens the other page. The real pages, mounted with react-dom/client over
// tests/pdf/fake-dom.mjs in a MemoryRouter whose history the test reads.
// Run: node --test tests/unit/legal-footer.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { kitLoader, mount, elements, reactProps } from './ui-dom-harness.mjs';

let kit;
before(async () => { kit = await kitLoader(); });
after(() => kit?.close());

async function legalPage(path) {
  const { default: TermsPage } = await kit.load('/src/pages/TermsPage.jsx');
  const { default: PrivacyPage } = await kit.load('/src/pages/PrivacyPage.jsx');
  const seen = [];
  function Probe() {
    const location = useLocation();
    const type = useNavigationType();
    if (seen.at(-1)?.key !== location.key) seen.push({ key: location.key, path: location.pathname, type });
    return null;
  }
  const view = mount(() => h(MemoryRouter, { initialEntries: [path] },
    h(Probe),
    h(Routes, null,
      h(Route, { path: '/terms', element: h(TermsPage) }),
      h(Route, { path: '/privacy', element: h(PrivacyPage) }))), {});
  const scrolls = [];
  view.window.scrollTo = (...args) => scrolls.push(args);
  const settle = async () => {
    for (let i = 0; i < 20; i += 1) {
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      view.act(() => {});
    }
  };
  const footerButton = (text) => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text).at(-1);
  const click = async (text) => { view.act(() => reactProps(footerButton(text)).onClick({})); await settle(); };
  await settle();
  return { view, seen, scrolls, click };
}

describe('R4-APP-08: the legal pages’ footer links', () => {
  for (const [path, own, other] of [['/terms', 'Terms', 'Privacy Policy'], ['/privacy', 'Privacy Policy', 'Terms']]) {
    it(`on ${path}, “${own}” goes to the top of the page and adds no history entry`, async () => {
      const { view, seen, scrolls, click } = await legalPage(path);
      try {
        await click(own);
        assert.equal(seen.length, 1, `the link navigated again: ${JSON.stringify(seen)}`);
        assert.deepEqual(scrolls, [[0, 0]], 'the page stayed scrolled where it was');
      } finally { await view.unmount(); }
    });

    it(`on ${path}, “${other}” still opens the other page`, async () => {
      const { view, seen, click } = await legalPage(path);
      try {
        await click(other);
        assert.equal(seen.length, 2);
        assert.equal(seen[1].path, path === '/terms' ? '/privacy' : '/terms');
        assert.equal(seen[1].type, 'PUSH');
      } finally { await view.unmount(); }
    });
  }
});
