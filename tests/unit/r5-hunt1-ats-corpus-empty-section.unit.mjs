// The job scanner's corpus took the title of every shown section, before it looked at the section's
// entries (R5-HUNT1-ats-corpus-empty-section-title). A section whose entries are all hidden, or that
// has none, prints no heading in any export (sectionPrints, R2-057), yet a posting asking for
// "Kubernetes" listed it as matched on a résumé whose only "Kubernetes" was such a section's title.
// The corpus now takes a section's title only when the section prints.
//
// Run: node --test tests/unit/r5-hunt1-ats-corpus-empty-section.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';

const resumeWith = (custom) => ({
  id: 'r5h1', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Platform Engineer', email: 'maria@example.com', summary: '', hiddenFields: [] },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, description: '<p>Built the ledger service.</p>' },
    ] },
    { id: 'cu', type: 'custom', title: 'Kubernetes Projects', visible: true, settings: {}, ...custom },
  ],
});

const JD = 'Kubernetes Kubernetes Kubernetes. Ledger.';

test('a section whose only entry is hidden adds no title to the job match', () => {
  const r = resumeWith({ items: [{ id: 'c1', title: 'Cluster tooling', visible: false }] });
  assert.ok(!/kubernetes/i.test(extractResumeCorpus(r)), extractResumeCorpus(r));
  const m = matchResumeWithJob(r, JD);
  assert.ok(m.missingKeywords.includes('Kubernetes'), JSON.stringify(m));
  assert.ok(!m.matchedKeywords.includes('Kubernetes'), JSON.stringify(m));
});

test('a section with no entries adds no title to the job match', () => {
  const m = matchResumeWithJob(resumeWith({ items: [] }), JD);
  assert.ok(m.missingKeywords.includes('Kubernetes'), JSON.stringify(m));
});

test('a section that prints an entry still counts its title (the guard)', () => {
  const m = matchResumeWithJob(resumeWith({ items: [{ id: 'c1', title: 'Cluster tooling' }] }), JD);
  assert.ok(m.matchedKeywords.includes('Kubernetes'), JSON.stringify(m));
  assert.ok(m.matchedKeywords.includes('Ledger'), JSON.stringify(m));
});
