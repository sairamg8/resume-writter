// Design → Links (settings.linkStyle, R2-147): how every link the résumé prints looks — its contacts,
// an entry's URL, a link in a description — in the PDF (= the preview) and the Word export. Its own
// module with relative imports only, so the PDF, Word and Node's test runner read one rule.
import { readableOn } from '../templates/pdf/shared/pdfColors.js';

/** The styles Design → Links offers: Plain prints a link as the text around it, as every link printed before. */
export const LINK_STYLES = ['plain', 'underline', 'accent'];
export const DEFAULT_LINK_STYLE = 'plain';

/** A stored style as it prints: one the app offers, else Plain (an imported file's 'bold'). */
export const linkStyleOf = (style) => (LINK_STYLES.includes(style) ? style : DEFAULT_LINK_STYLE);

/**
 * What `style` adds to a link's own look: { underline: true } for Underline; for Accent, { color }
 * — the accent, or on a coloured `ground` (Modern's banner, Banner's band, the Sidebar's column, a
 * letterhead's band) the least-shifted tint of it that reads there (readableOn): the accent on an
 * accent banner is no link at all. Plain adds nothing.
 */
export function linkLook(style, accent, ground = null) {
  const s = linkStyleOf(style);
  if (s === 'underline') return { underline: true };
  if (s === 'accent') {
    const a = accent || '#2563eb';
    return { color: ground ? readableOn(a, ground) : a };
  }
  return {};
}
