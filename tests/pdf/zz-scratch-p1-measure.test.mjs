// SCRATCH (a throwaway measurement, removed again in the next commit): the PDF build of a field of up to
// 200 000 characters in several shapes, to find the step whose cost grows faster than the input.
// It prints "P1 ..." lines; it asserts nothing.
import { before, after, describe, it } from 'node:test';
import inspector from 'node:inspector';
import { setup, teardown, resume, experience, render } from './harness.mjs';

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
/** `text` cut into pieces of about `size` characters at spaces. */
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

const SHAPES = {
  onePara: (n) => `<p>${words(n)}</p>`,
  article800: (n) => pieces(words(n, 2), 800).map((t) => `<p>${t}</p>`).join(''),
  paras120: (n) => pieces(words(n, 3), 120).map((t) => `<p>${t}</p>`).join(''),
  paras20: (n) => pieces(words(n, 4), 20).map((t) => `<p>${t}</p>`).join(''),
  bullets100: (n) => `<ul>${pieces(words(n, 5), 100).map((t) => `<li>${t}</li>`).join('')}</ul>`,
  bullets20: (n) => `<ul>${pieces(words(n, 6), 20).map((t) => `<li>${t}</li>`).join('')}</ul>`,
  runs: (n) => `<p>${pieces(words(n, 8), 40).map((t, i) => (i % 2 ? `<b>${t}</b>` : t)).join(' ')}</p>`,
  links: (n) => `<p>${pieces(words(n, 9), 100).map((t, i) => `<a href="https://example.com/p${i}">${t.slice(0, 20)}</a> ${t.slice(20)}`).join(' ')}</p>`,
  token: (n) => `<p>${'abcdefghij'.repeat(Math.ceil(n / 10)).slice(0, n)}</p>`,
  brLines: (n) => `<p>${pieces(words(n, 10), 10).join('<br>')}</p>`,
};

const pagesOf = (bytes) => (Buffer.from(bytes).toString('latin1').match(/\/Type \/Page(?!s)/g) || []).length;

const session = new inspector.Session();
session.connect();
const post = (method, params) => new Promise((resolve, reject) => session.post(method, params, (err, res) => (err ? reject(err) : resolve(res))));

async function profiled(fn) {
  await post('Profiler.enable');
  await post('Profiler.setSamplingInterval', { interval: 500 });
  await post('Profiler.start');
  let profile;
  try { await fn(); } finally { ({ profile } = await post('Profiler.stop')); }
  await post('Profiler.disable');
  return profile;
}

function summarize(profile, label, top = 22) {
  const keys = new Map();
  const parent = new Map();
  for (const n of profile.nodes) {
    const f = n.callFrame;
    const file = f.url.replace(/^.*node_modules\//, '').replace(/^.*\/(src|tests)\//, '$1/');
    keys.set(n.id, `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`);
    for (const c of n.children || []) parent.set(c, n.id);
  }
  const self = new Map();
  const incl = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i += 1) {
    const dt = profile.timeDeltas[i + 1] ?? profile.timeDeltas[i] ?? 0;
    total += dt;
    let id = profile.samples[i];
    self.set(keys.get(id), (self.get(keys.get(id)) || 0) + dt);
    const seen = new Set();
    for (; id !== undefined; id = parent.get(id)) {
      const k = keys.get(id);
      if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); }
    }
  }
  const show = (map, tag) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
    .forEach(([k, v]) => console.log(`P1PROF ${label} ${tag} ${(v / 1000).toFixed(0).padStart(7)} ms ${((100 * v) / total).toFixed(1).padStart(5)}% ${k}`));
  console.log(`P1PROF ${label} total ${(total / 1000).toFixed(0)} ms`);
  show(incl, 'incl');
  show(self, 'self');
}

const description = (html) => resume({ template: 'classic', sections: [experience([{ description: html }])] });

describe('P1 scratch', () => {
  it('a field of up to 200 000 characters, by shape', { timeout: 40 * 60 * 1000 }, async () => {
    await render(description('<p>warm up the fonts and the code</p>'));
    const SIZES = [12_500, 25_000, 50_000, 100_000, 200_000];
    const only = process.env.P1_SHAPES ? process.env.P1_SHAPES.split(',') : Object.keys(SHAPES);
    for (const shape of only) {
      let prev = null;
      let reached = null;
      for (const n of SIZES) {
        const html = SHAPES[shape](n);
        const chars = html.replace(/<[^>]*>/g, '').length;
        const start = performance.now();
        const bytes = await render(description(html));
        const ms = performance.now() - start;
        console.log(`P1 shape=${shape} chars=${chars} ms=${ms.toFixed(0)} pages=${pagesOf(bytes)} kb=${(bytes.length / 1024).toFixed(0)} ratio=${prev ? (ms / prev).toFixed(2) : '-'}`);
        reached = { n, ms };
        const growth = prev ? ms / prev : 2.2;
        prev = ms;
        const predicted = ms * Math.max(2.1, Math.min(4.5, growth + 0.2));
        if (predicted > 60_000) { console.log(`P1 shape=${shape} stops after ${n} (the next would take about ${(predicted / 1000).toFixed(0)} s)`); break; }
      }
      // A profile of the biggest build that stayed under 20 s, so the cost is told apart by function.
      const n = reached.ms > 20_000 ? SIZES[Math.max(0, SIZES.indexOf(reached.n) - 1)] : reached.n;
      const html = SHAPES[shape](n);
      const profile = await profiled(async () => { await render(description(html)); });
      summarize(profile, `${shape}@${n}`);
    }
  });
});
