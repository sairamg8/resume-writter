// SCRATCH (a throwaway measurement, removed again in the next commit): the PDF build of a huge value in EVERY
// text field of the résumé (plain ones too), of every template, and the work counts of the block-heavy shapes
// (V8 call counts of react-pdf's layout functions). It prints "P1F ..." lines; it asserts nothing.
import { before, after, describe, it } from 'node:test';
import fs from 'node:fs';
import inspector from 'node:inspector';
import { createRequire } from 'node:module';
import { setup, teardown, resume, experience, section, render, renderCover, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

function rng(seed) {
  let a = seed;
  return () => { a = (Math.imul(a, 1103515245) + 12345) & 0x7fffffff; return a / 0x7fffffff; };
}
function words(n, seed = 7) {
  const rand = rng(seed);
  const parts = [];
  let len = 0;
  while (len < n) {
    let w = '';
    for (let i = 2 + Math.floor(rand() * 9); i > 0; i -= 1) w += String.fromCharCode(97 + Math.floor(rand() * 26));
    parts.push(w);
    len += w.length + 1;
  }
  return parts.join(' ').slice(0, n).trim();
}
function pieces(text, size) {
  const out = [];
  for (let from = 0; from < text.length;) {
    let end = Math.min(text.length, from + size);
    if (end < text.length) { const sp = text.indexOf(' ', end); end = sp < 0 ? text.length : sp; }
    out.push(text.slice(from, end).trim());
    from = end + 1;
  }
  return out.filter(Boolean);
}
const pagesOf = (bytes) => (Buffer.from(bytes).toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;
const timed = async (fn) => { const s = performance.now(); const bytes = await fn(); return { ms: performance.now() - s, pages: pagesOf(bytes), kb: bytes.length / 1024 }; };

const TYPES = ['experience', 'education', 'skills', 'projects', 'languages', 'certifications', 'awards', 'volunteering', 'references', 'interests', 'custom'];
const SKIP = new Set(['id', 'proficiency', 'current', 'bullets']);

describe('P1F scratch', () => {
  it('every text field of every section type, 25 000 and 100 000 characters', { timeout: 40 * 60 * 1000 }, async () => {
    await render(resume({ sections: [experience([{ description: '<p>warm up</p>' }])] }));
    const blank = (type) => section(type, [{}]).items[0];
    for (const type of TYPES) {
      const fields = Object.entries(blank(type)).filter(([k, v]) => typeof v === 'string' && !SKIP.has(k)).map(([k]) => k);
      for (const field of [...fields, 'bullets']) {
        let small = null;
        let line = `P1F section=${type} field=${field}`;
        for (const n of [25_000, 100_000]) {
          if (n === 100_000 && small && small.ms > 6000) { line += ' 100k=skipped'; break; }
          const value = field === 'bullets' ? [words(n, 3)] : (field === 'description' ? `<p>${words(n, 3)}</p>` : words(n, 3));
          const r = resume({ template: 'classic', sections: [section(type, [{ [field]: value }])] });
          const t = await timed(() => render(r));
          line += ` ${n / 1000}k=${t.ms.toFixed(0)}ms/${t.pages}p`;
          if (n === 25_000) small = t; else line += ` ratio=${(t.ms / small.ms).toFixed(1)}`;
        }
        console.log(line);
      }
    }
  });

  it('every personal field and the cover letter, 25 000 and 100 000 characters', { timeout: 20 * 60 * 1000 }, async () => {
    for (const field of ['name', 'title', 'email', 'phone', 'location', 'website', 'linkedin', 'github', 'summary']) {
      let small = null;
      let line = `P1F personal=${field}`;
      for (const n of [25_000, 100_000]) {
        if (n === 100_000 && small && small.ms > 6000) { line += ' 100k=skipped'; break; }
        const value = field === 'summary' ? `<p>${words(n, 4)}</p>` : words(n, 4);
        const r = resume({ template: 'classic', personal: { [field]: value }, sections: [experience([{ description: '<p>x</p>' }])] });
        const t = await timed(() => render(r));
        line += ` ${n / 1000}k=${t.ms.toFixed(0)}ms/${t.pages}p`;
        if (n === 25_000) small = t; else line += ` ratio=${(t.ms / small.ms).toFixed(1)}`;
      }
      console.log(line);
    }
    for (const field of ['body', 'recipientName', 'recipientTitle', 'company', 'subject', 'closing']) {
      let small = null;
      let line = `P1F letter=${field}`;
      for (const n of [25_000, 100_000]) {
        if (n === 100_000 && small && small.ms > 6000) { line += ' 100k=skipped'; break; }
        const value = field === 'body' ? `<p>${words(n, 5)}</p>` : words(n, 5);
        const r = resume({ template: 'classic', coverLetter: { [field]: value } });
        const t = await timed(() => renderCover(r));
        line += ` ${n / 1000}k=${t.ms.toFixed(0)}ms/${t.pages}p`;
        if (n === 25_000) small = t; else line += ` ratio=${(t.ms / small.ms).toFixed(1)}`;
      }
      console.log(line);
    }
  });

  it('every template: one paragraph of 200 000 characters, and 500 bullets of 100', { timeout: 30 * 60 * 1000 }, async () => {
    const paragraph = `<p>${words(200_000, 1)}</p>`;
    const bullets = `<ul>${pieces(words(50_000, 2), 100).map((t) => `<li>${t}</li>`).join('')}</ul>`;
    for (const template of TEMPLATES) {
      const one = await timed(() => render(resume({ template, sections: [experience([{ description: paragraph }])] })));
      const many = await timed(() => render(resume({ template, sections: [experience([{ description: bullets }])] })));
      console.log(`P1F template=${template} paragraph200k=${one.ms.toFixed(0)}ms/${one.pages}p bullets500=${many.ms.toFixed(0)}ms/${many.pages}p`);
    }
  });

  it('work counts: calls of react-pdf layout functions for block-heavy and paragraph shapes', { timeout: 30 * 60 * 1000 }, async () => {
    const require = createRequire(import.meta.url);
    const layoutFile = require.resolve('@react-pdf/layout');
    const layoutSource = fs.readFileSync(layoutFile, 'utf8');
    const lineOf = (offset) => layoutSource.slice(0, offset).split('\n').length;
    const session = new inspector.Session();
    session.connect();
    const post = (m, p) => new Promise((res, rej) => session.post(m, p, (e, r) => (e ? rej(e) : res(r))));
    await post('Profiler.enable');
    const counted = async (fn) => {
      await post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
      await fn();
      const { result } = await post('Profiler.takePreciseCoverage');
      await post('Profiler.stopPreciseCoverage');
      const script = result.find((s) => s.url.endsWith('/@react-pdf/layout/lib/index.js'));
      const out = {};
      for (const f of script?.functions || []) {
        const count = f.ranges[0].count;
        if (!count) continue;
        const line = lineOf(f.ranges[0].startOffset);
        out[`${f.functionName || 'anon'}:${line}`] = count;
      }
      return out;
    };
    const watch = ['splitPage:', 'splitNodes:', 'shouldBreak:', 'isFixed:', 'persistDimensions:', 'destroyYogaNodes:', 'resolvePageStyles:', 'anon:2777', 'resolveDynamicNodes:', 'resolveInheritance:', 'layoutText:', 'measureText:'];
    const shapes = {
      onePara: (n) => `<p>${words(n)}</p>`,
      bullets100: (n) => `<ul>${pieces(words(n, 5), 100).map((t) => `<li>${t}</li>`).join('')}</ul>`,
      paras20: (n) => pieces(words(n, 4), 20).map((t) => `<p>${t}</p>`).join(''),
      article800: (n) => pieces(words(n, 2), 800).map((t) => `<p>${t}</p>`).join(''),
    };
    for (const [shape, make] of Object.entries(shapes)) {
      for (const n of shape === 'onePara' || shape === 'article800' ? [25_000, 50_000, 100_000, 200_000] : [6_000, 12_000, 24_000, 48_000]) {
        const html = make(n);
        let pages = 0;
        const counts = await counted(async () => { pages = pagesOf(await render(resume({ template: 'classic', sections: [experience([{ description: html }])] }))); });
        const picked = Object.entries(counts).filter(([k]) => watch.some((w) => k.startsWith(w))).map(([k, v]) => `${k}=${v}`).join(' ');
        console.log(`P1F counts shape=${shape} chars=${n} pages=${pages} ${picked}`);
      }
    }
    await post('Profiler.disable');
    session.disconnect();
  });
});
