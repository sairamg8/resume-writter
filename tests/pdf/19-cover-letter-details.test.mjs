// Cover-letter details from review R1: the closing's comma, impossible dates, an empty body,
// the signature kept with its closing, and the Text colour on every line — PDF and Word alike.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, renderCover, read, allItems, allText, drawState, loadModule, readDocx, MM, TEMPLATES } from './harness.mjs';
import { textShades } from '../../src/templates/pdf/shared/pdfColors.js';
import { PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

async function coverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}
const letter = (coverLetter, settings = {}) => resume({ settings, coverLetter: { body: '<p>Hello</p>', ...coverLetter } });

describe('the closing (R1-7)', () => {
  it('a closing typed with its comma prints one comma, in the PDF and in Word', async () => {
    for (const closing of ['Best regards,', 'Best regards', 'Best regards , ', 'Best regards,,']) {
      const r = letter({ closing });
      const pdf = allText(await read(await renderCover(r)));
      assert.ok(pdf.includes('Best regards,') && !pdf.includes('Best regards,,') && !pdf.includes(' ,'), `${JSON.stringify(closing)}: ${pdf}`);
      assert.ok((await coverDocx(r)).texts.includes('Best regards,'), JSON.stringify(closing));
    }
    const { letterSignature } = await loadModule('/src/utils/coverLetter.js');
    assert.equal(letterSignature({ closing: ' , ' }).closing, 'Sincerely,', 'nothing but a comma is no closing');
  });
});

describe('the date line (R1-12)', () => {
  it('prints a real date spelled out, and a date that does not exist exactly as typed', async () => {
    const { letterDate } = await loadModule('/src/utils/coverLetter.js');
    assert.equal(letterDate('2024-02-29'), '29 February 2024');
    assert.equal(letterDate('2026-01-15'), '15 January 2026');
    for (const typed of ['2026-02-31', '2025-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-06-00']) {
      assert.equal(letterDate(typed), typed, typed);
    }
  });
});

describe('an empty body (R1-11)', () => {
  it('an editor left with an empty paragraph prints no gap, and the preview still shows the writing hint', async () => {
    const closingY = async (body, opts) => allItems(await read(await renderCover(letter({ body }), opts))).find((t) => t.str.includes('Sincerely')).y;
    assert.equal(await closingY('<p><br></p>'), await closingY(''), 'the closing sits where it sits without a body');
    const preview = allText(await read(await renderCover(letter({ body: '<p><br></p>' }), { preview: true })));
    assert.ok(preview.includes('Start writing your cover letter'), preview);
  });
});

describe('the signature stays with its closing (R1-6)', () => {
  it('whatever the body\'s length, "Sincerely," and the name are on the same page', async () => {
    const para = '<p>I led the migration of our billing platform and shipped the new onboarding flow, working closely with design and support.</p>';
    let split = 0;
    for (let n = 24; n <= 44; n += 1) {
      const pages = await read(await renderCover(letter({ body: para.repeat(n), signatureName: 'Pat Signer', signatureDesignation: 'Engineer' })));
      const items = allItems(pages);
      const page = (s) => items.find((t) => t.str.includes(s))?.page;
      if (page('Sincerely') !== page('Pat Signer') || page('Pat Signer') !== items.findLast((t) => t.str.includes('Engineer'))?.page) split += 1;
    }
    assert.equal(split, 0, `${split} body lengths split the closing from the signature`);
  });
});

describe('a long title in the default header, contacts on the right', () => {
  // The name side kept its one-line width and the contacts got what was left: from a title of
  // about 60 characters they ran past the right margin (off the paper without a photo), and
  // from about 85, with a photo and icon contacts, the letter did not render at all — react-pdf
  // threw "unsupported number: Infinity" drawing an icon in a column of no width.
  const T72 = 'Senior Software Engineer, Platform Infrastructure & Developer Experience';
  const CONTACTS = { email: 'alexandra.johnson@example.com', phone: '+1 555 0100', location: 'San Francisco, CA', website: 'alexjohnson.dev', linkedin: 'linkedin.com/in/alexj' };

  it('the title wraps beside the photo and the contacts keep a column of their own, inside the margin', async () => {
    for (const title of [T72, `${T72} and Payments`, `${T72}: Payments, Risk and Fraud Detection Platform Group`]) {
      for (const photo of [PNG, '']) {
        for (const contactStyle of ['icon', 'bar']) {
          const r = resume({ settings: { contactStyle }, personal: { name: 'Alexandra Johnson', title, photo, ...CONTACTS }, coverLetter: { body: '<p>Hello</p>' } });
          const at = `${title.length} characters, ${photo ? 'photo' : 'no photo'}, ${contactStyle}`;
          const pages = await read(await renderCover(r).catch((e) => assert.fail(`${at}: ${e.message}`)));
          const right = pages[0].W - 18 * MM; // the default 18 mm margin
          assert.deepEqual(pages[0].items.filter((t) => t.x + t.w > right + 0.5).map((t) => t.str), [], `${at}: text past the margin`);
          const text = allText(pages).replace(/\s+/g, '');
          for (const value of [title, ...Object.values(CONTACTS)]) assert.ok(text.includes(value.replace(/\s+/g, '')), `${at}: "${value}" is printed`);
        }
      }
    }
  });

  // Below Everything put the name block beside the photo at its one-line width: from about 100
  // characters with a photo the title ran past the right margin, in every look (found with
  // FIDB-51; 0b83cb1 did it too). Below Name was never affected: a guard.
  it('Below Name and Below Everything: a long title wraps beside the photo, inside the margin, in every look', async () => {
    const title = `${T72}: Payments, Risk and Fraud Detection Platform Group`;
    for (const template of TEMPLATES) {
      for (const fieldsPosition of ['below-name', 'below-all']) {
        const at = `${template}, ${fieldsPosition}`;
        const r = resume({ template, personal: { name: 'Alexandra Johnson', title, photo: PNG, ...CONTACTS }, coverLetter: { body: '<p>Hello</p>', fieldsPosition } });
        const pages = await read(await renderCover(r));
        const right = pages[0].W - 18 * MM;
        assert.deepEqual(pages[0].items.filter((t) => t.x + t.w > right + 0.5).map((t) => t.str), [], `${at}: text past the margin`);
        assert.ok(allText(pages).replace(/\s+/g, '').includes(title.replace(/\s+/g, '')), `${at}: the whole title is printed`);
      }
    }
  });

  it('a usual title keeps its one line beside the photo (guard)', async () => {
    const r = resume({ personal: { name: 'Alexandra Johnson', title: 'Senior Software Engineer', photo: PNG, ...CONTACTS }, coverLetter: { body: '<p>Hello</p>' } });
    const items = allItems(await read(await renderCover(r)));
    for (const s of ['Alexandra Johnson', 'Senior Software Engineer']) assert.ok(items.some((t) => t.str === s), `"${s}" on one line`);
  });
});

describe('the Text colour reaches every line of the letter (R1-13)', () => {
  it('names in the Text colour, contacts and the designation in its grey — PDF and Word', async () => {
    const textColor = '#1e3a8a';
    const meta = textShades(textColor).meta;
    const r = resume({
      settings: { textColor },
      personal: { name: 'Pat Sample', email: 'pat@example.com' },
      coverLetter: { body: '<p>Hello</p>', recipientName: 'Sarah Smith', signatureName: 'Pat Signer', signatureDesignation: 'Staff Engineer', hiddenFields: [] },
    });
    const bytes = await renderCover(r);
    for (const needle of ['Pat Sample', 'Sarah Smith', 'Pat Signer']) assert.equal((await drawState(bytes, needle))[0]?.fill, textColor, needle);
    for (const needle of ['pat@example.com', 'Staff Engineer']) assert.equal((await drawState(bytes, needle))[0]?.fill, meta, needle);
    const { xml } = await coverDocx(r);
    const colourOf = (text) => (xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '').match(/<w:color w:val="([0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase();
    for (const text of ['Pat Sample', 'Sarah Smith', 'Pat Signer']) assert.equal(colourOf(text), textColor.slice(1), `Word ${text}`);
    assert.equal(colourOf('Staff Engineer'), meta.slice(1), 'Word designation');
  });
});
