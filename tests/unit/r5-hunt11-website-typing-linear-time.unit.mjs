// R5-HUNT11-WEBSITE-FREEZE-LEAD: the editor froze once while a Website was typed (Personal Info → Website),
// and no loop was found. What was found on that keystroke's path (every render calls contactItems, which
// calls displayUrl and safeHref once per link field) are two patterns that took time squared in the length
// of the value: displayUrl's /\/+$/ (a run of slashes, tried again from every slash of it) and safeHref's
// e-mail test /^[^@/]+@[^@/]+\.[^@/]+$/ (each dot tried as the one, each try read to the end). A pasted
// value of 20 000 characters cost 175–195 ms a render, 60 000 cost 1.6 s. Both are linear now, and read
// exactly what they read: the tables below are the old patterns' answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactItems, displayUrl } from '../../src/utils/contacts.js';
import { safeHref } from '../../src/utils/richText.js';

const N = 60_000;
/** The old patterns took 1.6 s on these; the loops read them in about a millisecond. */
const LIMIT_MS = 250;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('displayUrl reads a long run of slashes before another character in linear time', () => {
  const inner = `https://a.io${'/'.repeat(N)}x`;
  const { out, ms } = timed(() => displayUrl(inner));
  assert.equal(out, `a.io${'/'.repeat(N)}x`);
  assert.ok(ms < LIMIT_MS, `displayUrl took ${ms.toFixed(0)} ms on ${N} slashes`);
  const trailing = timed(() => displayUrl(`www.a.io${'/'.repeat(N)}`));
  assert.equal(trailing.out, 'a.io');
  assert.ok(trailing.ms < LIMIT_MS, `displayUrl took ${trailing.ms.toFixed(0)} ms on ${N} trailing slashes`);
});

test('displayUrl keeps cutting the scheme, "www." and the trailing slashes, and only those', () => {
  const table = [
    ['https://www.linkedin.com/in/me/', 'linkedin.com/in/me'],
    ['HTTP://Example.com//', 'Example.com'],
    ['itsairam.netlify.app', 'itsairam.netlify.app'],
    ['a//b/', 'a//b'],
    ['//', ''],
    ['/', ''],
    ['https://', ''],
    ['https://www.', ''],
    ['  github.com/me/  ', 'github.com/me'],
    ['x/./', 'x/.'],
    ['', ''],
    [null, ''],
  ];
  for (const [input, printed] of table) assert.equal(displayUrl(input), printed, JSON.stringify(input));
});

test('safeHref reads a long dotted value with a "/" or a second "@" after it in linear time', () => {
  for (const value of [`x@${'.'.repeat(N)}/`, `x@${'a.'.repeat(N / 2)}/p`, `x@${'a.'.repeat(N / 2)}@`]) {
    const { out, ms } = timed(() => safeHref(value));
    assert.equal(out, null, value.slice(0, 12));
    assert.ok(ms < LIMIT_MS, `safeHref took ${ms.toFixed(0)} ms on ${value.length} characters`);
  }
  const address = timed(() => safeHref(`x@${'a.'.repeat(N / 2)}b`));
  assert.equal(address.out?.startsWith('mailto:x@a.a.'), true);
  assert.ok(address.ms < LIMIT_MS, `safeHref took ${address.ms.toFixed(0)} ms on an address`);
});

test('safeHref still tells a bare e-mail address from every other value', () => {
  const table = [
    ['me@site.com', 'mailto:me@site.com'],
    ['me@a.b', 'mailto:me@a.b'],
    ['me@mail.site.co.uk', 'mailto:me@mail.site.co.uk'],
    ['me.name@site.com', 'mailto:me.name@site.com'],
    ['me@site.', null],
    ['me@.com', null],
    ['me@site', null],
    ['@site.com', null],
    ['me@@site.com', null],
    ['a@b@site.com', null],
    ['me@site.com/path', null],
    ['me@si te.com', null],
    ['github.com/me', 'https://github.com/me'],
    ['itsairam.netlify.app', 'https://itsairam.netlify.app'],
    ['https://itsairam.netlify.app', 'https://itsairam.netlify.app'],
    ['javascript:alert(1)', null],
    ['https://', null],
  ];
  for (const [input, href] of table) assert.equal(safeHref(input), href, input);
});

test('contactItems reads junk in every link field, whole, in linear time', () => {
  const junk = { website: `/${'/'.repeat(N)}x`, linkedin: `x@${'.'.repeat(N)}/`, github: `https://${'a'.repeat(N)}${'/'.repeat(N)}`, email: `x@${'.'.repeat(N)}/` };
  const { out, ms } = timed(() => contactItems(junk));
  assert.deepEqual(out.map(({ key }) => key), ['email', 'website', 'linkedin', 'github']);
  assert.ok(ms < LIMIT_MS, `contactItems took ${ms.toFixed(0)} ms on four values of about ${N} characters`);
});

test('a Website typed one key at a time prints each step as it reads, at no cost', () => {
  const target = 'https://www.itsairam.netlify.app/';
  const { ms } = timed(() => {
    for (let i = 1; i <= target.length; i += 1) {
      const typed = target.slice(0, i);
      const items = contactItems({ website: typed });
      const printed = displayUrl(typed);
      assert.deepEqual(items.map(({ value }) => value), printed ? [printed] : [], typed);
    }
  });
  assert.ok(ms < LIMIT_MS, `typing took ${ms.toFixed(0)} ms`);
  assert.deepEqual(contactItems({ website: target }).map(({ value, href }) => [value, href]), [['itsairam.netlify.app', target]]);
});
