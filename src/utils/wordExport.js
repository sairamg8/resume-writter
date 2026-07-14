import { Document, Packer, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { accent2Hex } from '@/utils/wordExportUtils';
import { buildPersonalSection, buildSection } from '@/utils/wordExportBuilders';

export async function exportToWord(resumeData, filename = 'resume.docx') {
  const { personal, sections, settings } = resumeData;
  const accentHex = accent2Hex(settings?.accentColor);

  const children = [
    ...buildPersonalSection(personal, settings),
    ...sections.flatMap(s => buildSection(s, accentHex)),
  ];

  const doc = new Document({
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

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
