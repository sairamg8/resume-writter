import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isJsonResume, jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';

test('isJsonResume: detects jsonresume.org schema correctly', () => {
  assert.equal(isJsonResume(null), false);
  assert.equal(isJsonResume(''), false);
  assert.equal(isJsonResume([]), false);
  assert.equal(isJsonResume({ name: 'test' }), false);

  assert.equal(isJsonResume({
    basics: { name: 'John Doe', email: 'john@example.com' },
    work: []
  }), true);

  assert.equal(isJsonResume({
    work: [{ name: 'Tech Co' }],
    education: [{ institution: 'State U' }]
  }), true);
});

test('jsonResumeToCpwtResume: converts JSON Resume to CPWT resume structure', () => {
  const jsonResume = {
    basics: {
      name: 'Sarah Connor',
      label: 'Security Engineer',
      email: 'sarah@resistance.org',
      phone: '+1 555 0199',
      url: 'https://sarah.dev',
      summary: 'Experienced cybersecurity specialist.',
      location: { city: 'Los Angeles', region: 'CA' },
      profiles: [
        { network: 'LinkedIn', url: 'https://linkedin.com/in/sarahconnor' },
        { network: 'GitHub', url: 'https://github.com/sarahconnor' }
      ]
    },
    work: [
      {
        name: 'Cyberdyne Systems',
        position: 'Lead Analyst',
        startDate: '2021-03-01',
        endDate: '2024-01-01',
        summary: 'Protected critical infrastructure.',
        highlights: [
          'Hardened 100+ production servers',
          'Mitigated 15 critical zero-day vulnerabilities'
        ]
      }
    ],
    education: [
      {
        institution: 'MIT',
        area: 'Computer Systems',
        studyType: 'B.S.',
        startDate: '2016-09-01',
        endDate: '2020-05-01',
        score: '3.9'
      }
    ],
    skills: [
      {
        name: 'Security & Cloud',
        keywords: ['Penetration Testing', 'AWS IAM', 'Cryptography']
      }
    ]
  };

  const resume = jsonResumeToCpwtResume(jsonResume, 'res_test_1');
  assert.equal(resume.id, 'res_test_1');
  assert.equal(resume.personal.name, 'Sarah Connor');
  assert.equal(resume.personal.title, 'Security Engineer');
  assert.equal(resume.personal.email, 'sarah@resistance.org');
  assert.equal(resume.personal.location, 'Los Angeles, CA');
  assert.equal(resume.personal.linkedin, 'https://linkedin.com/in/sarahconnor');
  assert.equal(resume.personal.github, 'https://github.com/sarahconnor');

  // Experience section
  const expSec = resume.sections.find(s => s.type === 'experience');
  assert.ok(expSec);
  assert.equal(expSec.items.length, 1);
  assert.equal(expSec.items[0].company, 'Cyberdyne Systems');
  assert.equal(expSec.items[0].role, 'Lead Analyst');
  assert.ok(expSec.items[0].description.includes('Hardened 100+'));

  // Education section
  const eduSec = resume.sections.find(s => s.type === 'education');
  assert.ok(eduSec);
  assert.equal(eduSec.items[0].institution, 'MIT');
  assert.equal(eduSec.items[0].degree, 'B.S.');

  // Skills section
  const skSec = resume.sections.find(s => s.type === 'skills');
  assert.ok(skSec);
  assert.equal(skSec.items[0].category, 'Security & Cloud');
  assert.ok(skSec.items[0].skills.includes('Penetration Testing'));
});

test('cpwtResumeToJsonResume: converts CPWT resume to JSON Resume standard', () => {
  const cpwtResume = {
    personal: {
      name: 'David Miller',
      title: 'DevOps Lead',
      email: 'david@example.com',
      phone: '123-456',
      website: 'https://david.io',
      location: 'Austin, TX',
      linkedin: 'https://linkedin.com/in/davidmiller',
      summary: 'Cloud infrastructure architect'
    },
    sections: [
      {
        type: 'experience',
        items: [
          {
            company: 'Cloud Corp',
            role: 'DevOps Engineer',
            startDate: '2022-01',
            endDate: '2024-01',
            current: false,
            description: '<ul><li>Reduced deployment time by 60%</li><li>Automated Kubernetes clusters</li></ul>'
          }
        ]
      },
      {
        type: 'skills',
        items: [
          {
            category: 'DevOps Tools',
            skills: 'Terraform, Docker, Kubernetes, CI/CD'
          }
        ]
      }
    ]
  };

  const jsonResume = cpwtResumeToJsonResume(cpwtResume);
  assert.equal(jsonResume.basics.name, 'David Miller');
  assert.equal(jsonResume.basics.label, 'DevOps Lead');
  assert.equal(jsonResume.basics.email, 'david@example.com');
  assert.equal(jsonResume.work.length, 1);
  assert.equal(jsonResume.work[0].name, 'Cloud Corp');
  assert.equal(jsonResume.work[0].highlights.length, 2);
  assert.ok(jsonResume.work[0].highlights[0].includes('60%'));
  assert.equal(jsonResume.skills.length, 1);
  assert.equal(jsonResume.skills[0].keywords.length, 4);
});

// A JSON Resume file whose values are not the schema's text. `keywords` that is not a list (a
// number, an object, true) went straight into the skill group, and the cover letter generator —
// which runs as the Cover Letter tab renders — threw on it ("….split is not a function"), blanking
// the editor. Other values stopped the import itself: a profile's network or URL, or a date, that is
// not text threw in here, and so did an object whose own "toString" is not a function.
const SHADOW = JSON.parse('{"toString":"x"}');

/** The skill group's `skills` a file whose one skill has `keywords` is imported with. */
const skillsFrom = (keywords) => jsonResumeToCpwtResume({ basics: { name: 'X' }, skills: [{ name: 'Lang', keywords }] }).sections[0].items[0].skills;

test('jsonResumeToCpwtResume: skill keywords that are not a list of text are stored as text', () => {
  assert.equal(skillsFrom(['React', 'SQL']), 'React, SQL');
  assert.equal(skillsFrom('React, SQL'), 'React, SQL');
  assert.equal(skillsFrom(12345), '12345');
  for (const v of [{ a: 1 }, {}, true, false, null, undefined, SHADOW]) assert.equal(skillsFrom(v), '', JSON.stringify(v));
  // A list keeps its text and numbers, joined as before; anything else in it is left out, not "[object Object]".
  assert.equal(skillsFrom([1, { x: 1 }, null, 'b', SHADOW, ['c']]), '1, b');
  assert.equal(skillsFrom([' a ', '']), ' a , ', 'text in a list is joined as it is');
});

test('jsonResumeToCpwtResume: the imported skills write a cover letter — none throws', () => {
  for (const keywords of [12345, { a: 1 }, true, ['React', 'SQL']]) {
    const resume = jsonResumeToCpwtResume({ basics: { name: 'Ada' }, skills: [{ name: 'Lang', keywords }] });
    assert.doesNotThrow(() => generateCoverLetter({ resume }), JSON.stringify(keywords));
  }
});

test('jsonResumeToCpwtResume: a value that is not text in any field is stored as text, and none stops the import', () => {
  for (const v of [42, { a: 1 }, ['A', 'B'], true, SHADOW]) {
    const file = {
      basics: {
        name: v, label: v, email: v, phone: v, url: v, summary: v, image: v,
        location: { city: v, region: 'CA', address: v }, profiles: [null, { network: v, url: v }],
      },
      work: [null, { name: v, position: v, location: v, startDate: v, endDate: v, summary: v, highlights: [v] }],
      education: [{ institution: v, studyType: v, area: v, location: v, score: v, startDate: v, endDate: v, courses: [v] }],
      skills: [null, { name: v, keywords: v }],
      projects: [{ name: v, url: v, roles: v, description: v, startDate: v, endDate: v, highlights: [v] }],
      certificates: [{ name: v, issuer: v, url: v, date: v }],
      awards: [{ title: v, awarder: v, date: v, summary: v }],
    };
    const label = JSON.stringify(v);
    const r = jsonResumeToCpwtResume(file, 'res_x');
    const { photo, hiddenFields, ...personal } = r.personal;
    assert.equal(photo, null, `${label}: an image that is not text is no photo`);
    assert.deepEqual(hiddenFields, []);
    assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'education', 'skills', 'projects', 'certifications', 'awards'], label);
    const texts = [r.name, ...Object.values(personal), ...r.sections.flatMap((s) => s.items.flatMap(({ id: _id, current: _current, ...fields }) => Object.values(fields)))];
    for (const t of texts) assert.equal(typeof t, 'string', `${label}: ${JSON.stringify(t)}`);
    assert.ok(!texts.join(' ').includes('[object Object]'), `${label}: ${texts.join(' | ')}`);
    assert.equal(r.sections[0].items.length, 1, `${label}: the null entry is skipped`);
  }
  // A list reads as its entries, a number as its digits.
  const r = jsonResumeToCpwtResume({ basics: { name: ['Ada', 'Lovelace'], label: 7 }, work: [{ position: ['Lead', 'Dev'], startDate: 2019 }] });
  assert.equal(r.name, 'Ada, Lovelace Resume');
  assert.equal(r.personal.title, '7');
  assert.equal(r.sections[0].items[0].role, 'Lead, Dev');
  assert.equal(r.sections[0].items[0].startDate, '2019');
});
