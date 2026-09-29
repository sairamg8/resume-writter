// R4-SW-W-01: Modern's banner in Word (wordExportHeader.js headerBand) took the space after its last
// line of text (the contacts' 4 pt, a stacked title's 3 pt, the name's 2 pt, the summary's 1 pt) off
// Banner top & bottom with a negative cell margin, which frameTable clamps at 0: set under that space
// (down to 0, headerSpacing.js), the rest stayed in the shaded cell as fill under the text, where the
// PDF's banner ends exactly Banner top & bottom under it. Now the paragraph's space after is cut to the
// padding, so what is under the band's last line — its space after plus the cell's bottom margin — is
// Banner top & bottom at every value. The Sidebar's band (15 pt, fixed) never reached it. Fictional data.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, readDocx, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const NAME = 'Pat Sample';
const cv = (settings = {}, personal = {}) => resume({
  template: 'modern',
  settings,
  personal: { name: NAME, title: 'Staff Engineer', email: 'pat@example.com', phone: '+1 555 0100', summary: '', hiddenFields: [], ...personal },
  sections: [experience([{}])],
});

async function docx(r) {
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderResumeDocx(r)).arrayBuffer()));
}

/** The first table's rows of cells: each cell's bottom margin and its last paragraph's space after, twips. */
function bandRows(xml) {
  const tbl = /<w:tbl>(.*?)<\/w:tbl>/s.exec(xml)?.[1] || '';
  assert.ok(tbl.includes(`>${NAME}`), 'the header is on its band');
  return [...tbl.matchAll(/<w:tr>(.*?)<\/w:tr>/gs)].map(([, tr]) => [...tr.matchAll(/<w:tc>(.*?)<\/w:tc>/gs)].map(([, tc]) => {
    const mar = /<w:tcMar>(.*?)<\/w:tcMar>/s.exec(tc)?.[1] || '';
    const paras = tc.split(/<w:p[ >]/).slice(1);
    const spacing = paras.at(-1)?.match(/<w:spacing\b[^>]*\/>/)?.[0] || '';
    return {
      bottom: Number(/<w:bottom w:type="dxa" w:w="(-?\d+)"\/>/.exec(mar)?.[1] ?? 0),
      after: Number(/w:after="(\d+)"/.exec(spacing)?.[1] ?? 0),
    };
  }));
}
/** What prints under the band's last line: the space after it and the cell's margin under it, twips. */
const under = (xml) => {
  const last = bandRows(xml).at(-1).at(-1);
  return last.after + last.bottom;
};

describe('Word: Modern\'s banner ends Banner top & bottom under its last line, at any value (R4-SW-W-01)', () => {
  // Banner top & bottom is stored in px (× 0.75 pt): 2 px is 1.5 pt, 30 twips.
  it('under the contacts: 0, 1.5 pt and the 15 pt default', async () => {
    for (const [pad, want] of [[0, 0], [2, 30], [undefined, 300]]) {
      const { xml } = await docx(cv(pad == null ? {} : { headerPadY: pad }));
      assert.equal(under(xml), want, `Banner top & bottom ${pad ?? 'unset'}`);
    }
  });

  it('under a stacked title or the name, with no contacts', async () => {
    const { xml: title } = await docx(cv({ headerPadY: 0 }, { email: '', phone: '' }));
    assert.equal(under(title), 0, 'the title');
    const { xml: name } = await docx(cv({ headerPadY: 1 }, { title: '', email: '', phone: '' }));
    assert.equal(under(name), 15, 'the name, at 0.75 pt');
  });

  it('under the summary on the banner', async () => {
    const { xml } = await docx(cv({ headerPadY: 0 }, { summary: '<p>Summarising ten years</p>' }));
    assert.equal(under(xml), 0);
  });
});
