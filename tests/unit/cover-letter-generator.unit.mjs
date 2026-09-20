import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_LETTER_ARCHETYPES, extractResumeHighlights, generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';

test('COVER_LETTER_ARCHETYPES: contains archetypes for tech, leadership, and growth', () => {
  assert.ok(COVER_LETTER_ARCHETYPES.length >= 3);
  const ids = COVER_LETTER_ARCHETYPES.map(a => a.id);
  assert.ok(ids.includes('impact'));
  assert.ok(ids.includes('leadership'));
  assert.ok(ids.includes('growth'));
});

test('extractResumeHighlights: pulls name, title, experiences, and skills', () => {
  const resume = {
    personal: {
      name: 'Jessica Alba',
      title: 'Senior Product Manager',
      summary: 'Product leader focused on customer growth'
    },
    sections: [
      {
        type: 'experience',
        items: [
          { role: 'Lead PM', company: 'Stripe', description: 'Grew ARR by 30%' }
        ]
      },
      {
        type: 'skills',
        items: [
          { category: 'Product', skills: 'Roadmapping, A/B Testing, SQL' }
        ]
      }
    ]
  };

  const highlights = extractResumeHighlights(resume);
  assert.equal(highlights.candidateName, 'Jessica Alba');
  assert.equal(highlights.candidateTitle, 'Senior Product Manager');
  assert.equal(highlights.topExperiences.length, 1);
  assert.equal(highlights.topExperiences[0].role, 'Lead PM');
  assert.ok(highlights.topSkills.includes('Roadmapping'));
});

test('generateCoverLetter: creates tailored letter with recipient, subject, and body paragraphs', () => {
  const resume = {
    personal: {
      name: 'Michael Scott',
      title: 'Regional Manager'
    },
    sections: [
      {
        type: 'experience',
        items: [{ role: 'Branch Manager', company: 'Dunder Mifflin' }]
      },
      {
        type: 'skills',
        items: [{ category: 'Management', skills: 'Negotiation, Client Retention' }]
      }
    ]
  };

  const letter = generateCoverLetter({
    resume,
    archetype: 'leadership',
    company: 'Sabre Corp',
    role: 'VP of Distribution',
    recipientName: 'Jo Bennett'
  });

  assert.equal(letter.recipientName, 'Jo Bennett');
  assert.equal(letter.company, 'Sabre Corp');
  assert.ok(letter.subject.includes('VP of Distribution'));
  assert.ok(letter.body.includes('Dear Jo Bennett'));
  assert.ok(letter.body.includes('Sabre Corp'));
  assert.equal(letter.signatureName, 'Michael Scott');
  assert.equal(letter.signatureDesignation, 'Regional Manager');
});
