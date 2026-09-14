// The cover letter as Word paragraphs: the same content, order and hidden contacts as the
// cover-letter PDF — letterhead (name, title, contacts over an accent rule), date, recipient
// block, subject, body, closing and signature. Sizes follow the letter's base font size.
import { Paragraph, BorderStyle } from 'docx';
import { accent2Hex, bold, normal, linked, descriptionToParagraphs } from '@/utils/wordExportUtils';
import { contactItems } from '@/utils/contacts';
import { hasRichText } from '@/utils/richText';
import { letterBlock, letterHiddenFields, letterSignature } from '@/utils/coverLetter';

const DARK = '0f172a';
const GREY = '64748b';
const pt = (n) => Math.round(n * 20); // points → twips (paragraph spacing)

const line = (children, after = 0, extra = {}) => new Paragraph({ children, spacing: { after }, ...extra });

/** Name, title and contact line; the last of them carries the accent rule, as in the PDF. */
function letterhead(personal, settings, cl, sizes, accentHex) {
  const rows = [{ runs: [bold(personal.name || 'Your Name', { size: sizes.name, color: DARK })], after: pt(1) }];
  if (personal.title) rows.push({ runs: [normal(personal.title, { size: sizes.base, color: accentHex })], after: pt(2) });
  const contacts = contactItems(personal, letterHiddenFields(cl, personal));
  if (contacts.length) {
    const style = { size: sizes.contact, color: GREY };
    const sep = (cl.headerStyle || settings.contactStyle) === 'bullet' ? '  •  ' : '  |  ';
    rows.push({ runs: contacts.flatMap((c, i) => [...(i ? [normal(sep, style)] : []), linked(c.value, c.href, style)]) });
  }
  // Word measures border width in eighths of a point: 20 = the PDF's 2.5 pt rule, 12 pt below the text.
  const rule = { bottom: { style: BorderStyle.SINGLE, size: 20, color: accentHex, space: 12 } };
  return rows.map((r, i) => (i === rows.length - 1
    ? line(r.runs, pt(16), { border: rule })
    : line(r.runs, r.after)));
}

export function buildCoverLetter(resume) {
  const { personal = {}, settings = {}, coverLetter } = resume || {};
  const cl = coverLetter || {};
  const accentHex = accent2Hex(settings.accentColor);
  const textHex = accent2Hex(settings.textColor, '1e293b');
  const baseSize = settings.fontSizeBase || 11;
  const sizes = {
    base: Math.round(baseSize * 2),
    name: Math.round((baseSize + (settings.fontSizeNameDelta ?? 8)) * 2),
    contact: Math.round(Math.max(8, baseSize - 0.5) * 2),
  };
  const text = { size: sizes.base, color: textHex };
  const block = letterBlock(cl);
  const sig = letterSignature(cl, personal);
  const gap = pt(12);

  const paras = letterhead(personal, settings, cl, sizes, accentHex);

  if (block.date) paras.push(line([normal(block.date, text)], gap));
  const recipient = [
    block.recipientName && bold(block.recipientName, { ...text, color: DARK }),
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
  if (sig.name) paras.push(line([bold(sig.name, { ...text, color: DARK })], 0, { keepNext: !!sig.designation }));
  if (sig.designation) paras.push(line([normal(sig.designation, { ...text, color: GREY })]));
  return paras;
}
