// R2-009: the Markdown export (Export → Markdown (.md)) prints each section's fields as its PDF
// renderer prints them. It used to print Interests as a heading over nothing; a reference as its name
// and company alone (job title, relationship, e-mail and phone dropped); a custom entry without its
// subtitle and location; an education entry without its field of study; a nested list item glued
// onto its parent ("- Shipped v2- nested child"); legacy bullets not at all; and a project or
// certificate link without a scheme as a relative link ("[My App](github.com/user/app)").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const md = (...sections) => generateMarkdownResume({ personal: { name: 'Ada Lovelace' }, sections });
/** The lines under `## heading`, up to the next `## ` heading, blank lines kept out. */
const under = (out, heading) => {
  const lines = out.split('\n');
  const at = lines.indexOf(`## ${heading}`);
  assert.ok(at >= 0, `no ## ${heading} in:\n${out}`);
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).filter((l) => l.trim());
};

test('Interests print every interest of every entry as one list, as the PDF prints its chips', () => {
  const out = md({ type: 'interests', title: 'Interests', items: [{ interests: 'Chess, Running' }, { interests: ' Photography ,' }] });
  assert.deepEqual(under(out, 'Interests'), ['Chess, Running, Photography']);
});

test('An Interests section with nothing to print prints no heading', () => {
  const out = md({ type: 'interests', title: 'Interests', items: [{ interests: ' , ' }] });
  assert.ok(!out.includes('## Interests'), out);
});

test('References print the job title, company, relationship, e-mail and phone', () => {
  const out = md({ type: 'references', title: 'References', items: [{ name: 'Jane Doe', jobTitle: 'CTO', company: 'Acme Corp', relationship: 'Manager', email: 'jane@acme.com', phone: '555 1234' }] });
  assert.deepEqual(under(out, 'References'), [
    '### **Jane Doe** — *CTO, Acme Corp*',
    '*Manager*  ',
    '[jane@acme.com](mailto:jane@acme.com) | 555 1234',
  ]);
});

test('A reference field hidden with its eye stays out', () => {
  const out = md({ type: 'references', title: 'References', items: [{ name: 'Jane Doe', jobTitle: 'CTO', email: 'jane@acme.com', phone: '555 1234', hiddenFields: ['phone', 'jobTitle'] }] });
  assert.deepEqual(under(out, 'References'), ['### **Jane Doe**', '[jane@acme.com](mailto:jane@acme.com)']);
});

test('Awards print the issuer, the date and the description', () => {
  const out = md({ type: 'awards', title: 'Awards', items: [{ title: 'Best Paper', issuer: 'ACMorg', date: '05/2021', description: '<p>For the parser.</p>' }] });
  assert.deepEqual(under(out, 'Awards'), ['### **Best Paper** — *ACMorg*', '*05/2021*', 'For the parser.']);
});

test('A custom section prints the subtitle, the date and the location', () => {
  const out = md({ type: 'custom', title: 'Publications', items: [{ title: 'React Performance Patterns', subtitle: 'Tech Blog', date: '2024', location: 'Online', description: '<p>An article.</p>' }] });
  assert.deepEqual(under(out, 'Publications'), ['### **React Performance Patterns** — *Tech Blog*', '*2024 | Online*', 'An article.']);
});

test('Education prints the field of study after the degree, as the PDF prints "degree, field"', () => {
  const out = md({ type: 'education', title: 'Education', items: [{ degree: 'BSc', fieldOfStudy: 'Computer Science', institution: 'MIT', startDate: '2015', endDate: '2019' }] });
  assert.deepEqual(under(out, 'Education'), ['### **BSc, Computer Science** — *MIT*', '*2015 – 2019*']);
  const hidden = md({ type: 'education', title: 'Education', items: [{ degree: 'BSc', fieldOfStudy: 'Computer Science', institution: 'MIT', hiddenFields: ['fieldOfStudy'] }] });
  assert.deepEqual(under(hidden, 'Education'), ['### **BSc** — *MIT*']);
});

test('A nested list item prints on its own line, indented under its parent', () => {
  const out = md({ type: 'experience', title: 'Work', items: [{ role: 'Dev', company: 'Acme', description: '<ul><li>Shipped v2<ul><li>nested child<ul><li>grandchild</li></ul></li></ul></li><li>Second</li></ul>' }] });
  assert.deepEqual(under(out, 'Work'), ['### **Dev** — *Acme*', '- Shipped v2', '    - nested child', '        - grandchild', '- Second']);
});

test('A numbered list keeps its numbers; a paragraph around a list stays a paragraph of its own', () => {
  const out = md({ type: 'experience', title: 'Work', items: [{ role: 'Dev', company: 'Acme', description: '<p>Lead line.</p><ol><li>One</li><li>Two</li></ol><p>Closing note.</p>' }] });
  const body = out.slice(out.indexOf('### **Dev**'));
  assert.ok(body.includes('Lead line.\n\n1. One\n2. Two\n\nClosing note.'), body);
});

test('A line break inside a paragraph or a list item stays a line break (two trailing spaces)', () => {
  const out = md({ type: 'experience', title: 'Work', items: [{ role: 'Dev', company: 'Acme', description: '<p>First line<br>Second line</p><ul><li>Item top<br>item rest</li></ul>' }] });
  const body = out.slice(out.indexOf('### **Dev**'));
  assert.ok(body.includes('First line  \nSecond line\n\n- Item top  \n  item rest'), body);
});

test('Legacy bullets print after the description, as the PDF prints them', () => {
  const out = md(
    { type: 'experience', title: 'Work', items: [{ role: 'Dev', company: 'Acme', description: '<p>Owned billing.</p>', bullets: ['Legacy walrus bullet', ' '] }] },
    { type: 'projects', title: 'Projects', items: [{ name: 'Flow', bullets: ['Project bullet'] }] },
    { type: 'custom', title: 'Talks', items: [{ title: 'Keynote', bullets: ['Custom bullet'] }] },
  );
  assert.deepEqual(under(out, 'Work'), ['### **Dev** — *Acme*', 'Owned billing.', '- Legacy walrus bullet']);
  assert.ok(under(out, 'Projects').includes('- Project bullet'), out);
  assert.ok(under(out, 'Talks').includes('- Custom bullet'), out);
});

test('A project or certificate link without a scheme gets https://, as the PDF links it', () => {
  const out = md(
    { type: 'projects', title: 'Projects', items: [{ name: 'My App', url: 'github.com/user/app', technologies: 'React', startDate: '2023', endDate: '2024' }] },
    { type: 'certifications', title: 'Certifications', items: [{ name: 'AWS SA', issuer: 'Amazon', url: 'aws.example/cert', urlLabel: 'View Certificate' }] },
  );
  assert.deepEqual(under(out, 'Projects'), ['### [My App](https://github.com/user/app)', '*Technologies: React | 2023 – 2024*']);
  assert.ok(under(out, 'Certifications').includes('[View Certificate](https://aws.example/cert)'), out);
});

test('A link the PDF would not follow (javascript:, data:) prints as text, never as a link', () => {
  const out = md(
    { type: 'projects', title: 'Projects', items: [{ name: 'Evil', url: 'javascript:alert(1)' }] },
    { type: 'certifications', title: 'Certifications', items: [{ name: 'Cert', url: 'data:text/html,x' }] },
    { type: 'experience', title: 'Work', items: [{ role: 'Dev', description: '<p>See <a href="javascript:alert(1)">this</a> and <a href="example.com/x">that</a>.</p>' }] },
  );
  assert.ok(!/\]\((javascript|data):/i.test(out), out);
  assert.ok(under(out, 'Projects').includes('### Evil'), out);
  assert.ok(out.includes('javascript:alert(1)'), 'the address is still printed, as the PDF prints it');
  assert.ok(out.includes('See this and [that](https://example.com/x).'), out);
});

test('The summary prints its list items on their own lines, nested ones indented', () => {
  const out = generateMarkdownResume({ personal: { name: 'Ada', summary: '<p>Engineer.</p><ul><li>Top<ul><li>Child</li></ul></li></ul>' }, sections: [] });
  assert.ok(out.includes('## Professional Summary\nEngineer.\n\n- Top\n    - Child\n'), out);
});
