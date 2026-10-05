// Typing-freeze finding 7 (the sweep of what a paste reaches): the Phone field's tel: link (contactHref, run on every
// render of the header) read its value with two patterns that split a long run of white space two ways at every
// character — the extension that follows a separator (/^\s*[([]?\s*(ext…)/) and the extension inside the number
// (/(\d[\s.)\]-]*)[([]?\s*(ext…)/) — and counted the digits of the whole number again for each part it joined
// ('a,' x 50 000 parts: time squared). A pasted value of 100 000 spaces took seconds. Read in linear time now, with
// the answers the old code gave (it is kept in tests/fixtures/typing-freeze-reference as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref } from '../../src/utils/contacts.js';
import * as before from '../fixtures/typing-freeze-reference/contacts.mjs';

const LIMIT_MS = 1000;
const N = 100_000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}
const tel = (phone) => contactHref('phone', { phone });

test('a number followed by a long run of white space is read in linear time', () => {
  for (const [name, phone] of [['spaces after a digit', `1${' '.repeat(N)}y`], ['spaces before an extension that is not one', `555 123 4567${' '.repeat(N)}x`], ['a separator and spaces', `555 1234567,${' '.repeat(N)}q`]]) {
    const { ms } = timed(() => tel(phone));
    assert.ok(ms < LIMIT_MS, `${name}: took ${ms.toFixed(0)} ms on ${phone.length} characters`);
  }
});

test('a value of many parts with no digits in them is read in linear time', () => {
  const phone = 'a,'.repeat(50_000);
  const { out, ms } = timed(() => tel(phone));
  assert.equal(out, null);
  assert.ok(ms < LIMIT_MS, `took ${ms.toFixed(0)} ms on ${phone.length} characters`);
});

test('the tel: links of ordinary numbers, with extensions, are as they were', () => {
  const table = [
    ['+1 (555) 123-4567 ext. 890', 'tel:+15551234567;ext=890'],
    ['(555) 123-4567, ext. 890', 'tel:5551234567;ext=890'],
    ['555 123 4567 (ext 12)', 'tel:5551234567;ext=12'],
    ['+44 (0) 20 7946 0958', 'tel:+442079460958'],
    ['030/1234567', 'tel:0301234567'],
    ['On request', null],
  ];
  for (const [phone, href] of table) assert.equal(tel(phone), href, phone);
});

const PIECES = ['+1', ' ', '  ', '(', ')', '[', ']', '555', '123', '4567', '-', '.', ',', '/', ';', '|', 'or', ' or ', 'ext', 'ext.', 'x', '#', 'extension', ':', '890', '12', '0', '(0)', '+44', '020', '7946', '0958', 'a', 'On request', '\t'];

test('the same link as the old code on 40 000 seeded values', () => {
  let seed = 5;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 40_000; n += 1) {
    let phone = '';
    const count = 1 + Math.floor(random() * 12);
    for (let i = 0; i < count; i += 1) phone += PIECES[Math.floor(random() * PIECES.length)];
    assert.equal(tel(phone), before.contactHref('phone', { phone }), JSON.stringify(phone));
  }
});
