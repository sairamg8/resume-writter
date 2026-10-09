// PROBE (not a product test): hostile-data robustness of the pure pipelines.
import { before, after, describe, it } from 'node:test';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const VALUES = [null, 0, -1, 1e308, 2 ** 53, true, false, [], {}, [null], [[]], [{}], ['a'], { a: 1 }, '', ' ', 'x'.repeat(3000), '\u0000', '\ud800', 'مرحبا بالعالم', '你好，世界', '😀👨‍👩‍👧‍👦', '<script>alert(1)</script>', '__proto__', 'constructor', '<p>unclosed', '&amp;&lt;', 'http://', 'javascript:alert(1)', '‮', 12345, 2024, 'Jan 2024', '99/9999', ['a', 'b'].join('\n')];

function paths(obj, base = [], out = []) {
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) { out.push([...base, k]); paths(obj[k], [...base, k], out); }
  }
  return out;
}
function setAt(root, path, value) {
  let o = root;
  for (let i = 0; i < path.length - 1; i += 1) o = o[path[i]];
  o[path[path.length - 1]] = value;
}

describe('probe 1', () => {
  it('hostile résumés through the pure pipelines', async () => {
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const md = await loadModule('/src/utils/markdownExport.js');
    const ats = await loadModule('/src/utils/atsChecker.js');
    const jrE = await loadModule('/src/utils/jsonResumeExport.js');
    const jrI = await loadModule('/src/utils/jsonResumeImport.js');
    const pub = await loadModule('/src/utils/publicLink.js');
    const cl = await loadModule('/src/utils/coverLetterText.js');
    const fn = await loadModule('/src/utils/exportFilename.js');
    const career = await loadModule('/src/utils/careerHistory.js');
    const stages = {
      markdown: (r) => md.generateMarkdownResume(r),
      atsText: (r) => ats.generateAtsPlainText(r),
      atsScore: (r) => ats.analyzeAtsScore(r, 'We need React, Node.js and leadership. Experience with C++ and AWS.'),
      match: (r) => ats.matchResumeWithJob(r, 'React Node.js AWS leadership'),
      jsonResume: (r) => jrE.cpwtResumeToJsonResume(r),
      jsonRoundTrip: (r) => normalizeResume(jrI.jsonResumeToCpwtResume(JSON.parse(JSON.stringify(jrE.cpwtResumeToJsonResume(r))))),
      publicSnapshot: (r) => { const s = pub.publicSnapshot(r); pub.publicSummary(s); return s; },
      letterText: (r) => cl.generateCoverLetterPlainText(r),
      filename: (r) => fn.buildExportFilename(r),
      career: (r) => career.careerItems(r),
    };
    const failures = new Map();
    const R = rng(7);
    const N = 2500;
    for (let n = 0; n < N; n += 1) {
      const base = JSON.parse(JSON.stringify(DEMO_RESUMES[Math.floor(R() * DEMO_RESUMES.length)]));
      base.coverLetter = { ...(base.coverLetter || {}), body: '<p>Dear team</p>', company: 'Acme' };
      const all = paths(base);
      const muts = [];
      for (let m = 0, k = 1 + Math.floor(R() * 3); m < k; m += 1) {
        const p = all[Math.floor(R() * all.length)];
        const v = VALUES[Math.floor(R() * VALUES.length)];
        try { setAt(base, p, typeof v === 'object' && v ? JSON.parse(JSON.stringify(v)) : v); muts.push(`${p.join('.')}=${JSON.stringify(v)?.slice(0, 40)}`); } catch { /* path gone */ }
      }
      let raw;
      try { raw = JSON.parse(JSON.stringify(base)); } catch { continue; }
      let norm;
      try { norm = normalizeResume(raw); } catch (e) {
        const key = `normalizeResume: ${e.message}`;
        if (!failures.has(key)) failures.set(key, { count: 0, example: muts.join(' | '), stack: String(e.stack).split('\n').slice(0, 4).join(' <- ') });
        failures.get(key).count += 1;
        continue;
      }
      for (const [name, f] of Object.entries(stages)) {
        try { await f(norm); } catch (e) {
          const key = `${name}: ${e.message}`;
          if (!failures.has(key)) failures.set(key, { count: 0, example: muts.join(' | '), stack: String(e.stack).split('\n').slice(0, 4).join(' <- ') });
          failures.get(key).count += 1;
        }
      }
    }
    for (const [k, v] of failures) console.log(`PROBE1 FAIL x${v.count} ${k}\n    e.g. ${v.example}\n    ${v.stack}`);
    console.log(`PROBE1 done: ${failures.size} distinct failures`);
  });
});
