// The Target Job Description Scanner matched the job's keywords against a corpus that was not the
// printed résumé (R2-022). It left out fields every export prints — a language and its proficiency,
// the header's contacts, a reference's job title and relationship, a custom entry's subtitle, a
// certificate's ID, a project's link — so a posting asking for Spanish listed Spanish as missing on
// a résumé whose Languages section prints it. And it read the summary and descriptions as raw HTML,
// so the markup's own words matched: a summary saying "R&amp;D" matched "AMP", a bulleted
// description matched "UL". A location Section Options → Show location keeps off the page matched too.
// The corpus now reads what the PDF prints: every printed field, rich text through the parse the PDF
// prints from, contacts as the header prints them.
//
// Run: node --test tests/unit/ats-job-match-printed.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';

const sample = ({ personal = {}, sections = [] } = {}) => ({
  id: 'ats_match', name: 'Sample', template: 'classic', settings: {},
  personal: {
    name: 'Maria Lopez', title: 'Platform Engineer', email: 'maria@example.com', phone: '+1 (555) 010-2030',
    location: 'Austin, TX', summary: 'Platform engineer building payment systems.', hiddenFields: [], ...personal,
  },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', location: 'Munich', startDate: '2020-01', current: true,
        description: '<p>Built the ledger service.</p>' },
    ] },
    ...sections,
  ],
});

/** Whether `keyword` (a job-description word, repeated so it ranks) is matched on `r`. */
function matched(r, keyword) {
  const m = matchResumeWithJob(r, `${keyword} ${keyword} ${keyword}`);
  assert.ok(m, `no keywords read from "${keyword}"`);
  const hit = m.matchedKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase());
  const miss = m.missingKeywords.some((k) => k.toLowerCase() === keyword.toLowerCase());
  assert.ok(hit !== miss, `${keyword}: in neither list — ${JSON.stringify(m)}`);
  return hit;
}

test('a language and its proficiency are printed, so a posting asking for them finds them', () => {
  const r = sample({ sections: [
    { id: 'lang', type: 'languages', title: 'Languages', visible: true, items: [{ id: 'l1', language: 'Spanish', proficiency: 'Bilingual' }] },
  ] });
  assert.equal(matched(r, 'Spanish'), true);
  assert.equal(matched(r, 'Bilingual'), true);
});

test('the header\'s contacts are printed — as the header prints them, and not when hidden', () => {
  const r = sample({ personal: { github: 'https://github.com/mlopez', location: 'Berlin, Germany' } });
  assert.equal(matched(r, 'GitHub'), true, 'the GitHub line prints github.com/mlopez');
  assert.equal(matched(r, 'Berlin'), true);
  const hidden = sample({ personal: { github: 'https://github.com/mlopez', location: 'Berlin, Germany', hiddenFields: ['github', 'location'] } });
  assert.equal(matched(hidden, 'GitHub'), false);
  assert.equal(matched(hidden, 'Berlin'), false);
});

test('a reference\'s job title and relationship, a custom subtitle, a certificate ID and a project link are printed', () => {
  const r = sample({ sections: [
    { id: 'ref', type: 'references', title: 'References', visible: true, items: [
      { id: 'r1', name: 'Tom Reyes', jobTitle: 'Controller', company: 'Globex', relationship: 'Mentor' },
    ] },
    { id: 'cus', type: 'custom', title: 'Open Source', visible: true, items: [
      { id: 'c1', title: 'Contributor', subtitle: 'Apache Flink' },
    ] },
    { id: 'cert', type: 'certifications', title: 'Certifications', visible: true, items: [
      { id: 'k1', name: 'Cloud Practitioner', issuer: 'Amazon', credentialId: 'CLF-C02' },
    ] },
    { id: 'proj', type: 'projects', title: 'Projects', visible: true, items: [
      { id: 'p1', name: 'Ledger', url: 'github.com/mlopez/terraform-modules' },
    ] },
  ] });
  for (const word of ['Controller', 'Mentor', 'Flink', 'CLF-C02', 'Terraform']) assert.equal(matched(r, word), true, word);
});

test('the markup of the summary and a description is not text: its tags and entities match nothing', () => {
  const r = sample({ personal: { summary: '<p>Led R&amp;D for <strong>payments</strong>.</p>' } });
  r.sections[0].items[0].description = '<ul><li>Built the ledger service.</li></ul>';
  assert.equal(matched(r, 'AMP'), false, '"&amp;" prints "&"');
  assert.equal(matched(r, 'UL'), false, 'a list prints no "ul"');
  assert.equal(matched(r, 'payments'), true, 'the guard: the words themselves match');
  assert.equal(matched(r, 'ledger'), true);
  assert.doesNotMatch(extractResumeCorpus(r), /<|&amp;/);
});

test('an entry location Show location keeps off the page matches nothing', () => {
  const r = sample();
  assert.equal(matched(r, 'Munich'), true, 'the guard: printed, it matches');
  r.sections[0].settings = { showLocation: false };
  assert.equal(matched(r, 'Munich'), false);
});

test('skill groups are read as they print: a list of skills matches, a hidden category does not', () => {
  const r = sample({ sections: [
    { id: 'sk', type: 'skills', title: 'Skills', visible: true, items: [
      { id: 's1', category: 'Observability', skills: ['Grafana', 'Prometheus'], hiddenFields: ['category'] },
    ] },
  ] });
  assert.equal(matched(r, 'Prometheus'), true);
  assert.equal(matched(r, 'Observability'), false);
});
