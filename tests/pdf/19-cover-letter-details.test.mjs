// Cover-letter details from reviews R1 and R9: the closing's comma, impossible dates, an empty
// body, the signature kept with its closing, and the Text colour on every line — PDF and Word
// alike.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, read, allItems, allText, drawState, loadModule, readDocx, MM, TEMPLATES } from './harness.mjs';
import { contrast, solid, textShades } from '../../src/templates/pdf/shared/pdfColors.js';
import { painted, PNG_2X2 as PNG } from './extractors.mjs';

before(setup);
after(teardown);

async function coverDocx(r) {
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  return readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
}
const letter = (coverLetter, settings = {}) => resume({ settings, coverLetter: { body: '<p>Hello</p>', ...coverLetter } });
/** The colour of the Word run that prints `text`, as 'rrggbb'. */
const colourOf = (xml, text) => (xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '').match(/<w:color w:val="([0-9A-Fa-f]{6})"/)?.[1]?.toLowerCase();

describe('the closing (R1-7, R9-9)', () => {
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

  // A closing that ends in punctuation of its own got our comma after it: 'Thank you!' printed
  // 'Thank you!,', 'Regards.' 'Regards.,', and a CJK or Arabic comma a second, Latin one (R9-9).
  it('a closing that ends in its own punctuation gets no comma, in the PDF and in Word', async () => {
    for (const [closing, printed] of [['Thank you!', 'Thank you!'], ['Regards.', 'Regards.'], ['With thanks…', 'With thanks…'], ['Thank you!, ', 'Thank you!']]) {
      const r = letter({ closing });
      const pdf = allText(await read(await renderCover(r)));
      assert.ok(pdf.includes(printed) && !pdf.includes(`${printed},`), `${JSON.stringify(closing)}: ${pdf}`);
      assert.ok((await coverDocx(r)).texts.includes(printed), `Word: ${JSON.stringify(closing)}`);
    }
    const { letterSignature } = await loadModule('/src/utils/coverLetter.js');
    for (const closing of ['此致，', '敬具。', 'مع التحية،', 'Cordialement :', 'Why not?', 'Yours;']) {
      assert.equal(letterSignature({ closing }).closing, closing, closing);
    }
    // A bracket, a quote or an emoji ends no clause: the comma follows it, as it would in a letter.
    for (const closing of ['Best regards (Pat)', 'Cheers 🙂']) assert.equal(letterSignature({ closing }).closing, `${closing},`, closing);
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
  // Walking marginV across the page break in 0.5 mm steps moves the page bottom through the
  // signature block in small increments (~1.4 pt), covering both split windows: designation
  // orphan (name | designation) and headline R1-6 orphan (closing | name) (W2a-4.2).
  it('walking across the page break, "Sincerely,", name and designation stay together', async () => {
    const para = '<p>I led the migration of our billing platform and shipped the new onboarding flow, working closely with design and support.</p>';
    let reachedBreak = false;
    for (let mv = 16; mv <= 21; mv += 0.5) {
      const r = letter({
        body: para.repeat(38),
        signatureName: 'Pat Signer',
        signatureDesignation: 'Engineer',
        signatureSpace: 'wide',
      }, { marginV: mv });
      const pages = await read(await renderCover(r));
      const items = allItems(pages);
      const page = (s) => items.find((t) => t.str.includes(s))?.page;
      const sincPage = page('Sincerely');
      const namePage = page('Pat Signer');
      const desigPage = items.findLast((t) => t.str.includes('Engineer'))?.page;
      assert.equal(sincPage, namePage, `marginV ${mv}mm: closing and name split`);
      assert.equal(namePage, desigPage, `marginV ${mv}mm: name and designation split`);
      const bodyItems = items.filter((t) => t.str.includes('billing platform'));
      const lastBodyPage = bodyItems[bodyItems.length - 1]?.page;
      if (sincPage > lastBodyPage) reachedBreak = true;
    }
    assert.ok(reachedBreak, 'the walk proved the signature block broke cleanly to a new page as a unit');
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
    const grey = textShades(textColor).sub; // the résumé header's contacts' shade (R9-13)
    const r = resume({
      settings: { textColor },
      personal: { name: 'Pat Sample', email: 'pat@example.com' },
      coverLetter: { body: '<p>Hello</p>', recipientName: 'Sarah Smith', signatureName: 'Pat Signer', signatureDesignation: 'Staff Engineer', hiddenFields: [] },
    });
    const bytes = await renderCover(r);
    for (const needle of ['Pat Sample', 'Sarah Smith', 'Pat Signer']) assert.equal((await drawState(bytes, needle))[0]?.fill, textColor, needle);
    for (const needle of ['pat@example.com', 'Staff Engineer']) assert.equal((await drawState(bytes, needle))[0]?.fill, grey, needle);
    const { xml } = await coverDocx(r);
    for (const text of ['Pat Sample', 'Sarah Smith', 'Pat Signer']) assert.equal(colourOf(xml, text), textColor.slice(1), `Word ${text}`);
    assert.equal(colourOf(xml, 'Staff Engineer'), grey.slice(1), 'Word designation');
  });

  // Word read the stored Text colour with a fallback of its own, the PDF the resolved one: a
  // résumé that stores none (an import, older data) printed the template's default in the PDF and
  // #1e293b in Word (R9-0; fixed by f059a96, this pins it). A translucent colour's designation
  // grey came from Word's rounded hex, a shade off the PDF's. Word has no opacity: a translucent
  // PDF run is compared as it shows on the white page.
  it('a résumé that stores no Text colour, or a short or translucent one: Word prints the PDF\'s colours, in every template', async () => {
    const runs = ['Pat Sample', 'pat@example.com', 'Sarah Smith', 'Hello', 'Pat Signer', 'Staff Engineer'];
    for (const template of TEMPLATES) {
      for (const textColor of [undefined, '#abc', '#11111180']) {
        const r = resume({
          template,
          personal: { name: 'Pat Sample', email: 'pat@example.com', hiddenFields: [] },
          coverLetter: { body: '<p>Hello</p>', recipientName: 'Sarah Smith', signatureName: 'Pat Signer', signatureDesignation: 'Staff Engineer', hiddenFields: [] },
        });
        if (textColor) r.settings.textColor = textColor;
        else delete r.settings.textColor;
        const bytes = await renderCover(r);
        const { xml } = await coverDocx(r);
        for (const text of runs) {
          const { fill, alpha } = (await drawState(bytes, text))[0];
          assert.equal(`#${colourOf(xml, text)}`, solid(fill, alpha), `${template}, Text colour ${textColor}: "${text}"`);
        }
      }
    }
  });
});

/** The Text colours the Design panel offers (DesignPanelColors.jsx): Near Black, Dark Gray, Slate, Ink. */
const TEXT_PRESETS = ['#1a1a1a', '#374151', '#334155', '#1e293b'];

/** The colours page 1's contact icons are painted in: every shape under 12 pt (a rule is wider). */
const iconColours = async (bytes) => [...new Set((await painted(bytes))
  .filter((p) => (p.paint === 'fill' || p.paint === 'stroke') && p.x1 - p.x0 < 12 && p.y1 - p.y0 < 12)
  .map((p) => p.colour))];

describe('the letter\'s greys read, and match the résumé\'s header (R9-13)', () => {
  // The letter printed its contacts, their icons and the designation in the Text colour's
  // lightest reading grey (textShades().meta): 3.3:1 on white at Dark Gray and Slate, 4.0:1 at Ink
  // and at Modern's and the Sidebar's default Text colours, below WCAG AA's 4.5:1 — and a shade
  // lighter than the résumé's own header prints its contacts (sub), where the letterhead takes
  // the résumé header's colours (FIDB-51). On Modern's and the Sidebar's band the contacts take
  // the band's colours (21-cover-letter-looks); the designation is on the paper in every look.
  it('at every Text colour preset and each template\'s default: the résumé header\'s colour, ≥ 4.5:1 on white — PDF and Word', async () => {
    const fillOf = async (bytes, text) => (await drawState(bytes, text))[0]?.fill;
    for (const template of TEMPLATES) {
      for (const textColor of [...TEXT_PRESETS, undefined]) {
        const at = `${template}, Text colour ${textColor ?? 'unset'}`;
        const r = resume({
          template,
          personal: { name: 'Pat Sample', email: 'pat@example.com', hiddenFields: [] },
          coverLetter: { body: '<p>Hello</p>', signatureName: 'Pat Signer', signatureDesignation: 'Staff Engineer', hiddenFields: [] },
        });
        if (textColor) r.settings.textColor = textColor;
        else delete r.settings.textColor;
        const bytes = await renderCover(r);
        const { xml } = await coverDocx(r);
        const onPaper = [['designation', await fillOf(bytes, 'Staff Engineer'), `#${colourOf(xml, 'Staff Engineer')}`]];
        if (!['modern', 'sidebar'].includes(template)) {
          const cv = await render(r);
          const email = await fillOf(bytes, 'pat@example.com');
          assert.equal(email, await fillOf(cv, 'pat@example.com'), `${at}: the contacts in the résumé header's colour`);
          assert.deepEqual(await iconColours(bytes), await iconColours(cv), `${at}: the icons in the résumé header's colour`);
          onPaper.push(['contacts', email, `#${colourOf(xml, 'pat@example.com')}`]);
        }
        for (const [what, pdf, word] of onPaper) {
          assert.ok(contrast(pdf) >= 4.5, `${at}: the ${what} at ${contrast(pdf).toFixed(2)}:1 (${pdf})`);
          assert.ok(contrast(word) >= 4.5, `${at}: Word's ${what} at ${contrast(word).toFixed(2)}:1 (${word})`);
        }
      }
    }
  });
});
