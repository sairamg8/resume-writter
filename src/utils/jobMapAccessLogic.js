// The Job Map access list as the admin panel edits it (the documents `jobmap_access/<email>`,
// firestore.rules). Pure functions, no imports: Node's test runner loads this file as it is
// (tests/unit/600-n3-job-map-access-logic.unit.mjs). The Firestore calls are in jobMapAccessIo.js.

/** The most addresses the list holds: the panel shows them all, and every one is a document read on each admin visit. */
export const MAX_ADDRESSES = 50;

/** What the panel says; plain text, one place. */
export const MESSAGES = {
  empty: 'Enter an e-mail address.',
  invalid: 'That does not look like an e-mail address.',
  duplicate: 'That address already has access.',
  full: `The list is full (${MAX_ADDRESSES} addresses). Remove one first.`,
  self: 'Your own address cannot be removed.',
  last: 'The last address cannot be removed.',
  missing: 'That address is not in the list.',
};

/** An address as the access document is named: trimmed and lower-cased. Anything but text is ''. */
export function normaliseAddress(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * A simple check, not a full one: text, an @ with something either side and a dot in the domain, no space, no
 * slash (a document id cannot hold one), at most 254 characters. The sign-in's own e-mail is what the rules compare.
 */
export function looksLikeEmail(address) {
  return typeof address === 'string' && address.length <= 254 && /^[^\s@/]+@[^\s@/.][^\s@/]*\.[^\s@/.]+$/.test(address);
}

/** The addresses once each (by lower case), sorted, as listed. Ids that are not text are dropped. */
export function sortAddresses(addresses) {
  const seen = new Map();
  for (const a of Array.isArray(addresses) ? addresses : []) {
    if (typeof a === 'string' && a && !seen.has(a.toLowerCase())) seen.set(a.toLowerCase(), a);
  }
  const order = (p, q) => Number(p > q) - Number(p < q);
  return [...seen.values()].sort((a, b) => order(a.toLowerCase(), b.toLowerCase()) || order(a, b));
}

/** Is `address` the signed-in admin's own (by lower case)? */
export function isOwnAddress(address, own) {
  const mine = normaliseAddress(own);
  return Boolean(mine) && normaliseAddress(address) === mine;
}

/**
 * What typing `input` into the add box does to `existing`: { ok: true, address } with the address to create
 * (trimmed, lower-cased), or { ok: false, error } with the text to show. The list is full at MAX_ADDRESSES.
 */
export function planAdd(existing, input) {
  const address = normaliseAddress(input);
  if (!address) return { ok: false, error: MESSAGES.empty };
  if (!looksLikeEmail(address)) return { ok: false, error: MESSAGES.invalid };
  const list = Array.isArray(existing) ? existing : [];
  if (list.some((a) => normaliseAddress(a) === address)) return { ok: false, error: MESSAGES.duplicate };
  if (list.length >= MAX_ADDRESSES) return { ok: false, error: MESSAGES.full };
  return { ok: true, address };
}

/**
 * What removing `address` from `existing` does: { ok: true, address } (the id as listed), or { ok: false, error }.
 * The admin's own address (`own`) stays, and so does the last one: the list is never left empty.
 */
export function planRemove(existing, address, own) {
  const list = Array.isArray(existing) ? existing : [];
  const listed = list.find((a) => normaliseAddress(a) === normaliseAddress(address));
  if (listed === undefined) return { ok: false, error: MESSAGES.missing };
  if (isOwnAddress(listed, own)) return { ok: false, error: MESSAGES.self };
  if (list.length <= 1) return { ok: false, error: MESSAGES.last };
  return { ok: true, address: listed };
}
