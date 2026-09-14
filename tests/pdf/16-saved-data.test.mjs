// Résumés saved by older builds — in this browser, in the cloud, in an exported .json — are made
// current on the way in (src/utils/normalizeResume.js); these tests check the migrations and
// what the documents print afterwards.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allText, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

/** The letter block every résumé created before bf0467f saved: a recipient title nobody typed. */
const OLD_DEFAULT = { recipientName: '', recipientTitle: 'Hiring Manager', company: '', date: '', subject: '' };

/** A résumé as a build before data version 7 saved it: the old letter default, no dataVersion. */
function legacy(coverLetter = {}) {
  const r = resume({ coverLetter: { ...OLD_DEFAULT, body: '<p>Hello</p>', ...coverLetter } });
  delete r.dataVersion;
  return r;
}

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

async function coverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}

describe('a letter saved with the old "Hiring Manager" default (R1-0)', () => {
  it('prints no recipient line once it is loaded — not in the PDF, not in Word', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(legacy());
    assert.equal(r.coverLetter.recipientTitle, '');
    assert.equal(allText(await read(await renderCover(r))), 'Test Person Engineer Hello Sincerely, Test Person Engineer');
    assert.deepEqual((await coverDocx(r)).texts, ['Test Person', 'Engineer', 'Hello', 'Sincerely,', 'Test Person', 'Engineer']);
  });

  it('keeps the title when the user filled in any other line of the block', async () => {
    const { normalizeResume } = await normalizer();
    for (const key of ['recipientName', 'company', 'subject', 'date']) {
      const r = normalizeResume(legacy({ [key]: 'Globex' }));
      assert.equal(r.coverLetter.recipientTitle, 'Hiring Manager', key);
    }
    const kept = normalizeResume(legacy({ company: 'Globex Corp' }));
    assert.ok(allText(await read(await renderCover(kept))).includes('Hiring Manager Globex Corp'));
    // Blank lines are empty lines: the user filled nothing in.
    assert.equal(normalizeResume(legacy({ date: '  ', subject: '\n' })).coverLetter.recipientTitle, '');
  });

  it('a "Hiring Manager" the user typed after the migration is theirs: it stays and prints', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    // A résumé created by this build carries the current version, so the migration never runs on it.
    const typed = resume({ coverLetter: { recipientTitle: 'Hiring Manager', body: '<p>Hello</p>' } });
    assert.equal(typed.dataVersion, DATA_VERSION);
    assert.equal(normalizeResume(typed), typed, 'the same object: nothing to change');
    // A migrated letter the user then fills in again is loaded (or synced, or imported) as it is.
    const migrated = normalizeResume(legacy());
    const edited = { ...migrated, coverLetter: { ...migrated.coverLetter, recipientTitle: 'Hiring Manager' } };
    const reloaded = normalizeResume(JSON.parse(JSON.stringify(edited)));
    assert.equal(reloaded.coverLetter.recipientTitle, 'Hiring Manager');
    assert.ok(allText(await read(await renderCover(reloaded))).includes('Hiring Manager'));
  });

  it('is not an edit: the input is not mutated, updatedAt is kept, the rest is untouched', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const old = { ...legacy({ closing: 'Best' }), template: 'dark', updatedAt: 5 };
    const before = JSON.parse(JSON.stringify(old));
    const r = normalizeResume(old);
    assert.deepEqual(old, before, 'the input is not mutated');
    assert.deepEqual(r, {
      ...before, template: 'classic', dataVersion: DATA_VERSION,
      coverLetter: { ...before.coverLetter, recipientTitle: '' },
    });
    assert.equal(normalizeResume(r), r, 'a current résumé: the same object');
    // An older résumé with no letter gets no letter; junk passes through.
    const { coverLetter: _letter, ...noLetter } = before;
    assert.ok(!('coverLetter' in normalizeResume(noLetter)));
    for (const v of [null, undefined, 'text', 7]) assert.equal(normalizeResume(v), v);
    assert.equal(normalizeResume({ ...before, dataVersion: 'x' }).coverLetter.recipientTitle, '', 'a junk version is no version');
  });
});

describe('cloud sync merge (R1-0)', () => {
  it('a cloud copy saved by an older build comes in migrated, whichever side wins', async () => {
    const { mergeResumeLists } = await loadModule('/src/utils/syncMerge.js');
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const cloudOnly = { ...legacy(), id: 'cloud_only', updatedAt: 1 };
    const cloudNewer = { ...legacy({ closing: 'Cloud' }), id: 'both', updatedAt: 20 };
    const localOlder = { ...normalizeResume(legacy({ closing: 'Local' })), id: 'both', updatedAt: 10 };
    const gone = { ...legacy(), id: 'gone', updatedAt: 30 };
    const merged = mergeResumeLists([localOlder], [cloudOnly, cloudNewer, gone], new Set(['gone']));
    assert.deepEqual(merged.map((r) => r.id).toSorted(), ['both', 'cloud_only']);
    for (const r of merged) {
      assert.equal(r.coverLetter.recipientTitle, '', r.id);
      assert.equal(r.dataVersion, DATA_VERSION, r.id);
    }
    assert.equal(merged.find((r) => r.id === 'both').coverLetter.closing, 'Cloud', 'the newer copy wins');
    assert.equal(merged.find((r) => r.id === 'both').updatedAt, 20, 'not an edit: updatedAt is kept');

    const tie = mergeResumeLists([{ ...localOlder, updatedAt: 20 }], [cloudNewer], new Set());
    assert.equal(tie[0].coverLetter.closing, 'Local', 'this browser wins a tie');
  });
});
