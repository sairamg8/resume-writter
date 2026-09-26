// Design → Section Headings' colours, per template and style: what PdfSectionTitle draws, and what
// the Word résumé's headings take (wordExportUtils.js sectionHeading, ONB-12-NB1). Plain data and
// functions (no react-pdf), so both read the one table.
import { readableOn, solid, tint } from './pdfColors';
import { tracking } from './pdfUnits';

/**
 * A section title's letter-spacing, pt, at `size` pt: Design → Title Spacing `pct` (% of the size,
 * SECTION_LETTER_SPACING), or — unset — the 0.7 pt titles always had, narrower below 11.7 pt so
 * small titles still extract as words (tracking()). PdfSectionTitle and the Word headings (R2-146).
 */
export const titleTracking = (size, pct) => (typeof pct === 'number' ? tracking(size, (size * pct) / 100) : tracking(size, 0.7));

/** titleTracking in whole % of `size`: what Title Spacing shows. */
export const titleTrackingPct = (size, pct) => (typeof pct === 'number' ? pct : Math.round((titleTracking(size) / size) * 100));

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
 *   short      Line after prints a short rule after the title, not one to the column's end: Compact's
 *              inline headings (CompactTemplatePDF.jsx) — the rule SHORT_RULE_EM × the title's size
 *              long, in Border colour, else the accent at full strength. Word prints Line after as a
 *              bottom border on every template: a paragraph's border cannot stop short.
 *   variant    the designed layouts' own mark under their own heading style (R2-138 B2), else null —
 *              drawn by PdfSectionTitle; Word prints the style's plain form, as it does Compact's:
 *                framed    Ruled with a rule above the title as well (Gridline)
 *                overline  Ruled with the rule above the title, none under it (Broadsheet)
 *                dotted    Underline dotted (Registry)
 *                double    Underline doubled (Chronicle)
 *                soft      Underline only as wide as the title (Linen)
 *                edge      Boxed with a bar of Border colour at its left edge (Keystone)
 *                bleed     Boxed as a band to the paper's edges, the title on the margin (Banded)
 *   center     every section title centred, whatever the section's Alignment (Lectern)
 */
export function sectionHeadingLook({ template, headingStyle, accent = '#2563eb', borderColor = '' }) {
  const bc = borderColor || accent;
  const chip = template === 'banner';
  const short = template === 'compact';
  const neutral = template === 'minimal'
    ? ['underline', 'ruled', 'leftbar'].includes(headingStyle)
    : (template === 'classic' || template === 'sidebar') && ['ruled', 'leftbar'].includes(headingStyle);
  return {
    chip,
    short,
    variant: VARIANTS[template]?.[headingStyle] || null,
    center: template === 'lectern',
    text: chip && headingStyle === 'box' ? readableOn('#ffffff', solid(bc), 4.5) : neutral ? '#374151' : accent,
    ruled: template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
      : template === 'academic' ? (borderColor || solid(accent, 0.55)) // the hairline under its titles
      : template === 'gridline' ? (borderColor || solid(accent, 0.5)) // the hairlines above and under its titles
      : template === 'broadsheet' ? solid(bc) // the rule over its titles, as heavy as the ink
      : template === 'minimal' || template === 'executive' ? (borderColor || '#d1d5db')
      : (borderColor || '#e5e7eb'), // classic, sidebar
    line: short ? solid(bc)
      : template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
      : template === 'minimal' ? (borderColor || '#d1d5db')
      : template === 'executive' ? tint(bc, 0x50 / 255)
      : (borderColor || tint(accent, 0x40 / 255)), // classic, sidebar
    underline: solid(template === 'minimal' ? (borderColor || '#e5e7eb') : bc),
    bar: bc,
    // Modern's box took the accent whatever the Border colour, under a control that stayed enabled
    // (R2-119): it tints the Border colour as the others do — the accent's tint while none is picked.
    box: chip ? solid(bc)
      : template === 'minimal' ? tint(bc, 0x12 / 255)
      : tint(bc, 0x14 / 255), // executive, classic, sidebar, modern
  };
}

/** Each designed layout's own heading mark, under the heading style it brings (sectionHeadingLook's `variant`). */
const VARIANTS = {
  gridline: { ruled: 'framed' },
  broadsheet: { ruled: 'overline' },
  registry: { underline: 'dotted' },
  chronicle: { underline: 'double' },
  linen: { underline: 'soft' },
  keystone: { box: 'edge' },
  banded: { box: 'bleed' },
};

/** The part of the look Border colour sets under each style; Plain has none. */
const BORDER_PART = { ruled: 'ruled', line: 'line', underline: 'underline', leftbar: 'bar', box: 'box' };

/**
 * What Section Headings → Border colour shows while none is picked (R2-088): the colour that, picked,
 * prints what the heading prints now — the accent where the style draws in it (`accent: true`),
 * else the template's own rule, opaque on the white page (Classic's Ruled is a light grey, not the
 * accent). `null` under Plain, which draws no border.
 */
export function headingBorderDefault({ template, headingStyle, accent = '#2563eb' }) {
  const part = BORDER_PART[headingStyle];
  if (!part) return null;
  const own = sectionHeadingLook({ template, headingStyle, accent })[part];
  const base = solid(accent);
  const isAccent = solid(sectionHeadingLook({ template, headingStyle, accent, borderColor: base })[part]) === solid(own);
  return { color: isAccent ? base : solid(own), accent: isAccent };
}

/** Compact's short rule after a section title (Line after), in multiples of the title's font size. */
export const SHORT_RULE_EM = 3;
