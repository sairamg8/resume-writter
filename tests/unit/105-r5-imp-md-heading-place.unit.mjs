// IMP-REV-1 (R5-IMP-02 review): a hand-written "### **Acme - Engineer** — *Leeds, UK*" — company and
// role in one bold run, the place in italics after it — was read as the export's "**primary** —
// *secondary*" once its bold run held a dash: the place became the company and "Acme - Engineer" the
// role. The export never puts a place in a heading's italic run, so such a heading splits at its
// dashes as before R5-IMP-02: the company and the role come back as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

const jobs = (md) => resumeFromText(markdownLines(md)).sections.find((s) => s.type === 'experience')?.items || [];

test('"**Acme - Engineer** — *Leeds, UK*": Acme\'s engineer, not a company "Leeds, UK"', () => {
  const [job] = jobs('# Robin Vale\n\n## Experience\n\n### **Acme - Engineer** — *Leeds, UK*\n*2019 – 2020*\n\n- Built things\n');
  assert.deepEqual([job.company, job.role], ['Acme', 'Engineer']);
});

test('"**Software Engineer – Google** — *Remote*": Google\'s software engineer', () => {
  const [job] = jobs('# Robin Vale\n\n## Experience\n\n### **Software Engineer – Google** — *Remote*\n*2019 – 2020*\n');
  assert.deepEqual([job.company, job.role], ['Google', 'Software Engineer']);
});

test('the export\'s form with a role in italics still keeps a typed dash in the company', () => {
  const [job] = jobs('# Robin Vale\n\n## Experience\n\n### **Deloitte - Consulting** — *Engineer*\n*2019 – 2020*\n');
  assert.deepEqual([job.company, job.role], ['Deloitte - Consulting', 'Engineer']);
});
