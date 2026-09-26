// The cover letter as Word paragraphs: the same text, order, colours and hidden contacts as the
// cover-letter PDF — letterhead (name, title, contacts in the résumé template's look), date,
// recipient block, subject, body, closing and signature. Sizes follow the letter's base font
// size. It is a text document: no photo; its contacts sit beside the name at Right of Name, the
// default Fields Position (R2-137), else under it, in Cover Letter → Contact Style and Layout, Icon
// printing as Bar.
//
// The letterhead takes the look the PDF's does (letterheadLook, FIDB-51): its colours, alignment
// and Name & Title layout, Modern's accent band and the Sidebar panel's colour as a shaded band,
// the résumé header's rule (else Minimal's hairline, Executive's double rule) under it. Word runs
// the Sidebar band 15 pt into the page margins, not to the paper's edges as the PDF does, and
// prints the name and title in Word's own weights (Minimal's light name and an Inline title's
// medium are regular).
import { Paragraph, BorderStyle, ShadingType, AlignmentType } from 'docx';
import { wordNameFont } from '@/utils/wordFonts';
import { bold, normal, descriptionToParagraphs, eighths, gapPara, inlineGap, lineSpacing, twips } from '@/utils/wordExportUtils';
import { bandFill, frameInner, frameTable, hexOn } from '@/utils/wordExportLook';
import { contactRows } from '@/utils/wordExportContacts';
import { CONTACT_GRID, contactItems } from '@/utils/contacts';
import { hasRichText } from '@/utils/richText';
import { linkLook } from '@/utils/linkStyle';
import { letterBlock, letterContactFormat, letterFieldsPosition, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { LETTER_CONTACTS_GAP, letterGrey, letterheadLook } from '@/templates/pdf/shared/letterhead';
import { pxToPt } from '@/templates/pdf/shared/pdfUnits';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { templateId } from '@/constants/templates';
import { setGapPt } from '@/constants/headerSpacing';
const pt = (n) => Math.round(n * 20); // points → twips (paragraph spacing, indents)

const line = (children, after = 0, extra = {}) => new Paragraph({ children, spacing: { after }, ...extra });

/**
 * The paragraph formatting that frames the letterhead's rows, when they are one column (the contacts
 * under the name): a band — each row shaded (bandFill), with borders of the band's own colour as its
 * padding, so Word joins the rows into one block — or the rule(s) under the last row.
 */
function frame(look, last) {
  const align = look.centered ? { alignment: AlignmentType.CENTER } : {};
  if (look.band) {
    const fill = bandFill(look.band);
    const edge = (space) => ({ style: BorderStyle.SINGLE, size: 4, color: fill, space });
    // The text sits where the PDF's does: inset by Modern's padding; on the page margin, flush
    // with the letter below, on the Sidebar's band (bleed), whose padX is 0 — `0 || padY` inset
    // it 15 pt (VFIDB-51-4). Word draws a side border its space outside the indent and shades up
    // to it, so the fill runs past the text: to the margins on Modern, padY into them on the
    // Sidebar (Word's border space stops at 31 pt; the PDF's fill reaches the paper's edges).
    const { padX, padY, bleed } = look.band;
    const inset = bleed ? 0 : padX;
    const side = bleed ? padY : padX;
    return {
      ...align,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      border: { top: edge(padY), bottom: edge(padY), left: edge(side), right: edge(side) },
      ...(inset ? { indent: { left: pt(inset), right: pt(inset) } } : {}),
    };
  }
  const [rule, second] = look.rules;
  if (!last || !rule) return align;
  return {
    ...align,
    border: { bottom: {
      style: second ? BorderStyle.DOUBLE : BorderStyle.SINGLE,
      // The PDF's space above the rule (look.ruleGap), in the whole points Word's border space takes.
      size: eighths(rule.width), color: hexOn(rule.color), space: Math.round(look.ruleGap),
    } },
  };
}

/**
 * Word cannot measure text: a sans's average advance, em a character — generous, so a layout that
 * sets two blocks side by side errs on the side of room — and a bold name's, wider.
 */
const EM = 0.6;
const BOLD_EM = 0.65;
/** Room added to each estimated width, pt. */
const SLACK = 4;
/** The width of `text` on one line at `size` half-points, pt, estimated at `em` a character. */
const across = (text, size, em = EM) => [...String(text ?? '')].length * (size / 2) * em;
/** Its widest word's: what cannot wrap. */
const widestWord = (text, size, em = EM) => Math.max(0, ...String(text ?? '').split(/\s+/).map((word) => across(word, size, em)));

/**
 * Right of Name, the default Fields Position (R2-137), as the letter's PDF lays it out
 * (CoverLetterHeaderPDF): the contacts beside the name, the letter's Name ↔ Contacts between them
 * (contactsSideGap, else its 12 pt). The contacts get what their widest item needs (a 2 Grid two
 * such cells), the name side what its lines need up to the rest; `{ name, contacts }` the two
 * columns' widths, twips, the gap the contacts' left margin, and `width` the contacts' own, pt.
 * Null where the PDF prints them under the name: another Fields Position, a centred letterhead
 * (its centre line), no contacts, or a name or title word that does not fit beside them — the PDF's
 * fit fallback. Word cannot measure text: the widths are estimates (across).
 */
function rightOfName(personal, cl, s, look, sizes, contacts, { contactStyle, layout }) {
  if (look.centered || letterFieldsPosition(cl) !== 'right' || !contacts.length) return null;
  const inner = frameInner(s, look.band);
  const gap = setGapPt(s, 'contactsSideGap') ?? LETTER_CONTACTS_GAP;
  const room = inner / 20 - gap;
  // Justify keeps the mark after each value on its line; Single and 2 Grid put Bullet's before it.
  const mark = layout === 'justify' ? across('  |  ', sizes.contact) : contactStyle === 'bullet' ? across('• ', sizes.contact) : 0;
  const widest = Math.max(...contacts.map((c) => across(c.value, sizes.contact))) + mark;
  const need = (layout === '2grid' && contacts.length > 1 ? 2 * widest + pxToPt(CONTACT_GRID.gapPx) : widest) + SLACK;
  const nameEm = look.name.weight === 'bold' ? BOLD_EM : EM;
  const name = personal.name || 'Your Name';
  if (Math.max(widestWord(name, sizes.name, nameEm), widestWord(personal.title, sizes.title)) + SLACK + need > room) return null;
  const title = personal.title ? across(personal.title, sizes.title) : 0;
  const nameLine = look.inline && personal.title ? across(name, sizes.name, nameEm) + look.inline.gap + title : Math.max(across(name, sizes.name, nameEm), title);
  const side = twips(Math.min(nameLine + SLACK, room - need));
  return { name: side, contacts: inner - side, gap: twips(gap), width: (inner - side) / 20 - gap };
}

/** Name, title and contact line in the résumé template's look (letterheadLook). */
function letterhead(personal, s, cl, sizes, look) {
  // Runs on a band blend onto the fill Word shades (bandFill), as the PDF's onto the band it paints —
  // not onto a colour Word cannot take (the white page) or a translucent band's colour at full
  // strength; a colour Word cannot take is white there, ink on the page.
  const on = look.band ? `#${bandFill(look.band)}` : '#ffffff';
  const ink = (color, alpha) => hexOn(color, on, look.band ? 'ffffff' : '1e293b', alpha);
  const nameRun = look.name.weight === 'bold' ? bold : normal;
  const contacts = contactItems(personal, letterHiddenFields(cl, personal));
  // A row's space after is the gap to the next: Name ↔ Title and Title ↔ Contacts (Name ↔ Contacts
  // without a title) as the letter's PDF prints them — the résumé's set value (Personal Info → Header
  // spacing), else Word's own 1 / 2 pt. A set value holds on a band too (`kept`), where rows otherwise
  // print with none between them.
  const nameGap = personal.title && !look.inline ? setGapPt(s, 'nameTitleGap') : null;
  const toContacts = contacts.length ? setGapPt(s, 'titleContactsGap') : null;
  const afterName = personal.title && !look.inline ? nameGap : toContacts;
  const rows = [{ runs: [nameRun(personal.name || 'Your Name', { size: sizes.name, color: ink(look.name.color), ...wordNameFont(s) })], after: pt(afterName ?? (look.inline && personal.title ? 2 : 1)), kept: afterName != null }];
  // Modern's title prints at 90 % on its band (look.title.opacity, R5-9): the same blend here.
  // Academic's title is italic (look.title.italic), as its PDF letterhead prints it.
  const title = personal.title ? normal(personal.title, { size: sizes.title, color: ink(look.title.color, look.title.opacity), ...(look.title.italic ? { italics: true } : {}) }) : null;
  if (title && look.inline) {
    // Name & Title Layout "Inline" (V2FIDB-51-3): the title on the name's line, after a real space
    // (the line reads and copies as words) widened to the PDF's gap — as the résumé's (inlineGap).
    rows[0] = { ...rows[0], runs: [...rows[0].runs, inlineGap(look.inline.gap, sizes.title), title] };
  } else if (title) {
    rows.push({ runs: [title], after: pt(toContacts ?? 2), kept: toContacts != null });
  }
  // Cover Letter → Contact Style and Layout (letterContactFormat) as the letter's PDF lays them out
  // (FIDB-51-VF1-NB1-NB2-NB1), in the band's marks where there is one, else the page's greys
  // (FIDB-51-VF1-NB1). A centred 2 Grid row is centred by its tab stops, not as a whole.
  const format = letterContactFormat(cl, s);
  const beside = rightOfName(personal, cl, s, look, sizes, contacts, format);
  const contactLines = [];
  if (contacts.length) {
    const style = { size: sizes.contact, color: ink(look.contacts) };
    const marks = look.marks && ink(look.marks);
    // Design → Links (R2-147): on a band, the Accent tint that reads on the fill Word shades.
    const links = linkLook(s.linkStyle, s.accentColor, look.band ? on : null);
    // Beside the name a 2 Grid's second cell starts where it does in the contacts' own width.
    const width = beside ? { width: beside.width } : {};
    for (const row of contactRows(contacts, { contactStyle: format.style, layout: format.layout, centered: look.centered, settings: s, style, markColor: marks, links, ...width })) {
      contactLines.push({ runs: row.runs, extra: look.centered && !row.centred ? { ...row.extra, alignment: undefined } : row.extra });
    }
  }
  // A band's rows touch (no white gap inside it). Word puts a bottom border's space between the
  // text and the border, so the gap under the letterhead is the PDF's: its gapBelow (16 pt, or the
  // résumé's Header ↔ First section) below the rule or band — and, with neither (a Classic résumé's
  // border off, V2FIDB-51-2), the PDF's pad above it too.
  const below = look.gapBelow + (look.band || look.rules.length ? 0 : look.ruleGap);
  if (beside) {
    // Right of Name (R2-137): a two-cell borderless table — the name and title | the contacts, the
    // gap the contacts' left margin — framed as the letterhead is (frameTable): the band shading both
    // cells, or the rule(s) under both. Set against the right margin as the PDF's; a 2 Grid's rows
    // keep their tab stops. The gap under it is a paragraph of its own: a table has no space after.
    const name = rows.map((r, i) => line(r.runs, i === rows.length - 1 ? 0 : look.band && !r.kept ? 0 : r.after));
    const right = format.layout === '2grid' ? {} : { alignment: AlignmentType.RIGHT };
    const side = contactLines.map((r) => line(r.runs, 0, { ...r.extra, ...right }));
    return [
      frameTable([[{ children: name }, { children: side, margins: { left: beside.gap } }]], [beside.name, beside.contacts], {
        settings: s, band: look.band, rules: look.rules, ruleGap: look.ruleGap,
      }),
      ...gapPara(below),
    ];
  }
  rows.push(...contactLines);
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    return line(r.runs, last ? pt(below) : look.band && !r.kept ? 0 : r.after, { ...frame(look, last), ...r.extra });
  });
}

export function buildCoverLetter(resume) {
  const { personal = {}, settings = {}, coverLetter, template } = resume || {};
  const cl = coverLetter || {};
  // The résumé's colours as its PDF resolves them (the template's defaults for unset ones).
  const s = resolveTemplateSettings(settings, templateId(template));
  const look = letterheadLook(template, s);
  const textHex = hexOn(s.textColor, '#ffffff', '1e293b');
  // The PDF's colours: names in the Text colour, contacts and the designation in its grey (R1-13,
  // letterGrey: the résumé header's, R9-13) — the grey of the Text colour itself, as the PDF's,
  // not of its rounded Word hex (R9-0).
  const colors = { text: textHex, grey: hexOn(letterGrey(s.textColor), '#ffffff', '64748b') };
  const baseSize = s.fontSizeBase || 11;
  const sizes = {
    base: Math.round(baseSize * 2),
    name: Math.round((baseSize + (s.fontSizeNameDelta ?? 8)) * 2),
    title: Math.round((look.title?.size || (baseSize + (s.fontSizeEntryDelta ?? 0))) * 2),
    contact: Math.round(Math.max(8, baseSize - 0.5) * 2),
  };
  const text = { size: sizes.base, color: textHex };
  const block = letterBlock(cl, s);
  const sig = letterSignature(cl, personal);
  const gap = pt(12);

  const paras = letterhead(personal, s, cl, sizes, look);

  if (block.date) paras.push(line([normal(block.date, text)], gap));
  const recipient = [
    block.recipientName && bold(block.recipientName, text),
    block.recipientTitle && normal(block.recipientTitle, text),
    block.company && normal(block.company, text),
  ].filter(Boolean);
  recipient.forEach((run, i) => paras.push(line([run], i === recipient.length - 1 ? gap : 0)));
  if (block.subject) paras.push(line([bold(block.subject, text)], gap));

  // The body and the closing at Design → Line Height, as the letter's PDF prints them (R2-062), the
  // body's lists behind Design → Lists' glyph (R2-147).
  if (hasRichText(cl.body)) {
    paras.push(...descriptionToParagraphs(cl.body, { ...text, lineHeight: s.lineHeightValue, bullet: s.bulletStyle, links: linkLook(s.linkStyle, s.accentColor) }));
    paras.push(line([], pt(16)));
  }

  // Closing and signature stay together on one page.
  const closingLine = { spacing: { after: pt(sig.wide ? 24 : 8), ...lineSpacing(s.lineHeightValue, text.size) } };
  paras.push(new Paragraph({ children: [normal(sig.closing, text)], ...closingLine, keepNext: true }));
  if (sig.name) paras.push(line([bold(sig.name, text)], 0, { keepNext: !!sig.designation }));
  if (sig.designation) paras.push(line([normal(sig.designation, { ...text, color: colors.grey })]));
  return paras;
}
