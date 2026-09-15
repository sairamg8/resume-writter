import { ATS_DEFAULTS } from '@/utils/defaultData';

// The five fictional sample résumés the owner's login got back after deleting everything, until
// 2026-09-15 — the owner asked for their own résumé instead (src/utils/demoSeed.js), and the app
// no longer carries them. Kept as test data: one résumé per template with every section filled
// in (tests/pdf/20-long-urls.test.mjs). Load through the harness (loadModule) for the `@/` alias.
// The person, companies and school are fictional; contact details use reserved example domains
// and a 555-01xx phone number.

const PERSONAL = {
  name: 'Jordan Rivera',
  title: 'Senior Frontend Engineer',
  email: 'jordan.rivera@example.com',
  phone: '+1 555 0142',
  location: 'Austin, TX',
  website: 'jordanrivera.example.com',
  linkedin: 'linkedin.com/in/jordan-rivera-sample',
  github: 'github.com/jordan-rivera-sample',
  summary: '<p>Frontend engineer with 8+ years of building fast, accessible web apps in React and TypeScript. Led design-system and performance work for products with 2M+ monthly users, and comfortable across the stack with Node.js and PostgreSQL.</p>',
  photo: null,
  hiddenFields: [],
};

const SECTIONS = [
  {
    id: 'experience', type: 'experience', title: 'Professional Experience', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: true, titleStyle: 'stacked' },
    items: [
      {
        id: 'exp1', company: 'Northwind Traders', role: 'Senior Frontend Engineer', location: 'Austin, TX',
        startDate: '03/2022', endDate: '', current: true, bullets: [],
        description: '<ul><li>Led the rebuild of the checkout flow in React and TypeScript, cutting drop-off by 18% and page weight by 40%.</li><li>Built the company design system — 60+ components with Storybook docs and visual regression tests — now used by six product teams.</li><li>Brought Largest Contentful Paint from 3.9 s to 1.6 s with route-level code splitting, an image CDN and server rendering.</li><li>Mentor four engineers and run the frontend guild\'s monthly architecture review.</li></ul>',
      },
      {
        id: 'exp2', company: 'Contoso Bank', role: 'Frontend Engineer', location: 'Remote',
        startDate: '06/2019', endDate: '02/2022', current: false, bullets: [],
        description: '<ul><li>Shipped the customer dashboard used by 2M+ people a month, from prototype to general availability.</li><li>Introduced end-to-end tests with Cypress; production incidents after releases fell by a third.</li><li>Made every customer-facing form meet WCAG 2.1 AA together with the accessibility team.</li></ul>',
      },
      {
        id: 'exp3', company: 'Fabrikam Studio', role: 'Web Developer', location: 'Dallas, TX',
        startDate: '07/2017', endDate: '05/2019', current: false, bullets: [],
        description: '<ul><li>Built 20+ marketing sites and storefronts for retail clients.</li><li>Replaced a jQuery codebase with reusable React components, halving the time to deliver a new page.</li></ul>',
      },
    ],
  },
  {
    id: 'skills', type: 'skills', title: 'Skills', visible: true,
    settings: { spacing: 'normal', columns: 1, skillsStyle: 'inline', separator: 'colon', titleStyle: 'inline' },
    items: [
      { id: 'sk1', category: 'Languages', skills: 'TypeScript, JavaScript, HTML, CSS, SQL' },
      { id: 'sk2', category: 'Frontend', skills: 'React, Next.js, Redux Toolkit, TanStack Query, Tailwind CSS, Storybook' },
      { id: 'sk3', category: 'Backend', skills: 'Node.js, Express, PostgreSQL, REST, GraphQL' },
      { id: 'sk4', category: 'Tooling', skills: 'Vite, Cypress, Jest, GitHub Actions, Docker, Figma' },
    ],
  },
  {
    id: 'projects', type: 'projects', title: 'Projects', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, titleStyle: 'stacked' },
    items: [
      {
        id: 'proj1', name: 'Open Recipes', url: 'github.com/jordan-rivera-sample/open-recipes',
        technologies: 'React, IndexedDB, Service Workers', startDate: '01/2023', endDate: '', bullets: [],
        description: '<p>Offline-first recipe manager that syncs across devices; 1,200 stars on GitHub.</p>',
      },
      {
        id: 'proj2', name: 'a11y-check-action', url: 'github.com/jordan-rivera-sample/a11y-check-action',
        technologies: 'Node.js, axe-core, GitHub Actions', startDate: '04/2021', endDate: '09/2021', bullets: [],
        description: '<p>GitHub Action that comments on pull requests that introduce accessibility regressions.</p>',
      },
    ],
  },
  {
    id: 'education', type: 'education', title: 'Education', visible: true,
    settings: { spacing: 'normal', columns: 1, showDates: true, showLocation: false, titleStyle: 'stacked' },
    items: [
      {
        id: 'edu1', institution: 'Lakeside State University', degree: 'B.S. Computer Science', fieldOfStudy: '',
        location: 'Austin, TX', startDate: '08/2013', endDate: '05/2017', gpa: '3.7', description: '', bullets: [],
      },
    ],
  },
  {
    id: 'certifications', type: 'certifications', title: 'Certifications', visible: true,
    settings: { spacing: 'normal', showDates: true, columns: 1 },
    items: [
      { id: 'cert1', name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: '05/2023', expiry: '05/2026', credentialId: '', url: '' },
      { id: 'cert2', name: 'Professional Scrum Master I', issuer: 'Scrum.org', date: '11/2020', expiry: '', credentialId: '', url: '' },
    ],
  },
  {
    id: 'languages', type: 'languages', title: 'Languages', visible: true,
    settings: { spacing: 'normal', columns: 2 },
    items: [
      { id: 'lang1', language: 'English', proficiency: 'Native' },
      { id: 'lang2', language: 'Spanish', proficiency: 'Professional' },
    ],
  },
];

const COVER_LETTER = {
  recipientName: 'Taylor Brooks',
  recipientTitle: 'Engineering Manager',
  company: 'Tailspin Toys',
  date: '',
  subject: 'Senior Frontend Engineer',
  body: '<p>Dear Taylor,</p><p>I am writing to apply for the Senior Frontend Engineer role at Tailspin Toys. For eight years I have built React applications that stay fast as they grow — most recently a checkout rebuild at Northwind Traders that cut drop-off by 18%.</p><p>Your team\'s work on playful, accessible shopping experiences is exactly where I do my best work. I would bring a habit of measuring before optimising, a design system built with designers rather than for them, and tests that make releases boring.</p><p>I would welcome the chance to talk about how I could help your team ship its next launch.</p>',
  closing: 'Sincerely',
};

function sample(id, name, template, settings) {
  return {
    id,
    name,
    updatedAt: 0,
    template,
    settings: { ...ATS_DEFAULTS, ...settings },
    personal: JSON.parse(JSON.stringify(PERSONAL)),
    sections: JSON.parse(JSON.stringify(SECTIONS)),
    coverLetter: { ...COVER_LETTER },
  };
}

/** One sample résumé per template, with the ids and names the owner's account had (demo_…). */
export const DEMO_RESUMES = [
  sample('demo_classic', 'Sample · Classic', 'classic',
    { accentColor: '#111111', textColor: '#111111', headingStyle: 'ruled', sectionTitleCase: 'upper' }),
  sample('demo_modern', 'Sample · Modern', 'modern',
    { accentColor: '#1d4ed8', textColor: '#1a1a1a', headingStyle: 'line', sectionTitleCase: 'upper', fontSizeNameDelta: 10, sectionGap: 14, itemGap: 8 }),
  sample('demo_minimal', 'Sample · Minimal', 'minimal',
    { accentColor: '#374151', textColor: '#111827', headingStyle: 'underline', sectionTitleCase: 'upper', sectionGap: 18, itemGap: 8, marginH: 20, marginV: 16 }),
  sample('demo_sidebar', 'Sample · Sidebar', 'sidebar',
    { accentColor: '#1e40af', textColor: '#1a1a1a', headingStyle: 'plain', sectionTitleCase: 'upper', sidebarBg: '#1e40af', headerTextColor: '#ffffff', nameColor: '#ffffff', jobTitleColor: '#bfdbfe', sectionGap: 14, itemGap: 8 }),
  sample('demo_executive', 'Sample · Executive', 'executive',
    { accentColor: '#2563eb', textColor: '#111111', headingStyle: 'underline', sectionTitleCase: 'normal', fontSizeNameDelta: 9, sectionGap: 16, itemGap: 8 }),
];
