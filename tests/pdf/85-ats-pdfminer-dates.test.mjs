// R3-004, a known limit: pdfminer.six's default layout analysis (LAParams(): pdf2txt.py and most
// pdfminer-based résumé parsers) reads an entry's flush-right date and location as a column of their
// own when the lines between two entries leave the right-hand strip empty. Its group_textboxes merges
// first the pair of text boxes whose bounding rectangle wastes the least area with no other box inside
// it: two consecutive entries' date/location boxes, one above the other in the empty strip, waste only
// the strip between them; a date box and its own entry's title/company/bullet box waste the whole
// empty width between them. So the dates group together, and the group tree reads them after the
// section. Short bullets show it; long ones reach under the dates and keep them apart. Every template
// sets its dates flush right at the title's line end (ATS-1, ATS-2, ATS-5). What would change it is a
// layout decision, not a local fix: a date within about two character widths of the title's end (no
// longer flush right), glyphs filling the gap (pdf.js and OpenResume would read title and date as one
// field) or text in the strip between entries. pdf.js, Poppler, MuPDF, pypdf and OpenResume read every
// entry in order. Runs when a Python with pdfminer.six is found (PDFMINER_PYTHON, else python3).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setup, teardown, render, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const PYTHON = process.env.PDFMINER_PYTHON || 'python3';
const hasPdfminer = spawnSync(PYTHON, ['-c', 'import pdfminer.high_level'], { encoding: 'utf8' }).status === 0;

/** pdfminer.six's text of `bytes` with its default LAParams, as pdf2txt.py prints it. */
function pdfminerText(bytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfminer-'));
  try {
    const file = path.join(dir, 'r.pdf');
    fs.writeFileSync(file, bytes);
    const run = spawnSync(PYTHON, ['-c', 'import sys\nfrom pdfminer.high_level import extract_text\nprint(extract_text(sys.argv[1]))', file], { encoding: 'utf8' });
    if (run.status !== 0) throw new Error(run.stderr);
    return run.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('pdfminer reads each job\'s dates with the job (known limits: todo until the layout changes)', () => {
  it('Classic\'s demo, role first, one short bullet a job: each job\'s dates before the next job', {
    todo: 'R3-004, known limit: pdfminer groups the flush-right date column on its own where the strip between entries is empty (see the top of this file)',
  }, async (t) => {
    if (!hasPdfminer) { t.skip('pdfminer.six not installed'); return; }
    const { DEMO_RESUMES } = await loadModule('/tests/fixtures/sampleResumes.js');
    const r = structuredClone(DEMO_RESUMES.find((d) => d.template === 'classic'));
    const exp = r.sections.find((s) => s.type === 'experience');
    exp.settings = { ...exp.settings, titleOrder: 'role' };
    exp.items.forEach((item, i) => { item.description = `<ul><li>Shipped release ${i + 1} on time.</li></ul>`; });
    const text = pdfminerText(await render(r));
    const at = (s) => text.indexOf(s);
    assert.ok(at('03/2022 – Present') >= 0 && at('03/2022 – Present') < at('Contoso Bank'), `job 1's dates before job 2:\n${text}`);
    assert.ok(at('06/2019 – 02/2022') < at('Fabrikam Studio'), `job 2's dates before job 3:\n${text}`);
  });
});
