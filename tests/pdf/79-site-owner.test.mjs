// R2-143: the owner's deployment keeps its own settings through its build's env. With VITE_* set,
// the app's modules as Vite builds them read those values: the demo accounts, the dev sign-in, and
// the contact address the Terms and Privacy pages print and link. Unset: tests/unit/site-owner.unit.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

// Read when setup() starts Vite. Made-up values, never the owner's.
Object.assign(process.env, {
  VITE_DEMO_ACCOUNTS: 'Owner@Example.org, second@example.org',
  VITE_CONTACT_EMAIL: 'help@example.org',
  VITE_DEV_USER_UID: 'dev_owner',
  VITE_DEV_USER_EMAIL: 'owner@example.org',
  VITE_DEV_USER_NAME: 'Owner',
});

before(setup);
after(teardown);

const page = async (file) => {
  const { default: Page } = await loadModule(file);
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Page)));
};

describe('a build with the owner\'s env keeps the owner\'s settings', () => {
  it('the demo accounts and the dev sign-in are the env\'s', async () => {
    const { DEMO_ACCOUNTS } = await loadModule('/src/utils/demoAccounts.js');
    assert.deepEqual(DEMO_ACCOUNTS, ['owner@example.org', 'second@example.org']);
    const { SITE_OWNER } = await loadModule('/src/utils/siteOwner.js');
    assert.deepEqual(SITE_OWNER.devUser, { uid: 'dev_owner', email: 'owner@example.org', displayName: 'Owner' });
  });

  for (const [name, file] of [['Terms', '/src/pages/TermsPage.jsx'], ['Privacy', '/src/pages/PrivacyPage.jsx']]) {
    it(`the ${name} page's contact is the env's address, linked`, async () => {
      const html = await page(file);
      assert.match(html, /<a href="mailto:help@example\.org"[^>]*>\s*help@example\.org\s*<\/a>/);
      assert.equal(html.includes('Contact the people who run this site'), false);
      assert.deepEqual(html.match(/mailto:[^"]*/g), ['mailto:help@example.org']);
    });
  }
});
