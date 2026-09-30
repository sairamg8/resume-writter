// R5-HUNT10-PRESENT-TENSE-VERBS-NOT-ACTION-VERBS: the verb list holds past tense only, so a current job
// written in present tense — "Manage a team of 8", "Develop REST APIs", "Lead quarterly planning" — read
// "Verb Missing" in the optimizer, scored "Limited Action Verbs (0% of bullets)" in ATS Check, and a
// power-verb chip went in front of the verb: "Spearheaded Manage a team of 8…". The academic starter's
// own current role ("Lead the lab's…", "Mentor two doctoral students…") did the same. A present form of
// a listed verb now counts, and a chip replaces it; a word that opens a noun or a title does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, analyzeBullet, leadsWithActionVerb } from '../../src/utils/bulletOptimizer.js';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';
import { STARTER_TEMPLATES } from '../../src/utils/starterTemplates.js';

const PRESENT = [
  'Manage a team of 8 engineers across 3 time zones',
  'Develop REST APIs serving 2M users',
  'Lead quarterly planning for 5 squads',
];

function atsVerbs(bullets) {
  const resume = {
    id: 'r', template: 'classic', settings: {}, personal: { name: 'Kim Park', hiddenFields: [] },
    sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets },
    ] }],
  };
  return analyzeAtsScore(resume).categories.experience.items.find((i) => i.id === 'action_verbs');
}

test('ATS Check counts present-tense bullets as opening with an action verb', () => {
  const item = atsVerbs(PRESENT);
  assert.equal(item.status, 'pass', JSON.stringify(item));
});

test('the optimizer badge reads a verb, and a chip replaces it', () => {
  for (const t of [...PRESENT, 'Build dashboards for 12 teams', 'Mentor two doctoral students']) {
    assert.equal(analyzeBullet(t).hasActionVerb, true, t);
  }
  assert.equal(insertActionVerb('Manage a team of 8 engineers', 'Spearheaded'), 'Spearheaded a team of 8 engineers');
  assert.equal(insertActionVerb('- Develop REST APIs serving 2M users', 'Architected'), '- Architected REST APIs serving 2M users');
  assert.equal(insertActionVerb('Lead quarterly planning for 5 squads', 'Orchestrated'), 'Orchestrated quarterly planning for 5 squads');
  assert.equal(insertActionVerb('Build out the data platform', 'Spearheaded'), 'Spearheaded the data platform');
  assert.equal(insertActionVerb('Take part in the hackathon', 'Spearheaded'), 'Spearheaded the hackathon');
});

test('every starter bullet, present tense too, opens with a verb the optimizer knows', () => {
  for (const starter of STARTER_TEMPLATES) {
    for (const m of JSON.stringify(starter).matchAll(/<li>(?:<p>)?([^<]+)/g)) {
      assert.ok(leadsWithActionVerb(m[1]), `${starter.id}: ${m[1]}`);
    }
  }
});

test('a present form that opens a noun or a title is not a verb, and keeps its word under a chip', () => {
  for (const t of ['Lead engineer for the payments team', 'Mentor to 5 interns', 'Design system for 40 teams',
    'Test automation framework', 'Double major in CS and Math', 'Chair, ACM student chapter', 'Take part in the hackathon']) {
    assert.equal(leadsWithActionVerb(t), false, t);
  }
  assert.equal(insertActionVerb('Lead engineer for the payments team', 'Spearheaded'), 'Spearheaded Lead engineer for the payments team');
  assert.equal(insertActionVerb('Design system for 40 teams', 'Spearheaded'), 'Spearheaded Design system for 40 teams');
  // Weak verbs stay weak in any tense.
  for (const t of ['Handle 40 tickets a day', 'Ensure uptime']) assert.equal(analyzeBullet(t).hasActionVerb, false, t);
});
