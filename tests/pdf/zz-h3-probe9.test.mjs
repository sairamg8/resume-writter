// PROBE (not a product test): layout invariants over templates x scripts x paper.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, render, read, allItems, allText, resume, section, experience, TEMPLATES, overlaps } from './harness.mjs';

before(setup);
after(teardown);

const chars = (s) => { const m = new Map(); for (const c of s.normalize('NFC')) if (!/[\s​-‏‪-‮]/.test(c)) m.set(c, (m.get(c) || 0) + 1); return m; };
const missing = (want, got) => { const out = []; for (const [c, n] of want) if ((got.get(c) || 0) < n) out.push(`${c}(${n - (got.get(c) || 0)})`); return out; };

const VARIANTS = {
  cjk: { name: '山田 太郎', title: 'シニアエンジニア', co: '株式会社テスト', role: '主任研究員', loc: '東京', text: '大規模なシステムの設計と開発を担当し、チームを率いて新しい製品を市場に投入しました。性能を三割改善し、費用を削減しました。', skills: 'プログラミング, データベース, クラウド', summary: '十年以上の経験を持つエンジニアです。大規模システムの設計に強みがあります。' },
  emoji: { name: 'Sam 😀 Lee', title: 'Engineer 🚀', co: 'Acme 🏢', role: 'Lead 👩‍💻', loc: 'Paris 🇫🇷', text: 'Shipped 🚢 the thing 🎉 and fixed 🐛 bugs; customers ❤️ it. Family 👨‍👩‍👧‍👦 first.', skills: 'Rust 🦀, Go, Python 🐍', summary: 'Builder 🛠️ with a flair for 🎨 design.' },
  latinlong: { name: 'Bartholomew Montgomery-Wellington-Featherstonehaugh', title: 'Principal Distinguished Staff Engineer of Infrastructure Reliability', co: 'International Business Machines Corporation Worldwide Holdings Ltd', role: 'Senior Vice President, Global Head of Engineering Productivity Platforms', loc: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, Wales', text: 'Supercalifragilisticexpialidocious_antidisestablishmentarianism_pneumonoultramicroscopicsilicovolcanoconiosis_https://example.com/a/very/long/path/that/never/ends/and/keeps/going/on/and/on?query=1&other=2 and then normal words follow.', skills: 'Pneumonoultramicroscopicsilicovolcanoconiosis, Floccinaucinihilipilification, C++, C#', summary: 'Averyveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryverylongwordwithoutanybreakpointswhatsoever ok.' },
  heavy: { name: 'Jordan Rivera', title: 'Engineer', co: 'Company', role: 'Role', loc: 'City', text: Array.from({ length: 18 }, (_, i) => `<li>Bullet ${i} where we did a considerable amount of work on the platform and measured the outcome carefully, then wrote it all up.</li>`).join(''), skills: 'a, b, c', summary: 'Summary.', many: 9 },
};

function build(v, template, extra = {}, cols = 1) {
  const li = v.text.startsWith('<li>') ? v.text : `<li>${v.text}</li><li>${v.text}</li>`;
  const exps = experience(Array.from({ length: v.many || 3 }, (_, i) => ({ company: `${v.co} ${i}`, role: v.role, location: v.loc, description: `<ul>${li}</ul>` })), { columns: cols });
  return resume({
    template,
    settings: { ...extra },
    personal: { name: v.name, title: v.title, email: 'a@b.co', phone: '+1 555 0100', location: v.loc, summary: `<p>${v.summary}</p>` },
    sections: [
      exps,
      section('skills', [{ category: v.title, skills: v.skills }]),
      section('education', [{ institution: v.co, degree: v.role, fieldOfStudy: v.title, location: v.loc, startDate: '2010', endDate: '2014', description: `<ul>${li}</ul>` }], { columns: cols }),
      section('projects', [{ name: v.role, technologies: v.skills, description: `<ul>${li}</ul>` }, { name: v.co, description: `<p>${v.text}</p>` }], { columns: cols }),
      section('languages', [{ language: v.name, proficiency: 'Native' }]),
      section('interests', [{ interests: v.skills }]),
      section('custom', [{ title: v.role, subtitle: v.co, date: '2020', location: v.loc, description: `<p>${v.text}</p>` }], { columns: cols }),
    ],
  });
}

describe('probe 9', () => {
  it('grids', async () => {
    const problems = [];
    for (const template of TEMPLATES) {
      for (const [vn, v] of Object.entries(VARIANTS)) {
        if (vn === 'emoji') continue;
        for (const [cols, size, mh] of [[2, 11, 18], [3, 12, 24], [4, 11, 18], [4, 14, 30]]) {
          const tag = `${template}/${vn}/c${cols}/s${size}/m${mh}`;
          try {
            const pages = await read(await render(build(v, template, { pageSize: 'LETTER', fontSizeBase: size, marginH: mh }, cols)));
            const items = allItems(pages);
            const bad = items.filter((t) => { const P = pages[t.page - 1]; return t.x < -1 || t.x + t.w > P.W + 1 || t.y < -2 || t.y > P.H + 2; });
            if (bad.length) problems.push(`${tag}: OFFPAGE ${bad.slice(0, 2).map((t) => `${JSON.stringify(t.str.slice(0, 14))}@${Math.round(t.x)}`).join(' ')}`);
            const ov = pages.flatMap((p) => overlaps(p));
            if (ov.length) problems.push(`${tag}: OVERLAP ${JSON.stringify(ov.slice(0, 1))}`);
            const want = chars([v.name, v.title, v.co, v.role, v.loc, v.skills, v.summary, v.text.replace(/<[^>]+>/g, '')].join(' '));
            const lost = missing(want, chars(allText(pages)));
            if (lost.length) problems.push(`${tag}: LOST ${lost.slice(0, 8).join(' ')}`);
          } catch (e) { problems.push(`${tag}: THROW ${String(e.message).slice(0, 100)}`); }
        }
      }
    }
    const kinds = {};
    for (const p of problems) { const k = p.split(': ')[1].split(' ')[0]; (kinds[k] ||= []).push(p); }
    assert.fail(`PROBE9 problems=${problems.length} ${Object.entries(kinds).map(([k, v]) => `[${k} x${v.length}] ${v.slice(0, 6).join(' ¦ ')}`).join(' ## ')}`);
  });
});
