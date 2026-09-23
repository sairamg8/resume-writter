// A `dataVersion` this build never issued (AUD-26). A résumé's version records which one-time
// migrations it has had; a number above DATA_VERSION is a claim this build cannot check — a newer
// build of the app wrote it, or the number is bad (a hand-edited backup, a corrupt file). Trusting
// it froze the résumé past every migration this app will ever ship, because 999 stays above every
// future DATA_VERSION. It is now stamped with what this build is at and the claim is kept in
// `dataVersionAhead` for the build that can check it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';

let normalizeResume;
let DATA_VERSION;
before(async () => {
  await setup();
  ({ normalizeResume, DATA_VERSION } = await loadModule('/src/utils/normalizeResume.js'));
});
after(teardown);

/** A résumé at `version` with nothing migration 8 (withItemGapsAsPrinted) has written yet. */
const at = (version) => {
  const r = { ...resume(), settings: {}, dataVersion: version };
  delete r.settings.itemGap;
  return r;
};

/** Did this build's migrations run? Migration 8 always writes `settings.itemGap`. */
const migrated = (r) => r.settings?.itemGap != null;

/** Every key of `r`, deeply, whose value is `undefined` — Firestore refuses a write holding one (AUD-07). */
const undefinedKeys = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => (v === undefined ? [`${path}${k}`] : undefinedKeys(v, `${path}${k}.`)));
};

describe('Storage · a dataVersion this build never issued (AUD-26)', () => {
  it('does not freeze a résumé past every future migration: a bad 999 comes back at this build\'s version', () => {
    const out = normalizeResume(at(999));
    // The freeze: 999 stays above every DATA_VERSION this app will ever reach, so `from >= DATA_VERSION`
    // is true for good and no migration — including ones not written yet — ever runs on it again.
    assert.equal(out.dataVersion, DATA_VERSION, '999 is not kept as the version');
    assert.ok(out.dataVersion <= DATA_VERSION, 'the stamp is a version this build has issued');
    assert.equal(out.dataVersionAhead, 999, 'the claim this build could not check is kept, not dropped');
  });

  it('runs none of this build\'s migrations on it — a newer build has had them all', () => {
    assert.equal(migrated(normalizeResume(at(999))), false, 'a bad 999 is not migrated backwards');
    assert.equal(migrated(normalizeResume(at(DATA_VERSION + 1))), false, 'a newer build\'s résumé is not re-migrated');
  });

  it('keeps a newer build\'s version so that build does not migrate its own data twice', () => {
    const out = normalizeResume(at(DATA_VERSION + 1));
    assert.equal(out.dataVersion, DATA_VERSION, 'stamped with what this build is at');
    assert.equal(out.dataVersionAhead, DATA_VERSION + 1, 'the newer build\'s version is remembered');
  });

  it('reads the claim back as the version once this build has caught up with it, and drops it', () => {
    // What a newer build wrote, saved by the older build that could not check it, now loaded by a
    // build that has reached that version: its migrations have run on this data already.
    const out = normalizeResume({ ...at(5), dataVersionAhead: DATA_VERSION });
    assert.equal(migrated(out), false, 'the migrations the claim covers do not run again');
    assert.equal(out.dataVersion, DATA_VERSION);
    assert.ok(!('dataVersionAhead' in out), 'a claim this build has caught up with is absorbed, not carried for ever');
  });

  it('ignores a claim this build will never catch up with', () => {
    const out = normalizeResume({ ...at(5), dataVersionAhead: 999 });
    assert.equal(out.dataVersion, DATA_VERSION);
    assert.equal(out.dataVersionAhead, 999, 'still unverifiable, still kept');
  });

  it('leaves the ordinary cases exactly as they were', () => {
    assert.equal(migrated(normalizeResume(at(7))), true, 'an older résumé still migrates');
    assert.equal(normalizeResume(at(7)).dataVersion, DATA_VERSION);
    const current = at(DATA_VERSION);
    assert.equal(normalizeResume(current), current, 'a current résumé comes back as the same object');
  });

  it('writes no `undefined`, which the cloud refuses (AUD-07)', () => {
    for (const v of [999, DATA_VERSION + 1, DATA_VERSION, 7]) {
      assert.deepEqual(undefinedKeys(normalizeResume(at(v))), [], `dataVersion ${v}`);
    }
    assert.deepEqual(undefinedKeys(normalizeResume({ ...at(5), dataVersionAhead: DATA_VERSION })), []);
  });
});
