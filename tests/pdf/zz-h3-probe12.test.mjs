// PROBE: round trips. Backup JSON through the store's import, JSON Resume out and in, Markdown out and the text import back.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const strip = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === 'id' || k === 'updatedAt' || k === 'dataVersion' ? undefined : v)));

function diff(a, b, path = '', out = []) {
  if (out.length > 12) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { out.push(`${path}: ${JSON.stringify(a)?.slice(0, 50)} -> ${JSON.stringify(b)?.slice(0, 50)}`); return out; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${path}: array/object`); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out);
  return out;
}

describe('probe 12', () => {
  it('round trips', async () => {
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const jrE = await loadModule('/src/utils/jsonResumeExport.js');
    const jrI = await loadModule('/src/utils/jsonResumeImport.js');
    const md = await loadModule('/src/utils/markdownExport.js');
    const imp = await loadModule('/src/utils/importText.js');
    const out = [];
    for (const r of DEMO_RESUMES.slice(0, 6)) {
      const n = normalizeResume(r);
      const idem = diff(strip(n), strip(normalizeResume(n)));
      if (idem.length) out.push(`${r.template} IDEMPOTENT ${idem.slice(0, 3).join(' | ')}`);
      const back = normalizeResume(jrI.jsonResumeToCpwtResume(JSON.parse(JSON.stringify(jrE.cpwtResumeToJsonResume(n)))));
      // what prints: the markdown of both
      const m1 = md.generateMarkdownResume(n);
      const m2 = md.generateMarkdownResume(back);
      if (m1 !== m2) {
        const l1 = m1.split('\n'); const l2 = m2.split('\n');
        const at = l1.findIndex((l, i) => l !== l2[i]);
        out.push(`${r.template} JSON-RESUME-REPRINT line ${at}: ${JSON.stringify(l1[at])?.slice(0, 80)} -> ${JSON.stringify(l2[at])?.slice(0, 80)}`);
      }
      // markdown out, text import back: name, contacts, sections, entries count
      const fromMd = imp.resumeFromText(m1);
      const want = n.sections.filter((s) => s.visible !== false).map((s) => `${s.type}:${s.items.length}`);
      const got = fromMd.sections.map((s) => `${s.type}:${s.items.length}`);
      if (JSON.stringify(want) !== JSON.stringify(got)) out.push(`${r.template} MD-IMPORT sections want=${want.join(',')} got=${got.join(',')}`);
      if (fromMd.personal.name !== n.personal.name) out.push(`${r.template} MD-IMPORT name ${fromMd.personal.name}`);
      for (const k of ['email', 'phone', 'location']) if (fromMd.personal[k] !== n.personal[k]) out.push(`${r.template} MD-IMPORT ${k} ${fromMd.personal[k]} vs ${n.personal[k]}`);
    }
    assert.fail(`PROBE12 ${out.length}: ${out.join(' ¦ ')}`);
  });
});
