// R4-IMP-02: the Markdown import kept only a link's label. A contact line of "[LinkedIn](https://…) |
// [GitHub](https://…)" — the usual Markdown résumé, and what Export → Markdown writes once a contact
// has a Display label — gave the pieces "LinkedIn" and "GitHub", dropped as bare labels: the URLs
// went nowhere. A project exported as "### [Name](href)" lost its URL on the app's own round trip, and
// a certificate's labelled link line its URL the same way. Each address now lands in its field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const fromMd = (md) => resumeFromText(markdownLines(md));
const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a contact line of labelled links: each address in its field, the label as its Display label', () => {
  const r = fromMd([
    '# Pat Sample',
    '**Frontend Developer**',
    '',
    '[pat@example.com](mailto:pat@example.com) | [LinkedIn](https://linkedin.com/in/pat-sample) | [GitHub](https://github.com/pat-sample) | [My Portfolio](https://pat.example.dev)',
    '',
    '## Experience',
    '### Acme — Frontend Developer',
    '*Mar 2021 – Present*',
  ].join('\n'));
  const p = r.personal;
  assert.equal(p.email, 'pat@example.com');
  assert.equal(p.linkedin, 'https://linkedin.com/in/pat-sample');
  assert.equal(p.github, 'https://github.com/pat-sample');
  assert.equal(p.website, 'https://pat.example.dev');
  assert.deepEqual([p.linkedinLabel, p.githubLabel, p.websiteLabel], ['LinkedIn', 'GitHub', 'My Portfolio']);
  assert.equal(r.sections.find((s) => s.title === 'Additional Information'), undefined, 'nothing left over');
});

test('a link whose label is its address reads as before: the address alone, no label', () => {
  const r = fromMd('# Pat Sample\n\n[linkedin.com/in/pat-sample](https://linkedin.com/in/pat-sample) • [pat@example.com](mailto:pat@example.com)\n');
  assert.equal(r.personal.linkedin, 'linkedin.com/in/pat-sample');
  assert.equal(r.personal.linkedinLabel, undefined);
  assert.equal(r.personal.email, 'pat@example.com');
});

test('a link in a sentence keeps its address beside its text', () => {
  const lines = markdownLines('Wrote [the migration guide](https://docs.example.com/guide) for the team.');
  assert.equal(lines[0].text, 'Wrote the migration guide (https://docs.example.com/guide) for the team.');
});

test('the app\'s own Markdown: a labelled LinkedIn, a project\'s URL and a certificate\'s labelled link come back', () => {
  const md = generateMarkdownResume({
    personal: {
      name: 'Pat Sample', title: 'Frontend Developer', email: 'pat@example.com',
      linkedin: 'https://linkedin.com/in/pat-sample', linkedinLabel: 'LinkedIn', github: 'github.com/pat-sample',
    },
    sections: [
      { id: 's1', type: 'projects', title: 'Projects', settings: {}, items: [
        { id: 'p1', name: 'Tidewater', url: 'https://github.com/pat-sample/tidewater', technologies: 'Rust, Kafka', startDate: 'Jan 2020', endDate: 'Dec 2020', description: '<p>A change-data-capture tool.</p>' },
      ] },
      { id: 's2', type: 'certifications', title: 'Certifications', settings: {}, items: [
        { id: 'c1', name: 'AWS Certified Data Engineer', issuer: 'Amazon Web Services', date: 'Jun 2022', url: 'https://verify.example.com/abc', urlLabel: 'Verify' },
      ] },
    ],
  });
  const r = fromMd(md);
  assert.equal(r.personal.linkedin, 'https://linkedin.com/in/pat-sample', md);
  assert.equal(r.personal.linkedinLabel, 'LinkedIn', md);
  assert.match(r.personal.github, /github\.com\/pat-sample$/, md);
  const [project] = items(r, 'projects');
  assert.deepEqual([project?.name, project?.url, project?.technologies], ['Tidewater', 'https://github.com/pat-sample/tidewater', 'Rust, Kafka'], md);
  const [cert] = items(r, 'certifications');
  assert.deepEqual([cert?.name, cert?.issuer, cert?.url, cert?.urlLabel], ['AWS Certified Data Engineer', 'Amazon Web Services', 'https://verify.example.com/abc', 'Verify'], md);
  assert.equal(cert?.description, undefined, 'the link line is the URL, not a description');
});

// The review of R4-IMP-02: a bracketed word with a dot is a project's stack, not its URL; a linked
// company on a job's title line keeps its role in place, its address in the description.
test('"Portfolio Site (Next.js)": its stack, not its URL', () => {
  const r = resumeFromText('Pat Sample\npat@example.com\n\nPROJECTS\nPortfolio Site (Next.js) | 2023\n• A static site.\nChat App (Socket.io) | 2022');
  assert.deepEqual(items(r, 'projects').map((p) => [p.name, p.technologies, p.url]), [
    ['Portfolio Site', 'Next.js', ''], ['Chat App', 'Socket.io', ''],
  ]);
});

test('a linked company on a job\'s title line: the company and the role as written, the address kept', () => {
  const r = fromMd('# Pat Sample\n\n## Experience\n### [Acme](https://acme.example.com) — Senior Engineer\n*Mar 2021 – Present*\n- Built it.\n');
  const [job] = items(r, 'experience');
  assert.deepEqual([job.company, job.role, job.startDate], ['Acme', 'Senior Engineer', 'Mar 2021']);
  assert.match(job.description, /https:\/\/acme\.example\.com/);
});

test('a certificate\'s line "Node.js" under it is no link', () => {
  const r = resumeFromText('Pat Sample\npat@example.com\n\nCERTIFICATIONS\nOpenJS Node.js Application Developer - OpenJS Foundation - Jun 2022\nNode.js');
  const [cert] = items(r, 'certifications');
  assert.equal(cert.url, '');
});
