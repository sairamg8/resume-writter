// R4-DOUT-03: under Section Options → Alignment "Center", the PDF prints a dated entry's first line as
// "Title · date" (PdfItemHeader CentredLine: a "·" run in the Text colour's muted shade, in the date's
// size), then the sub and the location lines; Word put the date on a line of its own under the title.
// Word now prints the PDF's line. A centred certification keeps its date under its name, as its PDF
// does (guard). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderDocx, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const JOB = { company: 'Acmeworks', role: 'Staff Planner', location: 'Riverton', startDate: '01/2020', endDate: '12/2021' };
const centred = (sections) => resume({ template: 'classic', sections });
const paraWith = (doc, word) => doc.paragraphs.find((p) => p.text.includes(word));
/** The Word run holding exactly `text`: its colour and size. */
function run(p, text) {
  const xml = p.xml.split('</w:r>').find((r) => r.includes(`>${text}</w:t>`));
  assert.ok(xml, `a run of its own: ${JSON.stringify(text)}`);
  return { color: /<w:color w:val="(\w+)"/.exec(xml)?.[1], size: /<w:sz w:val="(\d+)"/.exec(xml)?.[1] };
}
const squeezed = (s) => s.replace(/\s+/g, '');

describe('Word: a centred entry prints "Title · date" on one line, as the PDF does (R4-DOUT-03)', () => {
  it('Title Stacked: "Company · dates", then the role, then the location', async () => {
    const doc = await renderDocx(centred([section('experience', [JOB], { alignment: 'center', titleStyle: 'stacked' })]));
    const p = paraWith(doc, 'Acmeworks');
    assert.equal(p.text, 'Acmeworks · 01/2020 – 12/2021\nStaff Planner\nRiverton');
    // The "·" as the PDF draws it: the Text colour's muted shade (the location's, off Compact), the date's size.
    const [sep, date, where] = [run(p, '·'), run(p, '01/2020 – 12/2021'), run(p, 'Riverton')];
    assert.equal(sep.color, where.color, 'the "·" in the muted shade');
    assert.equal(sep.size, date.size, 'the "·" in the date\'s size');
  });

  it('the PDF prints the same first line', async () => {
    const r = centred([section('experience', [JOB], { alignment: 'center', titleStyle: 'stacked' })]);
    const items = allItems(await read(await render(r)));
    const title = items.find((t) => t.str.includes('Acmeworks'));
    assert.ok(title, 'the title prints');
    const pdfLine = items.filter((t) => t.page === title.page && Math.abs(t.y - title.y) < 1.5).sort((a, b) => a.x - b.x).map((t) => t.str).join('');
    const wordLine = paraWith(await renderDocx(r), 'Acmeworks').text.split('\n')[0];
    assert.equal(squeezed(wordLine), squeezed(pdfLine));
    assert.equal(squeezed(pdfLine), 'Acmeworks·01/2020–12/2021');
  });

  it('Title Inline: "Company — Role · dates", then the location', async () => {
    const doc = await renderDocx(centred([section('experience', [JOB], { alignment: 'center', titleStyle: 'inline' })]));
    assert.equal(paraWith(doc, 'Acmeworks').text, 'Acmeworks — Staff Planner · 01/2020 – 12/2021\nRiverton');
  });

  it('a project: "Name · dates"', async () => {
    const doc = await renderDocx(centred([section('projects', [{ name: 'Tideline', startDate: '2021', endDate: '2022' }], { alignment: 'center' })]));
    assert.equal(paraWith(doc, 'Tideline').text, 'Tideline · 2021 – 2022');
  });

  it('a centred certification keeps its date on a line of its own, as its PDF does (guard)', async () => {
    const doc = await renderDocx(centred([section('certifications', [{ name: 'Keystone Cert', issuer: 'Lumen Board', date: '2020' }], { alignment: 'center' })]));
    const lines = paraWith(doc, 'Keystone Cert').text.split('\n');
    assert.ok(lines.length === 2 && lines[1].startsWith('2020') && !lines[0].includes('·'), JSON.stringify(lines));
  });
});
