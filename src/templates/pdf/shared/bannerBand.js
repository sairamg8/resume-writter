// The Banner template's band, as plain numbers (no react-pdf): the résumé's band and the strip on its
// later pages (BannerTemplatePDF.jsx) and the cover letter's letterhead (letterhead.js LOOKS.banner)
// read the one set.
import { MM_TO_PT } from './pdfUnits';

/**
 * The band's padding under its text, pt, where the settings carry no header gaps: BANNER_HEADER_GAPS'
 * headerPadY (src/constants/templates.js).
 */
export const BANNER_PAD_Y = 20;

/** The strip across the top of every page after the first, pt at most: the band, carried on. */
export const BANNER_STRIP = 6;

/**
 * The strip's height on a page whose top margin is `marginVmm`: BANNER_STRIP, or half the margin
 * where that is less, so it never reaches the text (a 0 mm margin draws none).
 */
export const bannerStripPt = (marginVmm) => Math.max(0, Math.min(BANNER_STRIP, (Number(marginVmm) || 0) * MM_TO_PT / 2));

/** The band's padding under its text in resolved settings `s`: its header gap, else the template's. */
export const bannerPadY = (s) => s?.headerGaps?.headerPadY ?? BANNER_PAD_Y;
