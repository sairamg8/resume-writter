// Design → Section Headings' colours, per template and style: what PdfSectionTitle draws, and what
// the Word résumé's headings take (wordExportUtils.js sectionHeading, ONB-12-NB1). Plain data and
// functions (no react-pdf), so both read the one table.
import { solid, tint } from './pdfColors';

/**
 * The colours a section heading prints in, for `template` (an id), `headingStyle`, the résumé's
 * `accent` and Section Headings → Border colour `borderColor` ('' = the template's own):
 *   text       the title: the accent, or the neutral #374151 where the template's style prints it so
 *   ruled      Ruled's rule (a fill: translucent allowed)
 *   line       Line's rules beside the title (a fill)
 *   underline  Underline's border (opaque)
 *   bar        Left bar's bar
 *   box        Boxed's ground (a fill)
 */
export function sectionHeadingLook({ template, headingStyle, accent = '#2563eb', borderColor = '' }) {
  const bc = borderColor || accent;
  const neutral = template === 'minimal'
    ? ['underline', 'ruled', 'leftbar'].includes(headingStyle)
    : (template === 'classic' || template === 'sidebar') && ['ruled', 'leftbar'].includes(headingStyle);
  return {
    text: neutral ? '#374151' : accent,
    ruled: template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
      : template === 'minimal' || template === 'executive' ? (borderColor || '#d1d5db')
      : (borderColor || '#e5e7eb'), // classic, sidebar
    line: template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
      : template === 'minimal' ? (borderColor || '#d1d5db')
      : template === 'executive' ? tint(bc, 0x50 / 255)
      : (borderColor || tint(accent, 0x40 / 255)), // classic, sidebar
    underline: solid(template === 'minimal' ? (borderColor || '#e5e7eb') : bc),
    bar: bc,
    box: template === 'modern' ? tint(accent, 0x14 / 255)
      : template === 'minimal' ? tint(bc, 0x12 / 255)
      : tint(bc, 0x14 / 255), // executive, classic, sidebar
  };
}
