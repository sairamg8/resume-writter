// The Timeline template's rail, as plain numbers (no react-pdf): the résumé's rail (PdfTimeline.jsx)
// and the cover letter's letterhead rule (letterhead.js LOOKS.timeline) read the one width and colour.
import { solid } from './pdfColors';

/** The line's width (pt) and the accent's share in its colour on the white page. */
export const TIMELINE_RAIL = { width: 1.5, alpha: 0.35 };

/** The rail's colour: the accent at TIMELINE_RAIL.alpha on white (an opaque mix: a border takes no alpha). */
export const railColor = (accent) => solid(accent || '#2563eb', TIMELINE_RAIL.alpha);
