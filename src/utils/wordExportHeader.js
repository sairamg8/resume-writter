// The Word résumé's header: name, job title, contact line and summary (buildPersonalSection), in the
// colours, alignment and layout the PDF's header prints them in.
import { BorderStyle, LineRuleType, Paragraph, TabStopType, TextRun } from 'docx';
import {
  accent2Hex, linked, normal, descriptionToParagraphs, centredIf, contactSeparator, eighths, inlineGap, spacer, WORD_MARGIN_IN,
} from '@/utils/wordExportUtils';
import { CONTACT_GRID, contactItems } from '@/utils/contacts';
import { hasHeaderControls, headerBorderOn, templateId } from '@/constants/templates';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { PAGE_MARKS, solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { pxToPt } from '@/templates/pdf/shared/pdfUnits';
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

/**
 * The contacts' paragraphs in Design → Contact Layout (FIDB-51-VF1-NB1-NB2), as PdfContactRow lays
 * them out where the header takes it (`styled`: Classic, Minimal, Executive; Modern's banner and the
 * Sidebar's column print one line). Justify: one line, the values joined by the Contact Style's
 * marks (Icon prints bars). Single: a paragraph a value. 2 Grid: a paragraph a row of two, the second
 * at a tab stop where the PDF's second cell starts on Word's page — centred, centre tab stops at the
 * two cells' centres, and an odd last value centred on the line as its lone cell is. Word has no
 * cells: a value wider than its cell pushes the next one along, where the PDF gives it a row of its
 * own. Under Single and 2 Grid, Bullet prints a bullet before each value; Icon and Bar nothing.
 */
function contactParagraphs(items, s, styled, style, centered) {
  const contactStyle = styled ? s.contactStyle : 'icon';
  const layout = styled ? s.contactLayout : 'justify';
  const after = (i, n) => ({ spacing: { after: i === n - 1 ? 80 : 20 } });
  if (layout !== 'single' && layout !== '2grid') {
    return [new Paragraph({
      children: items.flatMap((c, i) => [...(i ? [contactSeparator(contactStyle, style)] : []), linked(c.value, c.href, style)]),
      ...after(0, 1),
      ...centredIf(centered),
    })];
  }
  const mark = contactStyle === 'bullet' ? [normal('• ', { ...style, color: accent2Hex(PAGE_MARKS.bullet) })] : [];
  const cell = (item) => [...mark, linked(item.value, item.href, style)];
  if (layout === 'single') {
    return items.map((item, i) => new Paragraph({ children: cell(item), ...after(i, items.length), ...centredIf(centered) }));
  }
  const width = PAGE_SIZES[pageSizeOf(s)].twips.width / 20 - 144 * WORD_MARGIN_IN;
  const cellPt = CONTACT_GRID.cell * width;
  const gap = pxToPt(CONTACT_GRID.gapPx);
  const left = (width - (2 * cellPt + gap)) / 2;
  const stops = centered
    ? [left + cellPt / 2, left + cellPt + gap + cellPt / 2].map((pt) => ({ type: TabStopType.CENTER, position: twips(pt) }))
    : [{ type: TabStopType.LEFT, position: twips(cellPt + gap) }];
  const tab = () => normal('\t', style);
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows.map((row, i) => {
    if (row.length === 1) return new Paragraph({ children: cell(row[0]), ...after(i, rows.length), ...centredIf(centered) });
    const children = centered ? [tab(), ...cell(row[0]), tab(), ...cell(row[1])] : [...cell(row[0]), tab(), ...cell(row[1])];
    return new Paragraph({ children, tabStops: stops, ...after(i, rows.length) });
  });
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
    paragraphs.push(...descriptionToParagraphs(personal.summary, { size: 20, color: '374151', italics: true }, centered ? 'center' : null));
  }

  paragraphs.push(headerEnd(s, template));
  return paragraphs;
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

