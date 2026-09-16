// The cover letter as Word paragraphs: the same text, order, colours and hidden contacts as the
// cover-letter PDF — letterhead (name, title, contacts in the résumé template's look), date,
// recipient block, subject, body, closing and signature. Sizes follow the letter's base font
// size. It is a text document: no photo, and the contacts are one line whatever the PDF's
// layout (R1-10), Icon printing as Bar.
//
// The letterhead takes the look the PDF's does (letterheadLook, FIDB-51): its colours, alignment
// and Name & Title layout, Modern's accent band and the Sidebar panel's colour as a shaded band,
// the résumé header's rule (else Minimal's hairline, Executive's double rule) as the last line's
// bottom border. Word runs the Sidebar band 15 pt into the page margins, not to the paper's edges
// as the PDF does, and prints the name and title in Word's own weights (Minimal's light name and
// an Inline title's medium are regular).
import { Paragraph, BorderStyle, ShadingType, AlignmentType } from 'docx';
import { accent2Hex, bold, normal, linked, contactSeparator, descriptionToParagraphs, inlineGap } from '@/utils/wordExportUtils';
import { contactItems } from '@/utils/contacts';
import { hasRichText } from '@/utils/richText';
import { letterBlock, letterContactFormat, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { solid } from '@/templates/pdf/shared/pdfColors';
import { letterGrey, letterheadLook, LETTERHEAD_GAP, LETTERHEAD_PAD } from '@/templates/pdf/shared/letterhead';
import { resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { templateId } from '@/constants/templates';
const pt = (n) => Math.round(n * 20); // points → twips (paragraph spacing, indents)
const eighths = (n) => Math.min(96, Math.max(2, Math.round(n * 8))); // points → Word's border widths (¼–12 pt)

const line = (children, after = 0, extra = {}) => new Paragraph({ children, spacing: { after }, ...extra });

/**
 * A colour as Word's 'rrggbb', opaque over `on` (the band a run sits on, else the white page), at
 * `alpha` times its own: what the PDF draws with that opacity (Word has none).
 */
const hexOn = (color, on = '#ffffff', fallback, alpha = 1) => accent2Hex(solid(color, alpha, on), fallback);

/**
 * The fill Word shades the letterhead's band in: the colour the PDF paints (a translucent one as it
 * shows over the white page), else — a colour Word cannot take — the look's own band colour
 * (letterheadLook's band.fallback), so a template's band brings its fallback with it: Word chose it
 * by the look's name, the Sidebar's slate or else Modern's blue (FIDB-51-VF7-NB2).
 */
const bandFill = (band) => hexOn(band.color, '#ffffff', hexOn(band.fallback));

/**
 * The paragraph formatting that frames the letterhead's rows: a band — each row shaded, with
 * borders of the band's own colour as its padding, so Word joins the rows into one block — or
 * the rule(s) under the last row.
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
      size: eighths(rule.width), color: hexOn(rule.color), space: LETTERHEAD_PAD,
    } },
  };
}

/** Name, title and contact line in the résumé template's look (letterheadLook). */
function letterhead(personal, s, cl, sizes, look) {
  // Runs on a band blend onto the fill Word shades (bandFill), as the PDF's onto the band it paints —
  // not onto a colour Word cannot take (the white page) or a translucent band's colour at full
  // strength; a colour Word cannot take is white there, ink on the page.
  const on = look.band ? `#${bandFill(look.band)}` : '#ffffff';
  const ink = (color, alpha) => hexOn(color, on, look.band ? 'ffffff' : '1e293b', alpha);
  const nameRun = look.name.weight === 'bold' ? bold : normal;
  const rows = [{ runs: [nameRun(personal.name || 'Your Name', { size: sizes.name, color: ink(look.name.color) })], after: pt(1) }];
  // Modern's title prints at 90 % on its band (look.title.opacity, R5-9): the same blend here.
  const title = personal.title ? normal(personal.title, { size: sizes.base, color: ink(look.title.color, look.title.opacity) }) : null;
  if (title && look.inline) {
    // Name & Title Layout "Inline" (V2FIDB-51-3): the title on the name's line, after a real space
    // (the line reads and copies as words) widened to the PDF's gap — as the résumé's (inlineGap).
    rows[0] = { runs: [...rows[0].runs, inlineGap(look.inline.gap, sizes.base), title], after: pt(2) };
  } else if (title) {
    rows.push({ runs: [title], after: pt(2) });
  }
  const contacts = contactItems(personal, letterHiddenFields(cl, personal));
  if (contacts.length) {
    const style = { size: sizes.contact, color: ink(look.contacts) };
    // The PDF's marks: a band's (letterheadLook's marks), else the page's greys (FIDB-51-VF1-NB1).
    const sep = () => contactSeparator(letterContactFormat(cl, s).style, style, look.marks && ink(look.marks));
    rows.push({ runs: contacts.flatMap((c, i) => [...(i ? [sep()] : []), linked(c.value, c.href, style)]) });
  }
  // A band's rows touch (no white gap inside it). Word puts a bottom border's space between the
  // text and the border, so the gap under the letterhead is the PDF's: 16 pt below the rule or band
  // — and, with neither (a Classic résumé's border off, V2FIDB-51-2), the PDF's pad above it too.
  const below = LETTERHEAD_GAP + (look.band || look.rules.length ? 0 : LETTERHEAD_PAD);
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    return line(r.runs, last ? pt(below) : look.band ? 0 : r.after, frame(look, last));
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
  if (sig.designation) paras.push(line([normal(sig.designation, { ...text, color: colors.grey })]));
  return paras;
}
