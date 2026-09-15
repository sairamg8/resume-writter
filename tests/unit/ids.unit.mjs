// Unit tests for unique ids (src/utils/ids.js, M17): ids were `${prefix}_${Date.now()}`, so two
// made in the same millisecond collided. Run: yarn test:unit
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../../src/utils/ids.js';

const N = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Run fn with the clock stopped, as when two adds land in the same millisecond. */
function sameMillisecond(fn) {
  const realNow = Date.now;
  Date.now = () => 1_757_800_000_000;
  try { return fn(); } finally { Date.now = realNow; }
}

/** Run fn with globalThis.crypto replaced by `value` (a page without Web Crypto, or plain http). */
function withCrypto(value, fn) {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
  try { return fn(); } finally { Object.defineProperty(globalThis, 'crypto', real); }
}

const many = (prefix) => Array.from({ length: N }, () => newId(prefix));
const assertUnique = (ids) => assert.equal(new Set(ids).size, ids.length, `duplicate ids among ${ids.length}`);

describe('newId', () => {
  it('is <prefix>_<uuid> where crypto.randomUUID exists; without a prefix, just the uuid', () => {
    const id = newId('exp');
    assert.ok(id.startsWith('exp_'), id);
    assert.match(id.slice(4), UUID);
    assert.match(newId(), UUID);
  });

  it(`never repeats: ${N} ids in a tight loop, in the same millisecond`, () => {
    assertUnique(sameMillisecond(() => many('x')));
  });

  it('without randomUUID (a page served over plain http) it uses crypto.getRandomValues', () => {
    const { crypto } = globalThis;
    const ids = sameMillisecond(() => withCrypto({ getRandomValues: (a) => crypto.getRandomValues(a) }, () => many('x')));
    for (const id of ids.slice(0, 50)) assert.match(id, /^x_[0-9a-f]{32}$/);
    assertUnique(ids);
  });

  it('without Web Crypto, a stopped clock and a constant Math.random still give unique ids', () => {
    const realRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const ids = sameMillisecond(() => withCrypto(undefined, () => many('x')));
      for (const id of ids.slice(0, 50)) assert.ok(id.startsWith('x_'), id);
      assertUnique(ids);
    } finally { Math.random = realRandom; }
  });
});
