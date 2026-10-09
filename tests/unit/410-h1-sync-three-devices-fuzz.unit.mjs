// H1-SYNC-FUZZ: three devices on one account run a seeded random script of edits, additions, moves, going offline and
// online, signing out and in, refreshes and failing writes, with clocks that are slow and fast. When every device is back
// online and the syncs have settled: (1) the devices and the account hold the same jobs, (2) nothing typed is lost — every
// edit's mark is in some job, an edit kept as a "(conflict copy)" counting — since nothing is deleted in the script.
// The real engine, plan and io over a fake Firestore. A failing seed prints its script. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const SEEDS = Number(process.env.H1_FUZZ_SEEDS) || 600;
const STEPS = 110;
const SKEW = [0, -2500, 1800];

/** mulberry32: the same numbers for a seed on every machine. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, index) {
  let list = [];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const net = { online: true, signedIn: false, clock: 0 };
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers,
    online: () => net.online, now: () => net.clock,
  });
  return {
    index, timers, seen, net, sync,
    get list() { return list; },
    set,
    start: async (user) => { sync.start(user); await settle(); },
    fire: async () => { await timers.fire(); },
  };
}

/** The script of a seed as data (who, what, which one): replayable, and shorter when steps are left out. */
function generate(seed) {
  const rand = random(seed);
  return Array.from({ length: STEPS }, () => ({ d: Math.floor(rand() * 3), roll: rand(), r: rand(), q: rand() }));
}

async function replay(ops) {
  const cloud = fakeFirestore();
  const devices = [0, 1, 2].map((i) => device(cloud, i));
  const script = [];
  const tokens = [];
  let tick = 0;
  let serial = 0;
  const stamp = (d) => { tick += 1; return 1_000_000 + tick * 100 + SKEW[d.index]; };
  const mark = () => { serial += 1; tokens.push(serial); return `[${serial}]`; };
  const say = (text) => script.push(text);

  async function signIn(d) {
    d.net.signedIn = true;
    await d.start(A);
  }
  // Device 0 starts with two jobs; the others join the account.
  devices[0].set([job('j1', mark(), stamp(devices[0])), job('j2', mark(), stamp(devices[0]))]);
  say('d0 starts with j1, j2');
  for (const d of devices) await signIn(d);

  for (const op of ops) {
    const d = devices[op.d];
    const { roll } = op;
    const pick = (n) => Math.floor(op.r * n);
    if (roll < 0.26) {
      if (!d.list.length) continue;
      const target = d.list[pick(d.list.length)];
      const text = mark();
      say(`d${d.index} edits ${target.id} ${text}`);
      d.set(d.list.map((x) => (x.id === target.id ? { ...x, notes: `${x.notes} ${text}`, updatedAt: stamp(d) } : x)));
    } else if (roll < 0.36) {
      const id = `n${serial + 1}`;
      const text = mark();
      say(`d${d.index} adds ${id} ${text}`);
      d.set([...d.list, job(id, text, stamp(d))]);
    } else if (roll < 0.41) {
      if (d.list.length < 2) continue;
      const next = [...d.list];
      const a = pick(next.length);
      const b = Math.floor(op.q * next.length);
      [next[a], next[b]] = [next[b], next[a]];
      say(`d${d.index} swaps places ${a} and ${b}`);
      d.set(next);
    } else if (roll < 0.55) {
      say(`d${d.index} flushes`);
      await d.fire();
    } else if (roll < 0.60) {
      say(`d${d.index} flushes while the cloud fails`);
      cloud.fail.commit = Object.assign(new Error('unavailable'), { code: 'unavailable' });
      await d.fire();
      cloud.fail.commit = null;
    } else if (roll < 0.70) {
      if (!d.net.signedIn) continue;
      d.net.online = !d.net.online;
      say(`d${d.index} goes ${d.net.online ? 'online' : 'offline'}`);
      await d.start(A);
    } else if (roll < 0.75) {
      if (!d.net.signedIn) continue;
      d.net.signedIn = false;
      say(`d${d.index} signs out`);
      await d.start(null);
    } else if (roll < 0.80) {
      if (d.net.signedIn) continue;
      say(`d${d.index} signs in`);
      await signIn(d);
    } else if (roll < 0.87) {
      if (!d.net.signedIn || !d.net.online) continue;
      d.net.clock += 10_000;
      say(`d${d.index} is shown again`);
      d.sync.shown();
      await settle();
    } else if (roll < 0.93) {
      if (!d.net.signedIn || !d.net.online) continue;
      say(`d${d.index} restarts its sync`);
      await d.start(A);
    } else {
      await settle(2);
    }
  }

  // Everyone online, signed in, and the syncs run until they have nothing more to send.
  for (let round = 0; round < 8; round += 1) {
    for (const d of devices) {
      d.net.online = true;
      d.net.signedIn = true;
      d.net.clock += 10_000;
      await d.start(A);
      for (let i = 0; i < 6 && d.timers.count; i += 1) await d.fire();
    }
  }
  say('every device online and signed in, settled');

  const problems = [];
  const notesOf = (list) => Object.fromEntries(list.map((x) => [x.id, x.notes]));
  const shapes = devices.map((d) => JSON.stringify(Object.entries(notesOf(d.list)).toSorted()));
  const inCloud = Object.fromEntries([...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([p, v]) => [p.split('/').at(-1), v.notes]));
  const cloudShape = JSON.stringify(Object.entries(inCloud).toSorted());
  if (new Set([...shapes, cloudShape]).size !== 1) problems.push(`the devices and the account differ:\n${[...shapes, cloudShape].join('\n')}`);
  const every = Object.values(inCloud).join(' ');
  for (const t of tokens) if (!every.includes(`[${t}]`)) problems.push(`the edit [${t}] is in no job of the account`);
  for (const d of devices) if (d.seen.status !== 'synced') problems.push(`d${d.index} ends ${d.seen.status}`);
  return { problems, script };
}

/** The steps of `ops` that matter: left out one at a time for as long as the script still fails. */
async function shrink(ops) {
  let kept = ops;
  for (let again = true; again;) {
    again = false;
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      const fewer = kept.filter((_, j) => j !== i);
      if ((await replay(fewer)).problems.length) { kept = fewer; again = true; }
    }
  }
  return kept;
}

test(`three devices, ${SEEDS} random scripts: they converge and nothing typed is lost`, async () => {
  const failures = [];
  const seen = new Set();
  let failed = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const ops = generate(seed);
    const { problems } = await replay(ops);
    if (!problems.length) continue;
    failed += 1;
    if (failures.length >= 6) continue;
    const small = await shrink(ops);
    const { problems: left, script } = await replay(small);
    const text = script.join('\n    ');
    if (seen.has(text)) continue;
    seen.add(text);
    failures.push(`seed ${seed} (${small.length} steps):\n  ${left.join('\n  ')}\n  script:\n    ${text}`);
  }
  assert.equal(failed, 0, `${failed} of ${SEEDS} scripts failed\n${failures.join('\n\n')}`);
});
