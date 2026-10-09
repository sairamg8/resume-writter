// PROBE: the Word export over every template, both papers, hostile text: well-formed, text kept.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, renderDocx, resume, section, experience, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const VARIANTS = {
  cjk: { name: '山田 太郎', title: 'シニアエンジニア', co: '株式会社テスト', role: '主任研究員', loc: '東京', text: '大規模なシステムの設計と開発を担当し、チームを率いて新しい製品を市場に投入しました。', skills: 'プログラミング, データベース', summary: '十年以上の経験を持つエンジニアです。' },
  arabic: { name: 'محمد الأحمد', title: 'مهندس برمجيات', co: 'شركة الاختبار', role: 'مهندس أول', loc: 'الرياض', text: 'قمت بتصميم وتطوير أنظمة كبيرة وقيادة فريق لإطلاق منتجات جديدة في السوق.', skills: 'البرمجة, قواعد البيانات', summary: 'مهندس لديه خبرة تزيد على عشر سنوات.' },
  emoji: { name: 'Sam 😀 Lee', title: 'Engineer 🚀', co: 'Acme 🏢', role: 'Lead 👩‍💻', loc: 'Paris 🇫🇷', text: 'Shipped 🚢 the thing 🎉 & fixed <bugs> "quoted" \'single\'.', skills: 'Rust 🦀, Go', summary: 'Builder 🛠️.' },
};

function wellFormed(xml) {
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[2] === '?xml') continue;
    if (m[4]) continue;
    if (m[1]) { const top = stack.pop(); if (top !== m[2]) return `mismatch </${m[2]}> vs <${top}> at ${m.index}`; } else stack.push(m[2]);
  }
  return stack.length ? `unclosed ${stack.slice(-3).join(',')}` : '';
}

describe('probe 8', () => {
  it('docx', async () => {
    const problems = [];
    for (const template of TEMPLATES) {
      for (const [vn, v] of Object.entries(VARIANTS)) {
        for (const pageSize of ['A4', 'LETTER']) {
          const tag = `${template}/${vn}/${pageSize}`;
          try {
            const r = resume({
              template, settings: { pageSize },
              personal: { name: v.name, title: v.title, email: 'a@b.co', phone: '+1 555 0100', location: v.loc, summary: `<p>${v.summary}</p>` },
              sections: [
                experience([{ company: v.co, role: v.role, location: v.loc, description: `<ul><li>${v.text}</li></ul>` }]),
                section('skills', [{ category: v.title, skills: v.skills }]),
                section('education', [{ institution: v.co, degree: v.role, fieldOfStudy: v.title, location: v.loc, startDate: '2010', endDate: '2014' }]),
              ],
            });
            const d = await renderDocx(r);
            const bad = wellFormed(d.xml);
            if (bad) problems.push(`${tag}: XML ${bad}`);
            const sz = /<w:pgSz [^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/.exec(d.xml) || /<w:pgSz [^>]*w:h="(\d+)"[^>]*w:w="(\d+)"/.exec(d.xml);
            const want = pageSize === 'A4' ? ['11906', '16838'] : ['12240', '15840'];
            if (!sz || !(sz.slice(1).sort().join() === want.slice().sort().join())) problems.push(`${tag}: PAGE ${sz?.[0]}`);
            const all = d.texts.join(' ');
            for (const needle of [v.name, v.title, v.co, v.role, v.loc, v.skills.split(',')[0], v.summary]) if (!all.includes(needle)) problems.push(`${tag}: MISSING ${needle.slice(0, 20)}`);
            if (vn === 'arabic' && !/<w:rtl\/>|<w:bidi/.test(d.xml)) problems.push(`${tag}: NO-RTL`);
          } catch (e) { problems.push(`${tag}: THROW ${String(e.message).slice(0, 120)}`); }
        }
      }
    }
    const byKind = {};
    for (const p of problems) { const k = p.replace(/^[^:]+: /, '').slice(0, 25); (byKind[k] ||= []).push(p.split(':')[0]); }
    assert.fail(`PROBE8 problems=${problems.length} ${Object.entries(byKind).map(([k, v]) => `[${k}] x${v.length} e.g. ${v.slice(0, 3).join(',')}`).join(' ¦ ')}`);
  });
});
