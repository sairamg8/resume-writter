import { parseAccountList } from '@/utils/demoSeed';

/**
 * Demo accounts: the logins whose originals — the résumés marked "Keep as my original" — always
 * come back (useDemoSeed, demoSeed.js). Everyone else deletes like anywhere. A build can replace
 * the list with VITE_DEMO_ACCOUNTS (comma-separated; set but empty = nobody).
 */
export const DEMO_ACCOUNTS = parseAccountList(
  import.meta.env.VITE_DEMO_ACCOUNTS ?? 'sairamgudiputi8@gmail.com',
);
