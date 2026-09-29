// R4-DOUT-04 (remainder): the Sidebar page's project card (PdfSidebarSections.jsx SidebarMainProjects)
// printed a project's technologies on the line under its name and its link on a line of its own under
// that, where the other templates' PDFs and every Word export (the Sidebar's included) print
// "technologies · link" on one line, a " · " only between the two. The Sidebar PDF now joins them on
// one line, and its text is the Word export's. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const URL = 'github.example/me/tidepool';
const sidebar = (item, settings = {}) => resume({ template: 'sidebar', sections: [section('projects', [{ name: 'Tidepool', startDate: '2021', ...item }], settings)] });

/** The PDF's text items of the card's second line: those on `word`'s baseline. */
async function pdfLine(r, word) {
  const items = (await read(await render(r))).flatMap((p) => p.items);
  const at = items.find((i) => i.str.includes(word));
  assert.ok(at, `"${word}" printed: ${items.map((i) => i.str).join(' | ')}`);
  return items.filter((i) => Math.abs(i.y - at.y) < 0.5).toSorted((a, b) => a.x - b.x);
}
/**
 * A line's text, its runs in order, a space between two that do not touch (the reader drops a run of
 * spaces alone), spaces made single: "Reactx · link".
 */
const joined = (line) => line.reduce((out, t, k) => {
  const prev = line[k - 1];
  return out + (prev && t.x - (prev.x + prev.w) > 0.8 ? ' ' : '') + t.str;
}, '').replace(/\s+/g, ' ').replace(/\s*·\s*/g, ' · ').trim();

/** The Word export's line under the project's name. */
async function wordLine(r) {
  const doc = await renderDocx(r);
  const p = doc.paragraphs.find((q) => q.text.includes('Tidepool'));
  assert.ok(p, JSON.stringify(doc.texts));
  return p.text.split('\n')[1];
}

describe('Sidebar PDF: a project\'s technologies and link share one line, as Word prints it (R4-DOUT-04)', () => {
  it('"Reactx · link" on one line, the text Word prints', async () => {
    const r = sidebar({ technologies: 'Reactx', url: URL });
    const line = await pdfLine(r, 'Reactx');
    assert.equal(joined(line), `Reactx · ${URL}`, `the link is on the technologies' line: ${JSON.stringify(line)}`);
    assert.equal(await wordLine(r), joined(line));
  });

  it('centred: the same one line', async () => {
    const r = sidebar({ technologies: 'Reactx', url: URL }, { alignment: 'center' });
    assert.equal(joined(await pdfLine(r, 'Reactx')), `Reactx · ${URL}`);
  });

  it('only one of the two: alone on its line, no separator', async () => {
    const link = sidebar({ url: URL });
    assert.equal(joined(await pdfLine(link, 'tidepool')), URL);
    assert.equal(await wordLine(link), URL);
    const tech = sidebar({ technologies: 'Reactx' });
    assert.equal(joined(await pdfLine(tech, 'Reactx')), 'Reactx');
    assert.equal(await wordLine(tech), 'Reactx');
  });
});
