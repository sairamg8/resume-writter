import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isJsonResume, jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

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
