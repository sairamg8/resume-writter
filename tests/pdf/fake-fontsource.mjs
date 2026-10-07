/**
 * A stand-in for Fontsource's CDN (jsDelivr), for a test that prints in a web font. Such a test used to fetch
 * its fonts from the live CDN, and a slow CDN (8.1 s on one gate) made the app fall back to Noto Sans on
 * purpose, as it should: a test of the font logic failed on the weather. With this installed no font request
 * leaves the machine:
 *
 * - metadata.json answers as the package's own does (family, weights, styles, subsets, as jsDelivr served
 *   them on 2026-10-06), so the app registers the faces it would online: Bebas Neue has one weight and no
 *   italic, Lato no 500, Gelasio no 100 — and a package named in `missing` answers 404, a name that is no font;
 * - a face's file answers with real font bytes: the Noto Sans that ships with the app (@fontsource/noto-sans,
 *   the only Fontsource package installed), its glyphs under the package's names. Each file is a real WOFF
 *   whose `name` table is rewritten to the face asked for — "Gelasio-BoldItalic" for Gelasio's 700 italic — so
 *   the PDF embeds the font by that name, and a bold run that printed the regular face would show in it. The
 *   tests read what the PDF says (its text, the embedded fonts' names), never a glyph's shape;
 * - the script fonts (Hebrew, Thai, Arabic, Chinese, Japanese, Korean, Noto Emoji) answer with a REAL file of
 *   the script, kept in fixtures/fonts (whole when small, cut to the characters the tests print when not;
 *   make-fixtures.py makes them), so shaping, marks and ligatures are the font's own. A character a test
 *   prints that the cut file lacks prints as .notdef and fails the case that printed it: add it and re-run
 *   the script;
 * - the two symbol fonts (Noto Sans Math, Noto Sans Symbols 2) answer with a font that draws only the few
 *   characters the tests print in them (← ↑ → ↓ ∕, the bold letters 𝗕𝗼𝗹𝗱, and ✓ ✔ ✗ ✘ ★ ☆ ☎ ◦), each on a glyph of its own, so the PDF's text
 *   layer reads each back as typed;
 * - the harness's own server (the bundled Noto Sans, public/) and data: URLs go through to the real fetch;
 * - anything else FAILS LOUDLY: the fetch rejects naming the URL, the URL is listed in `unexpected`, and
 *   `assertClean()` — which a test runs after each case — throws for what that case asked, once, though the
 *   app swallows a failed font fetch and prints in Noto Sans. A font the app now asks for that is not in
 *   PACKAGES, or a face the metadata does not list, shows up as a red case that names it, not as a quiet fallback.
 *
 * It also refuses every connection from this process to another machine (net.Socket#connect), and lists it in
 * `refused`: the proof that the test made no network request, by whatever means.
 *
 * To print in another web font, add its package to PACKAGES with the fields of its metadata.json the app reads.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = path.join(ROOT, 'node_modules/@fontsource/noto-sans/files');
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/fonts');

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const BOTH = ['italic', 'normal'];
const SANS = ['cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'latin', 'latin-ext', 'vietnamese'];

/**
 * Package → what its metadata.json says that the app reads (pdfFontLoader.js chosenFont, registerCdn), as
 * jsDelivr served it on 2026-10-06. `symbols` marks a symbol font: the subset the app asks for (Noto Sans
 * Math's metadata lists no 'math' subset, though its math files are there) and the characters it draws.
 */
export const PACKAGES = {
  gelasio: { family: 'Gelasio', weights: [400, 500, 600, 700], styles: BOTH, subsets: ['latin', 'latin-ext', 'vietnamese'] },
  'bebas-neue': { family: 'Bebas Neue', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
  inter: { family: 'Inter', weights: WEIGHTS, styles: BOTH, subsets: SANS },
  'open-sans': { family: 'Open Sans', weights: [300, 400, 500, 600, 700, 800], styles: BOTH, subsets: [...SANS, 'hebrew', 'math', 'symbols'] },
  'fira-sans': { family: 'Fira Sans', weights: WEIGHTS, styles: BOTH, subsets: SANS },
  'ibm-plex-sans': { family: 'IBM Plex Sans', weights: [100, 200, 300, 400, 500, 600, 700], styles: BOTH, subsets: ['cyrillic', 'cyrillic-ext', 'greek', 'latin', 'latin-ext', 'vietnamese'] },
  asap: { family: 'Asap', weights: WEIGHTS, styles: BOTH, subsets: ['latin', 'latin-ext', 'vietnamese'] },
  roboto: { family: 'Roboto', weights: WEIGHTS, styles: BOTH, subsets: [...SANS, 'math', 'symbols'] },
  lato: { family: 'Lato', weights: [100, 300, 400, 700, 900], styles: BOTH, subsets: ['latin', 'latin-ext'] },
  'source-sans-3': { family: 'Source Sans 3', weights: WEIGHTS.slice(1), styles: BOTH, subsets: SANS },
  'source-serif-4': { family: 'Source Serif 4', weights: WEIGHTS.slice(1), styles: BOTH, subsets: ['cyrillic', 'cyrillic-ext', 'greek', 'latin', 'latin-ext', 'vietnamese'] },
  'pt-serif': { family: 'PT Serif', weights: [400, 700], styles: BOTH, subsets: ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'] },
  literata: { family: 'Literata', weights: WEIGHTS.slice(1), styles: BOTH, subsets: SANS },
  // The script fonts: the subset the app asks for is a REAL file (fixtures/fonts, made by make-fixtures.py), the
  // others (latin, cyrillic…) are Noto Sans' under the package's name, as for every text font above.
  'noto-sans-hebrew': { family: 'Noto Sans Hebrew', weights: WEIGHTS, styles: ['normal'], subsets: ['cyrillic-ext', 'greek-ext', 'hebrew', 'latin', 'latin-ext'], fixtures: ['hebrew'] },
  'noto-sans-thai': { family: 'Noto Sans Thai', weights: WEIGHTS, styles: ['normal'], subsets: ['latin', 'latin-ext', 'thai'], fixtures: ['thai'] },
  'noto-sans-arabic': { family: 'Noto Sans Arabic', weights: WEIGHTS, styles: ['normal'], subsets: ['arabic', 'latin', 'latin-ext', 'math', 'symbols'], fixtures: ['arabic'] },
  'ibm-plex-sans-arabic': { family: 'IBM Plex Sans Arabic', weights: WEIGHTS.slice(0, 7), styles: ['normal'], subsets: ['arabic', 'cyrillic-ext', 'latin', 'latin-ext'], fixtures: ['arabic'] },
  'noto-sans-sc': { family: 'Noto Sans SC', weights: WEIGHTS, styles: ['normal'], subsets: ['chinese-simplified', 'cyrillic', 'latin', 'latin-ext', 'vietnamese'], fixtures: ['chinese-simplified'] },
  'noto-sans-tc': { family: 'Noto Sans TC', weights: WEIGHTS, styles: ['normal'], subsets: ['chinese-traditional', 'cyrillic', 'latin', 'latin-ext', 'vietnamese'], fixtures: ['chinese-traditional'] },
  'noto-sans-jp': { family: 'Noto Sans JP', weights: WEIGHTS, styles: ['normal'], subsets: ['cyrillic', 'japanese', 'latin', 'latin-ext', 'vietnamese'], fixtures: ['japanese'] },
  'noto-sans-kr': { family: 'Noto Sans KR', weights: WEIGHTS, styles: ['normal'], subsets: ['cyrillic', 'korean', 'latin', 'latin-ext', 'vietnamese'], fixtures: ['korean'] },
  'noto-emoji': { family: 'Noto Emoji', weights: [300, 400, 500, 600, 700], styles: ['normal'], subsets: ['emoji'], fixtures: ['emoji'] },
  'noto-sans-math': {
    family: 'Noto Sans Math', weights: [400], styles: ['normal'], subsets: ['latin'],
    symbols: { subset: 'math', chars: '←↑→↓∕𝗕𝗼𝗹𝗱' },
  },
  'noto-sans-symbols-2': {
    family: 'Noto Sans Symbols 2', weights: [400], styles: ['normal'], subsets: ['braille', 'latin', 'latin-ext', 'math', 'mayan-numerals', 'symbols'],
    symbols: { subset: 'symbols', chars: '✓✔✗✘★☆☎◦' },
  },
};

// ── WOFF: read a file's tables, write them back with some changed ─────────────

/** The tables of a WOFF file, inflated: { flavor, tables: [{ tag, body }] }. */
function readWoff(file) {
  if (file.toString('latin1', 0, 4) !== 'wOFF') throw new Error('not a WOFF file');
  const tables = [];
  for (let i = 0; i < file.readUInt16BE(12); i += 1) {
    const at = 44 + 20 * i;
    const offset = file.readUInt32BE(at + 4);
    const stored = file.readUInt32BE(at + 8);
    const length = file.readUInt32BE(at + 12);
    const body = file.subarray(offset, offset + stored);
    tables.push({ tag: file.toString('latin1', at, at + 4), body: stored < length ? zlib.inflateSync(body) : Buffer.from(body) });
  }
  return { flavor: file.readUInt32BE(4), tables };
}

const padding = (length) => (4 - (length % 4)) % 4;

/** The checksum an sfnt table directory records: its 32-bit words summed, the last one padded with zeros. */
function checksum(body) {
  const padded = Buffer.concat([body, Buffer.alloc(padding(body.length))]);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

/** A WOFF file of `tables`, each stored deflated when that is smaller, as the format has it. */
function writeWoff({ flavor, tables }) {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const stored = sorted.map(({ tag, body }) => {
    const deflated = zlib.deflateSync(body);
    return { tag, body, blob: deflated.length < body.length ? deflated : body };
  });
  const directory = [];
  const blobs = [];
  let offset = 44 + 20 * stored.length;
  let sfntSize = 12 + 16 * stored.length;
  for (const { tag, body, blob } of stored) {
    const entry = Buffer.alloc(20);
    entry.write(tag, 0, 4, 'latin1');
    entry.writeUInt32BE(offset, 4);
    entry.writeUInt32BE(blob.length, 8);
    entry.writeUInt32BE(body.length, 12);
    entry.writeUInt32BE(checksum(body), 16);
    directory.push(entry);
    blobs.push(blob, Buffer.alloc(padding(blob.length)));
    offset += blob.length + padding(blob.length);
    sfntSize += body.length + padding(body.length);
  }
  const header = Buffer.alloc(44);
  header.write('wOFF', 0, 4, 'latin1');
  header.writeUInt32BE(flavor, 4);
  header.writeUInt32BE(offset, 8); // the length of the file
  header.writeUInt16BE(stored.length, 12);
  header.writeUInt32BE(sfntSize, 16);
  header.writeUInt16BE(1, 20); // major version
  return Buffer.concat([header, ...directory, ...blobs]);
}

/**
 * A `name` table of the one record set fontkit reads names from (Windows, Unicode, English): the family, the
 * subfamily, the full name and the PostScript name — the name the PDF embeds the font by.
 */
function nameTable(family, subfamily) {
  const names = [[1, family], [2, subfamily], [4, `${family} ${subfamily}`], [6, `${family}-${subfamily}`.replace(/\s+/g, '')]];
  const strings = names.map(([, text]) => Buffer.from(text, 'utf16le').swap16());
  const table = Buffer.alloc(6 + 12 * names.length);
  table.writeUInt16BE(names.length, 2);
  table.writeUInt16BE(table.length, 4); // where the strings start
  let offset = 0;
  names.forEach(([id], i) => {
    [3, 1, 0x409, id, strings[i].length, offset].forEach((value, k) => table.writeUInt16BE(value, 6 + 12 * i + 2 * k));
    offset += strings[i].length;
  });
  return Buffer.concat([table, ...strings]);
}

/** A `cmap` table of one format 12 subtable (Windows, full Unicode) for [[code point, glyph]…]. */
function cmapTable(pairs) {
  const groups = [...pairs].sort((a, b) => a[0] - b[0]);
  const subtable = Buffer.alloc(16 + 12 * groups.length);
  subtable.writeUInt16BE(12, 0); // format
  subtable.writeUInt32BE(subtable.length, 4);
  subtable.writeUInt32BE(groups.length, 12);
  groups.forEach(([codePoint, glyph], i) => {
    subtable.writeUInt32BE(codePoint, 16 + 12 * i);
    subtable.writeUInt32BE(codePoint, 20 + 12 * i);
    subtable.writeUInt32BE(glyph, 24 + 12 * i);
  });
  const head = Buffer.alloc(12);
  head.writeUInt16BE(1, 2); // one subtable
  head.writeUInt16BE(3, 4);
  head.writeUInt16BE(10, 6);
  head.writeUInt32BE(12, 8); // where it starts
  return Buffer.concat([head, subtable]);
}

/** The glyph a donor's `cmap` gives `codePoint`: its format 4 Windows subtable, which every Noto Sans file has. */
function glyphOf(cmap, codePoint) {
  for (let i = 0; i < cmap.readUInt16BE(2); i += 1) {
    if (cmap.readUInt16BE(4 + 8 * i) !== 3 || cmap.readUInt16BE(6 + 8 * i) !== 1) continue;
    const at = cmap.readUInt32BE(8 + 8 * i);
    const segments = cmap.readUInt16BE(at + 6) / 2;
    const ends = at + 14;
    const starts = ends + 2 * segments + 2;
    const deltas = starts + 2 * segments;
    const ranges = deltas + 2 * segments;
    for (let s = 0; s < segments; s += 1) {
      const start = cmap.readUInt16BE(starts + 2 * s);
      if (codePoint < start || codePoint > cmap.readUInt16BE(ends + 2 * s)) continue;
      const delta = cmap.readInt16BE(deltas + 2 * s);
      const range = cmap.readUInt16BE(ranges + 2 * s);
      if (!range) return (codePoint + delta) & 0xffff;
      const glyph = cmap.readUInt16BE(ranges + 2 * s + range + 2 * (codePoint - start));
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
  }
  return 0;
}

// ── The faces ────────────────────────────────────────────────────────────────

const WEIGHT_WORDS = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
// The subsets of the bundled Noto Sans, which the stand-in's text fonts take their glyphs from.
const DONOR_SUBSETS = new Set(['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese']);
// The letters whose glyphs a symbol font draws its characters with, one each: a glyph shared by two characters
// would take the text of the first it was asked for into the PDF's text layer.
const SHAPES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const readDonor = (subset, weight, style) => readWoff(fs.readFileSync(path.join(NOTO, `noto-sans-${subset}-${weight}-${style}.woff`)));

/** A text font's face: Noto Sans' own, named for the package and the weight and style asked ("Inter-BoldItalic"). */
function textFace({ family }, subset, weight, style) {
  const donor = readDonor(subset, weight, style);
  const words = weight === 400 ? (style === 'italic' ? 'Italic' : 'Regular') : `${WEIGHT_WORDS[weight]}${style === 'italic' ? ' Italic' : ''}`;
  return writeWoff({ ...donor, tables: donor.tables.map((t) => (t.tag === 'name' ? { ...t, body: nameTable(family, words) } : t)) });
}

/** A symbol font's only face: it draws `symbols.chars` and nothing else, each on a glyph of its own. */
function symbolFace({ family, symbols }) {
  const donor = readDonor('latin', 400, 'normal');
  const donorCmap = donor.tables.find((t) => t.tag === 'cmap').body;
  const chars = [...symbols.chars];
  if (chars.length > SHAPES.length) throw new Error(`${family}: more characters than glyphs to draw them with`);
  const pairs = chars.map((char, i) => [char.codePointAt(0), glyphOf(donorCmap, SHAPES.charCodeAt(i))]);
  if (pairs.some(([, glyph]) => !glyph)) throw new Error(`${family}: a letter its glyphs are taken from is missing in Noto Sans`);
  return writeWoff({
    ...donor,
    tables: donor.tables.map((t) => {
      if (t.tag === 'name') return { ...t, body: nameTable(family, 'Regular') };
      if (t.tag === 'cmap') return { ...t, body: cmapTable(pairs) };
      return t;
    }),
  });
}

const faces = new Map();
/** The bytes of one face, or null when the package's metadata does not list it (or the stand-in cannot draw it). */
function faceBytes(pkg, subset, weight, style) {
  const meta = PACKAGES[pkg];
  if (!meta) return null;
  const key = `${pkg}/${subset}/${weight}/${style}`;
  if (!faces.has(key)) {
    let bytes = null;
    if (meta.symbols) {
      if (subset === meta.symbols.subset && weight === 400 && style === 'normal') bytes = symbolFace(meta);
    } else if (meta.fixtures?.includes(subset) && style === 'normal' && meta.weights.includes(weight)) {
      // the one real file of the script, for every weight (its name table says Regular)
      bytes = fs.readFileSync(path.join(FIXTURES, `${pkg}-${subset}-400-normal.woff`));
    } else if (DONOR_SUBSETS.has(subset) && meta.subsets.includes(subset) && meta.weights.includes(weight) && meta.styles.includes(style)) {
      bytes = textFace(meta, subset, weight, style);
    }
    faces.set(key, bytes);
  }
  return faces.get(key);
}

// ── The network ──────────────────────────────────────────────────────────────

const CDN_URL = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@fontsource\/([a-z0-9-]+)@5\/(.+)$/;
// What goes through to the real fetch: this machine (the harness's font server), and data: URLs.
const LOCAL = /^(https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/|data:)/;
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/;

/** A function making the Response for `url`, or null when the stand-in does not serve it. */
function answerFor(url, missing) {
  const found = CDN_URL.exec(url);
  if (!found) return null;
  const [, pkg, rest] = found;
  if (rest === 'metadata.json') {
    if (missing.has(pkg)) return () => new Response('Not Found', { status: 404, statusText: 'Not Found' });
    const meta = PACKAGES[pkg];
    if (!meta) return null;
    const { family, weights, styles, subsets } = meta;
    return () => new Response(JSON.stringify({ id: pkg, family, subsets, weights, styles, defSubset: 'latin' }), { status: 200 });
  }
  const file = new RegExp(`^files/${pkg}-([a-z-]+)-(\\d+)-(normal|italic)\\.woff$`).exec(rest);
  const bytes = file && faceBytes(pkg, file[1], Number(file[2]), file[3]);
  return bytes ? () => new Response(bytes, { status: 200 }) : null;
}

/** The options of a Socket#connect call, whichever way it was called (net.connect passes them normalised, in an array). */
function connectOptions([first, second]) {
  if (Array.isArray(first)) return first[0] || {};
  if (first && typeof first === 'object') return first;
  if (typeof first === 'string' && !/^\d+$/.test(first)) return { path: first };
  return { port: first, host: typeof second === 'string' ? second : undefined };
}

/**
 * Put the stand-in in place of the CDN: fetch is replaced, and connections beyond this machine are refused.
 * `missing`: package names that answer 404, a name that is no font. Returns what a test asks it:
 * `served` (every CDN URL answered), `unexpected` (URLs it does not know) and `refused` (connections beyond
 * this machine), both for good; `assertClean()` (throws for what was added to those two since it last looked);
 * `restore()`. Stand-ins nest: a second one, restored first, keeps its own lists.
 */
export function fakeFontsource({ missing = [] } = {}) {
  const gone = new Set(missing);
  const served = [];
  const unexpected = [];
  const refused = [];
  const reported = { unexpected: 0, refused: 0 }; // how much of each list assertClean has thrown for
  const realFetch = globalThis.fetch;
  const realConnect = net.Socket.prototype.connect;

  globalThis.fetch = async (input, init) => {
    const url = String(input?.url ?? input);
    if (LOCAL.test(url)) return realFetch(input, init);
    const answer = answerFor(url, gone);
    if (!answer) {
      unexpected.push(url);
      throw new TypeError(`fetch failed: ${url} is not served by the font CDN stand-in (tests/pdf/fake-fontsource.mjs)`);
    }
    served.push(url);
    return answer();
  };

  net.Socket.prototype.connect = function connect(...args) {
    const options = connectOptions(args);
    const host = String(options.host || 'localhost'); // as Node's own default
    if (!options.path && !LOOPBACK.test(host)) {
      refused.push(`${host}:${options.port}`);
      throw new Error(`a connection to ${host}:${options.port} was refused: these tests make no network request`);
    }
    return realConnect.apply(this, args);
  };

  return {
    served,
    unexpected,
    refused,
    assertClean() {
      const problems = [
        ...unexpected.slice(reported.unexpected).map((url) => `${url} is not served by the stand-in`),
        ...refused.slice(reported.refused).map((to) => `a connection to ${to}`),
      ];
      reported.unexpected = unexpected.length;
      reported.refused = refused.length;
      if (problems.length) throw new Error(`the test reached for the network: ${problems.join('; ')}`);
    },
    restore() {
      globalThis.fetch = realFetch;
      net.Socket.prototype.connect = realConnect;
    },
  };
}
