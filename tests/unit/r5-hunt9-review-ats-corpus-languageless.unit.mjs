// R5-HUNT9-REVIEW-ATS-CORPUS-LANGUAGELESS-PROFICIENCY: a language row with no language prints nothing
// in any export (entryPrints, R5-HUNT9-LANGUAGE-DEFAULT-PROFICIENCY-PRINTS-ALONE), yet the job
// scanner's corpus still took its proficiency: a posting asking for "Conversational" listed it as
// matched on a résumé whose only "Conversational" was such a row's level, printed nowhere. The corpus
// now reads only the entries that print. Fictional data only.
//
// Run: node --test tests/unit/r5-hunt9-review-ats-corpus-languageless.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';

const resumeWith = (languages) => ({
  id: 'r5h9', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com', summary: '', hiddenFields: [] },
  sections: [
    { id: 'exp', type: 'experience', title: 'Work History', visible: true, settings: {}, items: [
      { id: 'e1', company: 'Fabrikam', role: 'Engineer', startDate: '2020-01', current: true, description: '<p>Built the ledger service.</p>' },
    ] },
    { id: 'lang', type: 'languages', title: 'Languages', visible: true, settings: {}, items: languages },
  ],
});

const JD = 'Conversational Conversational Conversational. Ledger.';

test('a language row with no language adds no proficiency to the job match', () => {
  const r = resumeWith([
    { id: 'l1', language: 'Spanish', proficiency: 'Native' },
    { id: 'l2', language: '', proficiency: 'Conversational' },
  ]);
  assert.ok(!/conversational/i.test(extractResumeCorpus(r)), extractResumeCorpus(r));
  const m = matchResumeWithJob(r, JD);
  assert.ok(m.missingKeywords.includes('Conversational'), JSON.stringify(m));
  assert.ok(!m.matchedKeywords.includes('Conversational'), JSON.stringify(m));
});

test('a new row\'s default "Professional" alone is not in the corpus', () => {
  const r = resumeWith([
    { id: 'l1', language: 'Spanish', proficiency: 'Native' },
    { id: 'l2', language: '  ', proficiency: 'Professional' },
  ]);
  assert.ok(!/professional/i.test(extractResumeCorpus(r)), extractResumeCorpus(r));
});

test('a language with its proficiency still counts both (the guard)', () => {
  const r = resumeWith([{ id: 'l1', language: 'Portuguese', proficiency: 'Conversational' }]);
  assert.match(extractResumeCorpus(r), /Portuguese/);
  const m = matchResumeWithJob(r, JD);
  assert.ok(m.matchedKeywords.includes('Conversational'), JSON.stringify(m));
  assert.ok(m.matchedKeywords.includes('Ledger'), JSON.stringify(m));
});
