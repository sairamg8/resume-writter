// R5-HUNT9-REVIEW-CERT-BLANK-URL-LABEL: the fix for R5-HUNT9-CERT-LINK-LABEL-WITHOUT-URL-COUNTED left a
// certificate's Link label out of the job match whenever its Link URL was blank after trimming. But
// the editor shows the label's box, and the PDF (PdfSectionsTwo, PdfSidebarColumn) and Word
// (wordExportBuilders) print the label, whenever the URL is any non-empty text (`item.url && …`): a
// URL of a stray space still prints "Kubernetes Administrator" on the page, and the job match called
// Kubernetes missing. The corpus now tests the URL as the renderers do.
//
// Run: node --test tests/unit/r5-hunt9-review-cert-blank-url-label.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';

const resumeWith = (cert) => ({
  id: 'r5h9r', name: 'Sample', template: 'classic', settings: {},
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

test('the renderers print a certificate label whenever its URL is non-empty text (the premise)', () => {
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(src('src/templates/pdf/shared/PdfSectionsTwo.jsx'), /item\.url \? <Text[^\n]*item\.urlLabel \|\| item\.url/);
  assert.match(src('src/templates/pdf/shared/PdfSidebarColumn.jsx'), /\{item\.url && <EntryLink url=\{item\.url\} label=\{item\.urlLabel\}/);
  assert.match(src('src/utils/wordExportBuilders.js'), /\.\.\.\(item\.url \? \[[\s\S]{0,200}linked\(item\.urlLabel \|\| item\.url/);
  assert.match(src('src/components/SectionEditorLeafItems.jsx'), /\{item\.url && \(\s*<InputField label="Link label/);
});

test('a label whose URL is only spaces is printed, so it counts in the corpus and the job match', () => {
  for (const url of [' ', '   ', '\t']) {
    const r = resumeWith({ url, urlLabel: 'Kubernetes Administrator' });
    assert.match(extractResumeCorpus(r), /Kubernetes Administrator/, JSON.stringify(url));
    const m = matchResumeWithJob(r, JD);
    assert.ok(m.matchedKeywords.includes('Kubernetes'), JSON.stringify(m));
    assert.ok(!m.missingKeywords.includes('Kubernetes'), JSON.stringify(m));
  }
});

test('an empty URL still leaves the label out (R5-HUNT9-CERT-LINK-LABEL-WITHOUT-URL-COUNTED)', () => {
  const r = resumeWith({ url: '', urlLabel: 'Kubernetes Administrator' });
  assert.ok(!/kubernetes/i.test(extractResumeCorpus(r)));
});
