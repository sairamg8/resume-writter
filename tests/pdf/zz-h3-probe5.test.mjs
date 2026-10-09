// PROBE: the two orphaned entry headers found by probe 4.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, bodyItems } from './harness.mjs';

before(setup);
after(teardown);

const bullet = (i) => `<li>Bullet number ${i} where we did a considerable amount of work on the platform and measured the outcome carefully.</li>`;

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

describe('probe 5', () => {
  it('dump', async () => {
    const out = [];
    for (const [template, n] of [['sidebar', 12], ['bookend', 15], ['bookend', 14], ['bookend', 16], ['sidebar', 11], ['sidebar', 13]]) {
      const pages = await read(await render(build(template, n, { pageSize: 'A4' })));
      pages.forEach((p, i) => {
        const items = bodyItems(p, i);
        const lines = new Map();
        for (const t of items) { const k = Math.round(t.y); lines.set(k, [...(lines.get(k) || []), `${Math.round(t.x)}:${t.str}`]); }
        const ys = [...lines.keys()].sort((a, b) => b - a);
        const pick = i === 0 ? ys.slice(-5) : ys.slice(0, 4);
        out.push(`${template}/n${n} p${i + 1}/${pages.length} H=${Math.round(p.H)} ${pick.map((y) => `y${y}[${lines.get(y).join(' ').slice(0, 70)}]`).join(' ')}`);
      });
    }
    console.log(`PROBE5\n${out.join('\n')}`);
    assert.fail('probe');
  });
});
