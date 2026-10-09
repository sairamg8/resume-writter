// CYC8-S3: the custom interview stages ("Your Stages") were the browser's, whoever was signed in:
// the next account on a shared browser saw the last one's stage names. Signed in, the added stages
// are now the account's own, kept under its own key (jobStages.js), and signed out they are the
// browser's list as before. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'cpwtcv_job_stages_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let visit = 0;
const openApp = () => import(`../../src/utils/jobStages.js?cyc8account=${visit += 1}`);
const saved = (key) => JSON.parse(localStorage.getItem(key));

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.addEventListener = () => {};
});

test('a stage added while signed in is the account\'s: the next account and the signed-out list do not see it', async () => {
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot('A'), []);
  stages.addCustomStage('Culture Round');
  assert.deepEqual(stages.stagesSnapshot('A'), ['Culture Round']);
  assert.deepEqual(saved(`${KEY}_A`), ['Culture Round'], 'stored under the account\'s own key');
  assert.equal(localStorage.getItem(KEY), null, 'the browser\'s own list is not touched');
  assert.deepEqual(stages.stagesSnapshot('B'), [], 'another account on this browser sees none of them');
  assert.deepEqual(stages.stagesSnapshot(null), [], 'signed out, the browser\'s list has none of them');
});

test('signing back in brings the account\'s stages back; signing out keeps them stored', async () => {
  const stages = await openApp();
  stages.stagesSnapshot('A');
  stages.addCustomStage('Culture Round');
  stages.stagesSnapshot(null);
  stages.addCustomStage('Browser Chat');
  assert.deepEqual(saved(KEY), ['Browser Chat'], 'signed out, the stage is the browser\'s');
  assert.deepEqual(stages.stagesSnapshot('A'), ['Culture Round'], 'the account\'s list does not take the browser\'s later stage');
  assert.deepEqual(saved(`${KEY}_A`), ['Culture Round'], 'sign-out removed nothing');
});

test('removing a stage while signed in changes only that account\'s list', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Browser Chat']));
  localStorage.setItem(`${KEY}_A`, JSON.stringify(['Culture Round', 'Founder Chat']));
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot('A'), ['Culture Round', 'Founder Chat']);
  stages.removeCustomStage('Culture Round');
  assert.deepEqual(saved(`${KEY}_A`), ['Founder Chat']);
  assert.deepEqual(saved(KEY), ['Browser Chat']);
});

test('an account with no list yet starts empty: the browser\'s own names are not carried into it (CYC-B)', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Browser Chat']));
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot('A'), [], 'before: the first open of a new account showed the previous names once');
  assert.equal(localStorage.getItem(`${KEY}_A`), null, 'reading writes nothing');
  stages.addCustomStage('Culture Round');
  assert.deepEqual(saved(`${KEY}_A`), ['Culture Round']);
  assert.deepEqual(saved(KEY), ['Browser Chat'], 'the browser\'s list is left as it was');
  assert.deepEqual(stages.stagesSnapshot('B'), [], 'a second account starts empty too');
  assert.deepEqual(stages.stagesSnapshot(null), ['Browser Chat'], 'signed out, the browser\'s list is still its own');
});

test('the list is the same array on every read of one account, so React re-renders on a change only', async () => {
  const stages = await openApp();
  assert.equal(stages.stagesSnapshot('A'), stages.stagesSnapshot('A'));
  assert.equal(stages.stagesSnapshot('A'), stages.stagesSnapshot());
});
