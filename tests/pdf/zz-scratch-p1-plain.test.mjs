// SCRATCH (a throwaway measurement, removed again in the next commit): the PDF build of a huge value in a PLAIN text
// field (a single-line input: no rich text), by size, with the call counts of textkit's line breaker, in several
// templates, and the many-node shapes of the skills styles. It prints "P1P ..." lines; it asserts nothing.
import { before, after, describe, it } from 'node:test';
import fs from 'node:fs';
import inspector from 'node:inspector';
import { createRequire } from 'node:module';
import { setup, teardown, resume, experience, section, render } from './harness.mjs';

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
const pagesOf = (bytes) => (Buffer.from(bytes).toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;

const session = new inspector.Session();
session.connect();
const post = (m, p) => new Promise((res, rej) => session.post(m, p, (e, r) => (e ? rej(e) : res(r))));
const require = createRequire(import.meta.url);
const textkitSource = fs.readFileSync(require.resolve('@react-pdf/textkit'), 'utf8');
const lineOf = (offset) => textkitSource.slice(0, offset).split('\n').length;
async function counted(fn, names) {
  await post('Profiler.enable');
  await post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  await fn();
  const { result } = await post('Profiler.takePreciseCoverage');
  await post('Profiler.stopPreciseCoverage');
  const script = result.find((s) => s.url.endsWith('/@react-pdf/textkit/lib/textkit.js'));
  const out = {};
  for (const f of script?.functions || []) {
    const count = f.ranges[0].count;
    if (count && names.includes(f.functionName)) out[`${f.functionName}:${lineOf(f.ranges[0].startOffset)}`] = count;
  }
  return out;
}
const COUNTED = ['computeCost', 'computeSum', 'getNodes', 'linebreak', 'breakLines', 'layoutParagraph'];

const FIELDS = {
  company: (value) => section('experience', [{ company: value }]),
  skills: (value) => section('skills', [{ category: 'Languages', skills: value }]),
  interests: (value) => section('interests', [{ interests: value }]),
  language: (value) => section('languages', [{ language: value }]),
  institution: (value) => section('education', [{ institution: value }]),
  referenceName: (value) => section('references', [{ name: value }]),
  customTitle: (value) => section('custom', [{ title: value }]),
  description: (value) => section('experience', [{ description: `<p>${value}</p>` }]),
};

describe('P1P scratch', () => {
  it('plain fields by size, with counts', { timeout: 40 * 60 * 1000 }, async () => {
    await render(resume({ sections: [experience([{ description: '<p>warm up</p>' }])] }));
    for (const [field, make] of Object.entries(FIELDS)) {
      let prev = null;
      for (const n of [25_000, 50_000, 100_000, 200_000]) {
        const r = resume({ template: 'classic', sections: [make(words(n, 3))] });
        const start = performance.now();
        const bytes = await render(r);
        const ms = performance.now() - start;
        let counts = '';
        if (ms < 12_000) {
          const c = await counted(async () => { await render(r); }, COUNTED);
          counts = Object.entries(c).map(([k, v]) => `${k}=${v}`).join(' ');
        }
        console.log(`P1P field=${field} chars=${n} ms=${ms.toFixed(0)} pages=${pagesOf(bytes)} ratio=${prev ? (ms / prev).toFixed(2) : '-'} ${counts}`);
        const growth = prev ? ms / prev : 2.5;
        prev = ms;
        if (ms * Math.max(2.1, Math.min(5, growth + 0.3)) > 70_000) { console.log(`P1P field=${field} stops after ${n}`); break; }
      }
    }
    // The name: it is also the running header of every page after the first.
    let prev = null;
    for (const n of [12_500, 25_000, 50_000, 100_000]) {
      const r = resume({ template: 'classic', personal: { name: words(n, 4) }, sections: [experience([{ description: `<p>${words(30_000, 5)}</p>` }])] });
      const start = performance.now();
      const bytes = await render(r);
      const ms = performance.now() - start;
      console.log(`P1P name chars=${n} (and 30k of description: ${pagesOf(bytes)} pages) ms=${ms.toFixed(0)} ratio=${prev ? (ms / prev).toFixed(2) : '-'}`);
      const growth = prev ? ms / prev : 2.5;
      prev = ms;
      if (ms * Math.max(2.1, Math.min(5, growth + 0.3)) > 70_000) break;
    }
  });

  it('other templates, three plain fields of 50 000 characters', { timeout: 20 * 60 * 1000 }, async () => {
    for (const template of ['sidebar', 'timeline', 'banner', 'compact', 'modern', 'academic', 'gridline', 'keel']) {
      let line = `P1P template=${template}`;
      for (const field of ['company', 'skills', 'interests']) {
        const r = resume({ template, personal: { name: 'Test Person' }, sections: [FIELDS[field](words(50_000, 6))] });
        const start = performance.now();
        const bytes = await render(r);
        line += ` ${field}=${(performance.now() - start).toFixed(0)}ms/${pagesOf(bytes)}p`;
      }
      console.log(line);
    }
  });

  it('the many-node shapes: a skills field of thousands of skills in each style, and a long interests list', { timeout: 20 * 60 * 1000 }, async () => {
    const list = (count) => Array.from({ length: count }, (_, i) => `skill${i}`).join(', ');
    for (const style of ['inline', 'tags', 'bars', 'stacked', 'grid']) {
      let line = `P1P skillsStyle=${style}`;
      for (const count of [250, 500, 1000, 2000]) {
        const s = section('skills', [{ category: 'All', skills: list(count) }], { skillsStyle: style });
        const start = performance.now();
        const bytes = await render(resume({ template: 'classic', sections: [s] }));
        const ms = performance.now() - start;
        line += ` ${count}=${ms.toFixed(0)}ms/${pagesOf(bytes)}p`;
        if (ms > 15_000) break;
      }
      console.log(line);
    }
  });
});
