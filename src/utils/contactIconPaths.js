/**
 * The contact-icon packs as data — the one table both the editor (SVG, contactIcons.jsx) and the
 * PDF (react-pdf, PdfIcons.jsx) draw from, so a pack cannot look different in the export.
 *
 * Each icon is a list of [tag, attributes] on a 24×24 view box (Lucide's icon-node shape).
 * An outline pack strokes every shape in the text colour at the pack's stroke width; the filled
 * pack fills them. `paint: 'fill'` fills one shape of an outline pack (the dots of "Modern").
 * Holes (the Filled pack's pin, globe and LinkedIn "in") are even-odd cut-outs, never white
 * shapes, so they show whatever the icon sits on — a white page, the Modern banner, the Sidebar.
 */

/** "Classic": Lucide's mail, phone, map-pin and globe (lucide-react 1.28, ISC) and Lucide-style LinkedIn / GitHub marks. */
const LUCIDE = {
  email: [
    ['path', { d: 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7' }],
    ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
  ],
  phone: [
    ['path', { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' }],
  ],
  location: [
    ['path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' }],
    ['circle', { cx: 12, cy: 10, r: 3 }],
  ],
  website: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
    ['path', { d: 'M2 12h20' }],
  ],
  linkedin: [
    ['path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' }],
    ['rect', { x: 2, y: 9, width: 4, height: 12 }],
    ['circle', { cx: 4, cy: 4, r: 2 }],
  ],
  github: [
    ['path', { d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S9 17.44 9 18v4' }],
    ['path', { d: 'M9 18c-4.51 2-5-2-7-2' }],
  ],
};

/** "Modern": refined marks — a smartphone instead of a handset, a rounded LinkedIn tile. */
const REFINED = {
  email: [
    ['rect', { x: 3, y: 5, width: 18, height: 14, rx: 2.5 }],
    ['path', { d: 'm3.5 7.5 7.6 5.2a1.5 1.5 0 0 0 1.8 0l7.6-5.2' }],
  ],
  phone: [
    ['rect', { x: 7, y: 2.5, width: 10, height: 19, rx: 2.25 }],
    ['path', { d: 'M10 5.25h4' }],
    ['circle', { cx: 12, cy: 17.5, r: 0.9, paint: 'fill' }],
  ],
  location: [
    ['path', { d: 'M12 21s-6.5-5.2-6.5-10.2a6.5 6.5 0 1 1 13 0C18.5 15.8 12 21 12 21z' }],
    ['circle', { cx: 12, cy: 10.5, r: 2.25 }],
  ],
  website: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M3 12h18' }],
    ['path', { d: 'M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z' }],
  ],
  linkedin: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }],
    ['path', { d: 'M8 11v6' }],
    ['circle', { cx: 8, cy: 8, r: 0.9, paint: 'fill' }],
    ['path', { d: 'M12 17v-4.2c0-1.4.7-2.3 1.9-2.3 1.1 0 1.6.7 1.6 2.2V17' }],
    ['path', { d: 'M12 11.5V17' }],
  ],
  github: [
    ['path', { d: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21' }],
  ],
};

/** "Minimal": ultra-simple geometric marks. */
const MINIMAL = {
  email: [
    ['rect', { x: 3.5, y: 6, width: 17, height: 12, rx: 1.5 }],
    ['path', { d: 'm4 7 8 5.5L20 7' }],
  ],
  phone: [
    ['path', { d: 'M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z' }],
    ['path', { d: 'M10 17.5h4' }],
  ],
  location: [
    ['path', { d: 'M12 21s-5.5-4.8-5.5-9.5a5.5 5.5 0 1 1 11 0C17.5 16.2 12 21 12 21z' }],
    ['circle', { cx: 12, cy: 11, r: 1.8 }],
  ],
  website: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M3.5 12h17M12 3.5c2.5 2.8 2.5 14.2 0 17M12 3.5c-2.5 2.8-2.5 14.2 0 17' }],
  ],
  linkedin: [
    ['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 2 }],
    ['path', { d: 'M8 10.5v6M8 8.2v.01M12 16.5v-4c0-1.2.8-2 1.9-2 1 0 1.6.6 1.6 1.9v4.1' }],
  ],
  github: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M9.5 17.5v-2c0-1 .4-1.5 1-1.8-2.2-.2-3.5-1.2-3.5-3.2 0-.7.2-1.3.7-1.8-.1-.2-.3-1 .1-1.7 0 0 .6-.2 1.9.7.5-.1 1.1-.2 1.8-.2s1.3.1 1.8.2c1.3-.9 1.9-.7 1.9-.7.4.7.2 1.5.1 1.7.5.5.7 1.1.7 1.8 0 2-1.3 3-3.5 3.2.6.3 1 1 1 1.8v2' }],
  ],
};

/** "Filled": solid marks — envelope, handset, pin, globe, LinkedIn badge, GitHub cat. */
const FILLED = {
  email: [
    ['path', { d: 'M2.75 6.5A2.75 2.75 0 0 1 5.5 3.75h13A2.75 2.75 0 0 1 21.25 6.5v11a2.75 2.75 0 0 1-2.75 2.75h-13A2.75 2.75 0 0 1 2.75 17.5v-11zm1.85.9 6.7 4.55c.4.27.9.27 1.3 0l6.7-4.55v-.4c0-.55-.45-1-1-1h-13c-.55 0-1 .45-1 1v.4z' }],
  ],
  phone: [
    ['path', { d: 'M7.05 2.6c.7-1.15 2.2-1.55 3.4-.9l1.65.9c.95.5 1.3 1.7.85 2.7l-.65 1.55c-.25.6-.1 1.3.4 1.7l2.05 2.05c.45.45 1.15.6 1.7.4l1.55-.65c1-.45 2.2-.1 2.7.85l.9 1.65c.65 1.2.25 2.7-.9 3.4-1.55.9-3.45 1.55-5.3 1.55-6.35 0-11.5-5.15-11.5-11.5 0-1.85.65-3.75 1.55-5.3.5-.85 1.5-1.3 2.55-1z' }],
  ],
  location: [
    ['path', { fillRule: 'evenodd', d: 'M12 2.5c-3.9 0-7 3.05-7 6.8 0 4.55 5.4 10.55 6.55 11.75a.7.7 0 0 0 .9 0C13.6 19.85 19 13.85 19 9.3c0-3.75-3.1-6.8-7-6.8zm0 9.3a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z' }],
  ],
  website: [
    ['path', { fillRule: 'evenodd', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-7.5 9.2h3.05c.15-2.05.7-3.9 1.5-5.35A8.05 8.05 0 0 0 4.5 11.2zm4.55 1.6H4.5a8.05 8.05 0 0 0 4.55 5.35c-.8-1.45-1.35-3.3-1.5-5.35zm1.5 0h3.9c-.15 2.2-.75 4.15-1.65 5.55-.4.6-.8 1.05-1.3 1.4-.5-.35-.9-.8-1.3-1.4-.9-1.4-1.5-3.35-1.65-5.55zm0-1.6c.15-2.2.75-4.15 1.65-5.55.4-.6.8-1.05 1.3-1.4.5.35.9.8 1.3 1.4.9 1.4 1.5 3.35 1.65 5.55h-5.9zm5.4 0h3.05a8.05 8.05 0 0 0-4.55-5.35c.8 1.45 1.35 3.3 1.5 5.35zm0 1.6c-.15 2.05-.7 3.9-1.5 5.35a8.05 8.05 0 0 0 4.55-5.35h-3.05z' }],
  ],
  linkedin: [
    // The tile with the "in" cut out of it.
    ['path', { fillRule: 'evenodd', d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7.15 9.9h2.05v7.35H7.15V9.9zm1.02-3.25a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM11.2 9.9h1.96v1h.03c.27-.52.94-1.07 1.94-1.07 2.07 0 2.45 1.36 2.45 3.13v4.29h-2.05v-3.8c0-.9-.02-2.07-1.26-2.07-1.26 0-1.45.99-1.45 2v3.87H11.2V9.9z' }],
  ],
  github: [
    ['path', { d: 'M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.32.1-2.75 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.9-1.32 2.74-1.05 2.74-1.05.55 1.43.2 2.49.1 2.75.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.48-.01 2.82 0 .26.18.58.69.48A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2z' }],
  ],
};

/** Every pack the Design panel offers, by settings.iconSet id. "Bold" is Classic drawn heavier. */
export const ICON_PACKS = {
  filled:  { paint: 'fill', icons: FILLED },
  lucide:  { paint: 'stroke', strokeWidth: 2, icons: LUCIDE },
  refined: { paint: 'stroke', strokeWidth: 1.75, icons: REFINED },
  minimal: { paint: 'stroke', strokeWidth: 1.5, icons: MINIMAL },
  bold:    { paint: 'stroke', strokeWidth: 2.6, icons: LUCIDE },
};

/** The pack in effect: settings.iconSet when it names a pack, else Classic. */
export function getIconSetId(settings) {
  const id = settings?.iconSet;
  return ICON_PACKS[id] ? id : 'lucide';
}

/** The image the user uploaded for this field (a data URL), or null. */
export function getCustomContactIcon(field, settings) {
  const map = settings?.customContactIcons;
  if (!map || typeof map !== 'object') return null;
  const src = map[field];
  return typeof src === 'string' && src.trim() ? src.trim() : null;
}

/**
 * The shapes of one icon, ready for either renderer: [{ tag, props }] with fill, stroke and
 * stroke width resolved for `color` ('currentColor' in the editor, a hex colour in the PDF).
 * `strokeWidth` overrides the pack's own. Null for an unknown pack or field.
 */
export function iconShapes(setId, field, { color, strokeWidth } = {}) {
  const pack = ICON_PACKS[setId];
  const shapes = pack?.icons[field];
  if (!shapes) return null;
  const sw = strokeWidth ?? pack.strokeWidth;
  return shapes.map(([tag, { paint = pack.paint, ...attrs }]) => ({
    tag,
    props: paint === 'fill'
      ? { fill: color, stroke: 'none', ...attrs }
      : { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', ...attrs },
  }));
}
