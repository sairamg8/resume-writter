import { Document, Packer, convertInchesToTwip } from 'docx';
import { accent2Hex } from '@/utils/wordExportUtils';
import { buildPersonalSection, buildSection } from '@/utils/wordExportBuilders';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { downloadBlob } from '@/utils/download';

function buildDocument(children) {
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
    ...sections.flatMap((s) => buildSection(resolveSection(s, template), accentHex)),
  ];
  return Packer.toBlob(buildDocument(children));
}

export async function exportToWord(resume, filename = 'resume.docx') {
  downloadBlob(await renderResumeDocx(resume), filename);
}
