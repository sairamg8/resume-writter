// Section Options → Title in the Word résumé (R2-070, R2-061). The PDF lays an entry's header out in
// the section's Title — "Stacked" (every template's default but Executive's and the Timeline's): the
// first field with the date, the second field on the line under it with the location; "Inline": "first
// — second" on one line; "Side by side": both on one line, apart — while Word printed every entry
// Inline, whatever the section stored. Checked against the PDF itself: the second field shares the
// first's line in Word exactly where it does in the PDF, on every template, in each Title and both
// alignments.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

/** Each section whose Section Options offer a Title, one entry: its first and second field. */
const TYPES = {
  experience: { fields: ['Acmecorp', 'Leadengineer'], item: { company: 'Acmecorp', role: 'Leadengineer', location: 'Springfield', startDate: '01/2011', endDate: '12/2012', description: '<p>Shipped things.</p>' } },
  education: { fields: ['Stateuni', 'Bachelorarts'], item: { institution: 'Stateuni', degree: 'Bachelorarts', location: 'Riverton', startDate: '2005', endDate: '2009' } },
  volunteering: { fields: ['Helperrole', 'Charityorg'], item: { role: 'Helperrole', org: 'Charityorg', location: 'Lakeside', startDate: '2014', endDate: '2015' } },
  custom: { fields: ['Customtitle', 'Customsub'], item: { title: 'Customtitle', subtitle: 'Customsub', location: 'Hillview', date: '2016' } },
};
/** The Sidebar's side column prints its own layout, no Title to choose (SIDEBAR_COLUMN_TYPES). */
const SIDE = ['education'];

const cv = (template, settings) => resume({
  template,
  personal: { name: 'Robin Sample', title: 'Engineer' },
  sections: Object.entries(TYPES).map(([type, { item }]) => section(type, [item], settings, type === 'custom' ? { title: 'Extra' } : {})),
});

/** Does the PDF print `b` on `a`'s line: their baselines less than a few points apart. */
function pdfSameLine(items, a, b) {
  const [ya, yb] = [a, b].map((w) => items.find((t) => t.str.includes(w))?.y);
  assert.ok(ya != null && yb != null, `"${a}" and "${b}" in the PDF`);
  return Math.abs(ya - yb) < 3;
}

/** Does Word print `b` on `a`'s line: no line break between them in the paragraph that holds `a`. */
function wordSameLine(texts, a, b) {
  const para = texts.find((t) => t.includes(a));
  assert.ok(para?.includes(b), `"${a}" and "${b}" in one paragraph: ${JSON.stringify(para)}`);
  const lines = para.split('\n');
  return lines.findIndex((l) => l.includes(a)) === lines.findIndex((l) => l.includes(b));
}

describe('Word: an entry\'s header follows Section Options → Title, as the PDF lays it out (R2-070)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the second field shares the first's line in Word where it does in the PDF — unset, Stacked, Inline, Side by side; left and centred`, async () => {
      const wrong = [];
      for (const titleStyle of [undefined, 'stacked', 'inline', 'sidebyside']) {
        for (const alignment of ['left', 'center']) {
          const r = cv(template, { ...(titleStyle ? { titleStyle } : {}), alignment });
          const items = allItems(await read(await render(r)));
          const { texts } = await renderDocx(r);
          for (const [type, { fields: [a, b] }] of Object.entries(TYPES)) {
            if (template === 'sidebar' && SIDE.includes(type)) continue;
            const [pdf, word] = [pdfSameLine(items, a, b), wordSameLine(texts, a, b)];
            if (pdf !== word) wrong.push(`${template} ${titleStyle || 'unset'} ${alignment} ${type}: PDF ${pdf ? 'one line' : 'two lines'}, Word ${word ? 'one line' : 'two lines'}`);
          }
        }
      }
      assert.deepEqual(wrong, []);
    });
  }

  it('Classic: Stacked puts the role under the company with the location, Inline joins them with " — ", Side by side sets them apart', async () => {
    const line = async (titleStyle) => (await renderDocx(cv('classic', { titleStyle }))).texts.find((t) => t.includes('Acmecorp'));
    assert.equal(await line('stacked'), 'Acmecorp\t01/2011 – 12/2012\nLeadengineer\tSpringfield');
    assert.equal(await line('inline'), 'Acmecorp — Leadengineer\t01/2011 – 12/2012\n\tSpringfield');
    assert.equal(await line('sidebyside'), 'Acmecorp Leadengineer\t01/2011 – 12/2012\n\tSpringfield');
  });

  it('Stacked without a location or a second field: no empty line, no stray tab', async () => {
    const texts = async (item) => (await renderDocx(resume({ sections: [section('experience', [{ startDate: '01/2011', endDate: '12/2012', ...item }], { titleStyle: 'stacked' })] }))).texts;
    assert.ok((await texts({ company: 'Acmecorp', role: 'Leadengineer' })).includes('Acmecorp\t01/2011 – 12/2012\nLeadengineer'));
    assert.ok((await texts({ company: 'Acmecorp', location: 'Springfield' })).includes('Acmecorp\t01/2011 – 12/2012\n\tSpringfield'));
    assert.ok((await texts({ company: 'Acmecorp' })).includes('Acmecorp\t01/2011 – 12/2012'));
  });
});
