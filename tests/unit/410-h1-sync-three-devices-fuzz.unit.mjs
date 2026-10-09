// H1-SYNC-FUZZ: three devices on two accounts run a seeded random script of edits, additions, imports, deletions with Undo,
// moves, going offline and online, signing out and in, switching accounts, refreshes, page reloads, a browser's site
// data cleared and failing writes and reads, with clocks that are slow and fast. When every device is back online and the
// syncs have settled, for each account: (1) the devices and the account hold the same jobs, (2) nothing typed is lost —
// every edit's mark is in some job of its account (an edit kept as a "(conflict copy)" counting), unless its job was
// deleted in the script, (3) nothing typed for one account is in the other's. The real engine, plan and io over a fake
// Firestore; a failing script is cut down to the steps that matter and printed with each device's list after each step.
// Run: yarn test:unit (H1_FUZZ_SEEDS sets how many scripts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const USERS = { A: { uid: 'A', email: 'a@example.com' }, B: { uid: 'B', email: 'b@example.com' } };
const SEEDS = Number(process.env.H1_FUZZ_SEEDS) || 400;
const STEPS = 110;
// Not multiples of 100 apart: two edits never carry one time (that is a case of its own, 409).
const SKEW = [3, -2537, 1811];
const IMPORTED = 3;

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

/** One browser: its list, its sync record, its engine (booted again by a reload), and what it is signed in as. */
function device(cloud, index) {
  const d = { index, list: [], online: true, account: null, clock: 0, wipes: 0, lastDeleted: null };
  const listeners = new Set();
  d.set = (next) => { d.list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => d.list, replace: (next) => d.set(next),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (x) => x, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
  const record = () => memoryMeta({ uid: null, versions: {}, revs: {}, device: `dev-${index}-${d.wipes}`, order: null, stashed: {} });
  d.meta = record();
  d.boot = () => {
    d.sync?.cancel(); // the page that was is gone
    listeners.clear();
    d.timers = manualTimers();
    const { seen, report } = recorder();
    d.seen = seen;
    d.sync = createCollectionSync({
      name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: d.meta, report, timers: d.timers,
      online: () => d.online, now: () => d.clock,
    });
  };
  d.boot();
  d.user = () => (d.account ? USERS[d.account] : null);
  d.start = async (user = d.user()) => { d.sync.start(user); await settle(); };
  d.fire = async () => { await d.timers.fire(); };
  d.wipe = () => {
    d.wipes += 1;
    d.list = [];
    d.meta = record();
    d.account = null;
    d.lastDeleted = null;
    d.boot();
  };
  return d;
}

async function replay(ops, trace = false) {
  const cloud = fakeFirestore();
  const devices = [0, 1, 2].map((i) => device(cloud, i));
  const script = [];
  let tick = 0;
  let serial = 0;
  const owners = new Map(); // token → the accounts it was typed for
  const pending = [[], [], []]; // typed while signed out: for whichever account the device signs in as next
  const deleted = new Set(); // marks of the edits that were in a job deleted in the script, and of those typed on one
  const deletedIds = new Set(); // ids of jobs deleted in the script
  const jobOf = new Map(); // mark → the id of the job it was typed on
  const stamp = (d) => { tick += 1; return 1_000_000 + tick * 100 + SKEW[d.index]; };
  const say = (text) => script.push(text);
  const own = (token, account) => owners.set(token, new Set([...(owners.get(token) ?? []), account]));
  // A job belongs to the account its browser's list belongs to (the sync record names it once an account has synced);
  // until then it is the browser's own, and goes to whichever account syncs it first.
  const mark = (d, id, fixed) => {
    serial += 1;
    const token = fixed ?? serial;
    jobOf.set(token, id);
    const account = d.meta.read().uid;
    if (account) own(token, account);
    else pending[d.index].push(token);
    return `[${token}]`;
  };
  const claimAll = () => {
    for (const d of devices) {
      const account = d.meta.read().uid;
      if (!account || !pending[d.index].length) continue;
      for (const t of pending[d.index]) own(t, account);
      pending[d.index] = [];
    }
  };
  const short = (n) => n.replace(/\s+/g, '');
  const dump = () => {
    if (!trace) return;
    for (const acct of ['A', 'B']) {
      const docs = [...cloud.data].filter(([p]) => p.startsWith(`users/${acct}/jobs/`)).map(([p, v]) => `${p.split('/').at(-1).replace('job_', '')}=${short(v.notes)}@${v.updatedAt - 1_000_000}r${v.syncRev}`);
      if (docs.length) script.push(`      cloud ${acct}: ${docs.join(' ')}`);
    }
    for (const x of devices) script.push(`      d${x.index}${x.account ? ` (${x.account})` : ' (out)'}${x.online ? '' : ' (off)'}: ${x.list.map((j) => `${j.id.replace('job_', '')}=${short(j.notes)}@${j.updatedAt - 1_000_000}`).join(' ')}`);
  };

  async function signIn(d, account) {
    d.account = account;
    await d.start();
  }
  // Device 0 starts with two jobs; the others join the account.
  devices[0].account = 'A';
  devices[0].set([job('j1', mark(devices[0], 'j1'), stamp(devices[0])), job('j2', mark(devices[0], 'j2'), stamp(devices[0]))]);
  say('d0 starts with j1, j2');
  for (const d of devices) await signIn(d, 'A');

  /** The device's sync run until it has nothing more to send. */
  async function quiesce(d) {
    await d.start();
    for (let i = 0; i < 6 && d.timers.count; i += 1) await d.fire();
  }

  for (const op of ops) {
    claimAll();
    dump();
    const d = devices[op.d];
    const { roll } = op;
    const pick = (n) => Math.floor(op.r * n);
    if (roll < 0.20) {
      if (!d.list.length) continue;
      const target = d.list[pick(d.list.length)];
      const text = mark(d, target.id);
      say(`d${d.index} edits ${target.id} ${text}`);
      d.set(d.list.map((x) => (x.id === target.id ? { ...x, notes: `${x.notes} ${text}`, updatedAt: stamp(d) } : x)));
    } else if (roll < 0.28) {
      const id = `n${serial + 1}`;
      const text = mark(d, id);
      say(`d${d.index} adds ${id} ${text}`);
      d.set([...d.list, job(id, text, stamp(d))]);
    } else if (roll < 0.31) {
      const k = pick(IMPORTED);
      const id = `imp${k}`;
      if (d.list.some((x) => x.id === id)) continue;
      const text = mark(d, id, 1000 + k);
      say(`d${d.index} imports ${id}`);
      d.set([...d.list, job(id, text, 50)]);
    } else if (roll < 0.36) {
      if (!d.list.length) continue;
      const target = d.list[pick(d.list.length)];
      say(`d${d.index} deletes ${target.id}`);
      deletedIds.add(target.id);
      for (const [, t] of target.notes.matchAll(/\[(\d+)\]/g)) deleted.add(Number(t));
      d.lastDeleted = { job: target, index: d.list.indexOf(target), account: d.account };
      d.set(d.list.filter((x) => x.id !== target.id));
    } else if (roll < 0.38) {
      const was = d.lastDeleted;
      if (!was || was.account !== d.account || d.list.some((x) => x.id === was.job.id)) continue;
      say(`d${d.index} undoes the deletion of ${was.job.id}`);
      const rest = [...d.list];
      rest.splice(Math.min(was.index, rest.length), 0, was.job);
      d.set(rest);
    } else if (roll < 0.41) {
      if (d.list.length < 2) continue;
      const next = [...d.list];
      const a = pick(next.length);
      const b = Math.floor(op.q * next.length);
      [next[a], next[b]] = [next[b], next[a]];
      say(`d${d.index} swaps places ${a} and ${b}`);
      d.set(next);
    } else if (roll < 0.52) {
      say(`d${d.index} flushes`);
      await d.fire();
    } else if (roll < 0.55) {
      say(`d${d.index} flushes while the cloud fails`);
      cloud.fail.commit = Object.assign(new Error('unavailable'), { code: 'unavailable' });
      await d.fire();
      cloud.fail.commit = null;
    } else if (roll < 0.57) {
      if (!d.account || !d.online) continue;
      say(`d${d.index} restarts its sync while the cloud cannot be read`);
      cloud.fail.read = Object.assign(new Error('unavailable'), { code: 'unavailable' });
      await d.start();
      cloud.fail.read = null;
    } else if (roll < 0.65) {
      if (!d.account) continue;
      d.online = !d.online;
      say(`d${d.index} goes ${d.online ? 'online' : 'offline'}`);
      await d.start();
    } else if (roll < 0.69) {
      if (!d.account) continue;
      d.account = null;
      say(`d${d.index} signs out`);
      await d.start(null);
    } else if (roll < 0.73) {
      if (d.account) continue;
      const account = op.q < 0.8 ? 'A' : 'B';
      say(`d${d.index} signs in as ${account}`);
      await signIn(d, account);
    } else if (roll < 0.77) {
      if (!d.account) continue;
      const account = d.account === 'A' ? 'B' : 'A';
      say(`d${d.index} switches to ${account}`);
      await signIn(d, account);
    } else if (roll < 0.82) {
      if (!d.account || !d.online) continue;
      d.clock += 10_000;
      say(`d${d.index} is shown again`);
      d.sync.shown();
      await settle();
    } else if (roll < 0.87) {
      if (!d.account || !d.online) continue;
      say(`d${d.index} restarts its sync`);
      await d.start();
    } else if (roll < 0.91) {
      say(`d${d.index} reloads the page`);
      d.boot();
      await d.start();
    } else if (roll < 0.94) {
      // The site data cleared: after everything typed here has reached its account.
      if (!d.account || !d.online || pending[d.index].length || Object.keys(d.meta.read().stashed).length) continue;
      await quiesce(d);
      say(`d${d.index} clears the site data`);
      d.wipe();
      await d.start(null);
    } else {
      await settle(2);
    }
  }
  claimAll();
  dump();

  const problems = [];
  const shapeOf = (list) => JSON.stringify(list.map((x) => [x.id, x.notes]).toSorted());
  const inCloud = (acct) => Object.fromEntries([...cloud.data].filter(([p]) => p.startsWith(`users/${acct}/jobs/`)).map(([p, v]) => [p.split('/').at(-1), v.notes]));
  const check = (acct) => {
    const account = inCloud(acct);
    const cloudShape = JSON.stringify(Object.entries(account).toSorted());
    for (const d of devices) {
      if (shapeOf(d.list) !== cloudShape) problems.push(`${acct}: d${d.index} and the account differ:\n${shapeOf(d.list)}\n${cloudShape}`);
      if (d.seen.status !== 'synced') problems.push(`${acct}: d${d.index} ends ${d.seen.status}`);
    }
    const every = Object.values(account).join(' ');
    for (const [t, accounts] of owners) {
      const here = every.includes(`[${t}]`);
      if (accounts.has(acct) && !here && !deleted.has(t) && !deletedIds.has(jobOf.get(t))) problems.push(`${acct}: the edit [${t}] is in no job of the account`);
      if (!accounts.has(acct) && here) problems.push(`${acct}: the edit [${t}], typed for the other account, is in this one`);
    }
  };

  // Everyone online and signed in as each account in turn, the syncs run until they have nothing more to send.
  let phase = 0;
  for (const account of ['A', 'B', 'A']) {
    phase += 1;
    for (let round = 0; round < 5; round += 1) {
      for (const d of devices) {
        d.online = true;
        d.account = account;
        d.clock += 10_000;
        await quiesce(d);
        claimAll();
        if (trace && round < 2) { say(`final ${account}, round ${round}, d${d.index} synced`); dump(); }
      }
    }
    say(`every device online and signed in as ${account}, settled`);
    if (phase >= 2) check(account);
  }
  return { problems, script };
}

/** The script of a seed as data (who, what, which one): replayable, and shorter when steps are left out. */
function generate(seed) {
  const rand = random(seed);
  return Array.from({ length: STEPS }, () => ({ d: Math.floor(rand() * 3), roll: rand(), r: rand(), q: rand() }));
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

test(`three devices, two accounts, ${SEEDS} random scripts: they converge and nothing typed is lost or leaks`, async () => {
  const failures = [];
  const seen = new Set();
  let failed = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const ops = generate(seed);
    const { problems } = await replay(ops);
    if (!problems.length) continue;
    failed += 1;
    if (failures.length >= 2) continue;
    const small = await shrink(ops);
    const { problems: left, script } = await replay(small, true);
    const text = script.join('\n    ');
    if (seen.has(text)) continue;
    seen.add(text);
    failures.push(`seed ${seed} (${small.length} steps):\n  ${left.join('\n  ')}\n  script:\n    ${text}`);
  }
  assert.equal(failed, 0, `${failed} of ${SEEDS} scripts failed\n${failures.join('\n\n')}`);
});
