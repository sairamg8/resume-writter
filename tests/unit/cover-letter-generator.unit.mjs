import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVER_LETTER_ARCHETYPES, extractResumeHighlights, generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';
import { richTextToPlain, sanitizeRichText } from '../../src/utils/richText.js';

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

// HTML injection: every résumé field and typed value is text, never markup. The body a crafted
// import produced used to carry live <img onerror> / <script> tags into the modal's innerHTML.
const HOSTILE = {
  name: 'Ada <img src=x onerror=alert(1)> Lovelace',
  title: 'Engineer <script>alert(2)</script>',
  role: '<svg onload=alert(3)>Lead',
  company: 'R&D <b>Labs</b>',
  skill: '<iframe src=javascript:alert(4)>',
};
const hostileLetter = (archetype) => generateCoverLetter({
  resume: {
    personal: { name: HOSTILE.name, title: HOSTILE.title },
    sections: [
      { type: 'experience', items: [{ role: HOSTILE.role, company: HOSTILE.company }] },
      { type: 'skills', items: [{ skills: `${HOSTILE.skill}, SQL` }] },
    ],
  },
  archetype,
  company: 'Acme"><img src=y onerror=alert(5)>',
  role: '<a href="javascript:alert(6)">Staff</a>',
  recipientName: '<style>*{display:none}</style>Jo',
});

for (const archetype of ['impact', 'leadership', 'growth']) {
  test(`generateCoverLetter (${archetype}): the body's only tags are its own <p>s — every value is escaped text`, () => {
    const { body } = hostileLetter(archetype);
    const tags = [...new Set((body.match(/<[^>]*>/g) || []).map((t) => t.toLowerCase()))].sort();
    assert.deepEqual(tags, ['</p>', '<p>'], body);
    const plain = richTextToPlain(body);
    for (const s of ['<style>*{display:none}</style>Jo', 'Acme"><img src=y onerror=alert(5)>', '<a href="javascript:alert(6)">Staff</a>']) {
      assert.ok(plain.includes(s), `"${s}" survives as text in: ${plain}`);
    }
    for (const s of [HOSTILE.title, HOSTILE.company, HOSTILE.skill]) {
      assert.ok(plain.includes(s), `"${s}" survives as text in: ${plain}`);
    }
    assert.equal(sanitizeRichText(body), body, 'already canonical: the sanitiser changes nothing');
  });
}

test('generateCoverLetter: an ampersand is escaped exactly once and reads back as typed', () => {
  const { body } = hostileLetter('impact');
  assert.ok(body.includes('R&amp;D &lt;b&gt;Labs&lt;/b&gt;'), body);
  assert.ok(!body.includes('&amp;amp;'), body);
  assert.ok(richTextToPlain(body).includes('R&D <b>Labs</b>'));
  assert.ok(richTextToPlain(body).includes(HOSTILE.skill));
});

test('generateCoverLetter: a line break inside a field reads as a space, not a hard break (as before escaping)', () => {
  const { body } = generateCoverLetter({
    resume: { personal: { title: 'Staff\r\nEngineer' }, sections: [{ type: 'experience', items: [{ role: 'Lead\nDev', company: 'Acme\n  Inc' }] }] },
    company: 'Globex\nCorp',
  });
  assert.ok(!body.includes('<br>'), body);
  const plain = richTextToPlain(body);
  for (const s of ['Staff Engineer', 'Lead Dev', 'Acme Inc', 'Globex Corp']) assert.ok(plain.includes(s), `"${s}" in: ${plain}`);
});
