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
import { BOARD_COSMETIC, boardConflictCopy, jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const USERS = { A: { uid: 'A', email: 'a@example.com' }, B: { uid: 'B', email: 'b@example.com' } };
const SEEDS = Number(process.env.H1_FUZZ_SEEDS) || 1500;
const ONLY = (process.env.H1_FUZZ_ONLY ?? '').split(',').filter(Boolean).map(Number); // seeds to run alone, to look at them
const STEPS = 140;
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
// A project: every one has the same key to begin with, and the store gives a later one with a key another has a key of its own.
const board = (id, notes, updatedAt) => ({ id, key: 'KEY', title: 'Acme', notes, starred: false, color: '', issues: [], updatedAt });

/** What differs between the two lists the engine syncs: the item, its copy, the store's own pass over a list it takes. */
const KINDS = {
  jobs: { name: 'jobs', make: job, label: (j) => j.company, copy: jobConflictCopy, apart: [], addressable: (list) => list },
  boards: {
    name: 'boards', make: board, label: (b) => b.title, copy: boardConflictCopy, apart: BOARD_COSMETIC,
    addressable: (list) => {
      const keys = new Set();
      return list.map((b) => {
        let key = b.key;
        for (let n = 2; keys.has(key); n += 1) key = `${b.key}${n}`;
        keys.add(key);
        return key === b.key ? b : { ...b, key };
      });
    },
  },
};

/**
 * `fs` with a random pause before each call to the server (none, or a few turns of the event loop): the syncs of different
 * devices, started together or one after the other, then reach the account in many different orders.
 */
function jittered(fs, rand) {
  const pause = async () => { for (let n = Math.floor(rand() * 4); n > 0; n -= 1) await new Promise((resolve) => { setImmediate(resolve); }); };
  return {
    ...fs,
    getDocsFromServer: async (col) => { await pause(); return fs.getDocsFromServer(col); },
    getDocFromServer: async (ref) => { await pause(); return fs.getDocFromServer(ref); },
    writeBatch: (db) => {
      const batch = fs.writeBatch(db);
      return { set: (...a) => batch.set(...a), delete: (...a) => batch.delete(...a), commit: async () => { await pause(); return batch.commit(); } };
    },
    runTransaction: async (db, update) => {
      await pause();
      return fs.runTransaction(db, (tx) => update({
        get: async (ref) => { await pause(); return tx.get(ref); },
        set: (...a) => tx.set(...a),
        delete: (...a) => tx.delete(...a),
      }));
    },
  };
}

/**
 * `fs` as the rules (firestore.rules) have it: a call is answered for the account the browser is signed in as when the call
 * reaches the server (`account()`: null, nobody), and refused for any other's documents. A sync a start has replaced then
 * cannot write to the account the browser has left.
 */
function asUser(fs, account, onWrite = () => {}) {
  const check = (path) => {
    const a = account();
    if (!a || !path.startsWith(`users/${a}/`)) throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  };
  return {
    ...fs,
    getDocsFromServer: async (col) => { check(col.path); return fs.getDocsFromServer(col); },
    getDocFromServer: async (ref) => { check(ref.path); return fs.getDocFromServer(ref); },
    writeBatch: (db) => {
      const paths = [];
      const named = [];
      const batch = fs.writeBatch(db);
      return {
        set: (ref, ...rest) => { paths.push(ref.path); named.push(`set ${ref.path}`); return batch.set(ref, ...rest); },
        delete: (ref) => { paths.push(ref.path); named.push(`del ${ref.path}`); return batch.delete(ref); },
        commit: async () => { paths.forEach(check); onWrite('batch', named); return batch.commit(); },
      };
    },
    runTransaction: (db, update) => fs.runTransaction(db, async (tx) => {
      const paths = [];
      const named = [];
      const result = await update({
        get: async (ref) => { check(ref.path); return tx.get(ref); },
        set: (ref, ...rest) => { paths.push(ref.path); named.push(`set ${ref.path}`); return tx.set(ref, ...rest); },
        delete: (ref) => { paths.push(ref.path); named.push(`del ${ref.path}`); return tx.delete(ref); },
      });
      paths.forEach(check);
      onWrite('tx', named);
      return result;
    }),
  };
}

/** One browser: its list, its sync record, its engine (booted again by a reload), and what it is signed in as. */
function device(cloud, index, link, kind) {
  const d = { turns: 5, index, list: [], online: true, account: null, clock: 0, wipes: 0, lastDeleted: null };
  const listeners = new Set();
  d.set = (next) => { d.list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => d.list, replace: (next) => d.set(kind.addressable(next)),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (x) => x, label: kind.label, conflictCopy: kind.copy, conflictApart: kind.apart,
    // The first visit's demo job: one id on every browser, untouched until someone writes in it.
    seed: (j) => j.id === 'demo' && j.notes === '', seedIds: ['demo'],
  };
  const record = () => memoryMeta({ uid: null, versions: {}, revs: {}, device: `dev-${index}-${d.wipes}`, order: null, stashed: {} });
  d.meta = record();
  const served = link(d);
  d.boot = () => {
    d.sync?.cancel(); // the page that was is gone
    listeners.clear();
    d.timers = manualTimers();
    const { seen, report } = recorder();
    d.seen = seen;
    d.sync = createCollectionSync({
      name: kind.name, io: collectionIo(served, cloud.db, kind.name), store, meta: d.meta, report, timers: d.timers,
      online: () => d.online, now: () => d.clock,
    });
  };
  d.boot();
  d.user = () => (d.account ? USERS[d.account] : null);
  d.start = async (user = d.user()) => { d.sync.start(user); await settle(d.turns); };
  d.fire = async () => { await d.timers.fire(); await settle(d.turns); };
  d.wipe = (list) => {
    d.wipes += 1;
    d.list = list;
    d.meta = record();
    d.account = null;
    d.lastDeleted = null;
    d.boot();
  };
  return d;
}

async function replay(ops, seed, trace = false) {
  const kind = KINDS[seed % 3 === 0 ? 'boards' : 'jobs'];
  const cloud = fakeFirestore();
  // Calm: a step ends when its syncs have. Jittered: a step ends soon, and its syncs go on among the next steps'.
  const jitter = seed % 2 === 0 ? random(seed * 7919 + 13) : null;
  const onWrite = (d) => (kind, paths) => writes.push(`d${d.index} ${kind}: ${paths.map((p) => p.replace('users/', '').replace(`/${kind.name}/`, '/').replace(`/meta/${kind.name}`, '/meta')).join(' ')}`);
  const link = (d) => (jitter ? jittered(asUser(cloud.fs, () => d.account, onWrite(d)), jitter) : asUser(cloud.fs, () => d.account, onWrite(d)));
  const devices = [0, 1, 2].map((i) => device(cloud, i, link, kind));
  for (const d of devices) d.turns = jitter ? 3 : 5;
  const script = [];
  let tick = 0;
  let serial = 0;
  const owners = new Map(); // token → the accounts it was typed for
  const unowned = new Set(); // typed before any account had synced the browser's list: it may reach the account of a sync a start replaced
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
    else { pending[d.index].push(token); unowned.add(token); }
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
  const writes = [];
  let shownWrites = 0;
  const dump = () => {
    if (!trace) return;
    const written = writes.slice(shownWrites);
    shownWrites = writes.length;
    if (written.length) script.push(`      wrote: ${written.join(' | ')}`);
    for (const acct of ['A', 'B']) {
      const docs = [...cloud.data].filter(([p]) => p.startsWith(`users/${acct}/${kind.name}/`)).map(([p, v]) => `${p.split('/').at(-1).replace('job_', '')}=${short(v.notes)}@${v.updatedAt - 1_000_000}r${v.syncRev}${v.syncBy?.replace('dev-', 'd')}`);
      if (docs.length) script.push(`      cloud ${acct}: ${docs.join(' ')}`);
    }
    for (const x of devices) {
      script.push(`      d${x.index}${x.account ? ` (${x.account})` : ' (out)'}${x.online ? '' : ' (off)'}: ${x.list.map((j) => `${j.id.replace('job_', '')}=${short(j.notes)}@${j.updatedAt - 1_000_000}`).join(' ')}`);
      const m = x.meta.read();
      const seenIds = Object.keys(m.versions).map((id) => `${id.replace('job_', '')}:${m.versions[id] - (m.versions[id] > 1000 ? 1_000_000 : 0)}/r${m.revs[id] ?? '-'}`);
      script.push(`           record ${m.uid ?? '-'} ${seenIds.join(' ')}`);
    }
  };

  async function signIn(d, account) {
    d.account = account;
    await d.start();
  }
  // Every browser shows the demo job at first; device 0 starts with two jobs more, the others join the account.
  const demo = (d) => kind.make('demo', '', stamp(d));
  devices[0].account = 'A';
  devices[0].set([kind.make('j1', mark(devices[0], 'j1'), stamp(devices[0])), kind.make('j2', mark(devices[0], 'j2'), stamp(devices[0])), demo(devices[0])]);
  devices[1].set([demo(devices[1])]);
  devices[2].set([demo(devices[2])]);
  say('d0 starts with j1, j2 and the demo job, the others with the demo job');
  for (const d of devices) await signIn(d, 'A');

  /** The device's sync run until it has nothing more to send. */
  async function quiesce(d) {
    const turns = d.turns;
    d.turns = 80; // however long the server takes to answer
    await d.start();
    for (let i = 0; i < 6 && d.timers.count; i += 1) await d.fire();
    d.turns = turns;
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
      d.set([...d.list, kind.make(id, text, stamp(d))]);
    } else if (roll < 0.31) {
      const k = pick(IMPORTED);
      const id = `imp${k}`;
      if (d.list.some((x) => x.id === id)) continue;
      const text = mark(d, id, 1000 + k);
      say(`d${d.index} imports ${id}`);
      d.set([...d.list, kind.make(id, text, 50)]);
    } else if (roll < 0.36) {
      if (!d.list.length) continue;
      const target = d.list[pick(d.list.length)];
      say(`d${d.index} deletes ${target.id}`);
      deletedIds.add(target.id);
      const marks = [...target.notes.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      for (const t of marks) deleted.add(t);
      pending[d.index] = pending[d.index].filter((t) => !marks.includes(t)); // belongs to no account while it is gone
      d.lastDeleted = { job: target, index: d.list.indexOf(target), account: d.account, marks };
      d.set(d.list.filter((x) => x.id !== target.id));
    } else if (roll < 0.38) {
      const was = d.lastDeleted;
      if (!was || was.account !== d.account || d.list.some((x) => x.id === was.job.id)) continue;
      say(`d${d.index} undoes the deletion of ${was.job.id}`);
      const rest = [...d.list];
      rest.splice(Math.min(was.index, rest.length), 0, was.job);
      for (const t of was.marks) { const uid = d.meta.read().uid; if (uid) own(t, uid); else pending[d.index].push(t); }
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
      await settle(d.turns);
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
      d.wipe([demo(d)]);
      await d.start(null);
    } else if (roll < 0.97) {
      // A star or a colour: a change of looks alone, which is no conflict (a project's).
      if (kind.name !== 'boards' || !d.list.length) continue;
      const target = d.list[pick(d.list.length)];
      say(`d${d.index} stars ${target.id}`);
      d.set(d.list.map((x) => (x.id === target.id ? { ...x, starred: !x.starred, updatedAt: stamp(d) } : x)));
    } else {
      await settle(2);
    }
  }
  for (const d of devices) d.turns = 80;
  claimAll();
  dump();

  const problems = [];
  const shapeOf = (list) => JSON.stringify(list.map((x) => [x.id, x.notes]).toSorted());
  const inCloud = (acct) => Object.fromEntries([...cloud.data].filter(([p]) => p.startsWith(`users/${acct}/${kind.name}/`)).map(([p, v]) => [p.split('/').at(-1), v.notes]));
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
      if (accounts.has(acct) && !here && !deleted.has(t) && !deletedIds.has(jobOf.get(t)) && !String(jobOf.get(t)).startsWith('imp')) problems.push(`${acct}: the edit [${t}] is in no job of the account`);
      if (!accounts.has(acct) && here && !unowned.has(t)) problems.push(`${acct}: the edit [${t}], typed for the other account, is in this one`);
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
    // Settled means settled: syncs with nothing to send write nothing, and leave no timer behind.
    const before = cloud.commits.length;
    for (const d of devices) await quiesce(d);
    if (cloud.commits.length !== before) {
      problems.push(`${account}: ${cloud.commits.length - before} more write(s) after everything had settled: ${cloud.commits.slice(before).map((ops) => ops.map(([op, path]) => `${op} ${path.replace('users/', '')}`).join(',')).join(' | ')}`);
    }
    for (const d of devices) if (d.timers.count) problems.push(`${account}: d${d.index} still has ${d.timers.count} timer(s) waiting`);
  }
  return { problems, script };
}

/** The script of a seed as data (who, what, which one): replayable, and shorter when steps are left out. */
function generate(seed) {
  const rand = random(seed);
  return Array.from({ length: STEPS }, () => ({ d: Math.floor(rand() * 3), roll: rand(), r: rand(), q: rand() }));
}

/** The steps of `ops` that matter: left out one at a time for as long as the script still fails. */
async function shrink(ops, seed) {
  let kept = ops;
  for (let again = true; again;) {
    again = false;
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      const fewer = kept.filter((_, j) => j !== i);
      if ((await replay(fewer, seed)).problems.length) { kept = fewer; again = true; }
    }
  }
  return kept;
}

test(`three devices, two accounts, ${SEEDS} random scripts: they converge and nothing typed is lost or leaks`, async () => {
  const failures = [];
  const seen = new Set();
  let failed = 0;
  for (const seed of ONLY.length ? ONLY : Array.from({ length: SEEDS }, (_, i) => i + 1)) {
    const ops = generate(seed);
    const { problems } = await replay(ops, seed);
    if (!problems.length) continue;
    failed += 1;
    if (failures.length >= 2) continue;
    const small = await shrink(ops, seed);
    const { problems: left, script } = await replay(small, seed, true);
    const text = script.join('\n    ');
    if (seen.has(text)) continue;
    seen.add(text);
    failures.push(`seed ${seed} (${small.length} steps):\n  ${left.join('\n  ')}\n  script:\n    ${text}`);
  }
  assert.equal(failed, 0, `${failed} of ${SEEDS} scripts failed\n${failures.join('\n\n')}`);
});
