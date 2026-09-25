import { parseAccountList } from './demoSeed.js';

/**
 * What a deployment says about who runs it, from its build's VITE_* env (.env.example): the demo
 * accounts, the contact address of the Terms and Privacy pages, and the account the dev server
 * signs in as without Firebase. A clone or fork that sets none of them gets neutral, made-up
 * values — nobody's e-mail, nobody's account; the owner's site sets its own.
 * No `@/` imports, so Node's test runner loads this file as it is (tests/unit/site-owner.unit.mjs).
 */
export function siteOwnerFrom(env = {}) {
  const value = (key) => String(env[key] ?? '').trim();
  return {
    // Set but empty = nobody, as unset.
    demoAccounts: parseAccountList(env.VITE_DEMO_ACCOUNTS),
    contactEmail: value('VITE_CONTACT_EMAIL'),
    devUser: {
      uid: value('VITE_DEV_USER_UID') || 'dev_user',
      email: value('VITE_DEV_USER_EMAIL') || 'dev@example.com',
      displayName: value('VITE_DEV_USER_NAME') || 'Dev User',
    },
  };
}

// import.meta.env is Vite's; plain Node has none, which reads as nothing set.
export const SITE_OWNER = siteOwnerFrom(import.meta.env);
