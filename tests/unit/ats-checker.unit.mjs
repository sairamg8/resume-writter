import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_VERBS,
  WEAK_PHRASES,
  ATS_STANDARD_SECTIONS,
  extractResumeCorpus,
  extractJobKeywords,
  matchResumeWithJob,
  standardizeSectionsForAts,
  isStandardAtsTitle,
  generateAtsPlainText,
  analyzeAtsScore,
} from '../../src/utils/atsChecker.js';

// Sample fully-populated ATS-optimized resume
const sampleAtsResume = {
  id: 'test_resume_ats',
  name: 'Senior Software Engineer',
  template: 'classic',
  settings: {
    font: 'notosans',
    contactCols: 1,
  },
  personal: {
    name: 'Sarah Connor',
    title: 'Senior Full Stack Engineer',
    email: 'sarah.connor@example.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    linkedin: 'https://linkedin.com/in/sarahconnor',
    github: 'https://github.com/sarahconnor',
    summary: 'Results-driven Senior Full Stack Engineer with over 8 years of experience designing, architecting, and deploying high-scale distributed systems and cloud platforms.',
    photo: null,
  },
  sections: [
    {
      id: 'sec_exp',
      type: 'experience',
      title: 'Professional Experience',
      titleOrder: 'role',
      settings: { titleOrder: 'role' },
      visible: true,
      items: [
        {
          id: 'exp1',
          company: 'Acme Cloud Technologies',
          role: 'Lead Software Architect',
          location: 'San Francisco, CA',
          startDate: '2021-01',
          endDate: 'Present',
          current: true,
          description: 'Leading the core platform engineering team.',
          bullets: [
            'Architected distributed microservices handling 250,000 requests per second with 99.99% uptime.',
            'Spearheaded the migration to Kubernetes, slashing cloud infrastructure costs by $1.2M annually.',
            'Engineered automated CI/CD pipelines that reduced deployment cycle time by 45%.',
            'Mentored 12 junior engineers and established engineering best practices across 4 teams.',
          ],
        },
        {
          id: 'exp2',
          company: 'InnoTech Solutions',
          role: 'Senior Software Engineer',
          location: 'San Jose, CA',
          startDate: '2017-06',
          endDate: '2020-12',
          current: false,
          description: 'Full-stack application development.',
          bullets: [
            'Developed real-time analytics dashboard serving over 500k monthly active users.',
            'Optimized database query performance, decreasing p99 response times by 35%.',
            'Automated end-to-end testing suite increasing regression test coverage to 92%.',
          ],
        },
      ],
    },
    {
      id: 'sec_edu',
      type: 'education',
      title: 'Education',
      visible: true,
      items: [
        {
          id: 'edu1',
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          location: 'Berkeley, CA',
          startDate: '2013',
          endDate: '2017',
          gpa: '3.85',
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
          id: 'sk1',
          category: 'Languages & Runtimes',
          skills: 'TypeScript, JavaScript, Python, Go, Java, SQL',
        },
        {
          id: 'sk2',
          category: 'Frameworks & Libraries',
          skills: 'React, Node.js, Next.js, Express, Tailwind CSS, GraphQL',
        },
        {
          id: 'sk3',
          category: 'Cloud & DevOps',
          skills: 'AWS, Docker, Kubernetes, CI/CD, Terraform, PostgreSQL, Redis',
        },
      ],
    },
  ],
};

test('ATS Action Verbs: has comprehensive dictionary of action verbs', () => {
  assert.ok(ACTION_VERBS.size >= 120);
  assert.ok(ACTION_VERBS.has('architected'));
  assert.ok(ACTION_VERBS.has('spearheaded'));
  assert.ok(ACTION_VERBS.has('engineered'));
  assert.ok(ACTION_VERBS.has('optimized'));
  assert.ok(ACTION_VERBS.has('developed'));
});

test('ATS Weak Phrases: identifies common passive/weak patterns', () => {
  assert.ok(WEAK_PHRASES.includes('responsible for'));
  assert.ok(WEAK_PHRASES.includes('helped with'));
  assert.ok(WEAK_PHRASES.includes('worked on'));
});

test('Standard ATS Headings: identifies standard vs custom section titles', () => {
  assert.equal(isStandardAtsTitle({ type: 'experience', title: 'Work Experience' }), true);
  assert.equal(isStandardAtsTitle({ type: 'experience', title: 'Professional Experience' }), true);
  assert.equal(isStandardAtsTitle({ type: 'experience', title: 'Employment History' }), true);
  assert.equal(isStandardAtsTitle({ type: 'experience', title: 'My Journey' }), false);

  assert.equal(isStandardAtsTitle({ type: 'education', title: 'Education' }), true);
  assert.equal(isStandardAtsTitle({ type: 'education', title: 'Academic Background' }), true);
  assert.equal(isStandardAtsTitle({ type: 'education', title: 'Where I Studied' }), false);

  assert.equal(isStandardAtsTitle({ type: 'skills', title: 'Technical Skills' }), true);
  assert.equal(isStandardAtsTitle({ type: 'skills', title: 'Core Competencies' }), true);
  assert.equal(isStandardAtsTitle({ type: 'skills', title: 'My Superpowers' }), false);
});

test('standardizeSectionsForAts: converts non-standard titles to canonical Workday headings and sets titleOrder to role', () => {
  const customSections = [
    { id: '1', type: 'experience', title: 'Where I Worked', settings: { titleOrder: 'company' } },
    { id: '2', type: 'education', title: 'My College' },
    { id: '3', type: 'skills', title: 'What I Know' },
  ];
  const standardized = standardizeSectionsForAts(customSections);
  assert.equal(standardized[0].title, 'Professional Experience');
  assert.equal(standardized[0].titleOrder, 'role');
  assert.equal(standardized[0].settings?.titleOrder, 'role');
  assert.equal(standardized[1].title, 'Education');
  assert.equal(standardized[2].title, 'Skills');
});

test('analyzeAtsScore: flags company-leading experience title order and passes role-leading order', () => {
  const companyLeadingResume = {
    ...sampleAtsResume,
    sections: sampleAtsResume.sections.map(s => s.type === 'experience' ? { ...s, titleOrder: 'company', settings: { titleOrder: 'company' } } : s),
  };
  const reportWarn = analyzeAtsScore(companyLeadingResume);
  const expItemWarn = reportWarn.categories.experience.items.find(i => i.id === 'exp_title_order');
  assert.ok(expItemWarn, 'exp_title_order item should exist');
  assert.equal(expItemWarn.status, 'warn');
  assert.equal(expItemWarn.fixable, true);
  assert.equal(expItemWarn.action, 'set_title_order_role');

  const reportPass = analyzeAtsScore(sampleAtsResume);
  const expItemPass = reportPass.categories.experience.items.find(i => i.id === 'exp_title_order');
  assert.ok(expItemPass, 'exp_title_order item should exist');
  assert.equal(expItemPass.status, 'pass');
});

test('analyzeAtsScore: computes top-tier score for well-structured resume', () => {
  const report = analyzeAtsScore(sampleAtsResume);
  assert.ok(report.totalScore >= 90, `Expected totalScore >= 90, got ${report.totalScore}`);
  assert.equal(report.grade, 'A+');
  assert.equal(report.gradeLabel, 'Workday & ATS Ready');

  // Verify categories
  assert.ok(report.categories.contact.score >= 18);
  assert.ok(report.categories.headings.score >= 18);
  assert.ok(report.categories.experience.score >= 20);
  assert.ok(report.categories.education.score >= 14);
  assert.ok(report.categories.skills.score >= 8);
  assert.ok(report.categories.layout.score >= 9);
  assert.equal(report.criticalCount, 0);
});

test('analyzeAtsScore: flags missing contacts, missing sections, and weak bullets', () => {
  const poorResume = {
    template: 'sidebar',
    personal: {
      name: 'Bob', // single word name
      email: 'invalid-email',
      phone: '123', // invalid phone
      location: '',
      photo: 'data:image/png;base64,123',
    },
    sections: [
      {
        id: 'exp',
        type: 'experience',
        title: 'Random Stuff I Did', // non-standard title
        visible: true,
        items: [
          {
            role: 'Worker',
            company: 'Company',
            bullets: [
              'Responsible for helping with bugs', // weak passive phrase, no metrics, no action verb
            ],
          },
        ],
      },
    ],
  };

  const report = analyzeAtsScore(poorResume);
  assert.ok(report.totalScore < 60, `Expected low score, got ${report.totalScore}`);
  assert.ok(report.criticalCount > 0);

  // Check that critical issues and warnings were identified
  const contactItems = report.categories.contact.items;
  assert.ok(contactItems.some(i => i.id === 'email' && i.status === 'fail'));
  assert.ok(contactItems.some(i => i.id === 'name' && i.status === 'warn'));
  assert.ok(contactItems.some(i => i.id === 'phone' && i.status === 'fail'));

  // Missing education & skills
  assert.ok(report.categories.headings.items.some(i => i.id === 'has_edu' && i.status === 'fail'));
  assert.ok(report.categories.headings.items.some(i => i.id === 'has_skills' && i.status === 'fail'));

  // Non standard heading
  assert.ok(report.categories.headings.items.some(i => i.id === 'std_headings' && i.status === 'warn'));

  // Weak phrases & low action verb ratio
  assert.ok(report.categories.experience.items.some(i => i.id === 'weak_phrases'));

  // Sidebar template warning
  assert.ok(report.categories.layout.items.some(i => i.id === 'template' && i.status === 'warn'));
});

test('Job Description Matcher: extracts keywords and calculates match score', () => {
  const sampleJd = `
    We are seeking a Senior Full Stack Engineer with strong experience in TypeScript, React, Node.js, and AWS.
    The ideal candidate will have expertise in Kubernetes, Docker, Microservices, CI/CD pipelines, and GraphQL.
    Experience with Python and Go is a big plus. Strong system design and problem solving skills required.
  `;

  const match = matchResumeWithJob(sampleAtsResume, sampleJd);
  assert.ok(match !== null);
  assert.ok(match.matchPercentage >= 70, `Expected match >= 70%, got ${match.matchPercentage}%`);
  assert.ok(match.matchedKeywords.includes('react'));
  assert.ok(match.matchedKeywords.includes('typescript'));
  assert.ok(match.matchedKeywords.includes('kubernetes'));
  assert.ok(match.matchedKeywords.includes('docker'));
  assert.ok(match.matchedKeywords.includes('aws'));
});

test('generateAtsPlainText: outputs parser-perfect text with headers and bullets', () => {
  const plainText = generateAtsPlainText(sampleAtsResume);
  assert.ok(plainText.includes('SARAH CONNOR'));
  assert.ok(plainText.includes('sarah.connor@example.com'));
  assert.ok(plainText.includes('+1 (555) 234-5678'));
  assert.ok(plainText.includes('PROFESSIONAL EXPERIENCE'));
  assert.ok(plainText.includes('Acme Cloud Technologies'));
  assert.ok(plainText.includes('Lead Software Architect'));
  assert.ok(plainText.includes('* Architected distributed microservices'));
  assert.ok(plainText.includes('EDUCATION'));
  assert.ok(plainText.includes('University of California, Berkeley'));
  assert.ok(plainText.includes('SKILLS'));
  assert.ok(plainText.includes('Languages & Runtimes: TypeScript, JavaScript, Python, Go, Java, SQL'));
});

test('analyzeAtsScore: handles null or empty input gracefully without throwing', () => {
  const nullReport = analyzeAtsScore(null);
  assert.equal(nullReport.totalScore, 0);
  assert.equal(nullReport.grade, 'C');

  const emptyReport = analyzeAtsScore({});
  assert.ok(emptyReport.totalScore <= 20);
  assert.equal(emptyReport.grade, 'D');
  assert.ok(emptyReport.criticalCount > 0);
});

test('analyzeAtsScore: respects section visibility (visible: false is ignored)', () => {
  const resumeWithHidden = {
    ...sampleAtsResume,
    sections: sampleAtsResume.sections.map(s => s.type === 'skills' ? { ...s, visible: false } : s),
  };
  const report = analyzeAtsScore(resumeWithHidden);
  // Hidden skills section should cause missing skills section flag
  assert.ok(report.categories.headings.items.some(i => i.id === 'has_skills' && i.status === 'fail'));
});

test('Template ATS ratings: Classic, Minimal, Executive pass; Sidebar alerts', () => {
  for (const tmpl of ['classic', 'minimal', 'executive']) {
    const r = { ...sampleAtsResume, template: tmpl };
    const report = analyzeAtsScore(r);
    assert.equal(report.categories.layout.score, 10, `${tmpl} should receive 10 layout points`);
  }

  const sidebarResume = { ...sampleAtsResume, template: 'sidebar' };
  const sidebarReport = analyzeAtsScore(sidebarResume);
  assert.ok(sidebarReport.categories.layout.score < 10);
  assert.ok(sidebarReport.categories.layout.items.some(i => i.id === 'template' && i.status === 'warn'));
});

test('Job Description Matcher: handles empty input and correctly identifies missing keywords', () => {
  assert.equal(matchResumeWithJob(sampleAtsResume, ''), null);
  assert.equal(matchResumeWithJob(sampleAtsResume, '   '), null);
  assert.equal(matchResumeWithJob(null, 'Java'), null);

  const specializedJd = 'Looking for an expert in Rust, Elixir, WebAssembly, and Solana blockchain architecture.';
  const match = matchResumeWithJob(sampleAtsResume, specializedJd);
  assert.ok(match !== null);
  assert.ok(match.missingKeywords.includes('rust'));
  assert.ok(match.missingKeywords.includes('elixir'));
  assert.ok(match.missingKeywords.includes('solana'));
  assert.ok(match.matchPercentage < 40);
});

test('generateAtsPlainText: handles projects, certifications, and volunteering sections', () => {
  const fullResume = {
    ...sampleAtsResume,
    sections: [
      ...sampleAtsResume.sections,
      {
        id: 'sec_proj',
        type: 'projects',
        title: 'Projects',
        visible: true,
        items: [{ name: 'FlowCV Engine', technologies: 'React, Vite', url: 'https://github.com/project', description: 'Fast resume builder' }],
      },
      {
        id: 'sec_cert',
        type: 'certifications',
        title: 'Certifications',
        visible: true,
        items: [{ name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2023' }],
      },
      {
        id: 'sec_vol',
        type: 'volunteering',
        title: 'Volunteering',
        visible: true,
        items: [{ org: 'Code for Good', role: 'Mentor', startDate: '2022', endDate: '2023' }],
      },
    ],
  };

  const text = generateAtsPlainText(fullResume);
  assert.ok(text.includes('PROJECTS'));
  assert.ok(text.includes('FlowCV Engine (React, Vite)'));
  assert.ok(text.includes('CERTIFICATIONS'));
  assert.ok(text.includes('AWS Certified Solutions Architect - Amazon Web Services - 2023'));
  assert.ok(text.includes('VOLUNTEERING'));
  assert.ok(text.includes('Mentor - Code for Good'));
});

test('ATS_STANDARD_SECTIONS: defines taxonomy for experience, education, skills', () => {
  assert.ok(ATS_STANDARD_SECTIONS.experience.canonical);
  assert.ok(ATS_STANDARD_SECTIONS.education.canonical);
  assert.ok(ATS_STANDARD_SECTIONS.skills.canonical);
});

test('extractResumeCorpus: extracts all searchable text from resume fields', () => {
  const corpus = extractResumeCorpus(sampleAtsResume);
  assert.ok(corpus.includes('Sarah Connor'));
  assert.ok(corpus.includes('TypeScript'));
  assert.ok(corpus.includes('Acme Cloud Technologies'));
  assert.equal(extractResumeCorpus(null), '');
});

test('extractJobKeywords: returns frequency sorted list of technical terms', () => {
  const keywords = extractJobKeywords('TypeScript React Node.js React React Docker Kubernetes');
  assert.ok(keywords.length >= 4);
  assert.equal(keywords[0].keyword, 'react');
  assert.equal(keywords[0].count, 3);
  assert.deepEqual(extractJobKeywords(''), []);
  assert.deepEqual(extractJobKeywords(null), []);
});

test('extractBulletsFromItem: extracts bullets from html, unicode bullets, and legacy arrays', async () => {
  const { extractBulletsFromItem } = await import('../../src/utils/atsChecker.js');

  // HTML unordered list (RichTextEditor standard)
  const htmlItem = {
    description: '<ul><li>Spearheaded redesign of checkout flow, cutting drop-off by 18%.</li><li>Architected cloud microservices handling 50k RPS.</li></ul>',
    bullets: [],
  };
  const htmlBullets = extractBulletsFromItem(htmlItem);
  assert.equal(htmlBullets.length, 2);
  assert.equal(htmlBullets[0], 'Spearheaded redesign of checkout flow, cutting drop-off by 18%.');
  assert.equal(htmlBullets[1], 'Architected cloud microservices handling 50k RPS.');

  // Text with bullet characters
  const textBulletsItem = {
    description: '<p>• Spearheaded migration to Kubernetes</p><p>• Optimized query performance by 40%</p>',
  };
  const textBullets = extractBulletsFromItem(textBulletsItem);
  assert.equal(textBullets.length, 2);
  assert.equal(textBullets[0], 'Spearheaded migration to Kubernetes');
  assert.equal(textBullets[1], 'Optimized query performance by 40%');

  // Legacy array fallback
  const legacyItem = {
    bullets: ['Engineered scalable search engine.', 'Mentored 4 junior engineers.'],
  };
  const legacyBullets = extractBulletsFromItem(legacyItem);
  assert.equal(legacyBullets.length, 2);
  assert.equal(legacyBullets[0], 'Engineered scalable search engine.');
});

test('analyzeAtsScore: recognizes HTML bullet points in experience roles without bullets_count failure', () => {
  const resumeWithHtmlBullets = {
    id: 'res_html_bullets',
    template: 'classic',
    personal: {
      name: 'Alex Morgan',
      title: 'Full Stack Engineer',
      email: 'alex@example.com',
      phone: '+1 555 123 4567',
      location: 'New York, NY',
    },
    sections: [
      {
        id: 'sec_exp',
        type: 'experience',
        title: 'Work Experience',
        visible: true,
        items: [
          {
            id: 'exp1',
            company: 'Tech Corp',
            role: 'Senior Software Engineer',
            location: 'New York, NY',
            startDate: '2020-01',
            endDate: 'Present',
            current: true,
            description: '<ul><li>Spearheaded payment microservice migration, reducing latency by 45%.</li><li>Architected real-time event streaming pipeline processing 10M events daily.</li><li>Mentored 5 junior engineers and established team coding standards.</li><li>Automated CI/CD deployment pipelines, cutting cycle time by 60%.</li></ul>',
            bullets: [],
          },
        ],
      },
      {
        id: 'sec_edu',
        type: 'education',
        title: 'Education',
        visible: true,
        items: [{ institution: 'MIT', degree: 'BS', fieldOfStudy: 'CS', startDate: '2015', endDate: '2019' }],
      },
      {
        id: 'sec_skills',
        type: 'skills',
        title: 'Technical Skills',
        visible: true,
        items: [{ category: 'Languages', skills: 'JavaScript, TypeScript, Python, Go, Rust, Java, SQL, C++' }],
      },
    ],
  };

  const results = analyzeAtsScore(resumeWithHtmlBullets);
  const bulletCheck = results.categories.experience.items.find(i => i.id === 'bullets_count');
  assert.ok(bulletCheck == null || bulletCheck.status === 'pass', `Expected no bullets_count failure, but got: ${JSON.stringify(bulletCheck)}`);
  
  const actionVerbCheck = results.categories.experience.items.find(i => i.id === 'action_verbs');
  assert.ok(actionVerbCheck && actionVerbCheck.status === 'pass', 'Action verbs check should pass');
  
  const metricsCheck = results.categories.experience.items.find(i => i.id === 'metrics');
  assert.ok(metricsCheck && metricsCheck.status === 'pass', 'Metrics check should pass');
});

