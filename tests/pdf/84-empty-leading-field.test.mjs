// R2-111: an entry whose leading field is empty (an Experience entry with a Job Title and no Company)
// printed an empty bold title line holding only the date, and the next field under it, not bold. The
// next field now leads: bold, on the date's line, as Word prints it — in every template and both
// exporters. Timeline prints the date above the title, and the Sidebar its Education in the dark column
// with the date under it: there the field leads, bold.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, renderDocx, read, itemsWith, allItems, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

// Each entry leads with its first field empty: Company (Order "Co. / Role"), Role (Order "Role / Co."),
// Institution, Title; Volunteering's Role.
const CASES = [
  ['experience, no company', () => experience([{ company: '', role: 'Leadrole Engineer', startDate: '2019', endDate: '2021' }], { titleOrder: 'company' }), 'Leadrole'],
  ['experience, no role', () => experience([{ company: 'Leadco Industries', role: '', startDate: '2019', endDate: '2021' }], { titleOrder: 'role' }), 'Leadco'],
  ['education, no institution', () => section('education', [{ institution: '', degree: 'Leaddegree Science', startDate: '2019', endDate: '2021' }]), 'Leaddegree'],
  ['volunteering, no role', () => section('volunteering', [{ role: '', org: 'Leadorg Trust', startDate: '2019', endDate: '2021' }]), 'Leadorg'],
  ['custom, no title', () => section('custom', [{ title: '', subtitle: 'Leadsub Entry', date: '2021' }], {}, { title: 'Extra' }), 'Leadsub'],
];

for (const template of TEMPLATES) {
  it(`${template}: the field after an empty leading one prints bold on the date's line`, async () => {
    const wrong = [];
    for (const [what, make, needle] of CASES) {
      const pages = await read(await render(resume({ template, sections: [make()] })));
      const field = itemsWith(pages, needle)[0];
      const date = itemsWith(pages, '2021')[0];
      if (!field || !date) { wrong.push(`${what}: not printed`); continue; }
      if (!/bold/i.test(field.font)) wrong.push(`${what}: "${field.str}" in ${field.font}, not bold`);
      const dateAbove = template === 'timeline' || (template === 'sidebar' && what.startsWith('education'));
      if (dateAbove) {
        const firstLine = allItems(pages).filter((t) => t.page === date.page && t.y < date.y - 1 && t.x >= date.x - 60).sort((a, b) => b.y - a.y)[0];
        if (template === 'timeline' && firstLine?.str !== field.str) wrong.push(`${what}: "${firstLine?.str}" leads, not "${field.str}"`);
      } else if (Math.abs(field.y - date.y) > 1.5) wrong.push(`${what}: "${field.str}" at y=${field.y.toFixed(1)}, its date at y=${date.y.toFixed(1)}`);
    }
    assert.deepEqual(wrong, []);
  });
}

it('Word: the field after an empty leading one is the bold first run of its entry', async () => {
  const wrong = [];
  for (const [what, make, needle] of CASES) {
    const doc = await renderDocx(resume({ template: 'classic', sections: [make()] }));
    const p = doc.paragraphs.find((x) => x.text.includes(needle));
    if (!p) { wrong.push(`${what}: not printed`); continue; }
    const run = p.xml.split('</w:r>').find((r) => r.includes(needle)) || '';
    if (!/<w:b\/>|<w:b w:val="(true|1|on)"\/>/.test(run)) wrong.push(`${what}: not bold`);
    if (p.text.trim().startsWith('—')) wrong.push(`${what}: starts with a dash: ${p.text}`);
  }
  assert.deepEqual(wrong, []);
});
