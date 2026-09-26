// R4-LO-11: the ATS score's weak-phrase check used lower.includes(), so "Networked with" counted as
// "worked with" and "unhandled" as "handled": strong bullets were flagged as passive language. A weak
// phrase now counts only as whole words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

const resume = (bullets) => ({
  id: 'lo11', template: 'classic', settings: {}, personal: { name: 'Kim Park', hiddenFields: [] },
  sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
    { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true,
      description: `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` },
  ] }],
});
const weak = (bullets) => analyzeAtsScore(resume(bullets)).categories.experience.items.find((i) => i.id === 'weak_phrases');

test('a word that only contains a weak phrase is not one', () => {
  assert.equal(weak([
    'Networked with 40 hiring managers across 6 regions',
    'Fixed 120 unhandled exceptions in the billing API',
    'Reworked onboarding for 3 products',
  ]), undefined);
});

test('a weak phrase written as words still counts, at any position and case', () => {
  assert.match(weak([
    'Worked with 40 hiring managers across 6 regions',
    'Fixed bugs and handled 120 support tickets',
    'Built CI for 3 products',
  ]).text, /2 instances/);
});
