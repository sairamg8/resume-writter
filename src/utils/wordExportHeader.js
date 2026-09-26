// The Word résumé's header: name, job title, contact line and summary (buildPersonalSection), in the
// colours, alignment and layout the PDF's header prints them in — on Modern's banner and the Sidebar
// column's colour, the band Word draws for them (R2-137).
import { AlignmentType, BorderStyle, LineRuleType, Paragraph, TextRun, VerticalAlign } from 'docx';
import { wordNameFont } from '@/utils/wordFonts';
import { accent2Hex, bold, descriptionToParagraphs, centredIf, eighths, inlineGap, normal, spacer, wordContentTwips } from '@/utils/wordExportUtils';
import { wordPhoto } from '@/utils/wordExportPhoto';
import { contactRows } from '@/utils/wordExportContacts';
import { buildSectionTitle } from '@/utils/wordExportBuilders';
import { bandFill, frameInner, frameTable, hexOn } from '@/utils/wordExportLook';
import { contactItems } from '@/utils/contacts';
import { hasHeaderControls, headerBorderOn, photoRowDirection, templateId } from '@/constants/templates';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { headerColorsOnPage } from '@/templates/pdf/shared/headerColors';
import { headerRule, headerTitleSize, inlineLayout, letterheadLook } from '@/templates/pdf/shared/letterhead';
import { HEADER_BORDER_PAD_PT } from '@/templates/pdf/shared/pdfUnits';
import { setGapPt } from '@/constants/headerSpacing';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { headerContactPt } from '@/templates/pdf/shared/contactSize';
import { hasRichText } from '@/utils/richText';
import { linkLook } from '@/utils/linkStyle';

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
 * The templates whose header Word draws on its band (R2-137): Modern's accent banner and the two-column
 * Sidebar's panel colour, as the letter's letterhead already drew them (letterheadLook's band). Banner's
 * and Banded's headers take Header Customization's alignment, rule and contact styles on theirs, and
 * print on the page, as the Export menu says.
 */
const BANDED = new Set(['modern', 'sidebar']);

/**
 * The name's and the job title's Word colours on the band, 'rrggbb': the colours the PDF prints there
 * (letterheadLook — Design → Name and Job title colours, else the template's own; Modern's title at
 * 90 %, its own alpha multiplied in), opaque on the fill Word shades (`on`), as the letter's are. A
 * colour Word cannot take prints as the template's own there.
 */
function bandInk(settings, template, look, on) {
  const own = letterheadLook(template, resolveTemplateSettings({ ...settings, nameColor: '', jobTitleColor: '' }, templateId(template)));
  const hex = (key, alpha = 1) => hexOn(look[key].color, on, hexOn(own[key].color, on, 'ffffff', alpha), alpha);
  return { name: hex('name'), title: hex('title', look.title.opacity ?? 1) };
}

/**
 * The résumé's contacts in Design → Contact Layout, as paragraphs (contactRows; FIDB-51-VF1-NB1-NB2),
 * laid out `width` pt wide: what the photo beside them leaves, as the PDF's (headerRowWidth). `last`:
 * the space after the last row, twips — Word's own 4 pt, or Contacts ↔ Summary where it is set.
 * `on`: the band they print on, whose marks and link tint they take (R2-137).
 */
function contactParagraphs(items, s, styled, style, centered, width, last = 80, on = {}) {
  const rows = contactRows(items, {
    contactStyle: styled ? s.contactStyle : 'icon', layout: styled ? s.contactLayout : 'justify', centered, settings: s, style, width,
    markColor: on.marks, links: on.links ?? linkLook(s.linkStyle, s.accentColor),
  });
  return rows.map((row, i) => new Paragraph({
    children: row.runs, spacing: { after: i === rows.length - 1 ? last : 20 }, ...centredIf(row.centred), ...row.extra,
  }));
}

/**
 * Name, title, contacts and summary, closed by the header's rule (headerEnd). The contacts are the PDF's (PdfContactRow): its values
 * in the Text colour's grey — the template's own Text colour when none is stored — and the marks
 * of Design → Contact Style where the header takes it (`template`: Classic, Minimal, Executive).
 * Modern's banner and the Sidebar column draw icons, and Word prints icons as bars. Their header
 * prints on their band (R2-137): a shaded table (headerBand) holding the photo, name, title
 * and contacts in the band's colours — and Modern's summary, which its PDF prints on the banner.
 * Header alignment "Center" centres all four where the PDF does — in those same three templates;
 * a summary block aligned in the editor keeps its own alignment, as in the PDF (ONB-3). Name &
 * Title Layout "Inline" prints the title on the name's line, at the PDF's gap, in those three too.
 */
export function buildPersonalSection(personal = {}, settings = {}, template = 'classic') {
  const hidden = new Set(personal.hiddenFields || []);
  const centered = hasHeaderControls(template, settings) && settings?.headerAlign === 'center';
  const s = resolveTemplateSettings(settings, templateId(template));
  const baseSize = s.fontSizeBase ?? 11;
  const nameSize = Math.round((baseSize + (s.fontSizeNameDelta ?? 8)) * 2);
  const titleSize = Math.round(headerTitleSize(s) * 2);
  const paragraphs = [];

  // Modern's banner and the Sidebar's column: the band the PDF prints the header on (R2-137), the
  // letter's letterhead's (letterheadLook); else the white page.
  const look = letterheadLook(template, s);
  const band = BANDED.has(look.look) ? look.band : null;
  const on = band ? `#${bandFill(band)}` : null;
  const ink = band ? bandInk(settings, template, look, on) : headerInk(settings, template);
  // In the weight the PDF prints it, as the letter's letterhead takes it (letterheadLook): Minimal's
  // light name regular — Word has no light weight to give it — every other template's bold (R2-128).
  const nameRun = look.name.weight === 'bold' ? bold : normal;
  const name = nameRun(personal.name || 'Your Name', { size: nameSize, color: ink.name, ...wordNameFont(s) }); // Name Font (R2-146)
  // Academic prints the job title in italic, the position under the name (AcademicTemplatePDF.jsx).
  const italics = templateId(template) === 'academic' ? { italics: true } : {};
  const title = personal.title ? new TextRun({ text: personal.title, size: titleSize, color: ink.title, ...italics }) : null;
  // Name & Title Layout "Inline" (ONB-3-NB1): one line, as the PDF's nameBlock and the letter's letterhead print it.
  const inline = title && inlineLayout(templateId(template), s);
  const contacts = contactItems(personal);
  // Personal Info → Header spacing, where the résumé set a gap its template prints (a paragraph's
  // space after is the gap to what follows it); unset, Word keeps its own spacing (spec D6).
  const setTwips = (key) => (s.headerGaps?.[key] != null && setGapPt(settings, key) != null ? twips(setGapPt(settings, key)) : null);
  const toContacts = contacts.length ? setTwips('titleContactsGap') : null; // Title (or Name) ↔ Contacts
  const summary = !hidden.has('summary') && hasRichText(personal.summary);
  // Contacts ↔ Summary: the space after what prints last above the summary — the contacts, else the
  // title or the name (in the photo's row, its text column).
  const toSummary = summary ? setTwips('summaryGap') : null;
  const next = contacts.length ? toContacts : toSummary; // after the name and title: the contacts, else the summary
  const stacked = title && !inline;
  // The photo beside the name, as the PDF's header row: its cell the photo's width and the Photo ↔
  // Text gap, the contacts laid out in what is left. Above the name in a centred header and on the
  // Sidebar, whose column stacks them (R2-126).
  const photo = wordPhoto(personal, s, template, { onBand: !!band });
  const gap = s.headerGaps?.photoTextGap ?? 12;
  const beside = photo && !centered && templateId(template) !== 'sidebar';
  if (photo && !beside) paragraphs.push(new Paragraph({ children: [photo.run], spacing: { after: twips(gap) }, ...centredIf(centered) }));
  // The space after the text's last line, twips: on a band it comes off the band's padding under it.
  let textAfter = stacked ? setTwips('nameTitleGap') ?? 40 : next ?? (inline ? 60 : 40);
  paragraphs.push(new Paragraph({
    children: inline ? [name, inlineGap(inline.gap, titleSize), title] : [name],
    // A stacked title follows Name ↔ Title when set, else Word's own 2 pt; the contacts after the name
    // (no title, or Inline) Title ↔ Contacts, a summary with no contacts Contacts ↔ Summary.
    spacing: { after: textAfter },
    ...centredIf(centered),
  }));

  if (stacked) {
    textAfter = next ?? 60;
    paragraphs.push(new Paragraph({
      children: [title],
      spacing: { after: textAfter },
      ...centredIf(centered),
    }));
  }

  if (contacts.length) {
    // At the size the PDF prints them on this template (headerContactPt): it follows Design → Base.
    // Word printed them at 9 pt at every Base (R2-067). On a band, in its colours (letterheadLook).
    const color = band ? hexOn(look.contacts, on, 'ffffff') : accent2Hex(textShades(s.textColor).sub, '64748b');
    const style = { size: Math.round(headerContactPt(s, template) * 2), color };
    const room = band ? frameInner(s, band) / 20 : wordContentTwips(s) / 20;
    const width = beside ? room - photo.width - gap : band ? room : undefined;
    // On a band, its marks and the Accent link tint that reads on the fill Word shades (Design → Links, R2-147).
    const onBand = band ? { marks: look.marks ? hexOn(look.marks, on) : undefined, links: linkLook(s.linkStyle, s.accentColor, on) } : {};
    textAfter = toSummary ?? 80;
    paragraphs.push(...contactParagraphs(contacts, s, hasHeaderControls(template, settings), style, centered, width, textAfter, onBand));
  }
  // Modern prints its summary on the banner; the Sidebar under "About Me" on the page.
  const summaryOnBand = summary && band && templateId(template) === 'modern';
  const summaryParas = () => {
    const { run, frame } = summaryLook(s, template, summaryOnBand ? on : null);
    const links = linkLook(s.linkStyle, s.accentColor, summaryOnBand ? on : null);
    // At Design → Line Height, as the PDF's summary (R2-062), its lists behind Design → Lists' glyph (R2-147).
    return descriptionToParagraphs(personal.summary, { size: Math.round(baseSize * 2), lineHeight: s.lineHeightValue, bullet: s.bulletStyle, links, ...run }, centered ? 'center' : null, frame);
  };
  if (band) {
    paragraphs.splice(0, paragraphs.length, headerBand(band, s, { photo: beside ? photo : null, gap, text: paragraphs, textAfter, summary: summaryOnBand ? summaryParas() : null }));
  } else if (beside) {
    paragraphs.splice(0, paragraphs.length, photoRow(photo, gap, paragraphs, s));
  }

  if (summary && !summaryOnBand) {
    // The Sidebar prints its summary under an "About Me" section title at the top of its main column (FIDB-51-VF3-NB2-NB1-NB1).
    if (templateId(template) === 'sidebar') paragraphs.push(buildSectionTitle('About Me', settings, template));
    paragraphs.push(...summaryParas());
  }

  // Header ↔ First section, where set: the space after the header's end, as Word's own 4 pt is.
  paragraphs.push(headerEnd(s, template, setTwips('headerGapBelow') ?? 80));
  return paragraphs;
}

/**
 * The header's row of the photo and, beside it, the name, title and contacts `text` (paragraphs): a
 * borderless table as wide as the page's text (frameTable), the photo's cell its width and `gap` (pt,
 * Photo ↔ Text), the text aligned to the photo as Photo → Text Position sets (top, centre or bottom).
 * Photo → Position Right puts the photo's cell last, the gap on its left, as the PDF's row-reverse
 * (R2-147). `band`: the row is on the band (headerBand) — as wide as its text, its cells shaded, the
 * text cell's own margins `textMargins` — and `rows` the band's rows under it.
 */
function photoRow(photo, gap, text, s, { band = null, textMargins, rows = [] } = {}) {
  const width = frameInner(s, band);
  const first = Math.min(width, twips(photo.width + gap));
  const valign = { top: VerticalAlign.TOP, bottom: VerticalAlign.BOTTOM }[s.photoTextAlign] || VerticalAlign.CENTER;
  const right = photoRowDirection(s) === 'row-reverse';
  const pic = [new Paragraph({ children: [photo.run], spacing: { after: 0 }, ...(right ? { alignment: AlignmentType.RIGHT } : {}) })];
  // The gap between the photo and the text is padding on the photo cell's side facing the text.
  const gapSide = right ? 'left' : 'right';
  const photoCell = { children: pic, valign, margins: { [gapSide]: first - twips(photo.width) } };
  const textCell = { children: text, valign, margins: textMargins };
  return frameTable(
    [right ? [textCell, photoCell] : [photoCell, textCell], ...rows],
    right ? [width - first, first] : [first, width - first],
    { settings: s, band },
  );
}

/**
 * The header on its band in Word (R2-137): Modern's banner, the Sidebar column's colour. A table as
 * the letter's band and the PDF's banner: shaded in the band's fill (frameTable), its padding the
 * band's — Banner top & bottom and sides on Modern (headerPadY / headerPadX), the Sidebar's running
 * into the margins — holding the name, title and contacts `text` (paragraphs), the `photo` beside
 * them where the PDF sets it there (photoRow), and Modern's `summary` (paragraphs) under them across
 * the band. `textAfter`: the space after the text's last line, twips, which the band's padding under
 * it takes in, so the band ends its padding under the text as the PDF's does.
 */
function headerBand(band, s, { photo, gap, text, textAfter, summary }) {
  // The summary's paragraphs keep 1 pt after them (descriptionToParagraphs): the padding takes it in too.
  const rows = summary ? [[{ children: summary, span: 2, margins: { bottom: -20 } }]] : [];
  const textMargins = { bottom: -textAfter };
  if (photo) return photoRow(photo, gap, text, s, { band, textMargins, rows });
  return frameTable([[{ children: text, margins: textMargins }], ...rows], [frameInner(s, band)], { settings: s, band });
}

/**
 * The summary as the PDF prints it on the page (FIDB-51-VF3-NB2-NB1): Classic and Executive upright
 * in the Text colour's body shade; Minimal italic in its sub shade, beside a 2 pt bar of the accent
 * at 40 % (a left border, which Word joins down the paragraphs); the Sidebar's main column upright in
 * the Text colour itself. Modern prints it on its banner (`on`, the fill Word shades it, R2-137) in
 * the header text colour at 85 %, its own alpha multiplied in, as its PDF does.
 */
function summaryLook(s, template, on = null) {
  const t = templateId(template);
  if (on) return { run: { color: hexOn(s.headerTextColor || '#ffffff', on, 'ffffff', 0.85) }, frame: {} };
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
 * `below`: the space after it, twips (Word's own 4 pt, or Header ↔ First section).
 */
function headerEnd(s, template, below) {
  const on = hasHeaderControls(template, s) && headerBorderOn(s, template);
  if (!on) return spacer(below);
  const gap = twips(s.headerGaps?.headerRuleGap ?? HEADER_BORDER_PAD_PT);
  const rule = headerRule(s, template);
  if (!rule) return spacer(gap + below);
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: eighths(rule.width), color: accent2Hex(rule.color), space: 0 } },
    // A 1 pt line: the rule sits the gap under the text above it, not a whole empty line under it.
    spacing: { before: gap, after: below, line: 20, lineRule: LineRuleType.EXACT },
  });
}

