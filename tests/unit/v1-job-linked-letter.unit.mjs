// V1, documented behaviour (no app change): a job linked to a cover letter keeps that link. The tracker
// reads the record as linked, it is still a letter (so the dashboard lists it with the letters and the
// editor opens it on the letter's tab), and the job's Resume Used picker keeps listing that one letter
// (and no other) so the link shows. Pins that "a letter linked to a job shows as a letter" is intended.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkedResume, resumeChoices } from '../../src/utils/jobQuery.js';
import { isLetter, editorPath } from '../../src/utils/letters.js';

const cv = { id: 'resume_a', name: 'Design CV' };
const letter = { id: 'resume_l', name: 'Cover Letter', kind: 'letter' };
const otherLetter = { id: 'resume_m', name: 'Cover Letter', kind: 'letter' };
const all = [cv, letter, otherLetter];
const job = { id: 'job_1', resumeId: 'resume_l' };

test('a job linked to a letter reads as linked, and the record is still a letter', () => {
  const link = linkedResume(job, all);
  assert.equal(link.state, 'linked');
  assert.equal(link.resume, letter);
  assert.equal(isLetter(link.resume), true, 'it shows as a letter, not as a résumé');
  assert.equal(editorPath(link.resume.id, link.resume), '/resume/resume_l?tab=coverletter', 'Open goes to the letter');
});

test('the job\'s Resume Used picker lists the résumés and only the letter it is linked to', () => {
  assert.deepEqual(resumeChoices(job, all).map((r) => r.id), ['resume_a', 'resume_l']);
  assert.deepEqual(resumeChoices({ id: 'job_2' }, all).map((r) => r.id), ['resume_a'], 'an unlinked job lists no letter');
});
