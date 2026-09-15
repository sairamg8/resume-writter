// A cover letter saved with a "Visible Contact Fields" list of its own by a build whose letter
// printed the résumé's hidden contacts as well (before e0e243c, FIDB-44): made current on the way
// in (src/utils/normalizeResume.js, v10 — R5-0), so it never prints a contact the résumé hid.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allText, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

// The push of 4bc56fe: the first deployed build whose letter printed its own list alone (e0e243c).
const LIVE = Date.UTC(2026, 8, 14, 16, 9, 53);
const PERSONAL = { email: 'me@example.com', phone: '+1 555 0100', github: 'github.com/me' };
const PHONE = '+1 555 0100';

/**
 * A résumé hiding `resumeHidden`, whose letter stores `letterHidden` (undefined: no list), as a
 * build saved it — `dataVersion` undefined is none stored, as 4bc56fe and the builds before it.
 */
function saved(resumeHidden, letterHidden, { dataVersion, updatedAt = LIVE - 60_000 } = {}) {
  const r = resume({ personal: { ...PERSONAL, hiddenFields: resumeHidden }, coverLetter: { body: '<p>Hello</p>', hiddenFields: letterHidden } });
  if (letterHidden === undefined) delete r.coverLetter.hiddenFields;
  if (dataVersion === undefined) delete r.dataVersion; else r.dataVersion = dataVersion;
  return { ...r, updatedAt };
}

const normalizer = () => loadModule('/src/utils/normalizeResume.js');
const letterText = async (r) => allText(await read(await renderCover(r)));
async function letterDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer())).texts.join(' | ');
}

describe('a letter saved with its own hidden contacts before they were its own alone (R5-0, FIDB-44)', () => {
  it('prints the contacts it printed — none the résumé hides — in the PDF and in Word, and its panel shows them hidden', async () => {
    const { normalizeResume } = await normalizer();
    for (const [label, old] of [
      ['one eye click on the letter (no version)', saved(['phone'], ['github'])],
      ['hidden and shown again on the letter: an empty list', saved(['phone'], [])],
      ['version 8, last edited before 4bc56fe went live', saved(['phone'], ['github'], { dataVersion: 8 })],
      ['version 9, likewise', saved(['phone'], [], { dataVersion: 9 })],
      ['no updatedAt: not known to be newer', { ...saved(['phone'], []), updatedAt: undefined }],
    ]) {
      const r = normalizeResume(old);
      const [pdf, word] = [await letterText(r), await letterDocx(r)];
      assert.ok(!pdf.includes(PHONE) && pdf.includes('me@example.com'), `${label}: the PDF (= the preview): ${pdf}`);
      assert.ok(!word.includes(PHONE) && word.includes('me@example.com'), `${label}: Word: ${word}`);
      assert.ok(r.coverLetter.hiddenFields.includes('phone'), `${label}: the panel shows the phone hidden`);
      assert.deepEqual(r.coverLetter.hiddenFields.filter((k) => k !== 'phone'), old.coverLetter.hiddenFields, `${label}: the letter's own entries are kept`);
    }
    // What those builds printed: the résumé's hidden fields plus the letter's — the email alone here.
    const both = await letterText(normalizeResume(saved(['phone'], ['github'])));
    assert.ok(!both.includes('github.com/me'), both);
  });

  // Guards: nothing else was ever migrated; the fix is the test above.
  it('keeps a list edited since 4bc56fe went live, a letter with no list, and a résumé this build saved', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    const seen = normalizeResume(saved(['phone'], [], { dataVersion: 9, updatedAt: LIVE + 60_000 }));
    assert.deepEqual(seen.coverLetter.hiddenFields, [], 'edited while its letter printed its own list alone');
    assert.ok((await letterText(seen)).includes(PHONE));

    const none = normalizeResume(saved(['phone'], undefined));
    assert.ok(!('hiddenFields' in none.coverLetter), 'no list: it follows the résumé\'s already');
    assert.ok(!(await letterText(none)).includes(PHONE));

    const current = resume({ personal: { ...PERSONAL, hiddenFields: ['phone'] }, coverLetter: { hiddenFields: [] } });
    assert.equal(current.dataVersion, DATA_VERSION);
    assert.equal(normalizeResume(current), current, 'this build\'s data: the same object');

    const nothingToAdd = saved(['phone'], ['phone', 'github']);
    assert.deepEqual(normalizeResume(nothingToAdd).coverLetter, nothingToAdd.coverLetter, 'it hid them already');
    for (const junk of ['phone', null, 7]) {
      const r = normalizeResume({ ...saved(['phone'], []), coverLetter: { body: '<p>Hello</p>', hiddenFields: junk } });
      assert.equal(r.coverLetter.hiddenFields, junk, `a list that is not one (${junk}) is left as it is`);
    }
    const noLetter = saved(['phone'], []);
    delete noLetter.coverLetter;
    assert.ok(!('coverLetter' in normalizeResume(noLetter)));
  });

  it('is not an edit and runs once: a phone the user shows on the letter afterwards stays shown', async () => {
    const { normalizeResume } = await normalizer();
    const old = saved(['phone'], ['github']);
    const before = JSON.parse(JSON.stringify(old));
    const migrated = normalizeResume(old);
    assert.deepEqual(old, before, 'the input is not mutated');
    assert.equal(migrated.updatedAt, old.updatedAt, 'updatedAt is kept');
    assert.deepEqual(migrated.personal, old.personal, 'the résumé keeps its own list');
    assert.equal(normalizeResume(migrated), migrated, 'a second load changes nothing');
    const shown = { ...migrated, coverLetter: { ...migrated.coverLetter, hiddenFields: ['github'] }, updatedAt: 1 };
    const reloaded = normalizeResume(JSON.parse(JSON.stringify(shown)));
    assert.deepEqual(reloaded.coverLetter.hiddenFields, ['github']);
    assert.ok((await letterText(reloaded)).includes(PHONE), 'the user\'s choice prints');
  });
});
