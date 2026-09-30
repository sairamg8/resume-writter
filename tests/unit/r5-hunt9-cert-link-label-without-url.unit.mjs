// R5-HUNT9-CERT-LINK-LABEL-WITHOUT-URL-COUNTED: a certificate's Link label stays stored after its Link
// URL is cleared, the editor hides the label's box, and no export prints it (every renderer prints the
// label only as the text of a URL). The job match and the ATS keyword check still counted it, so a
// posting asking for "Kubernetes" matched a résumé whose only "Kubernetes" was that hidden label.
// The corpus now takes a certificate's label only when its URL is set.
//
// Run: node --test tests/unit/r5-hunt9-cert-link-label-without-url.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';

const resumeWith = (cert) => ({
  id: 'r5h9', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Platform Engineer', email: 'maria@example.com', summary: '', hiddenFields: [] },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, description: '<p>Built the ledger service.</p>' },
    ] },
    { id: 'ce', type: 'certifications', title: 'Certifications', visible: true, settings: {}, items: [
      { id: 'c1', name: 'AWS Developer', issuer: 'Amazon', ...cert },
    ] },
  ],
});

const JD = 'Kubernetes Kubernetes Kubernetes. Ledger.';

test('a Link label whose URL was cleared is not in the corpus or the job match', () => {
  // A URL of only spaces is not here: the editor still shows the label's box and the PDF and Word still
  // print the label for it (`item.url &&`), so it counts (r5-hunt9-review-cert-blank-url-label).
  for (const url of ['', undefined]) {
    const r = resumeWith({ url, urlLabel: 'Kubernetes Administrator' });
    assert.ok(!/kubernetes/i.test(extractResumeCorpus(r)), extractResumeCorpus(r));
    const m = matchResumeWithJob(r, JD);
    assert.ok(m.missingKeywords.includes('Kubernetes'), JSON.stringify(m));
    assert.ok(!m.matchedKeywords.includes('Kubernetes'), JSON.stringify(m));
  }
});

test('a Link label with its URL set still counts (the guard)', () => {
  const r = resumeWith({ url: 'https://verify.example.com/123', urlLabel: 'Kubernetes Administrator' });
  assert.ok(/Kubernetes Administrator/.test(extractResumeCorpus(r)));
  assert.ok(matchResumeWithJob(r, JD).matchedKeywords.includes('Kubernetes'));
});
