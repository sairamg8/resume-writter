// The résumés the performance harness measures (R2-142, PERF-1). Fictional and deterministic — the same
// text every run, so two runs' timings differ by the machine and not by the words. Built with the PDF
// harness's own builders (tests/pdf/harness.mjs: setup() first), from the app's section defaults.
import { resume, section, experience } from '../pdf/harness.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

/** Text of the large résumé's Summary the browser measurement finds its editor by. */
export const SUMMARY_MARKER = 'long record of shipping fast, reliable web software';

const PERSONAL = {
  name: 'Morgan Ellis',
  title: 'Principal Software Engineer',
  email: 'morgan.ellis@example.com',
  phone: '+1 555 0177',
  location: 'Denver, CO',
  website: 'morganellis.example.com',
  linkedin: 'linkedin.com/in/morgan-ellis-sample',
  github: 'github.com/morgan-ellis-sample',
};

const summary = (n) => `<p>Principal engineer with a ${SUMMARY_MARKER}. Leads platform, performance and tooling work${' across products used by millions of people every month'.repeat(n)}.</p>`;

const VERBS = ['Led', 'Built', 'Shipped', 'Cut', 'Migrated', 'Designed', 'Automated', 'Reduced', 'Rebuilt', 'Introduced', 'Owned', 'Mentored'];
const WORK = [
  'the checkout service and its payment retries', 'a design system used by six product teams', 'the release pipeline for forty services',
  'an observability stack with tracing and alerting', 'the search index behind the catalogue', 'a queue-based import for partner data',
  'the onboarding flow and its experiments', 'the mobile web shell and its offline cache', 'a permissions model for shared workspaces',
  'the nightly reporting jobs and their dashboards',
];
const RESULT = [
  'cutting page load time by 40%', 'halving the time to ship a change', 'removing a class of production incidents',
  'saving about $200k a year in infrastructure', 'lifting conversion by 3 points', 'shortening onboarding from weeks to days',
  'with no downtime during the move', 'while keeping the team on-call load flat',
];
const bullet = (job, n) => `<li>${VERBS[(job * 5 + n) % VERBS.length]} ${WORK[(job * 3 + n * 7) % WORK.length]}, ${RESULT[(job + n * 2) % RESULT.length]}.</li>`;

/** `jobs` positions of `bullets` bullets each (12 positions of five run to three pages or more at Classic's defaults). */
const positions = (jobs, bullets = 5) => Array.from({ length: jobs }, (_, i) => ({
  company: `Company ${String.fromCharCode(65 + i)}`,
  role: i % 3 === 0 ? 'Principal Engineer' : i % 3 === 1 ? 'Senior Engineer' : 'Software Engineer',
  location: ['Denver, CO', 'Remote', 'Austin, TX'][i % 3],
  startDate: `01/${2024 - i * 2}`,
  endDate: i === 0 ? '' : `12/${2025 - i * 2}`,
  current: i === 0,
  description: `<ul>${Array.from({ length: bullets }, (_, n) => bullet(i, n)).join('')}</ul>`,
}));

/** Experience (`jobs` positions), projects, education and skills. */
function sections(jobs) {
  return [
    experience(positions(jobs)),
    section('projects', Array.from({ length: 4 }, (_, i) => ({
      name: `Project ${i + 1}`, url: `github.com/morgan-ellis-sample/project-${i + 1}`, technologies: 'React, Node.js, PostgreSQL',
      startDate: `03/${2023 - i}`, endDate: `09/${2023 - i}`,
      description: `<ul>${Array.from({ length: 2 }, (_, n) => bullet(i + 20, n)).join('')}</ul>`,
    }))),
    section('education', [
      { institution: 'State University', degree: 'BSc', fieldOfStudy: 'Computer Science', location: 'Boulder, CO', startDate: '09/2008', endDate: '06/2012', gpa: '3.8' },
      { institution: 'Open Courseware Institute', degree: 'Certificate', fieldOfStudy: 'Distributed Systems', location: 'Online', startDate: '01/2016', endDate: '06/2016' },
    ]),
    section('skills', [
      { category: 'Languages', skills: 'TypeScript, JavaScript, Go, SQL, Python' },
      { category: 'Frontend', skills: 'React, Next.js, Vite, Tailwind CSS, Storybook' },
      { category: 'Platform', skills: 'Node.js, PostgreSQL, Redis, Kubernetes, Terraform' },
      { category: 'Practice', skills: 'Performance budgets, code review, incident response, mentoring' },
    ]),
  ];
}

const LETTER = {
  recipientName: 'Sam Rivera', recipientTitle: 'Engineering Manager', company: 'Globex Corp', date: '2026-01-15',
  subject: 'Application for Staff Engineer',
  body: `<p>Dear Sam,</p><p>I am writing to apply for the Staff Engineer role at Globex. ${'I have spent the last decade shipping and running web software at scale. '.repeat(4)}</p><p>${'I would enjoy talking about how I could help your platform team. '.repeat(3)}</p><p>Best regards,</p>`,
  closing: 'Sincerely',
};

/** One page: header, a two-line summary, one position of three bullets, and skills. */
export const smallResume = () => resume({
  template: 'classic',
  personal: { ...PERSONAL, summary: summary(0) },
  sections: [experience(positions(1, 3)), section('skills', [{ category: 'Languages', skills: 'TypeScript, JavaScript, SQL' }])],
  coverLetter: LETTER,
});

/** Three pages or more: what a long career looks like in the editor, and what a preview must keep up with. */
export const largeResume = () => resume({
  template: 'classic',
  personal: { ...PERSONAL, summary: summary(2) },
  sections: sections(12),
  coverLetter: LETTER,
});

/** The store document the app reads from localStorage (`cpwtcv_v1`) holding `r` as its one, open résumé. */
export const storeOf = (r) => ({ dataVersion: DATA_VERSION, activeId: r.id, deletedIds: [], resumes: [{ ...r, dataVersion: DATA_VERSION }] });

/** The résumé `r` with one more letter typed at the end of its Summary: what a keystroke does to the store's state. */
export function typedInto(r, letters) {
  return { ...r, updatedAt: r.updatedAt + letters.length, personal: { ...r.personal, summary: r.personal.summary.replace(/<\/p>$/, `${letters}</p>`) } };
}
