// Design → Section Headings' colours, per template and style: what PdfSectionTitle draws, and what
// the Word résumé's headings take (wordExportUtils.js sectionHeading, ONB-12-NB1). Plain data and
// functions (no react-pdf), so both read the one table.
import { readableOn, solid, tint } from './pdfColors';

/**
 * The colours a section heading prints in, for `template` (an id), `headingStyle`, the résumé's
 * `accent` and Section Headings → Border colour `borderColor` ('' = the template's own):
 *   text       the title: the accent, or the neutral #374151 where the template's style prints it so
 *   ruled      Ruled's rule (a fill: translucent allowed) — Academic's, under a title in the accent, is
 *              the accent at 55 % on white unless a Border colour is picked (AcademicTemplatePDF.jsx)
 *   line       Line's rules beside the title (a fill)
 *   underline  Underline's border (opaque)
 *   bar        Left bar's bar
 *   box        Boxed's ground (a fill)
 *   chip       Boxed prints as a chip: the title reversed out of an opaque fill of Border colour (else
 *              the accent), the box as wide as the title — Banner's headings (BannerTemplatePDF.jsx).
 *              `text` is then white where it reads 4.5:1 on the fill, else the least-shifted tint of it
 *              that does; Word shades the heading's paragraph in the same fill (wordExportBuilders.js).
 */
export function sectionHeadingLook({ template, headingStyle, accent = '#2563eb', borderColor = '' }) {
  const bc = borderColor || accent;
  const chip = template === 'banner';
  const neutral = template === 'minimal'
    ? ['underline', 'ruled', 'leftbar'].includes(headingStyle)
    : (template === 'classic' || template === 'sidebar') && ['ruled', 'leftbar'].includes(headingStyle);
  return {
    chip,
    text: chip && headingStyle === 'box' ? readableOn('#ffffff', solid(bc), 4.5) : neutral ? '#374151' : accent,
    ruled: template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
      : template === 'academic' ? (borderColor || solid(accent, 0.55)) // the hairline under its titles
      : template === 'minimal' || template === 'executive' ? (borderColor || '#d1d5db')
      : (borderColor || '#e5e7eb'), // classic, sidebar
    line: template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
      : template === 'minimal' ? (borderColor || '#d1d5db')
      : template === 'executive' ? tint(bc, 0x50 / 255)
      : (borderColor || tint(accent, 0x40 / 255)), // classic, sidebar
    underline: solid(template === 'minimal' ? (borderColor || '#e5e7eb') : bc),
    bar: bc,
    box: chip ? solid(bc)
      : template === 'modern' ? tint(accent, 0x14 / 255)
      : template === 'minimal' ? tint(bc, 0x12 / 255)
      : tint(bc, 0x14 / 255), // executive, classic, sidebar
  };
}
