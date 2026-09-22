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

/**
 * What the user set for this field's icon, or null: an uploaded image (a data URL), or a vector
 * choice from the header icon picker — `icon:<id>` (HEADER_ICONS) or `pack:<id>` (ICON_PACKS).
 */
export function getCustomContactIcon(field, settings) {
  const map = settings?.customContactIcons;
  if (!map || typeof map !== 'object') return null;
  const src = map[field];
  return typeof src === 'string' && src.trim() ? src.trim() : null;
}

/**
 * True when a field's icon (getCustomContactIcon) is an image to draw — a data URL or a web
 * address — rather than a picker choice drawn from the shapes. The editor and the PDF both ask
 * this, so a picked icon cannot be taken for an image address in one and not the other.
 */
export function isContactIconImage(src) {
  return typeof src === 'string' && /^(data:image\/|https?:\/\/)/.test(src);
}

/**
 * Curated registry of selectable header vector icons for each contact field and general use.
 * All icons use 24x24 viewBox and pure SVG tags ('path', 'rect', 'circle') compatible
 * with both web SVG and @react-pdf/renderer Svg.
 */
export const HEADER_ICONS = {
  // --- Email & Messages ---
  'mail': {
    id: 'mail',
    label: 'Mail Envelope',
    category: 'email',
    fields: ['email'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7' }],
      ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
    ],
  },
  'mail-open': {
    id: 'mail-open',
    label: 'Open Mail',
    category: 'email',
    fields: ['email'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z' }],
      ['path', { d: 'm22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10' }],
    ],
  },
  'send': {
    id: 'send',
    label: 'Paper Plane',
    category: 'email',
    fields: ['email', 'website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm22 2-7 20-4-9-9-4Z' }],
      ['path', { d: 'M22 2 11 13' }],
    ],
  },
  'at-sign': {
    id: 'at-sign',
    label: 'At Sign (@)',
    category: 'email',
    fields: ['email'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 12, cy: 12, r: 4 }],
      ['path', { d: 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8' }],
    ],
  },
  'inbox': {
    id: 'inbox',
    label: 'Inbox Tray',
    category: 'email',
    fields: ['email'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M22 12h-6l-2 3h-4l-2-3H2' }],
      ['path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }],
    ],
  },
  'message-square': {
    id: 'message-square',
    label: 'Message Box',
    category: 'email',
    fields: ['phone', 'email'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }],
    ],
  },

  // --- Phone & Mobile ---
  'phone': {
    id: 'phone',
    label: 'Handset',
    category: 'phone',
    fields: ['phone'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' }],
    ],
  },
  'smartphone': {
    id: 'smartphone',
    label: 'Smartphone',
    category: 'phone',
    fields: ['phone'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 5, y: 2, width: 14, height: 20, rx: 2, ry: 2 }],
      ['path', { d: 'M12 18h.01' }],
    ],
  },
  'phone-call': {
    id: 'phone-call',
    label: 'Active Call',
    category: 'phone',
    fields: ['phone'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' }],
      ['path', { d: 'M16 3a5 5 0 0 1 5 5' }],
      ['path', { d: 'M16 7a1 1 0 0 1 1 1' }],
    ],
  },
  'phone-forwarded': {
    id: 'phone-forwarded',
    label: 'Call Forward',
    category: 'phone',
    fields: ['phone'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384' }],
      ['path', { d: 'M18 2l4 4-4 4' }],
      ['path', { d: 'M14 6h8' }],
    ],
  },
  'message-circle': {
    id: 'message-circle',
    label: 'Chat Bubble',
    category: 'phone',
    fields: ['phone', 'email'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' }],
    ],
  },
  'hash': {
    id: 'hash',
    label: 'Number (#)',
    category: 'phone',
    fields: ['phone'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18' }],
    ],
  },

  // --- Location & Map ---
  'map-pin': {
    id: 'map-pin',
    label: 'Map Pin',
    category: 'location',
    fields: ['location'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' }],
      ['circle', { cx: 12, cy: 10, r: 3 }],
    ],
  },
  'navigation': {
    id: 'navigation',
    label: 'Compass Arrow',
    category: 'location',
    fields: ['location'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M3 11 22 2 13 21 11 13 3 11Z' }],
    ],
  },
  'compass': {
    id: 'compass',
    label: 'Compass Rose',
    category: 'location',
    fields: ['location'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 12, cy: 12, r: 10 }],
      ['path', { d: 'm16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z' }],
    ],
  },
  'home': {
    id: 'home',
    label: 'Home / Residence',
    category: 'location',
    fields: ['location'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
      ['path', { d: 'M9 22V12h6v10' }],
    ],
  },
  'building': {
    id: 'building',
    label: 'City Building',
    category: 'location',
    fields: ['location', 'linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 4, y: 2, width: 16, height: 20, rx: 2, ry: 2 }],
      ['path', { d: 'M9 22v-4h6v4' }],
      ['path', { d: 'M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01' }],
    ],
  },
  'map': {
    id: 'map',
    label: 'Folded Map',
    category: 'location',
    fields: ['location'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z' }],
      ['path', { d: 'M9 3v15M15 6v15' }],
    ],
  },

  // --- Website & Online Links ---
  'globe': {
    id: 'globe',
    label: 'World Globe',
    category: 'website',
    fields: ['website', 'location'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 12, cy: 12, r: 10 }],
      ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
      ['path', { d: 'M2 12h20' }],
    ],
  },
  'link': {
    id: 'link',
    label: 'Chain Link',
    category: 'website',
    fields: ['website', 'linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }],
      ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }],
    ],
  },
  'external-link': {
    id: 'external-link',
    label: 'External Link',
    category: 'website',
    fields: ['website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
      ['path', { d: 'M15 3h6v6' }],
      ['path', { d: 'M10 14 21 3' }],
    ],
  },
  'laptop': {
    id: 'laptop',
    label: 'Laptop',
    category: 'website',
    fields: ['website', 'github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16' }],
    ],
  },
  'monitor': {
    id: 'monitor',
    label: 'Desktop Screen',
    category: 'website',
    fields: ['website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }],
      ['path', { d: 'M8 21h8M12 17v4' }],
    ],
  },
  'code': {
    id: 'code',
    label: 'Code Brackets',
    category: 'website',
    fields: ['website', 'github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm16 18 6-6-6-6' }],
      ['path', { d: 'm8 6-6 6 6 6' }],
    ],
  },
  'layout-grid': {
    id: 'layout-grid',
    label: 'Portfolio Grid',
    category: 'website',
    fields: ['website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 3, y: 3, width: 7, height: 7 }],
      ['rect', { x: 14, y: 3, width: 7, height: 7 }],
      ['rect', { x: 14, y: 14, width: 7, height: 7 }],
      ['rect', { x: 3, y: 14, width: 7, height: 7 }],
    ],
  },

  // --- LinkedIn & Career ---
  'linkedin': {
    id: 'linkedin',
    label: 'LinkedIn Badge',
    category: 'linkedin',
    fields: ['linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' }],
      ['rect', { x: 2, y: 9, width: 4, height: 12 }],
      ['circle', { cx: 4, cy: 4, r: 2 }],
    ],
  },
  'briefcase': {
    id: 'briefcase',
    label: 'Briefcase',
    category: 'linkedin',
    fields: ['linkedin', 'website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 2, y: 7, width: 20, height: 14, rx: 2, ry: 2 }],
      ['path', { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }],
    ],
  },
  'user-check': {
    id: 'user-check',
    label: 'Verified Profile',
    category: 'linkedin',
    fields: ['linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
      ['circle', { cx: 9, cy: 7, r: 4 }],
      ['path', { d: 'm16 11 2 2 4-4' }],
    ],
  },
  'users': {
    id: 'users',
    label: 'Network / Community',
    category: 'linkedin',
    fields: ['linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
      ['circle', { cx: 9, cy: 7, r: 4 }],
      ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
      ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
    ],
  },
  'share-2': {
    id: 'share-2',
    label: 'Social Share',
    category: 'linkedin',
    fields: ['linkedin', 'website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 18, cy: 5, r: 3 }],
      ['circle', { cx: 6, cy: 12, r: 3 }],
      ['circle', { cx: 18, cy: 19, r: 3 }],
      ['path', { d: 'm8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98' }],
    ],
  },
  'award': {
    id: 'award',
    label: 'Award / Honors',
    category: 'linkedin',
    fields: ['linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 12, cy: 8, r: 6 }],
      ['path', { d: 'M15.477 12.89 17 22l-5-3-5 3 1.523-9.11' }],
    ],
  },

  // --- GitHub & Development ---
  'github': {
    id: 'github',
    label: 'GitHub Octocat',
    category: 'github',
    fields: ['github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S9 17.44 9 18v4' }],
      ['path', { d: 'M9 18c-4.51 2-5-2-7-2' }],
    ],
  },
  'git-branch': {
    id: 'git-branch',
    label: 'Git Branch',
    category: 'github',
    fields: ['github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M6 3v12' }],
      ['circle', { cx: 18, cy: 6, r: 3 }],
      ['circle', { cx: 6, cy: 18, r: 3 }],
      ['path', { d: 'M18 9a9 9 0 0 1-9 9' }],
    ],
  },
  'git-commit': {
    id: 'git-commit',
    label: 'Git Commit',
    category: 'github',
    fields: ['github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 12, cy: 12, r: 3 }],
      ['path', { d: 'M3 12h6M15 12h6' }],
    ],
  },
  'git-pull-request': {
    id: 'git-pull-request',
    label: 'Pull Request',
    category: 'github',
    fields: ['github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['circle', { cx: 18, cy: 18, r: 3 }],
      ['circle', { cx: 6, cy: 6, r: 3 }],
      ['path', { d: 'M13 6h3a2 2 0 0 1 2 2v7M6 9v12' }],
    ],
  },
  'terminal': {
    id: 'terminal',
    label: 'CLI Terminal',
    category: 'github',
    fields: ['github', 'website'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm4 17 6-6-6-6' }],
      ['path', { d: 'M12 19h8' }],
    ],
  },
  'code-2': {
    id: 'code-2',
    label: 'Code Tag',
    category: 'github',
    fields: ['github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm18 16 4-4-4-4' }],
      ['path', { d: 'm6 8-4 4 4 4' }],
      ['path', { d: 'm14.5 4-5 16' }],
    ],
  },
  'cpu': {
    id: 'cpu',
    label: 'CPU / Hardware',
    category: 'github',
    fields: ['github'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }],
      ['rect', { x: 9, y: 9, width: 6, height: 6 }],
      ['path', { d: 'M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2' }],
    ],
  },

  // --- General Icons ---
  'twitter': {
    id: 'twitter',
    label: 'Twitter / X',
    category: 'general',
    fields: ['website', 'linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z' }],
    ],
  },
  'user': {
    id: 'user',
    label: 'User Avatar',
    category: 'general',
    fields: ['linkedin'],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }],
      ['circle', { cx: 12, cy: 7, r: 4 }],
    ],
  },
  'calendar': {
    id: 'calendar',
    label: 'Calendar',
    category: 'general',
    fields: [],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }],
      ['path', { d: 'M16 2v4M8 2v4M3 10h18' }],
    ],
  },
  'star': {
    id: 'star',
    label: 'Star',
    category: 'general',
    fields: [],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z' }],
    ],
  },
  'sparkles': {
    id: 'sparkles',
    label: 'Sparkles',
    category: 'general',
    fields: [],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' }],
    ],
  },
  'shield': {
    id: 'shield',
    label: 'Shield',
    category: 'general',
    fields: [],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
    ],
  },
  'heart': {
    id: 'heart',
    label: 'Heart',
    category: 'general',
    fields: [],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' }],
    ],
  },
  'file-text': {
    id: 'file-text',
    label: 'Resume Document',
    category: 'general',
    fields: [],
    paint: 'stroke',
    strokeWidth: 2,
    shapes: [
      ['path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }],
      ['path', { d: 'M14 2v6h6M16 13H8M16 17H8M10 9H8' }],
    ],
  },
};

/**
 * Returns available icons for a given field key (or all icons if omitted).
 */
export function getSelectableIcons(fieldKey) {
  const all = Object.values(HEADER_ICONS);
  const recommended = fieldKey ? all.filter(i => Array.isArray(i.fields) && i.fields.includes(fieldKey)) : [];
  const others = fieldKey ? all.filter(i => !Array.isArray(i.fields) || !i.fields.includes(fieldKey)) : all;
  return { recommended, others, all };
}

/**
 * Resolves the shapes of an icon: handles custom selected icon IDs ('icon:...'),
 * pack styles ('pack:...'), or the default icon for `field` from pack `setId`.
 */
export function resolveIconShapes({ custom, field, setId = 'lucide', color = 'currentColor', strokeWidth } = {}) {
  let shapes = null;
  let packPaint = null;
  let defaultSw = 2;

  if (custom && typeof custom === 'string') {
    const trimmed = custom.trim();
    if (trimmed.startsWith('pack:')) {
      // A pack the app no longer has falls through to the chosen pack below, as an unknown icon does.
      const pack = ICON_PACKS[trimmed.slice(5)];
      shapes = pack?.icons?.[field];
      packPaint = pack?.paint;
      defaultSw = pack?.strokeWidth ?? 2;
    } else {
      const iconKey = trimmed.startsWith('icon:') ? trimmed.slice(5) : trimmed;
      if (HEADER_ICONS[iconKey]) {
        const item = HEADER_ICONS[iconKey];
        shapes = item.shapes;
        packPaint = item.paint || 'stroke';
        defaultSw = item.strokeWidth ?? 2;
      } else if (ICON_PACKS[iconKey]?.icons?.[field]) {
        const pack = ICON_PACKS[iconKey];
        shapes = pack.icons[field];
        packPaint = pack.paint;
        defaultSw = pack.strokeWidth ?? 2;
      }
    }
  }

  if (!shapes) {
    const pack = ICON_PACKS[setId] || ICON_PACKS.lucide;
    shapes = pack?.icons?.[field];
    packPaint = pack?.paint;
    defaultSw = pack?.strokeWidth ?? 2;
  }

  if (!shapes) return null;
  const sw = strokeWidth ?? defaultSw;

  return shapes.map(([tag, { paint = packPaint, ...attrs }]) => ({
    tag,
    props: paint === 'fill'
      ? { fill: color, stroke: 'none', ...attrs }
      : { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', ...attrs },
  }));
}

/**
 * The shapes of one icon, ready for either renderer: [{ tag, props }] with fill, stroke and
 * stroke width resolved for `color` ('currentColor' in the editor, a hex colour in the PDF).
 * `strokeWidth` overrides the pack's own. Null for an unknown pack or field.
 * Supports custom selected vector icon overrides via opts.custom.
 */
export function iconShapes(setId, field, { color, strokeWidth, custom } = {}) {
  return resolveIconShapes({ custom, field, setId, color, strokeWidth });
}

