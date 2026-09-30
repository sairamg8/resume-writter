// Review of R5-HUNT9-OPTIMIZER-VERB-CHIP-DOUBLES-UNLISTED-VERB. Listing "took", "rolled", "spun", "drove"
// and "set" as action verbs left three gaps:
// - "Took part in the 2023 hackathon" ("participated in") read as opening with a strong verb, in the badge
//   and the ATS score, and a chip gave "Spearheaded part in the 2023 hackathon";
// - "Took over 200 support calls a day" gave "Spearheaded 200 support calls a day": "over" there is
//   "more than", and dropping it made the claim smaller;
// - a verb's particle outside a short list stayed behind: "Spearheaded on the role of Scrum Master",
//   "Spearheaded back a bad release", "Spearheaded off a new team", "Spearheaded out to cut churn".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, analyzeBullet, leadsWithActionVerb } from '../../src/utils/bulletOptimizer.js';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

const chip = (t) => insertActionVerb(t, 'Spearheaded');

/** The ATS score's action-verb item for an Experience entry with these bullets. */
function atsVerbs(bullets) {
  const resume = {
    id: 'r', template: 'classic', settings: {}, personal: { name: 'Kim Park', hiddenFields: [] },
    sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets },
    ] }],
  };
  return analyzeAtsScore(resume).categories.experience.items.find((i) => i.id === 'action_verbs');
}

test('"Took part in" is no action verb, and a chip replaces the whole phrase', () => {
  assert.equal(leadsWithActionVerb('Took part in the 2023 hackathon'), false);
  assert.equal(analyzeBullet('Took part in the 2023 hackathon with a team of 4').hasActionVerb, false);
  assert.equal(chip('Took part in the 2023 hackathon'), 'Spearheaded the 2023 hackathon');
  assert.equal(chip('- Took part in the 2023 hackathon'), '- Spearheaded the 2023 hackathon');
  assert.match(atsVerbs(['Took part in the 2023 hackathon', 'Took part in 12 design reviews']).text, /\(0% of bullets\)/);
  // "Took" as a verb of its own still counts.
  assert.equal(leadsWithActionVerb('Took deploys from weekly trains to 300 a day'), true);
});

test('"over" before a number stays: it is "more than"', () => {
  assert.equal(chip('Took over 200 support calls a day'), 'Spearheaded over 200 support calls a day');
  assert.equal(chip('Took over $2M in accounts'), 'Spearheaded over $2M in accounts');
  assert.equal(chip('Took over the billing platform'), 'Spearheaded the billing platform');
});

test("a verb's particle goes with it", () => {
  const cases = [
    ['Took on the role of Scrum Master', 'Spearheaded the role of Scrum Master'],
    ['Rolled back a bad release in 4 minutes', 'Spearheaded a bad release in 4 minutes'],
    ['Spun off a new team', 'Spearheaded a new team'],
    ['Spun out the billing service', 'Spearheaded the billing service'],
    ['Drove down costs by 20%', 'Spearheaded costs by 20%'],
    ['Built up a team of 8', 'Spearheaded a team of 8'],
    ['Set out to cut churn by 10%', 'Spearheaded efforts to cut churn by 10%'],
    ['Set up the on-call practice', 'Spearheaded the on-call practice'],
    ['Rolled out SSO to 40 teams', 'Spearheaded SSO to 40 teams'],
  ];
  for (const [before, after] of cases) assert.equal(chip(before), after, before);
});

test('a preposition after the verb is not taken for its particle', () => {
  const kept = [
    ['Led up to 12 engineers', 'Spearheaded up to 12 engineers'],
    ['Led over 40 engineers', 'Spearheaded over 40 engineers'],
    ['Launched on time for 3 quarters', 'Spearheaded on time for 3 quarters'],
    ['Shipped off-the-shelf tools', 'Spearheaded off-the-shelf tools'],
    ['Led backend work', 'Spearheaded backend work'],
    ['Built out of spare parts', 'Spearheaded out of spare parts'],
  ];
  for (const [before, after] of kept) assert.equal(chip(before), after, before);
});
