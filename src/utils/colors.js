// Color normalization for stored settings and exports (ONB-7).
// Converts browser-compatible color formats (CSS named colors, #rgb, #rgba, rgb(), rgba(),
// hsl(), hsla()) to lowercase 6-digit hex (#rrggbb) and drops unparseable color strings.

const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export const CSS_NAMED_COLORS = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
  coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', green: '#008000', greenyellow: '#adff2f',
  grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
  midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5',
  navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6', olive: '#808000',
  olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6',
  palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
  papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
  plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513',
  salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
  sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
  steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
};

/**
 * Normalizes any color representation (CSS named color, #rgb, #rgba, #rrggbb, #rrggbbaa,
 * rgb(), rgba(), hsl(), hsla()) into a lowercase 6-character hex string '#rrggbb'.
 * Returns null for unparseable or unrecognized strings (e.g. 'banana', '#12345').
 */
export function normalizeHexColor(color) {
  if (typeof color !== 'string') return null;
  const c = color.trim().toLowerCase();
  if (!c) return null;

  if (CSS_NAMED_COLORS[c]) return CSS_NAMED_COLORS[c];

  let m = /^#([0-9a-f]{3,4})$/.exec(c);
  if (m) {
    const [r, g, b] = m[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(c);
  if (m) {
    return `#${m[1]}`;
  }

  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const parseVal = (v) => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v));
    const r = parseVal(m[1]);
    const g = parseVal(m[2]);
    const b = parseVal(m[3]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }

  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const h = parseFloat(m[1]);
    const s = parseFloat(m[2]) / 100;
    const l = parseFloat(m[3]) / 100;
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;
    const [r, g, b] = hslToRgb(h, s, l);
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  }

  return null;
}

export const SETTINGS_COLOR_KEYS = [
  'accentColor',
  'textColor',
  'sidebarBg',
  'headerTextColor',
  'nameColor',
  'jobTitleColor',
  'sectionBorderColor',
];

/**
 * Normalizes colors in `resume.settings` to standard 6-digit hex '#rrggbb' (ONB-7).
 * Converts CSS named colors, rgb(), hsl() to hex; drops unreadable strings (e.g. 'banana',
 * '#12345') so defaults take over. Empty string resets (nameColor, jobTitleColor,
 * sectionBorderColor) are preserved. Preserves object identity when unchanged.
 */
export function withNormalizedColors(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  let next = null;
  for (const key of SETTINGS_COLOR_KEYS) {
    if (!(key in settings) || settings[key] == null) continue;
    const val = settings[key];
    if (typeof val === 'string' && val.trim() === '') {
      if (val !== '') {
        next ??= { ...settings };
        next[key] = '';
      }
      continue;
    }
    const hex = normalizeHexColor(val);
    if (hex) {
      if (hex !== val) {
        next ??= { ...settings };
        next[key] = hex;
      }
    } else {
      next ??= { ...settings };
      delete next[key];
    }
  }
  return next ? { ...resume, settings: next } : resume;
}
