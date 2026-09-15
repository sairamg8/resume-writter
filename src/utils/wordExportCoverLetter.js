// The cover letter as Word paragraphs: the same text, order, colours and hidden contacts as the
// cover-letter PDF — letterhead (name, title, contacts in the résumé template's look), date,
// recipient block, subject, body, closing and signature. Sizes follow the letter's base font
// size. It is a text document: no photo, and the contacts are one line whatever the PDF's
// layout (R1-10).
//
// The letterhead takes the look the PDF's does (letterheadLook, FIDB-51): its colours and
// alignment, Modern's accent band and the Sidebar panel's colour as a shaded band, Classic's
// rule, Minimal's hairline and Executive's double rule as the last line's bottom border. Word
// keeps the band inside the page margins (the PDF runs the Sidebar band to the paper's edges)
// and prints the name in Word's own weights (Minimal's light name is regular).
import { Paragraph, BorderStyle, ShadingType, AlignmentType } from 'docx';
import { accent2Hex, bold, normal, linked, descriptionToParagraphs } from '@/utils/wordExportUtils';
import { contactItems } from '@/utils/contacts';
import { hasRichText } from '@/utils/richText';
import { letterBlock, letterContactFormat, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { letterheadLook, LETTERHEAD_GAP, LETTERHEAD_PAD } from '@/templates/pdf/shared/letterhead';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { templateId } from '@/constants/templates';
const pt = (n) => Math.round(n * 20); // points → twips (paragraph spacing, indents)
const eighths = (n) => Math.round(n * 8); // points → Word's border widths

const line = (children, after = 0, extra = {}) => new Paragraph({ children, spacing: { after }, ...extra });

/**
 * A colour as Word's 'rrggbb', opaque over `on` (the band a run sits on, else the white page), at
 * `alpha` times its own: what the PDF draws with that opacity (Word has none).
 */
const hexOn = (color, on = '#ffffff', fallback, alpha = 1) => accent2Hex(solid(color, alpha, on), fallback);

/**
 * The paragraph formatting that frames the letterhead's rows: a band — each row shaded, with
 * borders of the band's own colour as its padding, so Word joins the rows into one block — or
 * the rule(s) under the last row.
 */
function frame(look, last) {
  const align = look.centered ? { alignment: AlignmentType.CENTER } : {};
  if (look.band) {
    const fill = hexOn(look.band.color, '#ffffff', look.look === 'sidebar' ? '1e293b' : '2563eb');
    const edge = (space) => ({ style: BorderStyle.SINGLE, size: 4, color: fill, space });
    const padX = look.band.padX || look.band.padY;
    return {
      ...align,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      border: { top: edge(look.band.padY), bottom: edge(look.band.padY), left: edge(padX), right: edge(padX) },
      // The band sits inside the margins: the text is inset by the padding, as in the PDF.
      indent: { left: pt(padX), right: pt(padX) },
    };
  }
  const [rule, second] = look.rules;
  if (!last || !rule) return align;
  return {
    ...align,
    border: { bottom: {
      style: second ? BorderStyle.DOUBLE : BorderStyle.SINGLE,
      size: eighths(rule.width), color: hexOn(rule.color), space: LETTERHEAD_PAD,
    } },
  };
}

/** Name, title and contact line in the résumé template's look (letterheadLook). */
function letterhead(personal, s, cl, sizes, look) {
  // Runs on a band blend onto it; a colour Word cannot take is white there, ink on the page.
  const on = look.band ? look.band.color : '#ffffff';
  const ink = (color, alpha) => hexOn(color, on, look.band ? 'ffffff' : '1e293b', alpha);
  const nameRun = look.name.weight === 'bold' ? bold : normal;
  const rows = [{ runs: [nameRun(personal.name || 'Your Name', { size: sizes.name, color: ink(look.name.color) })], after: pt(1) }];
  // Modern's title prints at 90 % on its band (look.title.opacity, R5-9): the same blend here.
  if (personal.title) rows.push({ runs: [normal(personal.title, { size: sizes.base, color: ink(look.title.color, look.title.opacity) })], after: pt(2) });
  const contacts = contactItems(personal, letterHiddenFields(cl, personal));
  if (contacts.length) {
    const style = { size: sizes.contact, color: ink(look.contacts) };
    const sep = letterContactFormat(cl, s).style === 'bullet' ? '  •  ' : '  |  ';
    rows.push({ runs: contacts.flatMap((c, i) => [...(i ? [normal(sep, style)] : []), linked(c.value, c.href, style)]) });
  }
  // A band's rows touch (no white gap inside it). Word puts a bottom border's space between the
  // text and the border, so the gap under the letterhead is the PDF's: 16 pt below the rule or band.
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    return line(r.runs, last ? pt(LETTERHEAD_GAP) : look.band ? 0 : r.after, frame(look, last));
  });
}

export function buildCoverLetter(resume) {
  const { personal = {}, settings = {}, coverLetter, template } = resume || {};
  const cl = coverLetter || {};
  // The résumé's colours as its PDF resolves them (the template's defaults for unset ones).
  const s = resolveTemplateSettings(settings, templateId(template));
  const look = letterheadLook(template, s);
  const textHex = hexOn(s.textColor, '#ffffff', '1e293b');
  // The PDF's colours: names in the Text colour, contacts and the designation in its grey (R1-13)
  // — the grey of the Text colour itself, as the PDF's, not of its rounded Word hex (R9-0).
  const colors = { text: textHex, meta: hexOn(textShades(s.textColor).meta, '#ffffff', '64748b') };
  const baseSize = s.fontSizeBase || 11;
  const sizes = {
    base: Math.round(baseSize * 2),
    name: Math.round((baseSize + (s.fontSizeNameDelta ?? 8)) * 2),
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

  if (hasRichText(cl.body)) {
    paras.push(...descriptionToParagraphs(cl.body, text));
    paras.push(line([], pt(16)));
  }

  // Closing and signature stay together on one page.
  paras.push(line([normal(sig.closing, text)], pt(sig.wide ? 24 : 8), { keepNext: true }));
  if (sig.name) paras.push(line([bold(sig.name, text)], 0, { keepNext: !!sig.designation }));
  if (sig.designation) paras.push(line([normal(sig.designation, { ...text, color: colors.meta })]));
  return paras;
}
