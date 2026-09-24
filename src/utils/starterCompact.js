// The Compact one-pager starter (T9): the long career the Compact template is built for — five roles,
// six skill groups, four certifications, two awards, three languages — on one page. Its short sections
// store no Grids, so they print in Compact's grid (TEMPLATE_SECTION_DEFAULTS.compact) and in each other
// template's own layout after a switch. A fictional engineering leader; contact details use reserved
// example domains and a 555-01xx number.

/** An experience entry of the starter's: a role, its employer, place and dates, and its bullets. */
const job = (id, role, company, location, startDate, endDate, bullets) => ({
  id, role, company, location, startDate, endDate, current: !endDate,
  description: `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`,
});

export const COMPACT_STARTER = {
  id: 'compact-leader',
  name: 'Engineering Leader (Compact one-pager)',
  badge: 'Senior & Leadership',
  description: 'Fifteen years on one page: five roles, skills and certifications in a two-column grid.',
  template: 'compact',
  personal: {
    name: 'Priya Natarajan',
    title: 'Director of Platform Engineering',
    email: 'priya.natarajan@example.com',
    phone: '+1 555 0188',
    location: 'Chicago, IL',
    website: 'priyanatarajan.example.com',
    linkedin: 'linkedin.com/in/priya-natarajan-sample',
    github: '',
    summary: 'Engineering leader with 15 years of building and running platforms that product teams trust. Grew a 60-person platform organisation, cut cloud spend by a third and took deploys from weekly to hundreds a day.',
    hiddenFields: [],
  },
  sections: [
    {
      id: 'sec-exp', type: 'experience', title: 'Experience', visible: true,
      items: [
        job('exp-1', 'Director of Platform Engineering', 'Harborline Logistics', 'Chicago, IL', '2021-04', '', [
          'Lead 7 teams (60 engineers) owning compute, data, developer tooling and reliability for 400 services.',
          'Cut cloud spend by 34% ($4.1M a year) with capacity planning, spot fleets and a cost dashboard per team.',
          'Took deploys from weekly release trains to 300+ a day behind progressive delivery and automated rollback.',
        ]),
        job('exp-2', 'Senior Engineering Manager, Infrastructure', 'Brightwater Health', 'Chicago, IL', '2017-08', '2021-03', [
          'Built the Kubernetes platform that moved 120 services off hand-managed VMs in 18 months.',
          'Set up the on-call and incident review practice; availability rose from 99.5% to 99.95%.',
        ]),
        job('exp-3', 'Engineering Manager, Payments', 'Quillfield Commerce', 'Milwaukee, WI', '2014-06', '2017-07', [
          'Managed 12 engineers through a PCI DSS Level 1 certification and a card-processor migration.',
          'Hired and grew four engineers into tech leads; two now manage teams of their own.',
        ]),
        job('exp-4', 'Senior Software Engineer', 'Quillfield Commerce', 'Milwaukee, WI', '2011-09', '2014-05', [
          'Designed the order ledger that settled $2B a year with no reconciliation gaps.',
        ]),
        job('exp-5', 'Software Engineer', 'Tidewater Systems', 'Madison, WI', '2009-07', '2011-08', [
          'Wrote the scheduling service behind 40,000 daily field-service appointments.',
        ]),
      ],
    },
    {
      id: 'sec-skills', type: 'skills', title: 'Skills', visible: true,
      items: [
        { id: 'sk-1', category: 'Leadership', skills: 'Org design, hiring, performance coaching, budgeting, roadmaps' },
        { id: 'sk-2', category: 'Platform', skills: 'Kubernetes, Terraform, Argo CD, service mesh, observability' },
        { id: 'sk-3', category: 'Languages', skills: 'Go, Java, Python, SQL' },
        { id: 'sk-4', category: 'Data', skills: 'PostgreSQL, Kafka, Snowflake, dbt' },
        { id: 'sk-5', category: 'Cloud', skills: 'AWS, GCP, FinOps, capacity planning' },
        { id: 'sk-6', category: 'Practices', skills: 'SRE, incident command, SLOs, DORA metrics' },
      ],
    },
    {
      id: 'sec-certs', type: 'certifications', title: 'Certifications', visible: true,
      items: [
        { id: 'cert-1', name: 'AWS Certified Solutions Architect – Professional', issuer: 'Amazon Web Services', date: '2023-03', expiry: '', credentialId: '', url: '' },
        { id: 'cert-2', name: 'Certified Kubernetes Administrator', issuer: 'CNCF', date: '2020-11', expiry: '', credentialId: '', url: '' },
        { id: 'cert-3', name: 'Google Cloud Professional Cloud Architect', issuer: 'Google Cloud', date: '2022-06', expiry: '', credentialId: '', url: '' },
        { id: 'cert-4', name: 'FinOps Certified Practitioner', issuer: 'FinOps Foundation', date: '2021-09', expiry: '', credentialId: '', url: '' },
      ],
    },
    {
      id: 'sec-edu', type: 'education', title: 'Education', visible: true,
      items: [
        { id: 'edu-1', institution: 'Lakeshore University', degree: 'M.S. Computer Science', fieldOfStudy: '', location: 'Chicago, IL', startDate: '2007-09', endDate: '2009-05', gpa: '', description: '' },
        { id: 'edu-2', institution: 'Prairie State University', degree: 'B.S. Computer Engineering', fieldOfStudy: '', location: 'Urbana, IL', startDate: '2003-08', endDate: '2007-05', gpa: '', description: '' },
      ],
    },
    {
      id: 'sec-awards', type: 'awards', title: 'Awards', visible: true,
      items: [
        { id: 'aw-1', title: 'Engineering Leader of the Year', issuer: 'Harborline Logistics', date: '2023-12', description: '' },
        { id: 'aw-2', title: 'Speaker, Platform Engineering Summit', issuer: 'PlatformCon', date: '2022-06', description: '' },
      ],
    },
    {
      id: 'sec-langs', type: 'languages', title: 'Languages', visible: true,
      items: [
        { id: 'lang-1', language: 'English', proficiency: 'Native' },
        { id: 'lang-2', language: 'Tamil', proficiency: 'Native' },
        { id: 'lang-3', language: 'Spanish', proficiency: 'Conversational' },
      ],
    },
  ],
};
