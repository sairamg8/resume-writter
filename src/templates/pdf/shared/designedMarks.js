// The designed layouts' marks as plain numbers (no react-pdf), read by their PDFs (src/templates/pdf/*TemplatePDF.jsx)
// and their cover letters' letterheads (letterhead.js LOOKS), so a letter and its résumé draw one mark (R2-138 B2).
import { solid } from './pdfColors';

/** Gridline's hairlines over and under its header, pt, in the accent at half strength. */
export const GRID_HAIRLINE = 0.75;
export const gridHairlineColor = (accent) => solid(accent, 0.5);

/** Registry's bar over the name, pt tall, and the space under it. */
export const REGISTRY_BAR = 4;
export const REGISTRY_BAR_GAP = 10;

/** Bookend's heavy rules closing its header and running along every page's foot, pt. */
export const BOOKEND_RULE = 3;
export const BOOKEND_FOOT = 1.5;

/** Lectern's short rule centred under its header: pt wide and tall. */
export const LECTERN_RULE = { width: 48, height: 2 };

/** Chronicle's thick-and-thin masthead rule: the thick one's and the thin one's width, and the space between, pt. */
export const CHRONICLE_RULES = { thick: 2.5, thin: 0.75, gap: 1.5 };

/** Keystone's wedge beside the name: pt wide and tall. */
export const KEYSTONE_WEDGE = { width: 18, height: 26 };

/** Banded's band: the tint of the accent it fills with, and its padding under the text, pt. */
export const BANDED_TINT = 0x1c / 255;
export const BANDED_PAD = 14;

/** Keel's bar down the header's left side, pt wide, and the space between it and the text. */
export const KEEL_BAR = 4;
export const KEEL_PAD = 10;

/** Linen's short stitch over the name: pt wide and tall. */
export const LINEN_STITCH = { width: 36, height: 1.5 };

/** Broadsheet's heavy rule under its headline name, pt, and the space over and under it. */
export const BROADSHEET_RULE = 3;
export const BROADSHEET_RULE_GAP = 4;

/** Banded's band colour for `accent`: opaque, so the letter and Word fill it as the PDF does. */
export const bandedGround = (accent) => solid(accent || '#2563eb', BANDED_TINT);
