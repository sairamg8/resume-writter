// The ATS score read what the résumé stores, not what it prints (R2-020). R2-033 made it skip the
// fields hidden with an eye; three reads were left:
//   1. Section Options → Show dates off prints no dates on any template, in the PDF or Word — yet
//      Experience still scored "All roles have clear employment dates" and Education "Graduation date
//      listed", full points.
//   2. The summary's words were counted in its raw HTML: a cleared editor ('<p><br></p>', which
//      prints nothing) scored "Brief summary" +1.5, and a summary written as a list counted its tags
//      as words ("b</li><li>c" is one word), so 26 printed words read as 14.
//   3. A skill group was read as `item.skills.split(…)`: skills stored as a list (imported data)
//      threw, and the ATS Check tab went down with it. Every export reads a group through
//      skillGroup() (src/utils/skills.js); the score now does too.
//
// Run on GitHub, never locally (the owner's rule): wip/ciprobe.sh <name> 'node --test tests/unit/ats-printed-score.unit.mjs'
// Written fail-first by LANE-2 for R2-020 and committed with the failing cases marked todo (2026-09-24);
// the fix removes each `todo`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';
import { TEMPLATE_IDS } from '../../src/constants/templates.js';

const SUMMARY = 'Results-driven platform engineer with over eight years of experience designing, building and '
  + 'operating distributed systems on Kubernetes for payments, search and analytics products at scale.';

const sample = ({ template = 'classic', summary = SUMMARY, exp = {}, edu = {}, skills = 'Go, Python' } = {}) => ({
  id: 'ats_printed', name: 'Sample', template, settings: {},
  personal: {
    name: 'Sarah Connor', title: 'Senior Engineer', email: 'sarah@example.com', phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA', linkedin: 'linkedin.com/in/sarahconnor', summary, photo: null, hiddenFields: [],
  },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: exp, items: [
      { id: 'e1', company: 'Acme Cloud', role: 'Staff Engineer', startDate: '2021-01', current: true,
        bullets: ['Built a billing service in Go handling 10k requests per second.'] },
      { id: 'e2', company: 'Initech', role: 'Engineer', startDate: '2017-06', endDate: '2020-12',
        bullets: ['Cut deploy time by 45% with a new CI pipeline.'] },
    ] },
    { id: 'edu', type: 'education', title: 'Education', visible: true, settings: edu, items: [
      { id: 'd1', institution: 'MIT', degree: 'BS', fieldOfStudy: 'Computer Science', startDate: '2013', endDate: '2017' },
    ] },
    { id: 'sk', type: 'skills', title: 'Skills', visible: true, items: [{ id: 's1', category: 'Languages', skills }] },
  ],
});

const item = (r, cat, id) => analyzeAtsScore(r).categories[cat].items.find((i) => i.id === id);

// ── 1. Section Options → Show dates ──────────────────────────────────────────────────────────

test('Show dates on: every role and degree has its dates (the guard)', () => {
  assert.equal(item(sample(), 'experience', 'exp_dates').status, 'pass');
  assert.equal(item(sample(), 'education', 'edu_dates').status, 'pass');
});

test('Experience with Show dates off prints no dates, so its roles score as undated — and the item says why', { todo: 'R2-020 is open — these fail until the ATS score reads what the PDF prints (CI run 35970356735: 5 fail, 2 pass)' }, () => {
  for (const template of TEMPLATE_IDS) {
    const r = sample({ template, exp: { showDates: false } });
    const got = item(r, 'experience', 'exp_dates');
    assert.equal(got.status, 'warn', `${template}: ${got.text}`);
    assert.match(`${got.text} ${got.detail}`, /Show dates/, `${template}: names the control that hides them — ${got.text} / ${got.detail}`);
    assert.equal(analyzeAtsScore(r).categories.experience.score, analyzeAtsScore(sample({ template })).categories.experience.score - 2,
      `${template}: the dates' points go`);
  }
});

test('Education with Show dates off prints no graduation year, so it scores as missing', { todo: 'R2-020 is open — these fail until the ATS score reads what the PDF prints (CI run 35970356735: 5 fail, 2 pass)' }, () => {
  for (const template of TEMPLATE_IDS) {
    const got = item(sample({ template, edu: { showDates: false } }), 'education', 'edu_dates');
    assert.equal(got.status, 'warn', `${template}: ${got.text}`);
    assert.match(`${got.text} ${got.detail}`, /Show dates/, template);
  }
});

test('Show dates off on Education leaves Experience\'s dates alone, and the reverse', () => {
  assert.equal(item(sample({ edu: { showDates: false } }), 'experience', 'exp_dates').status, 'pass');
  assert.equal(item(sample({ exp: { showDates: false } }), 'education', 'edu_dates').status, 'pass');
});

// ── 2. The summary as it prints ──────────────────────────────────────────────────────────────

test('a cleared summary editor prints nothing and scores as no summary', { todo: 'R2-020 is open — these fail until the ATS score reads what the PDF prints (CI run 35970356735: 5 fail, 2 pass)' }, () => {
  for (const summary of ['<p><br></p>', '<p>&nbsp;</p>', '<p> </p><p><br></p>']) {
    const got = item(sample({ summary }), 'contact', 'summary');
    assert.equal(got.text, 'No Professional Summary', `${JSON.stringify(summary)}: ${got.text}`);
  }
  const full = analyzeAtsScore(sample()).categories.contact.score;
  assert.equal(analyzeAtsScore(sample({ summary: '<p><br></p>' })).categories.contact.score, full - 3, 'no points for it');
});

test('a summary\'s words are counted as they print, not with its markup', { todo: 'R2-020 is open — these fail until the ATS score reads what the PDF prints (CI run 35970356735: 5 fail, 2 pass)' }, () => {
  // 26 words as 13 two-word list items: the raw HTML splits into 14 whitespace tokens.
  const words = `${SUMMARY} daily`.replace(/[.,]/g, '').split(/\s+/);
  assert.equal(words.length, 26);
  const pairs = [];
  for (let i = 0; i < words.length; i += 2) pairs.push(`<li>${words[i]} ${words[i + 1]}</li>`);
  const got = item(sample({ summary: `<ul>${pairs.join('')}</ul>` }), 'contact', 'summary');
  assert.equal(got.status, 'pass', `${got.text}: ${got.detail}`);
  assert.match(got.detail, /\b26 words\b/, got.detail);
  // Entities are text: "&amp;" is one character, not a word, and "&nbsp;" is a space.
  const plain = item(sample(), 'contact', 'summary').detail;
  const html = item(sample({ summary: `<p>${SUMMARY.replace(/ /g, '&nbsp;')}</p>` }), 'contact', 'summary').detail;
  assert.equal(html, plain);
});

// ── 3. Skill groups read as every export reads them ──────────────────────────────────────────

test('skills stored as a list are counted, and the report does not throw', { todo: 'R2-020 is open — these fail until the ATS score reads what the PDF prints (CI run 35970356735: 5 fail, 2 pass)' }, () => {
  const list = ['Go', 'Python', 'Rust', 'Java', 'SQL', 'Docker', 'Kafka', 'Redis'];
  let report;
  assert.doesNotThrow(() => { report = analyzeAtsScore(sample({ skills: list })); });
  const got = report.categories.skills.items.find((i) => i.id === 'skills_count');
  assert.equal(got.status, 'pass', got.text);
  assert.match(got.text, /\b8 skills\b/, got.text);
  assert.equal(report.categories.skills.score, analyzeAtsScore(sample({ skills: list.join(', ') })).categories.skills.score);
});
