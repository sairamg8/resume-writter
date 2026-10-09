// PROBE: page-break sweep. Orphaned headings, blank pages, stray single lines.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, TEMPLATES, bodyItems } from './harness.mjs';

before(setup);
after(teardown);

const bullet = (i) => `<li>Bullet number ${i} where we did a considerable amount of work on the platform and measured the outcome carefully.</li>`;
const HEAD = /^(Professional Experience|PROFESSIONAL EXPERIENCE|Skills|SKILLS|Education|EDUCATION|Projects|PROJECTS|Company \d+|Role \d+|Languages|LANGUAGES|Interests|INTERESTS)\b/;

function build(template, n, extra) {
  return resume({
    template,
    settings: { ...extra },
    personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin', summary: '<p>Short summary.</p>' },
    sections: [
      experience([
        { description: `<ul>${Array.from({ length: n }, (_, i) => bullet(i)).join('')}</ul>` },
        { description: `<ul>${Array.from({ length: 3 }, (_, i) => bullet(i)).join('')}</ul>` },
      ]),
      section('skills', [{ category: 'Lang', skills: 'a, b, c' }, { category: 'Tools', skills: 'd, e, f' }]),
      section('education', [{ institution: 'University', degree: 'BSc', fieldOfStudy: 'CS', location: 'X', startDate: '2010', endDate: '2014', description: '' }]),
      section('languages', [{ language: 'English', proficiency: 'Native' }]),
    ],
  });
}

describe('probe 4', () => {
  it('sweep', async () => {
    const problems = [];
    for (const template of TEMPLATES) {
      for (const pageSize of ['A4']) {
        for (let n = 1; n <= 40; n += 1) {
          const tag = `${template}/${pageSize}/n${n}`;
          try {
            const pages = await read(await render(build(template, n, { pageSize })));
            pages.forEach((p, i) => {
              const items = bodyItems(p, i).filter((t) => !/^(Page \d+( of \d+)?)$/.test(t.str));
              if (!items.length) { problems.push(`${tag}: BLANK page ${i + 1}/${pages.length}`); return; }
              if (i < pages.length - 1 || true) {
                // last visual line
                const lowest = Math.min(...items.map((t) => t.y));
                const lastLine = items.filter((t) => Math.abs(t.y - lowest) < 2);
                const text = lastLine.map((t) => t.str).join(' ').trim();
                if (i < pages.length - 1 && HEAD.test(text)) problems.push(`${tag}: ORPHAN heading ends page ${i + 1}: "${text.slice(0, 60)}"`);
              }
            });
          } catch (e) { problems.push(`${tag}: THROW ${String(e.message).slice(0, 150)}`); }
        }
      }
    }
    console.log(`PROBE4 problems: ${problems.length}\n${problems.slice(0, 80).join('\n')}`);
    assert.equal(problems.length, 0);
  });
});
