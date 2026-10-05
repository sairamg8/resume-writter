// A résumé that two tabs changed at once, as one résumé (typing-freeze 5). The store used to keep the
// whole of this tab's copy when both had changed it (keepUnsaved), so a different field edited in the
// other tab — or the characters typed there since — vanished from both tabs. No imports, so Node's
// test runner loads this file as it is (tests/unit/tf-xtab-merge-resume.unit.mjs).

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** An object's keys that hold a value: an undefined one reads as absent, as it does once saved. */
const keysOf = (o) => Object.keys(o).filter((k) => o[k] !== undefined);

/** Deep equality of two saved values, key order ignored. */
export function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  const ka = keysOf(a);
  return ka.length === keysOf(b).length && ka.every((k) => same(a[k], b[k]));
}

/** `out`, or `mine` itself when `out` holds the very values `mine` does: an unchanged part keeps its identity. */
const asMine = (out, mine) => {
  if (Array.isArray(out)) return out.length === mine.length && out.every((v, i) => v === mine[i]) ? mine : out;
  const keys = keysOf(out);
  return keys.length === keysOf(mine).length && keys.every((k) => out[k] === mine[k]) ? mine : out;
};

/** The one change that turns `base` into `s`: the span of `base` it replaces, and the text it puts there. */
function edit(base, s) {
  const room = Math.min(base.length, s.length);
  let from = 0;
  while (from < room && base.charCodeAt(from) === s.charCodeAt(from)) from += 1;
  let tail = 0;
  while (tail < room - from && base.charCodeAt(base.length - 1 - tail) === s.charCodeAt(s.length - 1 - tail)) tail += 1;
  // Never between the two halves of a surrogate pair (an emoji).
  if (from && (base.charCodeAt(from - 1) & 0xfc00) === 0xd800) from -= 1;
  if (tail && (base.charCodeAt(base.length - tail) & 0xfc00) === 0xdc00) tail -= 1;
  return { from, to: base.length - tail, text: s.slice(from, s.length - tail) };
}

/**
 * Both tabs changed a text: when the two changes touch different parts of it, both are kept (typing
 * at the start in one tab and at the end in the other). Two insertions at one point go in the order
 * of their writers; changes that overlap cannot both be kept, and the later writer's text stands.
 */
function mergeText(base, mine, theirs, mineLater) {
  const a = edit(base, mine);
  const b = edit(base, theirs);
  const clash = Math.max(a.from, b.from) < Math.min(a.to, b.to)
    || (a.from === a.to && b.from < a.from && a.from < b.to)
    || (b.from === b.to && a.from < b.from && b.from < a.to);
  if (clash) return mineLater ? mine : theirs;
  const [x, y] = (a.from - b.from || a.to - b.to || (mineLater ? 1 : -1)) > 0 ? [b, a] : [a, b];
  return base.slice(0, x.from) + x.text + base.slice(x.to, y.from) + y.text + base.slice(y.to);
}

const hasIds = (a) => a.every((x) => isObj(x) && typeof x.id === 'string') && new Set(a.map((x) => x.id)).size === a.length;
const unique = (a) => a.every((x) => typeof x === 'string') && new Set(a).size === a.length;

/**
 * Lists of entries (sections, a section's entries): by id. An entry both tabs hold is merged; one
 * added in either stays; one deleted in either stays deleted, whatever the other did to it. The order
 * is the one the tab that moved entries gave (the later writer's when both did), with the entries
 * added in the other tab put after the entry they followed there, or at the end where they were last.
 */
function mergeEntries(base, mine, theirs, mineLater) {
  const byId = (a) => new Map(a.map((x) => [x.id, x]));
  const [b, m, t] = [byId(base), byId(mine), byId(theirs)];
  const live = new Map();
  for (const [id, x] of m) {
    if (t.has(id)) live.set(id, merge3(b.get(id), x, t.get(id), mineLater));
    else if (!b.has(id)) live.set(id, x);
  }
  for (const [id, x] of t) if (!m.has(id) && !b.has(id)) live.set(id, x);
  const moved = (a) => a.filter((x) => live.has(x.id) && b.has(x.id)).map((x) => x.id).join('\n')
    !== base.filter((x) => live.has(x.id)).map((x) => x.id).join('\n');
  const mineMoved = moved(mine);
  const [own, other] = (mineMoved !== moved(theirs) ? mineMoved : mineLater) ? [mine, theirs] : [theirs, mine];
  const order = own.map((x) => x.id).filter((id) => live.has(id));
  const known = new Set(order);
  const added = other.map((x) => x.id).filter((id) => live.has(id));
  const lastKnown = added.reduce((at, id, i) => (known.has(id) ? i : at), -1);
  let after = null;
  added.forEach((id, i) => {
    if (!known.has(id)) {
      if (i > lastKnown) order.push(id);
      else order.splice(after === null ? 0 : order.indexOf(after) + 1, 0, id);
    }
    after = id;
  });
  return asMine(order.map((id) => live.get(id)), mine);
}

/** Lists of words (hidden fields): what either tab added is in, what either deleted is out. */
function mergeSet(base, mine, theirs, mineLater) {
  const [first, second] = mineLater ? [mine, theirs] : [theirs, mine];
  const [b, m, t] = [new Set(base), new Set(mine), new Set(theirs)];
  return asMine([...new Set([...first, ...second])].filter((x) => !b.has(x) || (m.has(x) && t.has(x))), mine);
}

function mergeObject(base, mine, theirs, mineLater) {
  const [first, second] = mineLater ? [mine, theirs] : [theirs, mine];
  const out = {};
  for (const k of new Set([...keysOf(first), ...keysOf(second)])) {
    const v = merge3(base[k], mine[k], theirs[k], mineLater);
    if (v !== undefined) out[k] = v;
  }
  return asMine(out, mine);
}

/** `mine` and `theirs` as changed from `base`: each tab's change kept where the other did not make its own. */
function merge3(base, mine, theirs, mineLater) {
  if (same(mine, theirs)) return mine;
  if (same(base, mine)) return theirs;
  if (same(base, theirs)) return mine;
  if (isObj(mine) && isObj(theirs)) return mergeObject(isObj(base) ? base : {}, mine, theirs, mineLater);
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const was = Array.isArray(base) ? base : [];
    if (hasIds(was) && hasIds(mine) && hasIds(theirs)) return mergeEntries(was, mine, theirs, mineLater);
    if (unique(was) && unique(mine) && unique(theirs)) return mergeSet(was, mine, theirs, mineLater);
  } else if (typeof base === 'string' && typeof mine === 'string' && typeof theirs === 'string' && !mine.startsWith('data:')) {
    return mergeText(base, mine, theirs, mineLater);
  }
  return mineLater ? mine : theirs;
}

const stamp = (r) => (Number.isFinite(r?.updatedAt) ? r.updatedAt : 0);
/** A copy stamped this much before the one this tab last read is an old one (a save lasts under 2 s). */
const OLD_MS = 10_000;

/**
 * The résumé once another tab saved `theirs` while this tab changed `base` (what storage held when it
 * last read or wrote) into `mine`: every part that only one of them changed as it changed it, and
 * the same part changed in both by the writer who edited last (a text changed in two places by both,
 * in both). Both tabs weigh the same two copies the same way, so they end up with the same résumé.
 * A result that is neither copy is a new version of the résumé: one stamp past the later of the two.
 * A `theirs` stamped long before `base` is an old copy of the résumé, saved by a tab that never heard of
 * what this tab has read since: nothing in it is news, and read against `base` it would look like an
 * edit that put back what this tab typed after it (typed text twice): this tab's résumé stands.
 */
export function mergeResume(base, mine, theirs) {
  if (stamp(theirs) + OLD_MS < stamp(base)) return mine;
  const mineLater = stamp(mine) !== stamp(theirs) ? stamp(mine) > stamp(theirs) : JSON.stringify(mine) > JSON.stringify(theirs);
  const merged = merge3(base, mine, theirs, mineLater);
  if (same(merged, mine)) return mine;
  if (same(merged, theirs)) return theirs;
  return { ...merged, updatedAt: Math.max(stamp(mine), stamp(theirs)) + 1 };
}
