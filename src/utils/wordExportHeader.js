// The Word résumé's header: name, job title, contact line and summary (buildPersonalSection), in the
// colours, alignment and layout the PDF's header prints them in.
import { Paragraph, TextRun } from 'docx';
import { accent2Hex, linked, separator, descriptionToParagraphs, centredIf, contactSeparator, inlineGap, spacer } from '@/utils/wordExportUtils';
import { contactItems } from '@/utils/contacts';
import { hasHeaderControls, templateId } from '@/constants/templates';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { headerColorsOnPage } from '@/templates/pdf/shared/headerColors';
import { inlineLayout } from '@/templates/pdf/shared/letterhead';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { hasRichText } from '@/utils/richText';

/** The job title's size, half-points. */
const TITLE_SIZE = 24;

/**
 * The name's and the job title's Word colours, 'rrggbb' opaque on the white page: the colours the
 * header prints there (headerColorsOnPage — Design → Name and Job title colours, else the template's
 * own); a colour Word cannot take prints as the template's own (FIDB-51-VF1-NB1-NB1).
 */
function headerInk(settings, template) {
  const picked = headerColorsOnPage(settings, template);
  const own = headerColorsOnPage({ ...settings, nameColor: '', jobTitleColor: '' }, template);
  const hex = (key, last) => accent2Hex(solid(picked[key]), accent2Hex(solid(own[key]), last));
  return { name: hex('nameColor', '111111'), title: hex('jobTitleColor', '2563eb') };
}

/**
 * Name, title, contact line and summary. The contact line is the PDF's (PdfContactRow): its values
 * in the Text colour's grey — the template's own Text colour when none is stored — and the marks
 * of Design → Contact Style where the header takes it (`template`: Classic, Minimal, Executive).
 * Modern's banner and the Sidebar column draw icons, and Word prints icons as bars.
 * Header alignment "Center" centres all four where the PDF does — in those same three templates;
 * a summary block aligned in the editor keeps its own alignment, as in the PDF (ONB-3). Name &
 * Title Layout "Inline" prints the title on the name's line, at the PDF's gap, in those three too.
 */
export function buildPersonalSection(personal = {}, settings = {}, template = 'classic') {
  const hidden = new Set(personal.hiddenFields || []);
  const centered = hasHeaderControls(template) && settings?.headerAlign === 'center';
  const s = resolveTemplateSettings(settings, templateId(template));
  const paragraphs = [];

  const ink = headerInk(settings, template);
  const name = new TextRun({ text: personal.name || 'Your Name', bold: true, size: 40, color: ink.name });
  const title = personal.title ? new TextRun({ text: personal.title, size: TITLE_SIZE, color: ink.title }) : null;
  // Name & Title Layout "Inline" (ONB-3-NB1): one line, as the PDF's nameBlock and the letter's letterhead print it.
  const inline = title && inlineLayout(templateId(template), s);
  paragraphs.push(new Paragraph({
    children: inline ? [name, inlineGap(inline.gap, TITLE_SIZE), title] : [name],
    spacing: { after: inline ? 60 : 40 },
    ...centredIf(centered),
  }));

  if (title && !inline) {
    paragraphs.push(new Paragraph({
      children: [title],
      spacing: { after: 60 },
      ...centredIf(centered),
    }));
  }

  const contacts = contactItems(personal);
  if (contacts.length) {
    const style = { size: 18, color: accent2Hex(textShades(s.textColor).sub, '64748b') };
    const contactStyle = hasHeaderControls(template) ? s.contactStyle : 'icon';
    paragraphs.push(new Paragraph({
      children: contacts.flatMap((c, i) => [
        ...(i ? [contactSeparator(contactStyle, style)] : []),
        linked(c.value, c.href, style),
      ]),
      spacing: { after: 80 },
      ...centredIf(centered),
    }));
  }

  if (!hidden.has('summary') && hasRichText(personal.summary)) {
    paragraphs.push(separator());
    paragraphs.push(...descriptionToParagraphs(personal.summary, { size: 20, color: '374151', italics: true }, centered ? 'center' : null));
    paragraphs.push(spacer(80));
  }

  return paragraphs;
}

