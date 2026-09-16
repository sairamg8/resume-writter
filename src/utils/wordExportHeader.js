// The Word résumé's header: name, job title, contact line and summary (buildPersonalSection), in the
// colours, alignment and layout the PDF's header prints them in.
import { BorderStyle, LineRuleType, Paragraph, TextRun } from 'docx';
import { accent2Hex, descriptionToParagraphs, centredIf, eighths, inlineGap, spacer } from '@/utils/wordExportUtils';
import { contactRows } from '@/utils/wordExportContacts';
import { buildSectionTitle } from '@/utils/wordExportBuilders';
import { contactItems } from '@/utils/contacts';
import { hasHeaderControls, headerBorderOn, templateId } from '@/constants/templates';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { headerColorsOnPage } from '@/templates/pdf/shared/headerColors';
import { headerRule, inlineLayout } from '@/templates/pdf/shared/letterhead';
import { HEADER_BORDER_PAD_PT } from '@/templates/pdf/shared/pdfUnits';
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

const twips = (pt) => Math.round(pt * 20);

/** The résumé's contacts in Design → Contact Layout, as paragraphs (contactRows; FIDB-51-VF1-NB1-NB2). */
function contactParagraphs(items, s, styled, style, centered) {
  const rows = contactRows(items, {
    contactStyle: styled ? s.contactStyle : 'icon', layout: styled ? s.contactLayout : 'justify', centered, settings: s, style,
  });
  return rows.map((row, i) => new Paragraph({
    children: row.runs, spacing: { after: i === rows.length - 1 ? 80 : 20 }, ...centredIf(row.centred), ...row.extra,
  }));
}

/**
 * Name, title, contacts and summary, closed by the header's rule (headerEnd). The contacts are the PDF's (PdfContactRow): its values
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
    paragraphs.push(...contactParagraphs(contacts, s, hasHeaderControls(template), style, centered));
  }

  if (!hidden.has('summary') && hasRichText(personal.summary)) {
    // The Sidebar prints its summary under an "About Me" section title at the top of its main column (FIDB-51-VF3-NB2-NB1-NB1).
    if (templateId(template) === 'sidebar') paragraphs.push(buildSectionTitle('About Me', settings, template));
    const { run, frame } = summaryLook(s, template);
    paragraphs.push(...descriptionToParagraphs(personal.summary, { size: 20, ...run }, centered ? 'center' : null, frame));
  }

  paragraphs.push(headerEnd(s, template));
  return paragraphs;
}

/**
 * The summary as the PDF prints it on the page (FIDB-51-VF3-NB2-NB1): Classic and Executive upright
 * in the Text colour's body shade; Minimal italic in its sub shade, beside a 2 pt bar of the accent
 * at 40 % (a left border, which Word joins down the paragraphs); the Sidebar's main column upright in
 * the Text colour itself. Modern prints it on its banner in the header text colour; Word draws no
 * banner, so it prints as Classic's on the page, as Modern's name and title do (headerColorsOnPage).
 */
function summaryLook(s, template) {
  const t = templateId(template);
  const ink = (c) => accent2Hex(c, '374151');
  if (t === 'minimal') {
    const bar = { style: BorderStyle.SINGLE, size: eighths(2), color: accent2Hex(solid(s.accentColor || '#2563eb', 0.4), '2563eb'), space: 8 };
    return { run: { color: ink(textShades(s.textColor).sub), italics: true }, frame: { border: { left: bar } } };
  }
  if (t === 'sidebar') return { run: { color: ink(solid(s.textColor)) }, frame: {} };
  return { run: { color: ink(textShades(s.textColor).body) }, frame: {} };
}

/**
 * What closes the header: Header Customization → Header Bottom Border, as the PDF draws it under
 * the whole header — name, title, contacts and summary — in Classic, Minimal and Executive
 * (FIDB-51-VF3-NB2): a rule in the accent at its Thickness, the header's Text ↔ Border gap under
 * the text (headerRule; a Thickness no rule is drawn at keeps the gap). Else — the border off,
 * Modern's banner, the Sidebar's column — a little space, and no line: no PDF draws one there.
 */
function headerEnd(s, template) {
  const on = hasHeaderControls(template) && headerBorderOn(s, template);
  if (!on) return spacer(80);
  const gap = twips(s.headerGaps?.headerRuleGap ?? HEADER_BORDER_PAD_PT);
  const rule = headerRule(s, template);
  if (!rule) return spacer(gap + 80);
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: eighths(rule.width), color: accent2Hex(rule.color), space: 0 } },
    // A 1 pt line: the rule sits the gap under the text above it, not a whole empty line under it.
    spacing: { before: gap, after: 80, line: 20, lineRule: LineRuleType.EXACT },
  });
}

