/**
 * A seeded fuzz over the settings the app offers plus stress content, scored by ats-parse.mjs with every
 * reader available (pdf.js, Poppler in three modes, and MuPDF when `mupdf` is installed — it is optional,
 * not a dependency: `npm i mupdf --no-save` in a scratch directory and NODE_PATH it, or skip it).
 *
 *   node tests/pdf/ats-fuzz.mjs <seed> <count> [out.jsonl]      one JSON line per case (default: the temp dir)
 *   node tests/pdf/ats-fuzz-report.mjs <out.jsonl> [after.jsonl]  what failed, and by how much (A/B with a second run)
 *   DUMP=2293,2117 node tests/pdf/ats-fuzz.mjs 2 300            also keep those cases' PDF and each reader's text in <tmp>/ats-fuzz-dump
 *
 * Case n of seed s is `s * 1000 + n` and is deterministic, so a defect found at one case can be re-run, and a fix
 * verified, on exactly the same 300 résumés (that is how the ligature and Sidebar-contact defects were proved).
 * Heavy: run it under `flock /tmp/flowcv-heavy.lock` like the suites, and never with another render running.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setup, teardown, render, resume, section, experience, loadModule, TEMPLATES } from './harness.mjs';
import { truthBlocks, readers, score } from './ats-parse.mjs';

const mupdf = await import('mupdf').catch(() => null);
const [seed0, count, outFile] = [Number(process.argv[2] || 1), Number(process.argv[3] || 40), process.argv[4] || path.join(os.tmpdir(), 'ats-fuzz.jsonl')];
const DUMP_DIR = path.join(os.tmpdir(), 'ats-fuzz-dump');

function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(seed0);
const pick = (a) => a[Math.floor(R() * a.length)];
const many = (a, n) => [...a].sort(() => R() - 0.5).slice(0, n);
const chance = (p) => R() < p;

const BULLETS = [
  'Led the migration of a 40-service platform to Kubernetes, cutting infrastructure cost by $1.2M a year.',
  'Built cross-functional, end-to-end tests in C# and .NET that caught regressions before every release.',
  'Reduced page load from 3.9 s to 1.6 s and improved the first-contentful-paint score by 42% for 2M+ users.',
  'Owned the office-wide workflow for CI/CD, A/B testing and R&D experiments across six product teams.',
  'Drove an efficient, high-affluence onboarding programme: the first fifty hires reached productivity in half the time.',
  'Wrote Node.js and C++ services with real-time, low-latency pipelines — 99.99% uptime over 24 months.',
  'Mentored 4 engineers; ran the staff-level architecture review and the "design-first" proposal process.',
  'Shipped an offline-first, cloud-native app documented at https://example.com/products/index.html?ref=cv.',
  'Improved José\'s Café analytics — Ångström-level precision in São Paulo, Zürich and Reykjavík data.',
  'Negotiated a difficult, multi-year contract worth £3.4M with a large, official public-sector customer.',
  'Automated waffle-iron firmware builds; fixed a fifty-line shell script that had failed silently for months.',
  'Cut incident response time by 35% and wrote the on-call runbook adopted company-wide.',
];
const COMPANIES = ['Northwind Traders Inc.', 'Contoso Bank LLC', 'Fabrikam Studio', 'A. Datum Corporation', 'Tailspin Toys Ltd.', 'Wide World Importers & Sons', 'Adventure Works Cycles'];
const ROLES = ['Senior Frontend Engineer', 'Staff Software Engineer, Platform', 'Web Developer', 'Engineering Manager', 'Data Analyst II', 'Director of Product Design & Research'];
const NAMES = ['Jordan Rivera', 'José Ángel Núñez-Ramírez', 'Alexandria Montgomery-Wellington III', 'Li Wei', 'Zoë O\'Connor'];
const SKILLS = ['TypeScript, JavaScript, C++, C#, .NET, SQL', 'React, Next.js, Node.js, GraphQL, REST, Redux Toolkit', 'CI/CD, Docker, Kubernetes, Terraform, GitHub Actions', 'Figma, A/B Testing, R&D, Agile / Scrum'];
const DATES = [['03/2022', '', true], ['06/2019', '02/2022', false], ['Jul 2017', 'May 2019', false], ['2015', '2017', false], ['2020-01', '2021-12', false]];
const chunk = (n) => Array.from({ length: n }, () => pick(BULLETS));
const li = (arr) => '<ul>' + arr.map((b) => `<li>${b.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('') + '</ul>';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';

await setup();
const { DATE_FORMATS } = await loadModule('/src/utils/dates.js');
const out = fs.openSync(outFile, 'a');
try {
  for (let n = 0; n < count; n += 1) {
    const seed = seed0 * 1000 + n;
    const template = pick(TEMPLATES);
    const cfg = {
      template, font: pick(['notosans', 'notosans', 'inter', 'opensans', 'firasans', 'ibmplexsans', 'asap', 'roboto', 'lato', 'sourcesans', 'georgia', 'sourceserif', 'ptserif', 'literata']),
      fontSizeBase: pick([8, 9, 10, 11, 12]), fontSizeSectionDelta: pick([-1, 0, 1, 2, 3]), fontSizeEntryDelta: pick([-1, 0, 1, 2]), fontSizeNameDelta: pick([4, 8, 12]),
      lineHeightValue: pick([1.15, 1.3, 1.5, 1.7]), sectionGap: pick([8, 12, 16, 24]), itemGap: pick([4, 8, 12]), marginH: pick([10, 18, 28]), marginV: pick([10, 14, 24]),
      headingStyle: pick(['ruled', 'plain', 'line', 'underline', 'leftbar', 'box']), sectionTitleCase: pick(['upper', 'normal']),
      headerAlign: pick(['left', 'center']), headerLayout: pick(['stack', 'inline']), contactStyle: pick(['icon', 'bullet']), contactLayout: pick(['justify', 'single', '2grid']),
      iconSet: pick(['filled', 'lucide', 'refined', 'minimal', 'bold']), showHeaderBorder: chance(0.3), pageSize: pick(['A4', 'LETTER']), dateFormat: pick(DATE_FORMATS),
      photo: chance(0.25), skillsStyle: pick(['inline', 'bullet', 'tags']), titleStyle: pick(['stacked', 'inline', 'sidebyside']),
      extras: many(['projects', 'certifications', 'languages', 'awards', 'volunteering', 'references', 'interests', 'custom'], Math.floor(R() * 5)),
      nExp: 2 + Math.floor(R() * 3), nBul: 2 + Math.floor(R() * 4),
    };
    const name = pick(NAMES);
    const settings = {
      font: cfg.font, fontSizeBase: cfg.fontSizeBase, fontSizeSectionDelta: cfg.fontSizeSectionDelta, fontSizeEntryDelta: cfg.fontSizeEntryDelta, fontSizeNameDelta: cfg.fontSizeNameDelta,
      lineHeightValue: cfg.lineHeightValue, sectionGap: cfg.sectionGap, itemGap: cfg.itemGap, marginH: cfg.marginH, marginV: cfg.marginV, headingStyle: cfg.headingStyle, sectionTitleCase: cfg.sectionTitleCase,
      headerAlign: cfg.headerAlign, headerLayout: cfg.headerLayout, contactStyle: cfg.contactStyle, contactLayout: cfg.contactLayout, iconSet: cfg.iconSet, showHeaderBorder: cfg.showHeaderBorder, pageSize: cfg.pageSize, dateFormat: cfg.dateFormat,
    };
    const exp = section('experience', Array.from({ length: cfg.nExp }, () => {
      const d = pick(DATES);
      return { company: pick(COMPANIES), role: pick(ROLES), location: pick(['Austin, TX', 'Remote', 'São Paulo, BR', 'London, UK']), startDate: d[0], endDate: d[1], current: d[2], bullets: [], description: li(chunk(cfg.nBul)) };
    }), { titleStyle: cfg.titleStyle, showDates: true, showLocation: true });
    const sk = section('skills', many(SKILLS, 3).map((s, i) => ({ category: ['Languages', 'Frontend', 'Tooling', 'Practices'][i], skills: s })), { skillsStyle: cfg.skillsStyle, separator: 'colon', titleStyle: 'inline' });
    const edu = section('education', [{ institution: 'Lakeside State University', degree: 'B.S. Computer Science', fieldOfStudy: '', location: 'Austin, TX', startDate: '08/2013', endDate: '05/2017', gpa: '3.7', description: '', bullets: [] }], { showLocation: false });
    const extra = {
      projects: () => section('projects', [{ name: 'Open Recipes', url: 'github.com/jordan-sample/open-recipes', technologies: 'React, IndexedDB, Service Workers', startDate: '01/2023', endDate: '', bullets: [], description: '<p>Offline-first recipe manager that syncs across devices; 1,200 stars on GitHub.</p>' }]),
      certifications: () => section('certifications', [{ name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', date: '05/2023', expiry: '', credentialId: '', url: '' }]),
      languages: () => section('languages', [{ language: 'English', proficiency: 'Native' }, { language: 'Spanish', proficiency: 'Professional' }]),
      awards: () => section('awards', [{ title: 'Engineering Excellence Award', issuer: 'Northwind Traders Inc.', date: '2021', description: '<p>Recognised for the checkout rebuild.</p>' }]),
      volunteering: () => section('volunteering', [{ org: 'Code for Good', role: 'Volunteer Mentor', location: 'Remote', startDate: '2019', endDate: '', description: li(chunk(2)), bullets: [] }]),
      references: () => section('references', [{ name: 'Taylor Brooks', jobTitle: 'Engineering Manager', company: 'Tailspin Toys Ltd.', relationship: 'Manager', email: 'taylor.brooks@example.com', phone: '+1 555 0177' }]),
      interests: () => section('interests', [{ interests: 'Trail running, Chess, Open-source' }]),
      custom: () => section('custom', [{ title: 'Publications', subtitle: 'ACM Queue', date: '2022', location: '', description: '<p>Designing cross-functional, low-latency systems.</p>', bullets: [] }]),
    };
    const sections = [exp, edu, sk, ...cfg.extras.map((k) => extra[k]())].sort(() => R() - 0.5).sort((a, b) => (a.type === 'experience' ? -1 : b.type === 'experience' ? 1 : 0));
    const r = resume({
      template, settings,
      personal: {
        name, title: pick(ROLES), email: 'jordan.rivera@example.com', phone: pick(['+1 555 0142', '+1 (555) 010-0142', '+44 20 7946 0958']), location: pick(['Austin, TX', 'São Paulo, BR']),
        website: 'jordanrivera.example.com', linkedin: 'linkedin.com/in/jordan-rivera-sample', github: 'github.com/jordan-rivera-sample', summary: `<p>${pick(BULLETS)} ${pick(BULLETS)}</p>`, photo: cfg.photo ? PNG : null,
      },
      sections,
    });
    const row = { seed, cfg };
    try {
      const bytes = await render(r);
      const blocks = truthBlocks(r);
      const rd = await readers(bytes);
      row.pages = 0;
      if (mupdf) {
        const doc = mupdf.Document.openDocument(Buffer.from(bytes), 'application/pdf');
        let text = '';
        for (let i = 0; i < doc.countPages(); i += 1) text += doc.loadPage(i).toStructuredText('preserve-whitespace').asText() + '\n';
        rd.push(['MuPDF', text]);
        row.pages = doc.countPages();
      }
      if ((process.env.DUMP || '').split(',').includes(String(seed))) {
        fs.mkdirSync(DUMP_DIR, { recursive: true });
        fs.writeFileSync(path.join(DUMP_DIR, `${seed}.pdf`), bytes);
        rd.forEach(([nm, tx]) => fs.writeFileSync(path.join(DUMP_DIR, `${seed}.${nm.replace(/[^a-z-]/gi, '_')}.txt`), tx));
        fs.writeFileSync(path.join(DUMP_DIR, `${seed}.cfg.json`), JSON.stringify({ cfg, blocks }, null, 1));
      }
      row.results = rd.map(([reader, text]) => {
        const s = score(blocks, text);
        return { reader, recall: s.recall, missing: s.missing.slice(0, 5), overlaps: s.overlaps.length, overlapEx: s.overlaps.slice(0, 2), garbage: s.garbage, spaced: s.spaced, glued: s.glued };
      });
    } catch (e) { row.error = String((e && e.message) || e).slice(0, 200); }
    fs.writeSync(out, JSON.stringify(row) + '\n');
  }
} finally {
  fs.closeSync(out);
  await teardown();
}
