import { AlignmentType, Document, Footer, Header, Packer, PageNumber, Paragraph, TextRun } from 'docx';
import { accent2Hex, bulletNumbering, wordMargins } from '@/utils/wordExportUtils';
import { buildSection, sectionSpaceAfter } from '@/utils/wordExportBuilders';
import { buildPersonalSection } from '@/utils/wordExportHeader';
import { buildCoverLetter } from '@/utils/wordExportCoverLetter';
import { withWordPhoto } from '@/utils/wordExportPhoto';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { downloadBlob } from '@/utils/download';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { templateId } from '@/constants/templates';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { entryInk } from '@/utils/wordExportLook';
import { FONTS } from '@/utils/fonts';
import { RUNNING_HEADER_PT, runningHeaderLead, runningHeaderTop } from '@/constants/runningHeader';
import { textShades } from '@/templates/pdf/shared/pdfColors';

export function resolveWordFont(settings = {}) {
  if (settings?.customFont?.trim()) return settings.customFont.trim();
  const fontObj = FONTS.find((f) => f.id === settings?.font);
  return fontObj?.label || fontObj?.name || 'Noto Sans';
}

/** The least bottom margin, twips, that holds the page-number footer: the PDF's 10 mm (bottomMarginMm). */
const PAGE_NUMBER_ROOM = Math.round((10 * 1440) / 25.4);
const PAGE_NUMBER_SIZE = 16; // half-points: the PDF's 8 pt

/**
 * Design → Page numbers in Word (R2-147): "Page 1 of 2" in the page's footer at the right margin,
 * Word's own page and page-count fields, in the Text colour's meta grey as the PDF prints it.
 */
function pageNumberFooter(settings, template) {
  const color = entryInk(resolveTemplateSettings(settings, templateId(template)), templateId(template)).meta;
  const run = { size: PAGE_NUMBER_SIZE, color };
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ ...run, children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES] })],
    })],
  });
}

/**
 * The résumé's running header, as its PDF prints it (ATS-7, constants/runningHeader.js): "Name · Page N"
 * flush right in the top margin of every page after the first — the section's default header, with none
 * on its first page (titlePage). Null where the margin has no room for it, as in the PDF.
 */
function runningHeader(name, color, margin) {
  const top = runningHeaderTop((margin.v * 25.4) / 1440);
  if (top == null) return null;
  const run = { size: RUNNING_HEADER_PT * 2, color: textShades(color || '#111111').meta.replace('#', '') };
  return {
    distance: Math.round(top * 20),
    header: new Header({
      children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ ...run, text: runningHeaderLead(name) }), new TextRun({ ...run, children: [PageNumber.CURRENT] })],
      })],
    }),
  };
}

/**
 * A one-section document on the résumé's paper (A4 or US Letter, PAR-01), in Design → Spacing's page
 * margins (wordMargins, R2-062) — the résumé's and its letter's, as their PDFs print them — with the
 * bullets of Design → Lists (bulletNumbering, R2-147). `pageNumbers` (the résumé's Design → Page
 * numbers, R2-147; never the letter's): a footer with them, set in the middle of a bottom margin of at
 * least the PDF's room for it, as the PDF prints it. `running`: the résumé's name and Text colour, for its
 * running header (ATS-7; the letter has none).
 */
function buildDocument(children, settings, { pageNumbers = false, template, running = null } = {}) {
  const font = resolveWordFont(settings);
  const margin = wordMargins(settings);
  const rh = running && runningHeader(running.name, running.color, margin);
  const bottom = pageNumbers ? Math.max(margin.v, PAGE_NUMBER_ROOM) : margin.v;
  // The footer's distance from the paper's edge: its line centred in the bottom margin.
  const footerAt = Math.max(0, Math.round((bottom - PAGE_NUMBER_SIZE * 10 * 1.2) / 2));
  const baseSize = Math.round((settings?.fontSizeBase ?? 11) * 2);
  return new Document({
    styles: {
      default: {
        document: {
          run: { font, size: baseSize },
          paragraph: { spacing: { after: 40 } },
        },
        // Section titles are Heading 1 (sectionHeading, ATS-6); this replaces docx's own Heading 1
        // (2E74B5, 16 pt). It sets only outline level 1 and the document font: every visible
        // property of a title is its direct formatting, so the page looks as it did. Measured in
        // LibreOffice, which maps Heading 1 onto its own heading style:
        // - the font is here because a Heading 1 naming none prints in LibreOffice's heading font
        //   (Liberation Sans);
        // - it is based on no style: based on the "Normal" this file does not define, it inherits
        //   LibreOffice's "Heading", whose sans-serif class then picks the stand-in for a font the
        //   reader has not installed (Inter, Roboto, a Custom font…) — a sans where the body text
        //   around it gets a serif. Word resolves both from docDefaults either way.
        heading1: { basedOn: undefined, run: { font }, paragraph: { outlineLevel: 0 } },
      },
    },
    numbering: { config: bulletNumbering(settings?.bulletStyle) },
    sections: [{
      properties: {
        ...(rh ? { titlePage: true } : {}),
        page: {
          size: PAGE_SIZES[pageSizeOf(settings)].twips,
          margin: {
            top: margin.v, right: margin.h, bottom, left: margin.h,
            ...(rh ? { header: rh.distance } : {}), ...(pageNumbers ? { footer: footerAt } : {}),
          },
        },
      },
      ...(rh ? { headers: { default: rh.header } } : {}),
      // With a running header the first page is a title page (no header): its footer is the others' too.
      ...(pageNumbers ? { footers: { default: pageNumberFooter(settings, template), ...(rh ? { first: pageNumberFooter(settings, template) } : {}) } } : {}),
      children,
    }],
  });
}

/** The résumé as a .docx Blob — same sections, entries and hidden fields as the PDF. */
export async function renderResumeDocx(resume) {
  // The photo as the PDF export draws it: a WebP's copy, a plain URL's picture (R2-126).
  const { personal = {}, sections = [], settings = {}, template = 'classic' } = (await withWordPhoto(resume)) || {};
  const accentHex = accent2Hex(settings.accentColor);
  const effectiveTemplate = (templateId(template) === 'sidebar' && settings.sidebarSingleColumn) ? 'classic' : template;
  // Template defaults (e.g. Executive and Sidebar lead with the role, …) apply as in the PDF, and
  // so does Section Options → Alignment (never in the Sidebar's side column). A section's defaults and
  // its entries' look are the résumé's own template's in every Layout: the Sidebar's Single · ATS-safe
  // prints Classic's page and header (effectiveTemplate), no side column (buildSection reads the
  // Layout), but still leads a job with the role (R2-012) and prints its dates in grey and its second
  // field in the accent, as its PDF does (R2-121).
  const own = templateId(template);
  const printed = sections
    .map((s) => resolveSection(s, own))
    .map((section) => ({ section, paras: buildSection(section, accentHex, settings, own) }))
    .filter(({ paras }) => paras.length);
  // The header is Classic's, in the Sidebar's Text colour: its PDF resolves the page's settings as the
  // Sidebar's, so an unset Text colour prints the name and contacts in its slate, not Classic's black.
  const headerSettings = effectiveTemplate === template ? settings
    : { ...settings, textColor: resolveTemplateSettings(settings, own).textColor };
  const children = [
    ...buildPersonalSection(personal, headerSettings, effectiveTemplate),
    // Between Sections under every section but the last, as the PDF's: space under the last one
    // could only push a blank page (R2-062).
    ...printed.flatMap(({ section, paras }, i) => (i < printed.length - 1
      ? [...paras, ...sectionSpaceAfter(section, settings, own)]
      : paras)),
  ];
  const running = { name: personal?.name, color: resolveTemplateSettings(settings, own).textColor };
  return Packer.toBlob(buildDocument(children, settings, { pageNumbers: settings.pageNumbers === true, template: own, running }));
}

export async function exportToWord(resume, filename = 'resume.docx') {
  downloadBlob(await renderResumeDocx(resume), filename);
}

/** The cover letter as a .docx Blob — the same content as the cover-letter PDF. */
export async function renderCoverLetterDocx(resume) {
  return Packer.toBlob(buildDocument(buildCoverLetter(resume), resume?.settings));
}

export async function exportCoverLetterToWord(resume, filename = 'cover-letter.docx') {
  downloadBlob(await renderCoverLetterDocx(resume), filename);
}
