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
