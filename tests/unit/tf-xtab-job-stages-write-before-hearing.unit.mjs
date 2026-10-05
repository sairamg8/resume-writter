// Typing-freeze finding 5, the same race in the custom interview stages: another tab's stage that had
// landed in storage while its `storage` event was still on its way was not in this tab's list, and this
// tab's next add or remove wrote the list over it. Now a change reads storage first and takes in a
// save it has not heard of (src/utils/jobStages.js). Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'cpwtcv_job_stages_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); this.writes = 0; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (k === KEY) this.writes += 1; this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
class FullStorage extends MemoryStorage {
  setItem(k, v) {
    if (k === KEY) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    super.setItem(k, v);
  }
}

let visit = 0;
const openApp = () => import(`../../src/utils/jobStages.js?xtab=${visit += 1}`);
const stored = () => JSON.parse(localStorage.getItem(KEY));

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.addEventListener = () => {};
});

test('another tab adds a stage whose event has not arrived: this tab\'s add keeps it', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Panel']));
  const stages = await openApp();
  assert.deepEqual(stages.stagesSnapshot(), ['Panel']);
  localStorage.setItem(KEY, JSON.stringify(['Panel', 'Onsite'])); // landed; its event is on its way
  stages.addCustomStage('Culture Round');
  assert.deepEqual(stored(), ['Panel', 'Onsite', 'Culture Round'], 'before: Onsite was written over');
  assert.deepEqual(stages.stagesSnapshot(), ['Panel', 'Onsite', 'Culture Round']);
});

test('the same for a removal: the list the other tab saved, less the stage removed here', async () => {
  localStorage.setItem(KEY, JSON.stringify(['Panel', 'Onsite']));
  const stages = await openApp();
  stages.stagesSnapshot();
  localStorage.setItem(KEY, JSON.stringify(['Panel', 'Onsite', 'Culture Round']));
  stages.removeCustomStage('Onsite');
  assert.deepEqual(stored(), ['Panel', 'Culture Round']);
});

test('a stage the other tab just added is offered, not added twice', async () => {
  const stages = await openApp();
  stages.stagesSnapshot();
  localStorage.setItem(KEY, JSON.stringify(['Culture Round']));
  assert.equal(stages.addCustomStage('culture round'), 'Culture Round');
  assert.deepEqual(stored(), ['Culture Round']);
  assert.equal(localStorage.writes, 1, 'nothing written by this tab');
});

test('nothing waiting: a change is one write, and a list this tab wrote is not taken as another tab\'s', async () => {
  const stages = await openApp();
  stages.addCustomStage('Panel');
  stages.addCustomStage('Onsite');
  assert.deepEqual(stored(), ['Panel', 'Onsite']);
  assert.equal(localStorage.writes, 2);
});

test('storage full: stages kept in memory stay, as before', async () => {
  globalThis.localStorage = new FullStorage();
  const stages = await openApp();
  stages.addCustomStage('Panel');
  stages.addCustomStage('Onsite');
  assert.deepEqual(stages.stagesSnapshot(), ['Panel', 'Onsite']);
});
