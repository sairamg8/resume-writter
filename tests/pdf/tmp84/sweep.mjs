// Exploration: sweep where a section title lands near the page foot and report orphaned titles.
import { setup, teardown, resume, section, experience, render, read, allItems } from '../harness.mjs';
await setup();

const [,, template = 'classic', which = 'refs', nFrom = '26', nTo = '34'] = process.argv;
const make = {
  refs: () => section('references', [
    { name: 'Alex Doe', jobTitle: 'Manager', company: 'Acme', email: 'alex@example.com', phone: '+1 555 0100' },
    { name: 'Sam Roe', jobTitle: 'Director', company: 'Globex', email: 'sam@example.com', phone: '+1 555 0101' },
  ], { columns: 2 }, { title: 'References' }),
  edu2: () => section('education', [
    { institution: 'Northfield University of Technology and Applied Sciences', degree: 'B.Sc.', fieldOfStudy: 'Computer Science', startDate: '2012', endDate: '2016', description: '<p>Thesis on distributed systems.</p>' },
    { institution: 'Southgate College', degree: 'M.Sc.', startDate: '2016', endDate: '2018' },
  ], { columns: 2 }, { title: 'Education' }),
  exp1: () => experience([{ description: '<p>One line of work here.</p><ul><li>Bullet a</li><li>Bullet b</li></ul>' }, { description: '<p>Two</p>' }], {}),
  exp2: () => experience([
    { role: 'Senior Staff Principal Engineer of Platform Infrastructure', description: '<ul><li>Did a thing</li><li>Did another</li></ul>' },
    { description: '<p>Short</p>' },
  ], { columns: 2 }),
  certs: () => section('certifications', [
    { name: 'AWS Certified Solutions Architect Professional with a very long certification name that wraps', issuer: 'Amazon Web Services', credentialId: 'ABC-123', date: '2021' },
    { name: 'Second', issuer: 'Org', date: '2020' },
  ], {}, { title: 'Certifications' }),
  awards: () => section('awards', [
    { title: 'Best Engineer Award', issuer: 'Acme', date: '2020', description: '<p>For shipping things.</p>' },
    { title: 'Second Award', issuer: 'Org', date: '2019' },
  ], {}, { title: 'Awards' }),
  proj: () => section('projects', [{ name: 'Project Alpha', technologies: 'React', description: '<p>Built it.</p>' }], {}, { title: 'Projects' }),
  custom: () => section('custom', [{ title: 'Custom Entry', subtitle: 'Sub', date: '2020', description: '<p>Desc.</p>' }], {}, { title: 'Custom Things' }),
  langs: () => section('languages', [{ language: 'English', proficiency: 'Native' }, { language: 'German', proficiency: 'B2' }], {}, { title: 'Languages' }),
  vol: () => section('volunteering', [{ role: 'Mentor', org: 'Code Club', startDate: '2019', endDate: '2020', description: '<p>Taught.</p>' }], {}, { title: 'Volunteering' }),
  skills: () => section('skills', [{ category: 'Web', skills: 'React, Node' }, { category: 'Data', skills: 'SQL' }], {}, { title: 'Skills' }),
};

const bad = [];
let runs = 0;
const stats = {};
for (let n = +nFrom; n <= +nTo; n += 1) {
  for (let px = 0; px <= 22; px += 2) {
    const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
    const lead = experience([{ description: `<ul>${lis}</ul>` }]);
    lead.settings = { ...lead.settings, spaceAfter: px };
    const target = make[which]();
    if (target.type === 'experience') target.title = 'Target Zone';
    const r = resume({ template, sections: [lead, target] });
    const pages = await read(await render(r));
    runs += 1;
    const title = target.title.toUpperCase();
    const items = allItems(pages);
    const t = items.find((i) => i.str.trim().toUpperCase() === title || i.str.trim() === target.title);
    if (!t) { bad.push(`n=${n} px=${px}: title not found`); continue; }
    if (process.env.POS) console.log(`n=${n} px=${px} p${t.page} y=${t.y.toFixed(0)} pages=${pages.length}`);
    const pageItems = items.filter((i) => i.page === t.page);
    const below = pageItems.filter((i) => i.y < t.y - 1);
    stats[t.page] = (stats[t.page] || 0) + 1;
    if (!below.length && t.page < pages.length) bad.push(`n=${n} px=${px}: '${title}' ends page ${t.page}`);
    // Report which items are below the title on its page (to see split rows).
    if (process.env.SHOW && below.length && t.page < pages.length) console.log(`n=${n} px=${px} p${t.page}: below=`, below.map((b) => b.str).join(' | ').slice(0, 200));
  }
}
console.log(template, which, `${bad.length}/${runs} orphaned`, JSON.stringify(stats));
for (const b of bad) console.log('  ', b);
await teardown();
