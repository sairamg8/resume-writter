import { Document, Packer, convertInchesToTwip } from 'docx';
import { accent2Hex } from '@/utils/wordExportUtils';
import { buildPersonalSection, buildSection } from '@/utils/wordExportBuilders';
import { buildCoverLetter } from '@/utils/wordExportCoverLetter';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { downloadBlob } from '@/utils/download';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';

/** A one-section document on the résumé's paper (A4 or US Letter, PAR-01), 0.75 in margins on either. */
function buildDocument(children, settings) {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
          paragraph: { spacing: { after: 40 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: PAGE_SIZES[pageSizeOf(settings)].twips,
          margin: {
            top: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
            bottom: convertInchesToTwip(0.75),
            left: convertInchesToTwip(0.75),
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
  const children = [
    ...buildPersonalSection(personal, settings),
    // Template defaults (e.g. Executive and Sidebar put the role first) apply as in the PDF.
    ...sections.flatMap((s) => buildSection(resolveSection(s, template), accentHex, settings)),
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
