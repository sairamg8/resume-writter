// The ATS Check scored contact fields and the summary the user had hidden (R2-033). Hide Email,
// Phone, LinkedIn and Summary on Personal Info (the eye beside each) and no export prints them —
// PDF, Word, Markdown, ATS text — yet the Contact category still read "Valid professional email
// address", 20 of 20, and a job-description keyword found only in the hidden summary was reported as
// matched. AUD-12 fixed hidden entries and the hidden photo; the contact fields and the summary kept
// reading p.email, p.phone, … directly. They now read the résumé as it prints: a hidden field counts
// as absent, and the item says it is hidden, so the user knows why.
//
// Run: node --test tests/unit/ats-hidden-fields.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore, matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const SUMMARY = 'Results-driven platform engineer with over eight years of experience designing, building and '
  + 'operating distributed systems on Kubernetes for payments, search and analytics products at scale.';

const sample = (hiddenFields = []) => ({
  id: 'ats_hidden', name: 'Sample', template: 'classic', settings: {},
  personal: {
    name: 'Sarah Connor', title: 'Senior Engineer', email: 'sarah@example.com', phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA', linkedin: 'linkedin.com/in/sarahconnor', github: 'github.com/sarahc',
    summary: SUMMARY, photo: null, hiddenFields,
  },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Acme Cloud', role: 'Staff Engineer', startDate: '2021-01', current: true,
        bullets: ['Built a billing service in Go handling 10k requests per second.'] },
    ] },
    { id: 'sk', type: 'skills', title: 'Skills', visible: true, items: [{ id: 's1', category: 'Languages', skills: 'Go, Python' }] },
  ],
});

const contact = (r) => Object.fromEntries(analyzeAtsScore(r).categories.contact.items.map((i) => [i.id, i]));

test('nothing hidden: every contact item passes, 20 of 20 (the guard)', () => {
  const r = sample();
  const items = contact(r);
  for (const id of ['name', 'email', 'phone', 'location', 'linkedin', 'summary']) assert.equal(items[id].status, 'pass', id);
  assert.equal(analyzeAtsScore(r).categories.contact.score, 20);
});

test('a hidden email, phone, location, LinkedIn and summary score as absent', () => {
  const r = sample(['email', 'phone', 'location', 'linkedin', 'summary', 'photo']);
  const items = contact(r);
  assert.equal(items.name.status, 'pass', 'the name cannot be hidden');
  assert.equal(items.email.status, 'fail');
  assert.equal(items.phone.status, 'fail');
  assert.equal(items.location.status, 'warn');
  assert.equal(items.linkedin.status, 'warn');
  assert.equal(items.summary.status, 'warn');
  assert.equal(analyzeAtsScore(r).categories.contact.score, 4, 'only the name scores');
});

test('each hidden field alone costs exactly its own points, and its item says it is hidden', () => {
  const full = analyzeAtsScore(sample()).categories.contact.score;
  const cost = { email: 4, phone: 4, location: 3, linkedin: 2, summary: 3 };
  for (const [key, pts] of Object.entries(cost)) {
    const r = sample([key]);
    assert.equal(analyzeAtsScore(r).categories.contact.score, full - pts, key);
    const item = contact(r)[key];
    assert.match(item.text, /hidden/i, `${key}: ${item.text}`);
    assert.doesNotMatch(`${item.text} ${item.detail}`, /sarah@example|555|San Francisco|linkedin\.com/i, `${key}: no hidden value quoted`);
  }
});

test('a hidden website or GitHub changes nothing the contact score reads', () => {
  assert.equal(analyzeAtsScore(sample(['website', 'github'])).categories.contact.score, 20);
});

test('job match: a keyword only in the hidden summary is missing, as in every export', () => {
  const jd = 'We need a platform engineer with Kubernetes experience. Kubernetes, Kubernetes. Go and Python.';
  const shown = matchResumeWithJob(sample(), jd);
  assert.ok(shown.matchedKeywords.includes('Kubernetes'), JSON.stringify(shown));
  const hidden = matchResumeWithJob(sample(['summary']), jd);
  assert.ok(hidden.missingKeywords.includes('Kubernetes'), JSON.stringify(hidden));
  assert.ok(!extractResumeCorpus(sample(['summary'])).includes('Kubernetes'));
  assert.ok(!generateAtsPlainText(sample(['summary'])).includes('Kubernetes'), 'the ATS text agrees');
  assert.equal(analyzeAtsScore(sample(['summary']), jd).jobMatch.matchedKeywords.includes('Kubernetes'), false);
});

// The same defect one level down: an entry's own eye (Company, Job Title, dates, Description, a skill
// group's skills) hides the field from every export, yet the corpus and the score still read it.
const withEntry = (patch, skillPatch = {}) => {
  const r = sample();
  r.sections[0].items[0] = { ...r.sections[0].items[0], ...patch };
  r.sections[1].items[0] = { ...r.sections[1].items[0], ...skillPatch };
  return r;
};
const expItem = (r, id) => analyzeAtsScore(r).categories.experience.items.find((i) => i.id === id);

test('an entry\'s hidden fields: the job match does not find them', () => {
  const jd = 'Terraform Terraform Terraform. Kafka Kafka Kafka. Rust Rust Rust.';
  const r = withEntry({ company: 'Terraform Inc', description: '<ul><li>Ran Kafka clusters.</li></ul>', hiddenFields: ['company', 'description'] },
    { skills: 'Rust, Go', hiddenFields: ['skills'] });
  const match = matchResumeWithJob(r, jd);
  assert.deepEqual(match.matchedKeywords, [], JSON.stringify(match));
  const shown = matchResumeWithJob(withEntry({ company: 'Terraform Inc', description: '<ul><li>Ran Kafka clusters.</li></ul>' }, { skills: 'Rust, Go' }), jd);
  assert.deepEqual(shown.matchedKeywords.toSorted(), ['Kafka', 'Rust', 'Terraform'], 'the guard: shown, they match');
});

test('an entry\'s hidden Job Title, dates or skills score as absent', () => {
  assert.equal(expItem(withEntry({}), 'role_company').status, 'pass', 'the guard');
  assert.equal(expItem(withEntry({ hiddenFields: ['role'] }), 'role_company').status, 'warn');
  assert.equal(expItem(withEntry({}), 'exp_dates').status, 'pass', 'the guard');
  assert.equal(expItem(withEntry({ hiddenFields: ['startDate'] }), 'exp_dates').status, 'warn');
  // A hidden End Date prints no end — not "Present" — so a current job has no end date either.
  assert.equal(expItem(withEntry({ hiddenFields: ['endDate'] }), 'exp_dates').status, 'warn');
  const count = (hiddenFields) => analyzeAtsScore(withEntry({}, { skills: 'Go, Python, Rust, Java, SQL, Docker, Kafka, Redis', hiddenFields }))
    .categories.skills.items.find((i) => i.id === 'skills_count');
  assert.equal(count([]).status, 'pass', 'the guard: eight skills');
  assert.equal(count(['skills']).status, 'fail', `hidden, they are not listed: ${count(['skills']).text}`);
});
