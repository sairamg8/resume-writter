import { AlignmentType, Document, Footer, Header, Packer, PageNumber, Paragraph, Table, TableBorders, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx';
import { accent2Hex, bulletNumbering, gapPara, twips, wordMargins, xmlSafe } from '@/utils/wordExportUtils';
import { buildSection, sectionSpaceAfter } from '@/utils/wordExportBuilders';
import { buildPersonalSection } from '@/utils/wordExportHeader';
import { buildCoverLetter } from '@/utils/wordExportCoverLetter';
import { withWordPhoto } from '@/utils/wordExportPhoto';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { withHiddenFieldsEmptied } from '@/utils/entryPrints';
import { downloadBlob } from '@/utils/download';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { inMixedColumns, templateId } from '@/constants/templates';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { entryInk } from '@/utils/wordExportLook';
import { resolveWordFont, wordFontTable } from '@/utils/wordFonts';
import { RUNNING_HEADER_PT, runningHeaderLead, runningHeaderTop } from '@/constants/runningHeader';
import { textShades } from '@/templates/pdf/shared/pdfColors';
import { MAIN_PAD_LEFT, SIDE_PAD, getDocumentProps, sideShare } from '@/templates/pdf/shared/PdfPage';
import { getEffectiveSpacing } from '@/templates/pdf/shared/PdfSections';

export { resolveWordFont };

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
 * The .docx's File → Info properties, as the PDF's document properties (getDocumentProps): Title
 * "<Name> Resume" (the letter's "<Name> Cover Letter"), Author and Last Modified By the name, Subject
 * and Keywords. Without them docx wrote Author and Last Modified By "Un-named" and no Title
 * (R5-HUNT7-DOCX-AUTHOR-UN-NAMED).
 */
function docProps(personal, kind) {
  const pdf = getDocumentProps(personal);
  const name = personal?.name || '';
  return {
    title: name ? `${name} ${kind}` : kind,
    subject: kind,
    creator: pdf.author,
    lastModifiedBy: pdf.author,
    keywords: pdf.keywords,
  };
}

/**
 * A one-section document on the résumé's paper (A4 or US Letter, PAR-01), in Design → Spacing's page
 * margins (wordMargins, R2-062) — the résumé's and its letter's, as their PDFs print them — with the
 * bullets of Design → Lists (bulletNumbering, R2-147). `pageNumbers` (the résumé's Design → Page
 * numbers, R2-147; never the letter's): a footer with them, set in the middle of a bottom margin of at
 * least the PDF's room for it, as the PDF prints it. `running`: the résumé's name and Text colour, for its
 * running header (ATS-7; the letter has none). `personal` and `kind` ('Resume' or 'Cover Letter'): the
 * file's properties as the PDF's (docProps).
 */
function buildDocument(children, settings, { pageNumbers = false, template, running = null, personal = null, kind = 'Resume' } = {}) {
  const font = resolveWordFont(settings);
  const margin = wordMargins(settings);
  const rh = running && runningHeader(running.name, running.color, margin);
  const bottom = pageNumbers ? Math.max(margin.v, PAGE_NUMBER_ROOM) : margin.v;
  // The footer's distance from the paper's edge: its line centred in the bottom margin.
  const footerAt = Math.max(0, Math.round((bottom - PAGE_NUMBER_SIZE * 10 * 1.2) / 2));
  const baseSize = Math.round((settings?.fontSizeBase ?? 11) * 2);
  return new Document({
    ...docProps(personal, kind),
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

/** A Mixed row's cell padding on the other cell's side, twips: the PDF's (SIDE_PAD, MAIN_PAD_LEFT). */
const MIXED_PAD = { left: twips(SIDE_PAD), right: twips(MAIN_PAD_LEFT) };

/**
 * The Sidebar's Mixed short sections (`sections`, those that print, in their order) as the PDF lays them
 * out: two to a row, the first in a column the side column's width (Design → Template → Layout → Width,
 * sideShare) from the left margin, the second in the rest — a borderless table a row, as Grids prints
 * (gridTable). Each section is laid out at its cell's text width, one entry to a row (sectionLook);
 * Between Sections (each pair's larger Space after) under every row but the last. [] for none.
 */
function mixedRows(sections, accentHex, settings, template) {
  if (!sections.length) return [];
  const paper = PAGE_SIZES[pageSizeOf(settings)].twips.width;
  const side = wordMargins(settings).h;
  const left = Math.round(paper * sideShare(settings)) - side;
  const widths = [left, paper - 2 * side - left];
  const text = [widths[0] - MIXED_PAD.left, widths[1] - MIXED_PAD.right];
  const out = [];
  for (let i = 0; i < sections.length; i += 2) {
    const pair = sections.slice(i, i + 2);
    out.push(new Table({
      width: { size: widths[0] + widths[1], type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
      rows: [new TableRow({
        children: widths.map((w, c) => new TableCell({
          children: pair[c] ? buildSection(pair[c], accentHex, settings, template, { width: text[c] }) : [new Paragraph({ children: [] })],
          width: { size: w, type: WidthType.DXA },
          margins: { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: c ? MIXED_PAD.right : 0, right: c ? 0 : MIXED_PAD.left },
        })),
      })],
    }));
    if (i + 2 < sections.length) {
      const below = Math.max(...pair.map((s) => getEffectiveSpacing(s, resolveTemplateSettings(settings, template)).marginBottom));
      out.push(...gapPara(below));
    }
  }
  return out;
}

/** The résumé as a .docx Blob — same sections, entries and hidden fields as the PDF. */
export async function renderResumeDocx(resume) {
  // The photo as the PDF export draws it: a WebP's copy, a plain URL's picture (R2-126). Its text
  // without the characters XML forbids, which would leave a file Word cannot open (xmlSafe).
  const { personal = {}, sections = [], settings = {}, template = 'classic' } = (await withWordPhoto(xmlSafe(resume))) || {};
  const accentHex = accent2Hex(settings.accentColor);
  const effectiveTemplate = (templateId(template) === 'sidebar' && settings.sidebarSingleColumn) ? 'classic' : template;
  // Template defaults (e.g. Executive and Sidebar lead with the role, …) apply as in the PDF, and
  // so does Section Options → Alignment (never in the Sidebar's side column). A section's defaults and
  // its entries' look are the résumé's own template's in every Layout: the Sidebar's Single · ATS-safe
  // prints Classic's page and header (effectiveTemplate), no side column (buildSection reads the
  // Layout), but still leads a job with the role (R2-012) and prints its dates in grey and its second
  // field in the accent, as its PDF does (R2-121).
  const own = templateId(template);
  const resolved = sections.map((s) => resolveSection(withHiddenFieldsEmptied(s), own));
  // The Sidebar's Mixed layout (Design → Template → Layout, R2-147-col): its short sections print after
  // the others, two to a row (mixedRows). Every other layout prints its sections in their order: Word
  // has no side column, so Details Left, Right and Top and the column's width print the same page.
  const inRow = (section) => inMixedColumns(own, section.type, settings);
  const printed = resolved.filter((s) => !inRow(s))
    .map((section) => ({ section, paras: buildSection(section, accentHex, settings, own) }))
    .filter(({ paras }) => paras.length);
  const rows = mixedRows(resolved.filter((s) => inRow(s) && buildSection(s, accentHex, settings, own).length), accentHex, settings, own);
  // The header is Classic's, in the Sidebar's Text colour: its PDF resolves the page's settings as the
  // Sidebar's, so an unset Text colour prints the name and contacts in its slate, not Classic's black.
  const headerSettings = effectiveTemplate === template ? settings
    : { ...settings, textColor: resolveTemplateSettings(settings, own).textColor };
  const children = [
    ...buildPersonalSection(personal, headerSettings, effectiveTemplate),
    // Between Sections under every section but the last, as the PDF's: space under the last one
    // could only push a blank page (R2-062).
    ...printed.flatMap(({ section, paras }, i) => (i < printed.length - 1 || rows.length
      ? [...paras, ...sectionSpaceAfter(section, settings, own)]
      : paras)),
    ...rows,
  ];
  const running = { name: personal?.name, color: resolveTemplateSettings(settings, own).textColor };
  return Packer.toBlob(buildDocument(children, settings, { pageNumbers: settings.pageNumbers === true, template: own, running, personal }), false, [await wordFontTable(settings)]);
}

export async function exportToWord(resume, filename = 'resume.docx') {
  downloadBlob(await renderResumeDocx(resume), filename);
}

/** The cover letter as a .docx Blob — the same content as the cover-letter PDF. */
export async function renderCoverLetterDocx(resume) {
  // The letterhead's photo as the letter's PDF draws it: the copies its build prints (R4-DOUT-06).
  // Its text without the characters XML forbids (xmlSafe), as the résumé's.
  const letter = await withWordPhoto(xmlSafe(resume), { letter: true });
  return Packer.toBlob(buildDocument(buildCoverLetter(letter), resume?.settings, { personal: letter?.personal, kind: 'Cover Letter' }), false, [await wordFontTable(resume?.settings)]);
}

export async function exportCoverLetterToWord(resume, filename = 'cover-letter.docx') {
  downloadBlob(await renderCoverLetterDocx(resume), filename);
}
