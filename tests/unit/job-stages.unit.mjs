// Unit tests for the shared list of custom interview stages (src/utils/jobStages.js): what a
// saved list reads as, what a change writes, and what it copies first (R6-3). The browser side —
// that opening the form writes nothing at all — is cypress/e2e/20-regressions-job-store.cy.js.
// Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'cpwtcv_job_stages_v1';

/** A localStorage stand-in, as in storage-backup.unit.mjs: the methods the app uses. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** A storage that refuses every write of the stage list, the way a full one does. */
class FullStorage extends MemoryStorage {
  setItem(k, v) {
    if (k === KEY) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    super.setItem(k, v);
  }
}

const backups = () => [...globalThis.localStorage.map.keys()].filter((k) => k.startsWith(`${KEY}_backup_`));
const stored = () => globalThis.localStorage.getItem(KEY);

// The list is one per tab, held in the module: a fresh copy per test is a fresh specifier.
let visit = 0;
const openApp = () => import(`../../src/utils/jobStages.js?visit=${visit += 1}`);

/** What another tab's write fires here: the handlers the module registered on window. */
let onStorage = [];
const otherTabSaved = (value) => {
  localStorage.setItem(KEY, value);
  onStorage.forEach((h) => h({ key: KEY, newValue: value }));
};

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  onStorage = [];
  globalThis.addEventListener = (type, handler) => { if (type === 'storage') onStorage.push(handler); };
});

test('nothing saved: no stages, and reading the list writes nothing', async () => {
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot(), []);
  assert.equal(stored(), null, 'an empty list is not written until the user adds one');
  assert.deepEqual(backups(), []);
});

test('a saved list reads back as it is; the same array every time, so React re-renders on a change only', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Culture Round', 'Founder Chat']));
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot(), ['Culture Round', 'Founder Chat']);
  assert.equal(stages.stagesSnapshot(), stages.stagesSnapshot());
});

test('a partly unreadable list: the names it holds are read, and nothing is written until a change (R6-3)', async () => {
  const raw = JSON.stringify(['Culture Round', { label: 'Onsite' }]);
  localStorage.setItem(KEY, raw);
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot(), ['Culture Round']);
  assert.equal(stored(), raw, 'opening the form leaves the saved value alone');
  assert.deepEqual(backups(), [], 'nothing replaced, so nothing to copy');

  // The first change replaces it — after a copy of the whole original is kept.
  stages.addCustomStage('Panel');
  assert.deepEqual(JSON.parse(stored()), ['Culture Round', 'Panel']);
  assert.equal(backups().length, 1);
  assert.equal(localStorage.getItem(backups()[0]), raw, 'the entry that could not be read is in it');

  // Replaced once: a second change is not a second copy.
  stages.addCustomStage('Founder Chat');
  assert.equal(backups().length, 1);
});

test('a value that is not a list at all is kept until a change copies it', async () => {
  localStorage.setItem(KEY, '{"not":"a list"}');
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot(), []);
  assert.equal(stored(), '{"not":"a list"}');
  stages.addCustomStage('Culture Round');
  assert.deepEqual(JSON.parse(stored()), ['Culture Round']);
  assert.equal(localStorage.getItem(backups()[0]), '{"not":"a list"}');
});

test('a list that reads back in full is replaced with no copy; a blank name loses nothing either', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Culture Round', '  ']));
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot(), ['Culture Round']);
  stages.addCustomStage('Panel');
  assert.deepEqual(backups(), [], 'a blank name holds nothing: no copy and no clutter');
});

test('the list another tab saved is taken, so the next change here keeps both tabs\' stages (R6-3)', async () => {
  const stages = await openApp();
  stages.addCustomStage('Panel');
  let notified = 0;
  stages.subscribeStages(() => { notified += 1; });

  // The other tab adds its own stage: its write lands in storage and fires a storage event here.
  otherTabSaved(JSON.stringify(['Panel', 'Onsite']));
  assert.deepEqual(stages.stagesSnapshot(), ['Panel', 'Onsite']);
  assert.equal(notified, 1, 'the open form shows it');

  stages.addCustomStage('Culture Round');
  assert.deepEqual(JSON.parse(stored()), ['Panel', 'Onsite', 'Culture Round']);
});

test('a stage already offered is not added twice, whatever its case, and a blank one not at all', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Culture Round']));
  const stages = await openApp();
  stages.addCustomStage('culture round');
  stages.addCustomStage('PHONE SCREEN'); // one of PREDEFINED_STAGES
  stages.addCustomStage('   ');
  assert.deepEqual(stages.stagesSnapshot(), ['Culture Round']);
  assert.equal(stored(), JSON.stringify(['Culture Round']), 'and nothing was written');
});

test('removing: the stage goes, and a name the list never held writes nothing', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Culture Round', 'Panel']));
  const stages = await openApp();
  stages.removeCustomStage('Culture Round');
  assert.deepEqual(JSON.parse(stored()), ['Panel']);
  localStorage.removeItem(KEY);
  stages.removeCustomStage('Never Added');
  assert.equal(stored(), null);
});

test('storage full: the stage is still offered for this job, and the saved value stays readable', async () => {
  globalThis.localStorage = new FullStorage();
  localStorage.setItem('other', 'kept');
  const stages = await openApp();
  stages.addCustomStage('Culture Round');
  assert.deepEqual(stages.stagesSnapshot(), ['Culture Round'], 'the form shows it — it just is not remembered');
  assert.equal(stored(), null);
});

// ── J-28: a stage that differs only in case ──────────────────────────────────────────────────
// Adding 'hr round' added nothing, yet the job got 'hr round' — matching no item in either list.

test('J-28: addCustomStage returns the stage the job gets — an existing one in its own case, else the new one', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Founder Chat']));
  const stages = await openApp();
  assert.equal(stages.addCustomStage('hr round'), 'HR Round', 'the predefined stage');
  assert.equal(stages.addCustomStage('  founder CHAT '), 'Founder Chat', 'the custom stage');
  assert.deepEqual(stages.stagesSnapshot(), ['Founder Chat'], 'nothing added');
  assert.equal(stages.addCustomStage(' Culture Round '), 'Culture Round', 'a new one, trimmed');
  assert.deepEqual(stages.stagesSnapshot(), ['Founder Chat', 'Culture Round']);
  assert.equal(stages.addCustomStage('   '), '', 'nothing to add');
});
