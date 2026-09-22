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

// Values that are not text. A skill group's skills can be stored as a list, a number or an object
// (a JSON Resume `keywords` that is not a list, a native .json, a résumé already saved that way);
// the generator split them as text and threw "….split is not a function". It runs as the Cover
// Letter tab renders, so the whole editor went blank. `{"toString":"x"}` is an object JSON.parse
// gives that cannot even be printed: a name like it threw "Cannot convert object to primitive value".
const SHADOW = JSON.parse('{"toString":"x"}');

/** A résumé whose one skill group stores `skills` (plus `extra`, e.g. the old `name` label). */
const withSkills = (skills, extra = {}) => ({
  personal: { name: 'Ada Lovelace', title: 'Engineer' },
  sections: [
    { type: 'experience', items: [{ role: 'Lead', company: 'Acme' }] },
    { type: 'skills', items: [{ category: 'Tools', skills, ...extra }] },
  ],
});

test('extractResumeHighlights: skills that are not text never throw — a list gives its text and numbers, a number its digits, anything else nothing', () => {
  const cases = [
    [['React', 'SQL'], ['React', 'SQL']],
    [[' React ', 7, { a: 1 }, null, true, SHADOW, 'SQL'], ['React', '7', 'SQL']],
    [12345, ['12345']],
    [[], []],
    [{ a: 1 }, []],
    [{}, []],
    [true, []],
    [SHADOW, []],
  ];
  for (const [skills, want] of cases) {
    assert.deepEqual(extractResumeHighlights(withSkills(skills)).topSkills, want, JSON.stringify(skills));
    // A group with no skills falls back to its `name`, read the same way.
    assert.deepEqual(extractResumeHighlights(withSkills('', { name: skills })).topSkills, want, `name: ${JSON.stringify(skills)}`);
  }
});

test('generateCoverLetter: a résumé whose skills are not text writes its letter in every archetype, never "[object Object]"', () => {
  for (const skills of [12345, ['React', 'SQL'], { a: 1 }, true, SHADOW]) {
    for (const archetype of ['impact', 'leadership', 'growth']) {
      const plain = richTextToPlain(generateCoverLetter({ resume: withSkills(skills), archetype, company: 'Globex' }).body);
      assert.ok(!/\[object Object\]|\btrue\b/.test(plain), `${JSON.stringify(skills)}, ${archetype}: ${plain}`);
    }
  }
  const skillsLine = (skills) => /utilizing ([^.]*)\./.exec(richTextToPlain(generateCoverLetter({ resume: withSkills(skills) }).body))?.[1];
  assert.equal(skillsLine(['React', 'SQL']), 'React, SQL');
  assert.equal(skillsLine(12345), '12345');
  assert.equal(skillsLine({ a: 1 }), 'modern best practices', 'no skills: the letter\'s own words');
});

test('generateCoverLetter: a name, title, role or company that is not text prints as text or not at all — no throw, no "[object Object]"', () => {
  const r = (personal, item) => ({ personal, sections: [{ type: 'experience', items: [item] }] });
  // A list reads as its entries, comma-separated; a number as its digits.
  let letter = generateCoverLetter({ resume: r({ name: ['Ada', 'Lovelace'], title: 7 }, { role: ['Lead', 'Dev'], company: 2024 }) });
  assert.equal(letter.subject, 'Application for 7 — Ada, Lovelace');
  assert.ok(richTextToPlain(letter.body).includes('During my tenure as Lead, Dev at 2024,'), letter.body);
  // The signature is text too: the panel's Apply saves it into the letter's own fields.
  assert.equal(letter.signatureName, 'Ada, Lovelace');
  assert.equal(letter.signatureDesignation, '7');
  // An object, true or a list with no text is no value: the letter an empty field gives.
  const blank = (archetype) => generateCoverLetter({ resume: r({ name: '', title: '' }, { role: '', company: '' }), archetype, company: 'Globex' });
  for (const v of [{ a: 1 }, {}, true, SHADOW, [SHADOW], [{ a: 1 }]]) {
    for (const archetype of ['impact', 'leadership', 'growth']) {
      letter = generateCoverLetter({ resume: r({ name: v, title: v }, { role: v, company: v }), archetype, company: 'Globex' });
      assert.deepEqual(letter, blank(archetype), `${JSON.stringify(v)}, ${archetype}`);
    }
  }
  assert.equal(blank('impact').signatureName, 'Candidate');
  assert.equal(blank('impact').signatureDesignation, 'Professional');
});

test('extractResumeHighlights: a section or an entry that is not an object (null in a native .json or stored data) is skipped', () => {
  const h = extractResumeHighlights({
    personal: { name: 'Ada' },
    sections: [
      null,
      { type: 'experience', items: [null, { role: 'Lead', company: 'Acme' }] },
      { type: 'skills', items: [null, 7, { skills: 'SQL' }] },
    ],
  });
  assert.deepEqual(h.topExperiences, [{ role: 'Lead', company: 'Acme', description: '' }]);
  assert.deepEqual(h.topSkills, ['SQL']);
  for (const sections of [[null], [{ type: 'experience', items: [null] }], [{ type: 'skills', items: [null] }]]) {
    assert.doesNotThrow(() => generateCoverLetter({ resume: { personal: { name: 'Ada' }, sections } }), JSON.stringify(sections));
  }
});

test('AUD-12: extractResumeHighlights ignores hidden entries (visible: false)', () => {
  const resume = {
    personal: { name: 'Ada', title: 'Senior Engineer' },
    sections: [
      {
        type: 'experience',
        items: [
          { role: 'Hidden Lead', company: 'Secret Co', visible: false },
          { role: 'Visible Staff', company: 'Visible Co', visible: true },
        ],
      },
      {
        type: 'skills',
        items: [
          { skills: 'SecretSkill', visible: false },
          { skills: 'React, Node.js', visible: true },
        ],
      },
    ],
  };
  const h = extractResumeHighlights(resume);
  assert.equal(h.topExperiences[0]?.role, 'Visible Staff');
  assert.equal(h.topExperiences[0]?.company, 'Visible Co');
  assert.ok(!h.topSkills.includes('SecretSkill'));
  assert.ok(h.topSkills.includes('React'));

  const letter = generateCoverLetter({ resume, company: 'TargetCo' });
  assert.ok(!letter.body.includes('Secret Co'));
  assert.ok(!letter.body.includes('Hidden Lead'));
  assert.ok(!letter.body.includes('SecretSkill'));
  assert.ok(letter.body.includes('Visible Co'));
});
