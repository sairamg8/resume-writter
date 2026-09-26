// The cover letter as plain text (Export → Cover Letter Text on the letter's tab, R2-131): what its
// PDF and Word print, in their order — name, title, the contacts the letter shows, date, recipient
// block, subject, body, closing and signature — for pasting into an application form's letter box.
// Until it existed the letter's tab offered only the résumé's text exports.
import { contactHref, contactItems, displayUrl } from '@/utils/contacts';
import { letterBlock, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { hasRichText, parseRichText } from '@/utils/richText';

/**
 * The body's lines: each paragraph as typed (one line per line break) with a blank line after it,
 * a list item as "- …" (nested ones indented, a numbered one with its number), links as their text.
 */
function bodyLines(html) {
  const out = [];
  let inList = false;
  for (const block of parseRichText(html)) {
    const lines = block.runs.map((r) => r.text).join('').split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!lines.length) continue;
    if (block.marker) {
      const pad = '  '.repeat(Math.max(0, block.indent - 1));
      const lead = block.marker.length === 1 ? '-' : block.marker;
      lines.forEach((line, i) => out.push(i ? `${pad}  ${line}` : `${pad}${lead} ${line}`));
      inList = true;
    } else {
      if (inList) out.push('');
      out.push(...lines, '');
      inList = false;
    }
  }
  if (inList) out.push('');
  return out;
}

/**
 * A contact as plain text prints it: text cannot carry a link, so a website, LinkedIn or GitHub shown
 * under a Display label keeps its address beside the label ("LinkedIn (linkedin.com/in/jdoe)"), the
 * address its Link URL override points to when set. Anything else prints as the letter shows it.
 */
function contactText(personal, { key, value }) {
  const label = String(personal[`${key}Label`] || '').trim();
  // A Link URL the PDF would not follow (a javascript: address) is not printed either.
  if (!label || !['website', 'linkedin', 'github'].includes(key) || !contactHref(key, personal)) return value;
  const address = displayUrl(String(personal[`${key}Url`] || '').trim() || personal[key]);
  return address && address !== label ? `${label} (${address})` : label;
}

/** The letter of `resume` as plain text; '' for no résumé. */
export function generateCoverLetterPlainText(resume) {
  if (!resume) return '';
  const { personal = {}, settings = {} } = resume;
  const cl = resume.coverLetter || {};
  const block = letterBlock(cl, settings);
  const sig = letterSignature(cl, personal);
  const lines = [];
  const group = (parts) => {
    const shown = parts.filter(Boolean);
    if (shown.length) lines.push(...shown, '');
  };

  group([personal.name, personal.title, contactItems(personal, letterHiddenFields(cl, personal)).map((c) => contactText(personal, c)).join(' | ')]);
  group([block.date]);
  group([block.recipientName, block.recipientTitle, block.company]);
  group([block.subject]);
  if (hasRichText(cl.body)) lines.push(...bodyLines(cl.body));
  lines.push(sig.closing, ...(sig.wide ? [''] : []), ...[sig.name, sig.designation].filter(Boolean));

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
