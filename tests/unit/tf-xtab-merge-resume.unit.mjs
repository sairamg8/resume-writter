// Typing-freeze finding 5: a résumé that two tabs changed at once is merged field by field
// (src/utils/mergeResume.js), and keepUnsaved hands it the résumés both tabs changed
// (src/utils/unsavedJobs.js). Pure data in, pure data out. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeResume, same } from '../../src/utils/mergeResume.js';
import { keepUnsaved } from '../../src/utils/unsavedJobs.js';

const entry = (id, role = '') => ({ id, company: `Co ${id}`, role });
const resume = (over = {}) => ({
  id: 'r', updatedAt: 10,
  personal: { name: 'Casey Example', website: '', hiddenFields: [] },
  settings: { accent: '#111', gap: 8 },
  sections: [
    { id: 's1', title: 'Work', items: [entry('a'), entry('b'), entry('c')] },
    { id: 's2', title: 'Other', items: [entry('z')] },
  ],
  ...over,
});
const edited = (r, at, fn) => { const c = structuredClone(r); fn(c); c.updatedAt = at; return c; };
const items = (r, s = 's1') => r.sections.find((x) => x.id === s).items.map((i) => i.id);
/** Both tabs weigh the same two copies: whichever is "mine" the résumé is the same. */
const both = (base, x, y) => {
  const a = mergeResume(base, x, y);
  assert.deepEqual(mergeResume(base, y, x), a, 'the two tabs must end on the same résumé');
  return a;
};

test('different fields: both edits are kept, and the result is a new version past the later of the two', () => {
  const base = resume();
  const mine = edited(base, 20, (r) => { r.personal.website = 'https://example.com'; });
  const theirs = edited(base, 30, (r) => { r.personal.name = 'Casey R. Example'; });
  const out = both(base, mine, theirs);
  assert.equal(out.personal.website, 'https://example.com');
  assert.equal(out.personal.name, 'Casey R. Example');
  assert.equal(out.updatedAt, 31);
});

test('one side unchanged: the other side as it is, the very object', () => {
  const base = resume();
  const mine = edited(base, 20, (r) => { r.personal.website = 'x'; });
  assert.equal(mergeResume(base, mine, base), mine);
  assert.equal(mergeResume(base, base, mine), mine);
  assert.equal(mergeResume(base, mine, structuredClone(mine)), mine, 'both made the same change');
});

test('a part nobody changed here keeps its identity: no preview is built again', () => {
  const base = resume();
  const mine = edited(base, 20, (r) => { r.personal.website = 'x'; });
  const theirs = edited(base, 30, (r) => { r.sections[1].items[0].role = 'Lead'; });
  const out = mergeResume(base, mine, theirs);
  assert.equal(out.personal, mine.personal, 'the part only this tab changed is this tab\'s object');
  assert.equal(out.settings, mine.settings, 'the part both hold the same is this tab\'s object');
  assert.equal(out.sections[1].items[0].role, 'Lead');
});

test('a copy stamped long before the one this tab last read is an old one: this tab\'s résumé stands, not a text typed twice', () => {
  // The other tab's copy is what the résumé was before this tab typed "Casey Example": read against the
  // 'C' this tab last saw in storage it looks like the other tab typing "asey".
  const base = resume({ updatedAt: 1_000_000, personal: { name: 'C', hiddenFields: [] } });
  const mine = edited(base, 1_000_500, (r) => { r.personal.name = 'Casey Example'; });
  const old = resume({ updatedAt: 1, personal: { name: 'Casey', hiddenFields: [] } });
  assert.equal(mergeResume(base, mine, old), mine);
  // Not old: a few seconds before the copy this tab read, it is a save made meanwhile and is merged.
  const meanwhile = resume({ updatedAt: 995_000, personal: { name: 'C', hiddenFields: [], website: 'x' } });
  assert.equal(mergeResume(base, mine, meanwhile).personal.website, 'x');
});

test('a key one tab deleted stays deleted, and one both tabs set differently goes to the later writer', () => {
  const base = resume();
  const deleted = edited(base, 20, (r) => { delete r.settings.gap; });
  const typed = edited(base, 30, (r) => { r.personal.website = 'x'; });
  assert.deepEqual(both(base, deleted, typed).settings, { accent: '#111' });
  const early = edited(base, 20, (r) => { r.settings.accent = '#222'; });
  const late = edited(base, 30, (r) => { r.settings.accent = '#333'; });
  assert.equal(both(base, early, late).settings.accent, '#333');
  const tied = edited(base, 20, (r) => { r.settings.accent = '#333'; });
  assert.equal(both(base, early, tied).settings.accent, both(base, tied, early).settings.accent, 'a tie is settled the same way in both tabs');
});

test('text: changes to different parts of one string are both kept', () => {
  const text = (base, x, y, at = [20, 30]) => {
    const b = resume({ personal: { name: base, hiddenFields: [] } });
    const mk = (v, t) => ({ ...structuredClone(b), personal: { name: v, hiddenFields: [] }, updatedAt: t });
    return both(b, mk(x, at[0]), mk(y, at[1])).personal.name;
  };
  assert.equal(text('Hello world', 'Hello brave world', 'Hello world!'), 'Hello brave world!');
  assert.equal(text('Casey Example', 'Dr. Casey Example', 'Casey Example Jr.'), 'Dr. Casey Example Jr.');
  assert.equal(text('one two three', 'ONE two three', 'one two THREE'), 'ONE two THREE');
  assert.equal(text('abcdef', 'abdef', 'abcdXf'), 'abdXf', 'a deletion and an edit elsewhere');
  assert.equal(text('ab', 'aXb', 'aYb'), 'aXYb', 'two insertions at one point: the later writer\'s second');
  assert.equal(text('ab', 'aXb', 'aYb', [30, 20]), 'aYXb');
  assert.equal(text('abc def', 'abc DEF', 'ABC def'), 'ABC DEF');
  assert.equal(text('Hello', 'Hello A', 'Hello B'), 'Hello A B');
  assert.equal(text('', 'x', 'y'), 'xy');
  assert.equal(text('Casey Example', 'Cas Example', 'Casey Examp'), 'Cas Examp', 'two cuts in different places');
});

test('text: changes that overlap cannot both stand: the later writer\'s text, in both tabs', () => {
  const text = (x, y, at) => {
    const b = resume({ personal: { name: 'Casey Example', hiddenFields: [] } });
    const mk = (v, t) => ({ ...structuredClone(b), personal: { name: v, hiddenFields: [] }, updatedAt: t });
    return both(b, mk(x, at[0]), mk(y, at[1])).personal.name;
  };
  assert.equal(text('Alex Example', 'Blair Example', [20, 30]), 'Blair Example');
  assert.equal(text('Alex Example', 'Blair Example', [30, 20]), 'Alex Example');
  assert.equal(text('Casey', 'Casey Exam', [20, 30]), 'Casey Exam', 'one cut what the other cut part of');
});

test('text: an emoji is never cut in half', () => {
  const text = (base, x, y) => {
    const b = resume({ personal: { name: base, hiddenFields: [] } });
    const mk = (v, t) => ({ ...structuredClone(b), personal: { name: v, hiddenFields: [] }, updatedAt: t });
    return both(b, mk(x, 20), mk(y, 30)).personal.name;
  };
  assert.equal(text('a😀b', 'a😀bX', 'Ya😀b'), 'Ya😀bX');
  assert.equal(text('😀', '😁', '😀!'), '😁!');
  assert.equal(text('x😀', 'x😁', 'x😀😀'), 'x😁😀', 'edits sharing the first half of the pair');
  for (const s of [text('😀😀', '😀😁', '😁😀'), text('a😀', 'a😁', 'Za😀')]) assert.doesNotMatch(s, /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/, 'no lone surrogate');
});

test('text: a photo (a data URL) is never merged by pieces: the later writer\'s, whole', () => {
  const b = resume({ personal: { name: 'x', photo: 'data:image/png;base64,AAAA' } });
  const mk = (photo, t) => ({ ...structuredClone(b), personal: { ...b.personal, photo }, updatedAt: t });
  assert.equal(both(b, mk('data:image/png;base64,AAAB', 20), mk('data:image/png;base64,CAAA', 30)).personal.photo, 'data:image/png;base64,CAAA');
});

test('entries merge by id: adds, edits and deletes in both tabs all land', () => {
  const base = resume();
  const mine = edited(base, 20, (r) => {
    r.sections[0].items.push(entry('n1', 'mine'));
    r.sections[0].items[0].role = 'Lead';
  });
  const theirs = edited(base, 30, (r) => {
    r.sections[0].items.splice(1, 1); // b deleted
    r.sections[0].items[1].role = 'QA'; // c edited
    r.sections[0].items.push(entry('n2', 'theirs'));
  });
  const out = both(base, mine, theirs);
  assert.deepEqual(items(out).slice().sort(), ['a', 'c', 'n1', 'n2']);
  assert.equal(out.sections[0].items.find((i) => i.id === 'a').role, 'Lead');
  assert.equal(out.sections[0].items.find((i) => i.id === 'c').role, 'QA');
});

test('an entry deleted in one tab stays deleted whatever the other did to it, and a stale copy does not bring it back', () => {
  const base = resume();
  const deleted = edited(base, 20, (r) => { r.sections[0].items.splice(1, 1); });
  const touched = edited(base, 30, (r) => { r.sections[0].items[1].role = 'edited meanwhile'; });
  assert.deepEqual(items(both(base, deleted, touched)), ['a', 'c']);
  const typing = edited(base, 40, (r) => { r.personal.website = 'x'; }); // never touched the sections: a stale copy of them
  assert.deepEqual(items(both(base, deleted, typing)), ['a', 'c']);
  const gone = edited(base, 20, (r) => { r.sections.splice(1, 1); });
  assert.deepEqual(both(base, gone, typing).sections.map((s) => s.id), ['s1']);
});

test('the order: the tab that moved entries decides it, the entries the other added come after the one they followed', () => {
  const base = resume();
  const moved = edited(base, 30, (r) => { r.sections[0].items.unshift(r.sections[0].items.pop()); }); // c a b
  const added = edited(base, 20, (r) => { r.sections[0].items.push(entry('n1')); r.sections[0].items.splice(1, 0, entry('n0')); }); // a n0 b c n1
  assert.deepEqual(items(both(base, moved, added)), ['c', 'a', 'n0', 'b', 'n1']);
  // Both moved: the later writer's order.
  const other = edited(base, 20, (r) => { r.sections[0].items.reverse(); }); // c b a
  assert.deepEqual(items(both(base, moved, other)), ['c', 'a', 'b']);
  assert.deepEqual(items(both(base, edited(moved, 10, () => {}), edited(other, 50, () => {}))), ['c', 'b', 'a']);
  // Duplicate an entry (the copy right after it) in one tab while the other edits the original.
  const dup = edited(base, 20, (r) => { r.sections[0].items.splice(1, 0, entry('a2')); });
  const edit = edited(base, 30, (r) => { r.sections[0].items[0].role = 'Lead'; });
  assert.deepEqual(items(both(base, dup, edit)), ['a', 'a2', 'b', 'c']);
});

test('lists of words (hidden contact fields) are merged as sets; lists that are neither stay the later writer\'s', () => {
  const base = resume({ personal: { name: 'x', hiddenFields: ['email'] } });
  const withPhone = edited(base, 20, (r) => { r.personal.hiddenFields.push('phone'); });
  const withoutEmail = edited(base, 30, (r) => { r.personal.hiddenFields = []; });
  assert.deepEqual(both(base, withPhone, withoutEmail).personal.hiddenFields, ['phone']);
  const other = edited(base, 30, (r) => { r.personal.hiddenFields.push('location'); });
  assert.deepEqual([...both(base, withPhone, other).personal.hiddenFields].sort(), ['email', 'location', 'phone']);
  const plain = (list, t) => ({ ...resume({ updatedAt: t }), tags: list });
  const b = plain([[1], [2]], 10);
  assert.deepEqual(both(b, plain([[1]], 20), plain([[2], [3]], 30)).tags, [[2], [3]], 'no ids, no words: the later writer\'s list');
});

test('older data: a résumé without sections, entries without ids or a personal block merges without throwing', () => {
  const bare = { id: 'r', updatedAt: 1, name: 'Old' };
  assert.deepEqual(both(bare, { ...bare, updatedAt: 2, name: 'Old 2' }, { ...bare, updatedAt: 3, template: 'classic' }), { id: 'r', updatedAt: 4, name: 'Old 2', template: 'classic' });
  const noIds = (items, t) => ({ id: 'r', updatedAt: t, sections: [{ id: 's', items }] });
  const out = both(noIds([{ role: 'a' }], 1), noIds([{ role: 'a' }, { role: 'b' }], 2), noIds([{ role: 'c' }], 3));
  assert.deepEqual(out.sections[0].items, [{ role: 'c' }], 'entries without an id cannot be matched: the later writer\'s list');
  const nulls = both({ id: 'r', updatedAt: 1, personal: null }, { id: 'r', updatedAt: 2, personal: { name: 'x' } }, { id: 'r', updatedAt: 3, personal: null, extra: 1 });
  assert.equal(nulls.extra, 1);
});

test('same() reads values, not order or undefined keys', () => {
  assert.equal(same({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }), true);
  assert.equal(same({ a: 1, b: undefined }, { a: 1 }), true);
  assert.equal(same({ a: 1 }, { a: 2 }), false);
  assert.equal(same([1, 2], [1]), false);
  assert.equal(same([], {}), false);
  assert.equal(same(null, {}), false);
  assert.equal(same('a', 'a'), true);
});

test('keepUnsaved: a résumé changed in both tabs is merged, one changed here only is this tab\'s, one changed there only is the other tab\'s', () => {
  const r1 = resume({ id: 'r1' });
  const r2 = resume({ id: 'r2' });
  const r3 = resume({ id: 'r3' });
  const stored = [r1, r2, r3];
  const mine1 = edited(r1, 20, (r) => { r.personal.website = 'x'; });
  const mine3 = edited(r3, 20, (r) => { r.personal.website = 'y'; });
  const current = [mine1, r2, mine3];
  const theirs1 = edited(r1, 30, (r) => { r.personal.name = 'Z'; });
  const theirs2 = edited(r2, 30, (r) => { r.personal.name = 'Q'; });
  const incoming = [theirs1, theirs2, r3];
  const out = keepUnsaved(incoming, current, stored, mergeResume);
  assert.equal(out[0].personal.website, 'x');
  assert.equal(out[0].personal.name, 'Z');
  assert.equal(out[1], theirs2);
  assert.equal(out[2], mine3);
  // Without a merge it is this tab's whole résumé, as the job and board stores have it.
  assert.equal(keepUnsaved(incoming, current, stored)[0], mine1);
});

test('keepUnsaved with a merge: deletions here stay deleted, an add here stays, nothing unsaved is the other tab\'s list as it is', () => {
  const r1 = resume({ id: 'r1' });
  const r2 = resume({ id: 'r2' });
  const stored = [r1, r2];
  const incoming = [edited(r1, 30, (r) => { r.personal.name = 'Z'; }), r2];
  assert.equal(keepUnsaved(incoming, stored, stored, mergeResume), incoming);
  const fresh = resume({ id: 'r9' });
  const out = keepUnsaved(incoming, [r1, fresh], stored, mergeResume); // r2 deleted here, r9 added here
  assert.deepEqual(out.map((r) => r.id), ['r1', 'r9']);
  assert.equal(out[0], incoming[0]);
  // A résumé new in both tabs, which storage never held, is this tab's whole one.
  const same9 = edited(fresh, 30, (r) => { r.personal.name = 'Elsewhere'; });
  assert.equal(keepUnsaved([...incoming, same9], [r1, r2, fresh], stored, mergeResume).find((r) => r.id === 'r9'), fresh);
});

/** A small seeded generator (mulberry32): the same run every time. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('randomised: two tabs editing disjoint places always merge to the same résumé holding every edit', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const rand = rng(seed);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const base = resume({ personal: { name: 'Casey Example', website: '', summary: '[A:][B:]', hiddenFields: [] } });
    const expect = { A: {}, B: {} };
    const tab = (who, t) => {
      const r = structuredClone(base);
      const own = who === 'A' ? ['personal.website', 'a'] : ['personal.name', 'c'];
      const typed = 1 + Math.floor(rand() * 5);
      const ch = Array.from({ length: typed }, () => pick(['x', 'y', 'z', '1'])).join('');
      if (own[0] === 'personal.website') r.personal.website = ch; else r.personal.name = `${r.personal.name}${ch}`;
      expect[who].typed = ch;
      const slot = r.personal.summary.indexOf(`[${who}:`) + 3;
      r.personal.summary = r.personal.summary.slice(0, slot) + ch + r.personal.summary.slice(slot);
      const list = r.sections[0].items;
      if (rand() < 0.5) { list.push(entry(`n_${who}`)); expect[who].added = `n_${who}`; }
      if (rand() < 0.5) { const victim = who === 'A' ? 'a' : 'c'; r.sections[0].items = list.filter((i) => i.id !== victim); expect[who].deleted = victim; }
      if (rand() < 0.5) { const e = r.sections[0].items.find((i) => i.id === 'b'); if (e && who === 'B') { e.role = ch; expect[who].role = ch; } }
      r.updatedAt = t;
      return r;
    };
    const a = tab('A', 20 + Math.floor(rand() * 3));
    const b = tab('B', 20 + Math.floor(rand() * 3));
    const out = both(base, a, b);
    const note = `seed ${seed}`;
    assert.equal(out.personal.website, expect.A.typed, note);
    assert.equal(out.personal.name, `Casey Example${expect.B.typed}`, note);
    const [, slotA, slotB] = out.personal.summary.match(/^\[A:(.*)\]\[B:(.*)\]$/);
    assert.equal(slotA, expect.A.typed, note);
    assert.equal(slotB, expect.B.typed, note);
    const ids = items(out);
    for (const w of ['A', 'B']) {
      if (expect[w].added) assert.ok(ids.includes(expect[w].added), note);
      if (expect[w].deleted) assert.ok(!ids.includes(expect[w].deleted), note);
    }
    assert.equal(new Set(ids).size, ids.length, `${note}: no entry twice`);
    if (expect.B.role) assert.equal(out.sections[0].items.find((i) => i.id === 'b').role, expect.B.role, note);
  }
});

test('randomised: a text two tabs edit anywhere merges to the same text in both tabs, and a change in a part the other did not touch is kept', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const rand = rng(seed * 7919);
    const word = () => Array.from({ length: 1 + Math.floor(rand() * 4) }, () => 'abcde'[Math.floor(rand() * 5)]).join('');
    const base = Array.from({ length: 4 + Math.floor(rand() * 6) }, word).join(' ');
    const change = (s) => {
      const at = Math.floor(rand() * (s.length + 1));
      const cut = rand() < 0.4 ? Math.floor(rand() * Math.min(3, s.length - at + 1)) : 0;
      return s.slice(0, at) + (rand() < 0.8 ? word() : '') + s.slice(at + cut);
    };
    const x = change(base);
    const y = change(base);
    const mk = (v, t) => ({ id: 'r', updatedAt: t, name: v });
    const merged = mergeResume(mk(base, 1), mk(x, 2), mk(y, 3));
    assert.deepEqual(mergeResume(mk(base, 1), mk(y, 3), mk(x, 2)), merged, `seed ${seed}: the two tabs differ`);
    assert.equal(typeof merged.name, 'string');
    // Never a text neither tab typed: its length is the base's with the two changes, or one tab's own.
    assert.ok([x, y].includes(merged.name) || merged.name.length === base.length + (x.length - base.length) + (y.length - base.length), `seed ${seed}: ${JSON.stringify({ base, x, y, merged: merged.name })}`);
  }
});

test('a long text is merged whole: 200 000 characters, two insertions far apart', () => {
  const base = 'word '.repeat(40_000);
  const mine = `Dr. ${base}`;
  const theirs = `${base}Jr.`;
  const out = mergeResume({ id: 'r', updatedAt: 1, t: base }, { id: 'r', updatedAt: 2, t: mine }, { id: 'r', updatedAt: 3, t: theirs });
  assert.equal(out.t, `Dr. ${base}Jr.`);
});
