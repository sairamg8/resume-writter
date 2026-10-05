// TEMPORARY diagnosis of typing-freeze 7(b): where a huge paste's time goes. Removed after.
import { before, after, it } from 'node:test';
import inspector from 'node:inspector/promises';
import { setup, teardown, resume, experience, render } from './harness.mjs';

before(setup);
after(teardown);

function words(n, seed = 1) {
  let a = seed; let out = '';
  const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  while (out.length < n) { let w = ''; const l = 2 + Math.floor(rnd() * 9); for (let i = 0; i < l; i += 1) w += String.fromCharCode(97 + Math.floor(rnd() * 26)); out += `${w} `; }
  return out.slice(0, n);
}

it('diag', async () => {
  for (const [kind, n] of [['words', 50000], ['words', 200000], ['words', 400000], ['cjk', 200000], ['unbroken', 200000]]) {
    const r = resume({ template: 'classic', sections: [experience([{ description: `<p>${kind === 'words' ? words(n) : kind === 'cjk' ? '山田太郎東京大学'.repeat(n / 8) : 'x'.repeat(n)}</p>` }])] });
    const session = new inspector.Session();
    session.connect();
    await session.post('Profiler.enable');
    await session.post('Profiler.setSamplingInterval', { interval: 500 });
    await session.post('Profiler.start');
    const t0 = performance.now();
    await render(r);
    const ms = performance.now() - t0;
    const { profile } = await session.post('Profiler.stop');
    const self = new Map();
    const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
    profile.samples.forEach((id, i) => {
      const f = byId.get(id).callFrame;
      const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-3).join('/')}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
    });
    const top = [...self].sort((x, y) => y[1] - x[1]).slice(0, 14).map(([k, v]) => `   ${v.toFixed(0).padStart(7)} ms  ${k}`);
    console.log(`DIAG ${kind} n=${n} total=${ms.toFixed(0)} ms\n${top.join('\n')}`);
    session.disconnect();
  }
});
