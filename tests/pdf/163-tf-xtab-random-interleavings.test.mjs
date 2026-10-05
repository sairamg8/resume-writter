// Typing-freeze finding 5, shuffled: three tabs of one résumé each type in a place of their own (a field, a
// slot of one shared text, an entry's role), add and delete entries, move entries, save, and hear the
// others' saves, in orders a seeded generator picks — saves made before the others' events arrive among
// them, and quiet spells long enough to write at once. However it goes: the tabs end on the same résumé
// as storage, with no write loop, and every character any tab typed, every entry added and not deleted
// again, is in it. A fixed seed per run, so a failure repeats; its message carries the seed and the steps.
// The real useAppStore under StrictMode in three tabs of one localStorage (tests/pdf/xtab-tabs.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { openTabs, storeOf, savedResume, assertConverged } from './xtab-tabs.mjs';

before(setup);
after(teardown);

const EXP = 'sec_exp';
const OWN = { A: 'website', B: 'jobTitle', C: 'phone' };
const entry = (id) => ({ id, company: `Co ${id}`, role: '', location: '', startDate: '', endDate: '', current: false, description: '' });

/** A small seeded generator (mulberry32): the same run every time. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function run(seed, steps) {
  const rand = rng(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const t = await openTabs(3, storeOf([savedResume({ personal: { ...savedResume().personal, summary: '[A:][B:]' } })]));
  const log = [];
  try {
    const by = Object.fromEntries(t.tabs.map((tab) => [tab.name, tab]));
    const typed = { A: { own: '', slot: '', role: '' }, B: { own: '', slot: '', role: '' }, C: { own: '', slot: '', role: '' } };
    const added = { A: [], B: [], C: [] };
    const every = new Set();
    const gone = new Set();
    let serial = 0;
    for (let step = 0; step < steps; step += 1) {
      const k = pick(['A', 'B', 'C']);
      const tab = by[k];
      const race = rand() < 0.4;
      const ch = pick(['x', 'y', 'z', '1']);
      const roll = rand();
      const note = (what) => log.push(`${step}: ${k} ${what}${race ? ' (races)' : ''}`);
      if (roll < 0.2) {
        note(`types ${ch} in ${OWN[k]}`);
        typed[k].own += ch;
        await tab.edit((s) => s.updatePersonal(OWN[k], tab.resume().personal[OWN[k]] + ch), { race });
      } else if (roll < 0.35 && k !== 'C') {
        note(`types ${ch} in its slot of the summary`);
        typed[k].slot += ch;
        await tab.edit((s) => {
          const text = tab.resume().personal.summary;
          const at = text.indexOf(']', text.indexOf(`[${k}:`));
          s.updatePersonal('summary', text.slice(0, at) + ch + text.slice(at));
        }, { race });
      } else if (roll < 0.45) {
        note(`types ${ch} in its entry's role`);
        typed[k].role += ch;
        await tab.edit((s) => s.updateItem(EXP, `e_${k.toLowerCase()}`, (i) => ({ ...i, role: i.role + ch })), { race });
      } else if (roll < 0.52) {
        const id = `n_${k}_${serial}`;
        serial += 1;
        note(`adds ${id}`);
        added[k].push(id);
        every.add(id);
        await tab.edit((s) => s.addItem(EXP, entry(id)), { race });
      } else if (roll < 0.57 && added[k].length) {
        const id = added[k].splice(Math.floor(rand() * added[k].length), 1)[0];
        note(`deletes ${id}`);
        gone.add(id);
        await tab.edit((s) => s.removeItem(EXP, id), { race });
      } else if (roll < 0.63) {
        const from = Math.floor(rand() * 3);
        const to = Math.floor(rand() * 3);
        note(`moves entry ${from} to ${to}`);
        await tab.edit((s) => s.reorderItems(EXP, from, to), { race });
      } else if (roll < 0.78) {
        note('saves');
        await tab.flush({ race });
      } else if (roll < 0.93) {
        const count = rand() < 0.5 ? 1 : Infinity;
        note(`hears ${count === 1 ? 'one save' : 'every save'}`);
        await tab.deliver(count);
      } else {
        const ms = rand() < 0.5 ? 400 : 5;
        note(`the clock moves ${ms} ms`);
        await t.tick(ms);
      }
    }
    log.push('every tab saves and hears everything');
    await t.quiesce();
    const where = `seed ${seed}\n${log.join('\n')}`;
    assertConverged(assert, t);
    const personal = t.saved().resumes[0].personal;
    for (const k of ['A', 'B', 'C']) assert.equal(personal[OWN[k]], typed[k].own, `${OWN[k]} (${k}'s own field)\n${where}`);
    const slots = personal.summary.match(/^\[A:(.*)\]\[B:(.*)\]$/);
    assert.ok(slots, `the summary's frame is intact: ${personal.summary}\n${where}`);
    assert.equal(slots[1], typed.A.slot, `A's slot\n${where}`);
    assert.equal(slots[2], typed.B.slot, `B's slot\n${where}`);
    const items = t.saved().resumes[0].sections.find((s) => s.id === EXP).items;
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `no entry twice: ${ids}\n${where}`);
    assert.deepEqual([...ids].sort(), ['e_a', 'e_b', 'e_c', ...[...every].filter((id) => !gone.has(id))].sort(), `the entries\n${where}`);
    for (const k of ['A', 'B', 'C']) assert.equal(items.find((i) => i.id === `e_${k.toLowerCase()}`).role, typed[k].role, `${k}'s entry\n${where}`);
  } finally {
    await t.close();
  }
}

describe('three tabs, shuffled (typing-freeze 5)', () => {
  for (let seed = 1; seed <= 16; seed += 1) {
    it(`seed ${seed}: the tabs converge and every edit is kept`, () => run(seed * 104729, 36));
  }
});
