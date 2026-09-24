// The STAR Optimizer and the ATS score judged the same statement by different rules (R2-025). The
// optimizer's verb check knew only the 60 verbs its chips offer; the score knew 150 others and not all
// of those 60. Auto-Fix replaced "Responsible for" with "Led" — a verb the score counts and the
// optimizer did not — so the badge still said "Verb Missing" on the text Auto-Fix had just written.
// Their metric rules differed too: "10k" was a metric to the score and not to the optimizer, "S3" the
// reverse of what either should say. Both now read one verb list and one metric rule
// (src/utils/bulletOptimizer.js), and every verb the optimizer offers or writes counts.
//
// Run: node --test tests/unit/bullet-optimizer-ats-agree.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBullet, autoFixWeakPhrases, ACTION_VERBS_BY_CATEGORY } from '../../src/utils/bulletOptimizer.js';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

/** What the ATS score makes of `bullet` as a résumé's only statement: does it lead with a verb, does it quantify. */
function atsVerdict(bullet) {
  const r = {
    id: 'agree', template: 'classic', settings: {}, personal: { name: 'Kim Park', hiddenFields: [] },
    sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets: [bullet] },
    ] }],
  };
  const items = analyzeAtsScore(r).categories.experience.items;
  return {
    verb: items.find((i) => i.id === 'action_verbs').status === 'pass',
    metric: items.find((i) => i.id === 'metrics').status === 'pass',
  };
}

test('the repro: Auto-Fix\'s "Led" is a strong verb to the optimizer that wrote it', () => {
  const fixed = autoFixWeakPhrases('Responsible for migrating 12 services to AWS');
  assert.match(fixed, /^Led /);
  assert.equal(analyzeBullet(fixed).hasActionVerb, true, `"${fixed}" still reads Verb Missing`);
  assert.equal(atsVerdict(fixed).verb, true, 'and the ATS score agrees');
});

test('whatever weak opener Auto-Fix replaces, what it writes passes both verb checks', () => {
  for (const opener of ['Responsible for', 'Was responsible for', 'Worked on', 'Helped with', 'Assisted in', 'Handled',
    'Did', 'Made sure', 'Changed', 'Participated in', 'In charge of']) {
    const fixed = autoFixWeakPhrases(`${opener} the billing service for 3 teams`);
    assert.equal(analyzeBullet(fixed).hasActionVerb, true, `optimizer: "${fixed}"`);
    assert.equal(atsVerdict(fixed).verb, true, `ATS score: "${fixed}"`);
  }
});

test('every verb the optimizer offers counts in the ATS score', () => {
  const rejected = Object.values(ACTION_VERBS_BY_CATEGORY).flat()
    .filter((verb) => !atsVerdict(`${verb} the quarterly roadmap for 5 teams`).verb);
  assert.deepEqual(rejected, []);
});

test('the optimizer and the ATS score give one verdict on a statement\'s verb and its metric', () => {
  for (const bullet of [
    'Led the migration of 12 services to AWS',
    'Supervised 4 interns through their first release',
    'Galvanized a support team around one queue',
    'Ensured uptime of the payments API',
    'Handled 10k tickets per day',
    'Migrated object storage to S3 and EC2',
    'Cut deploy time by 45%',
    'Saved $1.2M in annual cloud spend',
    'Shipped the search rewrite in 2021',
    'Responsible for the billing service',
    '"Co-authored," the API design spec',
    '2019',
  ]) {
    const optimizer = analyzeBullet(bullet);
    assert.deepEqual({ verb: optimizer.hasActionVerb, metric: optimizer.hasMetric }, atsVerdict(bullet), bullet);
  }
});

test('a number is a metric where it stands as one — not the digit in a name, not a bare year', () => {
  const metric = (t) => analyzeBullet(t).hasMetric;
  for (const t of ['Cut deploy time by 45%', 'Handled 10k tickets', 'Grew revenue 3x', 'Served 2M users', 'Saved $40K', 'Reduced p95 to 200ms']) {
    assert.equal(metric(t), true, t);
  }
  for (const t of ['Migrated storage to S3', 'Moved services to EC2', 'Built a Web3 wallet', 'Responsible for the billing service']) {
    assert.equal(metric(t), false, t);
  }
  assert.equal(atsVerdict('2019').metric, false, 'a statement that is only a year is no metric');
});

test('a verb the optimizer calls weak is not a strong verb: "Ensured" is replaced by Auto-Fix', () => {
  const a = analyzeBullet('Ensured uptime of the payments API for 5 regions');
  assert.equal(a.weakPhrases.length, 1);
  assert.equal(a.hasActionVerb, false, 'not both a weak phrase and a strong verb');
});
