// R4-DOUT-09: the cover letter's job title prints in the weight its résumé's header prints it in.
// Banner, Timeline, Compact and the designed layouts print the title medium (fontWeight 500) stacked
// and Inline, Classic, Minimal and Executive medium only Inline, Academic regular italic both ways —
// the letter printed it regular under the name everywhere and medium Inline everywhere
// (letterheadLook's title.weight, CoverLetterHeaderPDF.jsx).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const make = (template, headerLayout) => resume({
  template,
  settings: { headerLayout },
  personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com', hiddenFields: [] },
  coverLetter: { body: '<p>Dear Sarah,</p>', date: '2026-01-15' },
});

/** A run's font without its per-document subset prefix ("ABCDEF+NotoSans-Medium" → "NotoSans-Medium"). */
const face = (t) => t.font.replace(/^[A-Z]{6}\+/, '');

/** The header's title run: the topmost "Engineer" on page 1 (a signature's designation sits lower). */
async function titleFace(bytes) {
  const [page] = await read(bytes);
  const runs = page.items.filter((t) => t.str.includes('Engineer'));
  assert.ok(runs.length, 'the title prints');
  return face(runs.reduce((top, t) => (t.y > top.y ? t : top)));
}

describe("the letter's job title in its résumé's weight (R4-DOUT-09)", () => {
  for (const headerLayout of ['stack', 'inline']) {
    it(`${headerLayout}: every template's letter prints the title in the résumé header's font`, async () => {
      for (const template of TEMPLATES) {
        const cv = await titleFace(await render(make(template, headerLayout)));
        const cl = await titleFace(await renderCover(make(template, headerLayout)));
        assert.equal(cl, cv, `${template} ${headerLayout}: the letter's title in ${cl}, the résumé's in ${cv}`);
      }
    });
  }

  it('the named cases: Banner, Gridline and Compact stacked print it medium, Classic stacked and Academic Inline regular', async () => {
    const letter = async (template, headerLayout) => titleFace(await renderCover(make(template, headerLayout)));
    for (const template of ['banner', 'gridline', 'compact', 'timeline']) {
      assert.match(await letter(template, 'stack'), /Medium/, `${template} stack`);
    }
    assert.doesNotMatch(await letter('classic', 'stack'), /Medium/, 'classic stack');
    assert.match(await letter('classic', 'inline'), /Medium/, 'classic inline');
    assert.doesNotMatch(await letter('academic', 'inline'), /Medium/, 'academic inline');
  });
});
