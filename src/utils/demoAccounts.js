import { SITE_OWNER } from '@/utils/siteOwner';

/**
 * Demo accounts: the logins whose originals — the résumés marked "Keep as my original" — always
 * come back (useDemoSeed, demoSeed.js). Everyone else deletes like anywhere. The build names them
 * in VITE_DEMO_ACCOUNTS (comma-separated); unset or empty = nobody (siteOwner.js).
 */
export const DEMO_ACCOUNTS = SITE_OWNER.demoAccounts;
