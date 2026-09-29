// R5-HUNT2-GENERATOR-CITES-HIDDEN-FIELDS: the Cover Letter generator skipped hidden sections and
// entries but read an entry's Job Title, Company and a skill group's skills even when the user hid
// them with the field's eye, so the letter named a confidential employer and skills the résumé (PDF,
// Word, Markdown) does not print. Now a hidden field counts as empty to the generator too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractResumeHighlights, generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';
import { richTextToPlain } from '../../src/utils/richText.js';

const resume = {
  personal: { name: 'Ada Park', title: 'Platform Engineer' },
  sections: [
    { type: 'experience', items: [{ role: 'Staff Engineer', company: 'Stealthco', hiddenFields: ['company'] }] },
    {
      type: 'skills',
      items: [
        { category: 'Secret', skills: 'Kdb, Q-lang', hiddenFields: ['skills'] },
        { category: 'Core', skills: 'Go, Kubernetes' },
      ],
    },
  ],
};

test('a hidden Company or skills are not among the highlights', () => {
  const h = extractResumeHighlights(resume);
  assert.deepEqual(h.topExperiences.map(e => [e.role, e.company]), [['Staff Engineer', '']]);
  assert.deepEqual(h.topSkills, ['Go', 'Kubernetes']);
});

test('the letter cites the role without the hidden company, and no hidden skills', () => {
  for (const archetype of ['impact', 'leadership', 'growth']) {
    const text = richTextToPlain(generateCoverLetter({ resume, archetype, company: 'Acme' }).body);
    assert.ok(!text.includes('Stealthco'), `${archetype}: ${text}`);
    assert.ok(!/Kdb|Q-lang/.test(text), `${archetype}: ${text}`);
    assert.ok(text.includes('as Staff Engineer'), `${archetype}: ${text}`);
  }
});

test('an entry whose role and company are both hidden is skipped for the next one', () => {
  const r = { ...resume, sections: [{ type: 'experience', items: [
    { role: 'Agent', company: 'Agency', hiddenFields: ['role', 'company'] },
    { role: 'Analyst', company: 'Globex' },
  ] }] };
  assert.deepEqual(extractResumeHighlights(r).topExperiences.map(e => [e.role, e.company]), [['Analyst', 'Globex']]);
});
