// Two lists repaired in a storage too full for both copies (ONB-4). The job list could not be read:
// its original was copied and the tracker's notice offers it. Later the résumé store could not be
// read either, and its copy only fitted without the job list's: backupRaw removed that one to make
// room, and the tracker's notice then said it "was later removed to make room for your changes",
// although nothing of the user's had needed the room. The real useJobStore and useAppStore run
// here, effects included (react-dom/client over tests/pdf/fake-dom.mjs), over a localStorage
// with a quota; the notices are the real RecoveryNotice, as the tracker and the dashboard show it.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { settle } from './fake-firestore.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const JOBS = 'cpwtcv_jobs_v1';
const RESUMES = 'cpwtcv_v1';

/** A localStorage stand-in with a quota in characters (keys and values), as a browser's ~5 MB. */
class MemoryStorage {
  constructor() { this.map = new Map(); this.quota = Infinity; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const used = [...this.map].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + String(v).length > this.quota) {
      throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    }
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
  get used() { return [...this.map].reduce((n, [key, val]) => n + key.length + val.length, 0); }
}

/** The page's recovery notice (role=alert, "could not be read"), by its text; null when none shows. */
async function noticeOf(page) {
  const view = mount(page, {});
  try {
    await settle(); // the résumé store backs up from an effect (VM4-9)
    view.update({});
    const alert = [...elements(view.container)].find((el) => el.getAttribute('role') === 'alert');
    return alert ? alert.textContent : null;
  } finally { await view.unmount(); }
}

it('the job list\'s copy is not removed to make room for the résumé store\'s: the tracker still offers it', async () => {
  const { RecoveryNotice } = await loadModule('/src/components/RecoveryNotice.jsx');
  const { useJobStore } = await loadModule('/src/hooks/useJobStore.js');
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const Tracker = () => {
    const { recovery } = useJobStore();
    return recovery && createElement(RecoveryNotice, { what: 'job list', recovery, onDismiss() {} });
  };
  const Dashboard = () => {
    const store = useAppStore();
    return store.recovery && createElement(RecoveryNotice, { what: 'résumés', recovery: store.recovery, onDismiss() {} });
  };

  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  try {
    const jobsRaw = `{ "jobs": [ cut off${'j'.repeat(300)}`;
    storage.setItem(JOBS, jobsRaw);
    const first = await noticeOf(Tracker); // the job list is read, copied and repaired
    const [jobsCopy] = [...storage.map.keys()].filter((k) => k.startsWith(`${JOBS}_backup_`));
    assert.equal(storage.getItem(jobsCopy), jobsRaw);
    assert.ok(first.includes(`under “${jobsCopy}”`), first);

    // Later: the résumé store cannot be read, and storage has room for its copy only without the job list's.
    const resumesRaw = `{ "resumes": [ cut off${'r'.repeat(300)}`;
    storage.setItem(RESUMES, resumesRaw);
    storage.quota = storage.used + 100;
    const dashboard = await noticeOf(Dashboard);
    const tracker = await noticeOf(Tracker);

    // Before: "The copy of the original kept under “…” was later removed to make room for your changes."
    assert.ok(!tracker.includes('removed to make room for your changes'), tracker);
    assert.equal(storage.getItem(jobsCopy), jobsRaw, 'before: removed to make room for the résumé store\'s copy');
    assert.ok(tracker.includes(`A copy of the original is kept in this browser`) && tracker.includes(`under “${jobsCopy}”`), tracker);
    assert.ok(tracker.includes('Download the copy'), tracker);
    // One copy could not be kept either way; the dashboard says it of its own, which is so.
    assert.ok(dashboard.includes('Browser storage is full, so no copy of the original could be kept.'), dashboard);
    assert.deepEqual([...storage.map.keys()].filter((k) => k.startsWith(`${RESUMES}_backup_`)), []);
    assert.equal(JSON.parse(storage.getItem(RESUMES)).resumes.length, 0, 'the repaired store is saved');
  } finally {
    delete globalThis.localStorage;
  }
});
