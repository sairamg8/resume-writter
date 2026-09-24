// The Sidebar's Single · ATS-safe cover letter: the Word file prints every line in the colour the
// PDF (= the preview) prints it — letterhead, date, recipient, subject, body, closing, signature —
// as R2-121 requires of the résumé. Checked for an unset, the default and a navy Text colour, with a
// coloured accent; Two columns guarded.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, drawState, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

const LETTER = {
  date: '2026-01-15', recipientName: 'Sarah Smith', recipientTitle: 'Engineering Manager', company: 'Globex Corp',
  subject: 'Application for the Senior Engineer role', body: '<p>Dear Sarah,</p><p>I am excited to apply.</p>',
  closing: 'Kind regards', signatureName: 'Pat Signer', signatureDesignation: 'Staff Engineer',
};
/** A word of each line, as both files print it. */
const LINES = ['Sample', 'Engineer', 'pat@example.com', 'January', 'Sarah Smith', 'Manager', 'Globex', 'Application', 'Dear', 'excited', 'Kind', 'Signer', 'Staff'];

const letter = (settings) => resume({
  template: 'sidebar',
  settings: { accentColor: '#e11d48', ...settings },
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100' },
  coverLetter: LETTER,
});

/** Each line's colour in the PDF letter, opaque on the page. */
async function pdfInks(r) {
  const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const bytes = await renderCover(r);
  const out = {};
  for (const w of LINES) {
    const [hit] = await drawState(bytes, w);
    out[w] = hit ? solid(hit.fill, hit.alpha).toLowerCase() : null;
  }
  return out;
}

/** Each line's colour in the Word letter. */
async function wordInks(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  const { xml } = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  const runs = xml.split('</w:r>');
  const out = {};
  for (const w of LINES) {
    const run = runs.find((x) => new RegExp(`<w:t[^>]*>[^<]*${w}`).test(x));
    out[w] = run ? `#${(/<w:color w:val="([0-9a-fA-F]{6})"/.exec(run)?.[1] || '000000').toLowerCase()}` : null;
  }
  return out;
}

describe('the Sidebar Single · ATS-safe letter prints in the same colours in Word as in the PDF', () => {
  for (const [label, extra] of [['unset Text colour', { textColor: undefined }], ['default Text colour', {}], ['navy Text colour', { textColor: '#1e3a8a' }]]) {
    for (const single of [true, false]) {
      it(`${single ? 'Single · ATS-safe' : 'Two columns (guard)'}, ${label}`, async () => {
        const r = letter({ sidebarSingleColumn: single, ...extra });
        if ('textColor' in extra && extra.textColor === undefined) delete r.settings.textColor;
        const [pdf, word] = [await pdfInks(r), await wordInks(r)];
        assert.deepEqual(LINES.filter((w) => !pdf[w] || !word[w]), [], 'every line prints in both');
        const differ = LINES.filter((w) => pdf[w] !== word[w]).map((w) => `${w}: pdf ${pdf[w]} ≠ word ${word[w]}`);
        assert.deepEqual(differ, []);
      });
    }
  }
});
