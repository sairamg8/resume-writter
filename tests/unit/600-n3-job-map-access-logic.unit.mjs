// N3 (Job Map access panel): the pure rules of the access list, src/utils/jobMapAccessLogic.js. An address is
// trimmed and lower-cased, must look like an e-mail, is refused when it is already there or the list holds 50;
// removing refuses the admin's own address and the last one. Without the module there is nothing to import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ADDRESSES, MESSAGES, normaliseAddress, looksLikeEmail, sortAddresses, isOwnAddress, planAdd, planRemove,
} from '../../src/utils/jobMapAccessLogic.js';

test('an address is trimmed and lower-cased; anything but text is empty', () => {
  assert.equal(normaliseAddress('  Ada.Lovelace@Example.ORG \n'), 'ada.lovelace@example.org');
  for (const v of [undefined, null, 7, {}, []]) assert.equal(normaliseAddress(v), '');
});

test('looksLikeEmail: name@domain.tld, and not spaces, a second @, a slash, a missing dot or part', () => {
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.org', "o'brien@example.ie"]) assert.equal(looksLikeEmail(ok), true, ok);
  for (const bad of ['', 'a', 'a@b', 'a@b.', '@b.co', 'a@.co', 'a b@c.co', 'a@b c.co', 'a@@b.co', 'a@b@c.co', 'a/b@c.co', 'a@b/c.co', 'a@b.c.', null, 4]) {
    assert.equal(looksLikeEmail(bad), false, String(bad));
  }
  assert.equal(looksLikeEmail(`${'a'.repeat(250)}@b.co`), false, 'longer than an address can be');
});

test('sortAddresses: sorted, once each by lower case, text only', () => {
  assert.deepEqual(sortAddresses(['zed@x.org', 'amy@x.org', 'Bob@x.org', 'bob@x.org', '', null, 3]), ['amy@x.org', 'Bob@x.org', 'zed@x.org']);
  assert.deepEqual(sortAddresses(undefined), []);
});

test('isOwnAddress compares by lower case and is false with no own address', () => {
  assert.equal(isOwnAddress('Me@X.org', 'me@x.org'), true);
  assert.equal(isOwnAddress('you@x.org', 'me@x.org'), false);
  assert.equal(isOwnAddress('', ''), false);
  assert.equal(isOwnAddress('me@x.org', undefined), false);
});

test('planAdd takes a new address, normalised', () => {
  assert.deepEqual(planAdd(['a@x.org'], '  New@X.org '), { ok: true, address: 'new@x.org' });
  assert.deepEqual(planAdd([], 'new@x.org'), { ok: true, address: 'new@x.org' });
  assert.deepEqual(planAdd(undefined, 'new@x.org'), { ok: true, address: 'new@x.org' });
});

test('planAdd refuses an empty, a malformed and a repeated address, whatever its case', () => {
  assert.deepEqual(planAdd(['a@x.org'], '   '), { ok: false, error: MESSAGES.empty });
  assert.deepEqual(planAdd(['a@x.org'], 'not an address'), { ok: false, error: MESSAGES.invalid });
  assert.deepEqual(planAdd(['a@x.org'], 'A@X.ORG'), { ok: false, error: MESSAGES.duplicate });
  assert.deepEqual(planAdd(['A@X.org'], 'a@x.org'), { ok: false, error: MESSAGES.duplicate }, 'a document the console named with capitals');
});

test('planAdd stops at 50 addresses: the 50th is taken, the 51st is not', () => {
  const list = (n) => Array.from({ length: n }, (_, i) => `u${i}@x.org`);
  assert.equal(MAX_ADDRESSES, 50);
  assert.equal(planAdd(list(49), 'last@x.org').ok, true);
  assert.deepEqual(planAdd(list(50), 'over@x.org'), { ok: false, error: MESSAGES.full });
  assert.deepEqual(planAdd(list(50), 'u3@x.org'), { ok: false, error: MESSAGES.duplicate }, 'a repeat is a repeat first');
});

test('planRemove takes another address out, by the id as listed', () => {
  assert.deepEqual(planRemove(['me@x.org', 'Bob@x.org'], 'bob@x.org', 'me@x.org'), { ok: true, address: 'Bob@x.org' });
});

test('planRemove keeps the admin\'s own address, the last address, and refuses one that is not listed', () => {
  assert.deepEqual(planRemove(['me@x.org', 'bob@x.org'], 'ME@x.org', 'me@x.org'), { ok: false, error: MESSAGES.self });
  assert.deepEqual(planRemove(['bob@x.org'], 'bob@x.org', 'me@x.org'), { ok: false, error: MESSAGES.last });
  assert.deepEqual(planRemove(['me@x.org'], 'me@x.org', 'me@x.org'), { ok: false, error: MESSAGES.self }, 'own first');
  assert.deepEqual(planRemove(['bob@x.org', 'amy@x.org'], 'zed@x.org', 'me@x.org'), { ok: false, error: MESSAGES.missing });
  assert.deepEqual(planRemove(undefined, 'bob@x.org', 'me@x.org'), { ok: false, error: MESSAGES.missing });
});
