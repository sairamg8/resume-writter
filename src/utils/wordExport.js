import { Document, Packer } from 'docx';
import { accent2Hex, wordMargins } from '@/utils/wordExportUtils';
import { buildSection, sectionSpaceAfter } from '@/utils/wordExportBuilders';
import { buildPersonalSection } from '@/utils/wordExportHeader';
import { buildCoverLetter } from '@/utils/wordExportCoverLetter';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { downloadBlob } from '@/utils/download';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { templateId } from '@/constants/templates';
import { FONTS } from '@/utils/fonts';

export function resolveWordFont(settings = {}) {
  if (settings?.customFont?.trim()) return settings.customFont.trim();
  const fontObj = FONTS.find((f) => f.id === settings?.font);
  return fontObj?.label || fontObj?.name || 'Noto Sans';
}

/**
 * A one-section document on the résumé's paper (A4 or US Letter, PAR-01), in Design → Spacing's page
 * margins (wordMargins, R2-062) — the résumé's and its letter's, as their PDFs print them.
 */
function buildDocument(children, settings) {
  const font = resolveWordFont(settings);
  const margin = wordMargins(settings);
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
    sections: [{
      properties: {
        page: {
          size: PAGE_SIZES[pageSizeOf(settings)].twips,
          margin: { top: margin.v, right: margin.h, bottom: margin.v, left: margin.h },
        },
      },
      children,
    }],
  });
}

/** The résumé as a .docx Blob — same sections, entries and hidden fields as the PDF. */
export async function renderResumeDocx(resume) {
  const { personal = {}, sections = [], settings = {}, template = 'classic' } = resume || {};
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
  const children = [
    ...buildPersonalSection(personal, settings, effectiveTemplate),
    // Between Sections under every section but the last, as the PDF's: space under the last one
    // could only push a blank page (R2-062).
    ...printed.flatMap(({ section, paras }, i) => (i < printed.length - 1
      ? [...paras, ...sectionSpaceAfter(section, settings, own)]
      : paras)),
  ];
  return Packer.toBlob(buildDocument(children, settings));
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
