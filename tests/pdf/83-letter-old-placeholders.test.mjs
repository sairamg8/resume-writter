// Letters saved by the old generator (R2-043, follow-up). Before 0617247 the Smart Cover Letter
// Generator stored 'Candidate' / 'Professional' as the letter's own signature for a résumé with no
// name or title, and ended the subject "… — Candidate". The fix stops new letters getting them, but a
// letter already saved kept printing them after the user filled in their name. A one-time migration
// (data version 12) clears them, so the letter signs with the résumé's name and title; a signature the
// user typed, and one saved by this build, are left alone.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allText, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');
async function coverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}

/** The old generator's body for a résumé with no title: its opening named a 'Professional'. */
const OLD_BODY = '<p>Dear Hiring Team,</p><p>I am writing to apply for the Professional opportunity at Globex. With over several years of hands-on experience as a Professional, I have dedicated my career.</p>';
const saved = (coverLetter, extra = {}) => ({
  ...resume({ personal: { name: 'Jane Doe', title: 'Staff Engineer' }, coverLetter: { body: OLD_BODY, closing: 'Sincerely,', ...coverLetter } }),
  dataVersion: 11,
  ...extra,
});

describe('letters the old generator saved (R2-043)', () => {
  it('a stored \'Candidate\' / \'Professional\' signature and "— Candidate" subject are cleared: the letter signs with the résumé\'s name and title', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(saved({ signatureName: 'Candidate', signatureDesignation: 'Professional', subject: 'Application for Professional — Candidate' }));
    assert.equal(r.coverLetter.signatureName, '');
    assert.equal(r.coverLetter.signatureDesignation, '');
    assert.equal(r.coverLetter.subject, 'Application for Professional');
    const pdf = allText(await read(await renderCover(r)));
    const docx = (await coverDocx(r)).texts.join(' | ');
    assert.ok(pdf.endsWith('Sincerely, Jane Doe Staff Engineer') && !pdf.includes('Candidate'), pdf);
    assert.ok(docx.endsWith('Sincerely, | Jane Doe | Staff Engineer') && !docx.includes('Candidate'), docx);
  });

  it('a generated name with a placeholder title: only the title is cleared', async () => {
    const { normalizeResume } = await normalizer();
    const r = normalizeResume(saved({ signatureName: 'Jane Doe', signatureDesignation: 'Professional', subject: 'Application for Professional — Jane Doe' }));
    assert.equal(r.coverLetter.signatureName, 'Jane Doe');
    assert.equal(r.coverLetter.signatureDesignation, '');
    assert.equal(r.coverLetter.subject, 'Application for Professional — Jane Doe');
  });

  it('a signature the user typed stays: \'Professional\' over a body that never said it, any other name or title', async () => {
    const { normalizeResume } = await normalizer();
    const typed = { signatureName: 'J. Doe', signatureDesignation: 'Professional', body: '<p>Hello</p>', subject: 'My application — Candidate for the role' };
    const r = normalizeResume(saved(typed));
    for (const [k, v] of Object.entries(typed)) assert.equal(r.coverLetter[k], v, k);
  });

  it('runs once: a letter this build saved keeps a \'Candidate\' the user typed', async () => {
    const { normalizeResume, DATA_VERSION } = await normalizer();
    assert.ok(DATA_VERSION >= 12);
    const now = saved({ signatureName: 'Candidate', signatureDesignation: 'Professional' }, { dataVersion: DATA_VERSION });
    const r = normalizeResume(now);
    assert.equal(r.coverLetter.signatureName, 'Candidate');
    assert.equal(r.coverLetter.signatureDesignation, 'Professional');
    // …and the migrated letter, loaded again, is unchanged.
    const once = normalizeResume(saved({ signatureName: 'Candidate', signatureDesignation: 'Professional' }));
    assert.equal(normalizeResume(once), once);
  });

  it('a résumé with no letter, or a letter with no signature, loads as before', async () => {
    const { normalizeResume } = await normalizer();
    const bare = { ...resume({ personal: { name: 'Jane Doe' } }), dataVersion: 11 };
    delete bare.coverLetter;
    assert.ok(!('coverLetter' in normalizeResume(bare)));
    const plain = normalizeResume(saved({}));
    assert.ok(!('signatureName' in plain.coverLetter) && !('signatureDesignation' in plain.coverLetter));
  });
});
