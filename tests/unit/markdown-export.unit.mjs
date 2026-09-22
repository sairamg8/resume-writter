import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

test('generateMarkdownResume: generates clean markdown with contact details, sections and bullets', () => {
  const mockResume = {
    personal: {
      name: 'Jane Developer',
      title: 'Senior Staff Engineer',
      email: 'jane@example.com',
      phone: '+1 555-123-4567',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/janedev',
      github: 'github.com/janedev',
      summary: '<p>Seasoned engineer with 10+ years scaling cloud platforms.</p>',
    },
    sections: [
      {
        id: 'exp1',
        type: 'experience',
        title: 'Work Experience',
        visible: true,
        items: [
          {
            role: 'Lead Architect',
            company: 'TechCorp',
            location: 'Remote',
            startDate: '2021-01',
            current: true,
            description: '<ul><li>Engineered microservices cluster handling 100K RPS.</li><li>Mentored 12 senior engineers.</li></ul>',
          }
        ]
      },
      {
        id: 'edu1',
        type: 'education',
        title: 'Education',
        visible: true,
        items: [
          {
            institution: 'Stanford University',
            degree: 'M.S. Computer Science',
            startDate: '2018',
            endDate: '2020',
            gpa: '3.9'
          }
        ]
      },
      {
        id: 'sk1',
        type: 'skills',
        title: 'Skills',
        visible: true,
        items: [
          { name: 'TypeScript' },
          { name: 'Go' },
          { name: 'Kubernetes' }
        ]
      }
    ]
  };

  const md = generateMarkdownResume(mockResume);
  assert.ok(md.includes('# Jane Developer'));
  assert.ok(md.includes('**Senior Staff Engineer**'));
  assert.ok(md.includes('mailto:jane@example.com'));
  assert.ok(md.includes('## Professional Summary'));
  assert.ok(md.includes('Seasoned engineer with 10+ years scaling cloud platforms.'));
  assert.ok(md.includes('## Work Experience'));
  assert.ok(md.includes('**Lead Architect** — *TechCorp*'));
  assert.ok(md.includes('- Engineered microservices cluster handling 100K RPS.'));
  assert.ok(md.includes('## Education'));
  assert.ok(md.includes('Stanford University'));
  assert.ok(md.includes('## Skills'));
  assert.ok(md.includes('- **TypeScript**'));
});

test('generateMarkdownResume: handles empty resume safely', () => {
  assert.equal(generateMarkdownResume(null), '');
  assert.equal(generateMarkdownResume({}), '');
});

test('AUD-13: generateMarkdownResume formats skills ({ category, skills }), languages, volunteering with org, formatted dates, and respects hiddenFields', () => {
  const resume = {
    settings: {
      dateFormat: 'MMM YYYY',
    },
    personal: {
      name: 'Ada Lovelace',
      title: 'Computing Pioneer',
    },
    sections: [
      {
        id: 'sec_exp',
        type: 'experience',
        title: 'Work Experience',
        visible: true,
        items: [
          {
            role: 'Lead Mathematician',
            company: 'Babbage Analytics',
            location: 'London, UK',
            startDate: '2021-01',
            endDate: '2023-06',
            hiddenFields: ['location'],
            visible: true,
          },
          {
            role: 'Secret Role',
            company: 'Secret Co',
            visible: false,
          },
        ],
      },
      {
        id: 'sec_vol',
        type: 'volunteering',
        title: 'Volunteering',
        visible: true,
        items: [
          {
            role: 'Mentor',
            org: 'Girls Who Code',
            startDate: '2020-03',
            endDate: '2020-12',
            description: '<p>Taught algorithms</p>',
            visible: true,
          },
        ],
      },
      {
        id: 'sec_skills',
        type: 'skills',
        title: 'Skills',
        visible: true,
        items: [
          {
            category: 'Languages & Tools',
            skills: 'Python, Julia, C++',
            visible: true,
          },
          {
            skills: 'Analytical Thinking',
            visible: true,
          },
        ],
      },
      {
        id: 'sec_lang',
        type: 'languages',
        title: 'Languages',
        visible: true,
        items: [
          {
            language: 'English',
            proficiency: 'Native',
            visible: true,
          },
          {
            language: 'French',
            proficiency: 'Fluent',
            visible: true,
          },
        ],
      },
    ],
  };

  const md = generateMarkdownResume(resume);

  // Skills
  assert.ok(md.includes('- **Languages & Tools:** Python, Julia, C++'), 'Skill category and skills should be formatted');
  assert.ok(md.includes('- Analytical Thinking'), 'Skill without category should be formatted');

  // Languages
  assert.ok(md.includes('- **English:** Native'), 'Language and proficiency should be formatted');
  assert.ok(md.includes('- **French:** Fluent'), 'Language and proficiency should be formatted');

  // Volunteering
  assert.ok(md.includes('**Mentor** — *Girls Who Code*'), 'Volunteering role and organization should appear');
  assert.ok(md.includes('Taught algorithms'), 'Volunteering description should appear');

  // Date format MMM YYYY (e.g. Jan 2021 – Jun 2023 instead of raw 2021-01 – 2023-06)
  assert.ok(md.includes('Jan 2021 – Jun 2023'), 'Dates should be formatted according to settings.dateFormat');
  assert.ok(!md.includes('2021-01 – 2023-06'), 'Raw unformatted dates should not appear');

  // Hidden field (location) and hidden entry (Secret Role)
  assert.ok(!md.includes('London, UK'), 'Hidden field (location) should not appear');
  assert.ok(!md.includes('Secret Role'), 'Hidden entry should not appear');
  assert.ok(!md.includes('Secret Co'), 'Hidden entry should not appear');
});
