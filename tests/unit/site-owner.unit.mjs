// R2-143: who runs a deployment comes from its build's VITE_* env (src/utils/siteOwner.js), so a
// clone or fork gets neutral, made-up values: no demo account, no contact address and a made-up dev
// sign-in — where the source used to name the owner's e-mail, uid and name. The same values with the
// env set, through Vite and the pages: tests/pdf/79-site-owner.test.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteOwnerFrom, SITE_OWNER } from '../../src/utils/siteOwner.js';

const SRC = path.resolve(fileURLToPath(new URL('../../src', import.meta.url)));
const NEUTRAL = {
  demoAccounts: [],
  contactEmail: '',
  devUser: { uid: 'dev_user', email: 'dev@example.com', displayName: 'Dev User' },
};

describe('a build that sets nothing names nobody', () => {
  it('no env: no demo account, no contact address, the made-up dev user', () => {
    assert.deepEqual(siteOwnerFrom({}), NEUTRAL);
    assert.deepEqual(siteOwnerFrom(undefined), NEUTRAL);
  });

  it('outside Vite (no import.meta.env) SITE_OWNER is that neutral one', () => {
    assert.deepEqual(SITE_OWNER, NEUTRAL);
  });

  it('set but empty or blank is nobody too', () => {
    assert.deepEqual(siteOwnerFrom({
      VITE_DEMO_ACCOUNTS: '', VITE_CONTACT_EMAIL: '  ', VITE_DEV_USER_UID: '', VITE_DEV_USER_EMAIL: ' ', VITE_DEV_USER_NAME: '',
    }), NEUTRAL);
  });

  it('the owner\'s deployment gets what its env says', () => {
    assert.deepEqual(siteOwnerFrom({
      VITE_DEMO_ACCOUNTS: ' Owner@Example.org, second@example.org ,',
      VITE_CONTACT_EMAIL: ' help@example.org ',
      VITE_DEV_USER_UID: 'dev_owner', VITE_DEV_USER_EMAIL: 'owner@example.org', VITE_DEV_USER_NAME: 'Owner',
    }), {
      demoAccounts: ['owner@example.org', 'second@example.org'],
      contactEmail: 'help@example.org',
      devUser: { uid: 'dev_owner', email: 'owner@example.org', displayName: 'Owner' },
    });
  });

  it('no source file holds a personal mailbox address', () => {
    // Fixtures and placeholders use example.* and made-up domains; a real person's inbox is one of these.
    const PERSONAL = /[\w.+-]+@(?:gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|proton|protonmail)\.[a-z.]+/gi;
    const found = fs.readdirSync(SRC, { recursive: true })
      .map((f) => path.join(SRC, f))
      .filter((f) => fs.statSync(f).isFile())
      .flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(PERSONAL)].map((m) => `${path.relative(SRC, f)}: ${m[0]}`));
    assert.deepEqual(found, []);
  });
});
