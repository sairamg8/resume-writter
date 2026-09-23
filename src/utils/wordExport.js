import { Document, Packer, convertInchesToTwip } from 'docx';
import { accent2Hex, WORD_MARGIN_IN } from '@/utils/wordExportUtils';
import { buildSection } from '@/utils/wordExportBuilders';
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

/** A one-section document on the résumé's paper (A4 or US Letter, PAR-01), WORD_MARGIN_IN margins on either. */
function buildDocument(children, settings) {
  const font = resolveWordFont(settings);
  const baseSize = Math.round((settings?.fontSizeBase ?? 11) * 2);
  return new Document({
    styles: {
      default: {
        document: {
          run: { font, size: baseSize },
          paragraph: { spacing: { after: 40 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: PAGE_SIZES[pageSizeOf(settings)].twips,
          margin: {
            top: convertInchesToTwip(WORD_MARGIN_IN),
            right: convertInchesToTwip(WORD_MARGIN_IN),
            bottom: convertInchesToTwip(WORD_MARGIN_IN),
            left: convertInchesToTwip(WORD_MARGIN_IN),
          },
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
  const children = [
    ...buildPersonalSection(personal, settings, effectiveTemplate),
    // Template defaults (e.g. Executive and Sidebar lead with the role, …) apply as in the PDF, and
    // so does Section Options → Alignment (never in the Sidebar's side column).
    ...sections.flatMap((s) => buildSection(resolveSection(s, effectiveTemplate), accentHex, settings, effectiveTemplate)),
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
