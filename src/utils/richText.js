/**
 * The rich-text editor's HTML → a flat list of text blocks.
 *
 * One parser for every consumer — the PDF (PdfRichText), the Word export and the editor's
 * sanitiser — so they agree on what the text says. It runs anywhere (no DOMParser), because
 * the PDF is also rendered in Node by the tests.
 *
 * Input is whatever reaches the editor: its own contentEditable output (Chrome writes a new
 * line as <div>, Firefox as <br>, Safari as <div> or <p>), text pasted from Google Docs, Word
 * or web pages (inline styles, <b style="font-weight:normal"> wrappers, <o:p>, <style>), and
 * imported JSON. Colours and backgrounds are dropped on purpose: the editor has no colour tool,
 * so a pasted colour is an accident — and "background-color: transparent" used to become
 * invisible text in the PDF.
 *
 * Block: { runs, align, indent, marker, inList, list }
 *   runs   [{ text, bold, italic, underline, strike, href }] — "\n" inside a run is a <br>
 *   align  'left' | 'center' | 'right' | 'justify' | null (null: the caller's alignment)
 *   indent list depth: 0 for body text; list items at depth n and their continuation
 *          paragraphs share indent n + 1 for the text, the marker hangs in the gutter
 *   marker '•' / '–' / '·' (by depth) or '1.' / 'a.' / 'i.' for list items, else null; the glyph a
 *          bullet prints with is listMarker's (Design → Lists)
 *   inList true for a block inside a list (an item, or its continuation); false for body text. A
 *          quote or <dd> outside any list shares a top-level item's indent, and only this tells it
 *          from that item's continuation (the ATS bullets, R4-SW-WT-01)
 *   list   on a list item only: { id, type, number } — which list it is in (one id per <ul>/<ol>), that
 *          list's number type ('1' | 'a' | 'A' | 'i' | 'I') and the item's number (null in a <ul>);
 *          sanitizeRichText writes the list back from these (R5-HUNT7-LIST-TYPE)
 */

const BLOCK_TAGS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'section', 'article',
  'header', 'footer', 'main', 'aside', 'nav', 'address', 'figure', 'figcaption', 'center',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'dl', 'dt', 'dd', 'hr',
  'ul', 'ol', 'li', 'form', 'fieldset', 'details', 'summary',
]);
// Elements whose content is never text the user meant to print.
const SKIP_TAGS = new Set([
  'script', 'style', 'head', 'title', 'template', 'noscript', 'xml', 'svg', 'math', 'iframe',
  'object', 'embed', 'select', 'textarea', 'button', 'canvas', 'video', 'audio', 'map',
]);
const VOID_TAGS = new Set([
  'br', 'img', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source',
  'track', 'wbr', 'param', 'keygen',
]);
// A new block element implicitly closes an open <p> (as in the HTML parser).
const CLOSES_P = BLOCK_TAGS;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ensp: '\u2002',
  emsp: '\u2003', thinsp: '\u2009', ndash: '–', mdash: '—', hellip: '…', bull: '•',
  middot: '·', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥',
  cent: '¢', sect: '§', para: '¶', deg: '°', plusmn: '±', times: '×', divide: '÷',
  frac12: '½', frac14: '¼', frac34: '¾', larr: '←', rarr: '→', uarr: '↑', darr: '↓',
  harr: '↔', rArr: '⇒', check: '✓', minus: '−', shy: '\u00ad', zwj: '\u200d', zwnj: '\u200c',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', sup1: '¹', sup2: '²', sup3: '³', micro: 'µ',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í',
  icirc: 'î', iuml: 'ï', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ',
  ouml: 'ö', oslash: 'ø', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý',
  yuml: 'ÿ', szlig: 'ß', Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä',
  Aring: 'Å', AElig: 'Æ', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó',
  Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø', Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û',
  Uuml: 'Ü', Yacute: 'Ý',
};

export function decodeEntities(str) {
  return str.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi, (m, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd';
      return String.fromCodePoint(code);
    }
    if (Object.hasOwn(NAMED_ENTITIES, name) && (m.endsWith(';') || /^(amp|lt|gt|quot|nbsp)$/i.test(name))) {
      return NAMED_ENTITIES[name];
    }
    return m;
  });
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

// Characters the tag scanner stops on: the quotes that open an attribute value, and the ">" that ends the tag.
const isSpecial = (c) => c === 62 || c === 34 || c === 39;

/**
 * Where in `html` an attribute list that starts at `from` ends: the index of its ">", or -1. Quoted values
 * may hold a ">" (and the other quote); a quote never closed fails the whole list. This is what the
 * pattern ((?:[^>"']|"[^"]*"|'[^']*')*)> read, but each quote is paired once, however many tags read over
 * it: the pattern tried every tag of '<a "<a "<a "…' again from its start (time squared), and every way of
 * splitting a long run of '<p<p<p…' into a name and attributes (time cubed; typing-freeze 7a).
 */
function attrScanner(html) {
  const n = html.length;
  // next[i]: the first ">" or quote at or after i (n when there is none).
  const next = new Int32Array(n + 1);
  next[n] = n;
  for (let i = n - 1; i >= 0; i -= 1) next[i] = isSpecial(html.charCodeAt(i)) ? i : next[i + 1];
  const seen = new Map(); // an opening quote → the ">" the list read from it ends at (or -1)
  return (from) => {
    const path = [];
    let p = from;
    let end;
    for (;;) {
      const k = next[p];
      if (k >= n) { end = -1; break; }
      const c = html.charCodeAt(k);
      if (c === 62) { end = k; break; }
      const known = seen.get(k);
      if (known !== undefined) { end = known; break; }
      path.push(k);
      let close = k + 1; // the quote that closes this one, skipping the other kind
      for (;;) {
        close = next[close];
        if (close >= n || html.charCodeAt(close) === c) break;
        close += 1;
      }
      if (close >= n) { end = -1; break; }
      p = close + 1;
    }
    for (const k of path) seen.set(k, end);
    return end;
  };
}

/** Tolerant HTML → tree of { tag, attrs, children } / text strings. Linear in the length of `html`. */
function buildTree(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  // Where each tag name is open in the stack, so closing a tag or asking whether one is open does not
  // walk a deep stack: '<section>' or a stray '</x>' repeated over 'n' open elements took time squared.
  const openAt = new Map(); // tag → indexes in `stack`, innermost last
  const top = () => stack[stack.length - 1];
  const pushOpen = (node) => {
    stack.push(node);
    const at = openAt.get(node.tag);
    if (at) at.push(stack.length - 1);
    else openAt.set(node.tag, [stack.length - 1]);
  };
  const cutTo = (length) => {
    while (stack.length > length) openAt.get(stack.pop().tag).pop();
  };
  const innermost = (tag) => {
    const at = openAt.get(tag);
    return at && at.length ? at[at.length - 1] : -1;
  };
  const closeTo = (tag) => {
    const i = innermost(tag);
    if (i < 1) return false;
    cutTo(i);
    return true;
  };
  // True when `tag` is open and no element of `stopAt` was opened inside it.
  const inScope = (tag, stopAt) => {
    const i = innermost(tag);
    if (i < 1) return false;
    for (const stop of stopAt) if (innermost(stop) > i) return false;
    return true;
  };

  // The tokens, by hand: comments (to "-->" or the end), CDATA, "<!…>" and "<?…>", a tag, text, a lone "<".
  // One regex did this, and backtracked over the rest of the text from every "<" that never closed.
  const n = html.length;
  const lastGt = html.lastIndexOf('>');
  const NAME_END = /[\s/>]/g;
  let nameFrom = 1; // the first whitespace, "/" or ">" at or after nameFrom is nameTo
  let nameTo = 0;
  let scan = null;
  let failedName = -1; // a tag name that ended here has no reading (its quotes all failed)
  let skipping = null;
  let i = 0;
  while (i < n) {
    let end; // index after the token
    let rawTag = null;
    let attrs = '';
    if (html.charCodeAt(i) !== 60) {
      end = html.indexOf('<', i + 1);
      if (end === -1) end = n;
    } else if (html.startsWith('<!--', i)) {
      end = html.indexOf('-->', i + 4);
      end = end === -1 ? n : end + 3;
    } else if (html.startsWith('<![CDATA[', i)) {
      end = html.indexOf(']]>', i + 9);
      end = end === -1 ? n : end + 3;
    } else if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      end = lastGt < i + 2 ? -1 : html.indexOf('>', i + 2);
      end = end === -1 ? i + 1 : end + 1; // no ">" ahead: a lone "<"
    } else {
      end = i + 1; // a lone "<" unless a tag starts here
      const s = html[i + 1] === '/' ? i + 2 : i + 1;
      const first = s < n ? html.charCodeAt(s) | 32 : 0;
      if (first >= 97 && first <= 122 && lastGt > s) {
        if (s + 1 >= nameFrom && s + 1 <= nameTo) { /* same name run as the last tag read */ } else {
          NAME_END.lastIndex = s + 1;
          const hit = NAME_END.exec(html);
          nameFrom = s + 1;
          nameTo = hit ? hit.index : n;
        }
        const maxEnd = nameTo;
        if (maxEnd !== failedName) {
          if (!scan) scan = attrScanner(html);
          // The name is as long as it can be; where that leaves an unclosed quote it gives characters back
          // to the attributes, so a quote inside the name opens one ('<a"b c" d>' is "a" with '"b c" d').
          let gt = scan(maxEnd);
          let nameEnd = maxEnd;
          for (let q = maxEnd - 1; gt === -1 && q > s; q -= 1) {
            const c = html.charCodeAt(q);
            if (c === 34 || c === 39) { gt = scan(q); nameEnd = q; }
          }
          if (gt === -1) failedName = maxEnd;
          else {
            rawTag = html.slice(s, nameEnd);
            attrs = html.slice(nameEnd, gt);
            end = gt + 1;
          }
        }
      }
    }
    const token = html.slice(i, end);
    i = end;
    if (skipping) {
      if (rawTag && token[1] === '/' && rawTag.toLowerCase() === skipping) skipping = null;
      continue;
    }
    if (!rawTag) {
      // Word's list marker ('·' in Symbol, '1.', then &nbsp; padding) sits between <![if !supportLists]>
      // and <![endif]> (or the <!--[if …]--> comment form): keep it apart so the list can drop it.
      if (/^<!(--)?\[if !supportLists\]/i.test(token)) {
        const node = { tag: '#mso-marker', attrs: {}, children: [] };
        top().children.push(node);
        pushOpen(node);
        continue;
      }
      if (/^<!(--)?\[endif\]/i.test(token)) {
        const at = innermost('#mso-marker');
        if (at > 0) { stack[at].closed = true; cutTo(at); }
        continue;
      }
      if (token.startsWith('<!') || token.startsWith('<?')) continue; // comments, doctype, CDATA
      top().children.push(decodeEntities(token));
      continue;
    }
    const tag = rawTag.toLowerCase();
    const selfClosed = () => { // the tag ends in "/>" (with whitespace allowed between)
      let k = token.length - 2;
      while (k > 0 && /\s/.test(token[k])) k -= 1;
      return token[k] === '/';
    };
    if (token[1] === '/') {
      if (tag === 'p' && !inScope('p', ['li', 'td', 'th', 'blockquote', 'div'])) {
        top().children.push({ tag: 'p', attrs: {}, children: [] }); // a stray </p> is an empty <p>
        continue;
      }
      if (tag === 'br') { top().children.push({ tag: 'br', attrs: {}, children: [] }); continue; }
      closeTo(tag);
      continue;
    }
    if (SKIP_TAGS.has(tag)) {
      if (!selfClosed()) skipping = tag;
      continue;
    }
    const node = { tag, attrs: parseAttrs(attrs), children: [] };
    if (CLOSES_P.has(tag) && inScope('p', ['li', 'td', 'th', 'blockquote', 'div', 'ul', 'ol'])) closeTo('p');
    if (tag === 'li' && inScope('li', ['ul', 'ol'])) closeTo('li');
    if ((tag === 'dt' || tag === 'dd') && inScope(tag, ['dl'])) closeTo(tag);
    top().children.push(node);
    if (!VOID_TAGS.has(tag) && !selfClosed()) pushOpen(node);
  }
  return root;
}

function styleOf(attrs) {
  const out = {};
  for (const decl of (attrs.style || '').split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

function alignOf(attrs) {
  const raw = styleOf(attrs)['text-align'] || (attrs.align || '').toLowerCase();
  const v = raw.replace('-webkit-', '').replace('-moz-', '');
  if (v === 'center' || v === 'right' || v === 'justify' || v === 'left') return v;
  if (v === 'start') return 'left';
  if (v === 'end') return 'right';
  return undefined;
}

/** Inline formatting an element adds to (or removes from) its content. */
function formatOf(tag, attrs, fmt) {
  const next = { ...fmt };
  if (tag === 'b' || tag === 'strong' || /^h[1-6]$/.test(tag) || tag === 'th' || tag === 'dt') next.bold = true;
  if (tag === 'i' || tag === 'em' || tag === 'cite' || tag === 'dfn' || tag === 'var' || tag === 'address') next.italic = true;
  if (tag === 'u' || tag === 'ins') next.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  if (tag === 'a' && attrs.href) next.href = attrs.href;
  const st = styleOf(attrs);
  const weight = st['font-weight'];
  if (weight) {
    if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) next.bold = true;
    else if (weight === 'normal' || weight === 'lighter' || Number(weight) <= 500) next.bold = false;
  }
  const fontStyle = st['font-style'];
  if (fontStyle) next.italic = fontStyle === 'italic' || fontStyle === 'oblique';
  const deco = st['text-decoration-line'] || st['text-decoration'];
  if (deco) {
    if (deco.includes('none')) { next.underline = false; next.strike = false; }
    if (deco.includes('underline')) next.underline = true;
    if (deco.includes('line-through')) next.strike = true;
  }
  return next;
}

const BULLETS = ['•', '–', '·'];

/**
 * Design → Lists → Bullet (settings.bulletStyle, R2-147): the glyph each depth of a bulleted list
 * prints with, the top level first. Bullet — the default, and what a résumé storing no style prints —
 * is the parse's own '•', '–', '·'; the others print one glyph at every depth (the indent shows the
 * nesting), None no glyph at all. Only the glyph changes: the item's text keeps its place. Numbered
 * lists keep their numbers under every style. The parse itself never changes: the text exports and
 * the ATS checker read its markers, whatever the style.
 */
export const BULLET_STYLES = { bullet: BULLETS, dash: ['–'], circle: ['◦'], none: [''] };
export const DEFAULT_BULLET_STYLE = 'bullet';

/** `style` if it is one of BULLET_STYLES, else the default (a résumé storing none, an imported file's unknown one). */
export const bulletStyleOf = (style) => (Object.hasOwn(BULLET_STYLES, style) ? style : DEFAULT_BULLET_STYLE);

/** The glyph list item `marker` (parseRichText's) prints with under `style`: a bullet's for its depth, a number as it is. */
export function listMarker(marker, style) {
  const depth = BULLETS.indexOf(marker);
  if (depth < 0) return marker;
  const glyphs = BULLET_STYLES[bulletStyleOf(style)];
  return glyphs[depth % glyphs.length];
}

/** The glyph a bulleted list item `depth` deep (1: the top level) prints with under `style`. */
export const bulletAt = (depth, style) => listMarker(BULLETS[(depth - 1) % BULLETS.length], style);

function toRoman(n) {
  // A list started at "1e15" took a loop of 10^12 turns (typing-freeze 7a): past what Roman numerals
  // were ever written for, the digits read better than a run of "m"s too.
  if (!(n < 100000)) return String(n);
  const table = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  let rest = n;
  for (const [v, s] of table) {
    const times = Math.floor(rest / v);
    if (times > 0) { out += s.repeat(times); rest -= v * times; }
  }
  return out;
}

function toAlpha(n) {
  let out = '';
  let rest = n;
  while (rest > 0) { rest -= 1; out = String.fromCharCode(97 + (rest % 26)) + out; rest = Math.floor(rest / 26); }
  return out;
}

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
const fromRoman = (s) => [...s].reduce((sum, c, i) => sum + (ROMAN[c] < (ROMAN[s[i + 1]] || 0) ? -ROMAN[c] : ROMAN[c]), 0);
const fromAlpha = (s) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 96, 0);

/**
 * A typed list marker's letters ('c', 'IV') as { type, start }: Roman when longer than one letter
 * and all Roman digits (ii, iv, xii), or i, v or x alone; any other letter counts in the alphabet, so
 * a Word list copied from its third item, 'c)', starts at c., not at i. (R5-HUNT7-LIST-TYPE).
 */
function letteredStart(s) {
  const lower = s.toLowerCase();
  const roman = /^[ivxlcdm]+$/.test(lower) && (lower.length > 1 || 'ivx'.includes(lower));
  const upper = s !== lower;
  return roman
    ? { type: upper ? 'I' : 'i', start: fromRoman(lower) }
    : { type: upper ? 'A' : 'a', start: fromAlpha(lower) };
}

function listType(attrs) {
  const css = styleOf(attrs)['list-style-type'];
  const t = attrs.type || '';
  if (css === 'lower-alpha' || css === 'lower-latin' || t === 'a') return 'a';
  if (css === 'upper-alpha' || css === 'upper-latin' || t === 'A') return 'A';
  if (css === 'lower-roman' || t === 'i') return 'i';
  if (css === 'upper-roman' || t === 'I') return 'I';
  return '1';
}

function numberMarker(n, type) {
  if (type === 'a') return `${toAlpha(n)}.`;
  if (type === 'A') return `${toAlpha(n).toUpperCase()}.`;
  if (type === 'i') return `${toRoman(n)}.`;
  if (type === 'I') return `${toRoman(n).toUpperCase()}.`;
  return `${n}.`;
}

// A typed list marker is a few characters ("1.", "(a)", "iv."): longer text is no marker.
const MARKER_CAP = 256;

/**
 * The text of a node with its whitespace gone, cut after MARKER_CAP characters, kept on the node. A tree of
 * nested Word markers, each inside the last, read the text of everything below it once per level (time
 * squared), and recursed as deep as the nesting (typing-freeze 7a).
 */
function markerText(node) {
  const work = [node];
  while (work.length) {
    const cur = work[work.length - 1];
    if (cur.mt !== undefined) { work.pop(); continue; }
    const pending = cur.children.filter((c) => typeof c !== 'string' && c.mt === undefined);
    if (pending.length) { for (const c of pending) work.push(c); continue; } // (not push(...pending): an element of 200 000 children is more arguments than a call takes)
    work.pop();
    let text = '';
    for (const c of cur.children) {
      if (text.length > MARKER_CAP) break;
      text += typeof c === 'string' ? c.replace(/[\s\u00a0]+/g, '') : c.mt;
    }
    cur.mt = text.slice(0, MARKER_CAP + 1);
  }
  return node.mt;
}

// The blocks Word writes a list item as. An <li> already sits in a real list (Outlook, Word's
// HTML export: <ol><li style="mso-list:l0 level1 lfo1">), so it is left as it is.
const WORD_ITEM_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/** A Word list paragraph's [list id, level]: from its mso-list style, or — when a list style ("List
 * Bullet 2") keeps mso-list in the skipped <style> sheet — from its typed marker and class. */
function wordListItem(child) {
  if (typeof child === 'string' || !WORD_ITEM_TAGS.has(child.tag)) return null;
  const m = /^(l\d+)\s+level(\d+)/.exec(styleOf(child.attrs)['mso-list'] || '');
  if (m) return [m[1], Number(m[2])];
  if (!child.children.some((c) => typeof c !== 'string' && c.tag === '#mso-marker' && c.closed)) return null;
  const n = /MsoList(?:Bullet|Number)(\d)/i.exec(child.attrs.class || '');
  return ['#style', n ? Number(n[1]) : 1];
}

/**
 * Word for desktop copies a list as paragraphs styled "mso-list:l0 level2 lfo1", not as <ul>/<ol>.
 * Runs of them become real lists, nested by level; a numbered marker ("1.", "a)") makes an <ol>.
 * The marker text itself is dropped by the walk (#mso-marker, mso-list:Ignore).
 */
function wordLists(tree) {
  // Children before their parent, as a recursive walk would, without recursing: a document nested ten
  // thousand tags deep threw a RangeError (typing-freeze 7a).
  const nodes = [];
  const todo = [tree];
  while (todo.length) {
    const node = todo.pop();
    nodes.push(node);
    for (const c of node.children) if (typeof c !== 'string') todo.push(c);
  }
  for (let k = nodes.length - 1; k >= 0; k -= 1) wordListsOf(nodes[k]);
}

function wordListsOf(node) {
  const out = [];
  let open = []; // [{ level, id, ordered, list }]
  for (const child of node.children) {
    const m = wordListItem(child);
    if (!m) {
      if (open.length && typeof child === 'string' && !child.trim()) continue; // the newline between items
      open = [];
      out.push(child);
      continue;
    }
    const [id, level] = m;
    const markerNode = child.children.find((c) => typeof c !== 'string' && c.tag === '#mso-marker' && c.closed);
    const marker = markerNode ? markerText(markerNode) : '';
    const num = /^\(?([0-9]+|[a-z]+|[A-Z]+)[.)]$/.exec(marker);
    const ordered = !!num;
    while (open.length && open[open.length - 1].level > level) open.pop();
    let top = open[open.length - 1];
    if (top && top.level === level && (top.ordered !== ordered || (level === 1 && top.id !== id))) {
      open.pop();
      top = open[open.length - 1];
    }
    if (!top || top.level < level) {
      const attrs = {};
      if (num && /^\d+$/.test(num[1])) attrs.start = num[1];
      else if (num) {
        // Its letters give the list's type and where it starts: 'c)' is c., 'iv.' is iv.
        const { type, start } = letteredStart(num[1]);
        attrs.type = type;
        if (start !== 1) attrs.start = String(start);
      }
      const list = { tag: ordered ? 'ol' : 'ul', attrs, children: [] };
      const parentItem = top && top.list.children[top.list.children.length - 1];
      (parentItem ? parentItem.children : out).push(list);
      top = { level, id, ordered, list };
      open.push(top);
    }
    top.list.children.push({ tag: 'li', attrs: child.attrs, children: child.children });
  }
  node.children = out;
}

const sameFormat = (a, b) => a.bold === b.bold && a.italic === b.italic
  && a.underline === b.underline && a.strike === b.strike && a.href === b.href;

export function parseRichText(html) {
  if (html == null) return [];
  const src = String(html);
  if (!src.trim()) return [];
  const tree = buildTree(src);
  wordLists(tree);
  const blocks = [];
  let cur = null; // { parts: [{ text, fmt } | { br: true }], align, indent, marker, list }
  let listCount = 0;

  const start = (ctx) => {
    cur = { parts: [], align: ctx.align || null, indent: ctx.indent, marker: null, inList: ctx.depth > 0 };
    if (ctx.li && !ctx.li.used) {
      cur.marker = ctx.li.marker;
      cur.list = ctx.li.list;
      ctx.li.used = true;
    }
  };
  const flush = () => {
    if (!cur) return;
    const block = finish(cur);
    if (block) blocks.push(block);
    cur = null;
  };
  const addText = (text, ctx) => {
    if (!text) return;
    if (!cur) {
      if (!text.replace(/[ \t\n\r\f]+/g, '')) return; // whitespace between blocks
      start(ctx);
    }
    cur.parts.push({ text: text.replace(/[ \t\n\r\f]+/g, ' '), fmt: ctx.fmt });
  };
  const addBreak = (ctx) => {
    if (!cur) start(ctx);
    cur.parts.push({ br: true });
  };

  // The tree is walked with a stack of its own, not by recursion: a document nested ten thousand tags
  // deep (pasted or imported) threw a RangeError (typing-freeze 7a). `flushAfter` is the flush that
  // closes a block, run when its children are done.
  const walk = (tree0, ctx0) => {
    const frames = [{ node: tree0, at: 0, ctx: ctx0, flushAfter: false }];
    while (frames.length) {
      const frame = frames[frames.length - 1];
      if (frame.at >= frame.node.children.length) {
        frames.pop();
        if (frame.flushAfter) flush();
        continue;
      }
      const child = frame.node.children[frame.at];
      frame.at += 1;
      const { ctx } = frame;
      const enter = (next, flushAfter) => frames.push({ node: child, at: 0, ctx: next, flushAfter });
      if (typeof child === 'string') { addText(child, ctx); continue; }
      const { tag, attrs } = child;
      if (tag === 'br') { addBreak(ctx); continue; }
      if (tag === 'img' || tag === 'input' || tag === 'wbr') continue;
      // Word's typed list marker. One Word never closed (a cut-off paste) may hold the item's text: kept.
      if ((tag === '#mso-marker' && child.closed) || styleOf(attrs)['mso-list'] === 'ignore') continue;
      if (tag === 'hr') { flush(); continue; }
      if (!BLOCK_TAGS.has(tag)) {
        enter({ ...ctx, fmt: formatOf(tag, attrs, ctx.fmt) }, false);
        continue;
      }
      const align = alignOf(attrs) || (tag === 'center' ? 'center' : ctx.align);
      if (tag === 'ul' || tag === 'ol') {
        flush();
        const depth = ctx.depth + 1;
        listCount += 1;
        const list = { id: listCount, ordered: tag === 'ol', type: listType(attrs), next: Number.parseInt(attrs.start, 10) };
        if (!Number.isFinite(list.next)) list.next = 1;
        enter({ ...ctx, align, depth, list, li: null, indent: depth }, true);
        continue;
      }
      if (tag === 'li') {
        flush();
        const depth = Math.max(ctx.depth, 1);
        const list = ctx.list || { ordered: false, type: '1', next: 1 };
        let marker;
        let number = null;
        if (list.ordered) {
          const value = Number.parseInt(attrs.value, 10);
          if (Number.isFinite(value)) list.next = value;
          number = list.next;
          marker = numberMarker(list.next, list.type);
          list.next += 1;
        } else {
          marker = BULLETS[(depth - 1) % BULLETS.length];
        }
        // Which list the item is in, its type and its number: sanitizeRichText writes them back.
        const li = { marker, used: false, list: { id: list.id, type: list.type, number } };
        enter({ ...ctx, align, depth, indent: depth, li, fmt: formatOf(tag, attrs, ctx.fmt) }, true);
        continue;
      }
      flush();
      const indent = tag === 'blockquote' || tag === 'dd' ? ctx.indent + 1 : ctx.indent;
      enter({ ...ctx, align, indent, fmt: formatOf(tag, attrs, ctx.fmt) }, true);
    }
  };

  walk(tree, { fmt: {}, align: null, indent: 0, depth: 0, list: null, li: null });
  flush();
  return blocks;
}

/** Collapse whitespace, turn parts into runs, apply the <br> rules; null for an empty block. */
function finish(block) {
  // Split into lines at <br>.
  const lines = [[]];
  for (const part of block.parts) {
    if (part.br) lines.push([]);
    else lines[lines.length - 1].push(part);
  }
  // Collapse spaces across part boundaries, then trim each line.
  const cleaned = lines.map((parts) => {
    const out = [];
    let lastSpace = true; // at line start, leading spaces are dropped
    for (const { text, fmt } of parts) {
      let t = text;
      if (lastSpace) t = t.replace(/^ +/, '');
      if (!t) continue;
      lastSpace = t.endsWith(' ');
      out.push({ text: t, fmt });
    }
    while (out.length) {
      const last = out[out.length - 1];
      const t = last.text.replace(/ +$/, '');
      if (t) { last.text = t; break; }
      out.pop();
    }
    return out;
  });
  const hasText = cleaned.some((l) => l.length > 0);
  const hadBreak = lines.length > 1;
  if (!hasText && !hadBreak) return null;
  // A trailing <br> ends the last line; it does not start a new one.
  if (cleaned.length > 1 && cleaned[cleaned.length - 1].length === 0) cleaned.pop();

  const runs = [];
  const push = (text, fmt) => {
    const f = { bold: !!fmt.bold, italic: !!fmt.italic, underline: !!fmt.underline, strike: !!fmt.strike, href: fmt.href || null };
    const prev = runs[runs.length - 1];
    if (prev && sameFormat(prev, f)) prev.text += text;
    else runs.push({ text, ...f });
  };
  cleaned.forEach((parts, i) => {
    if (i > 0) push('\n', {});
    if (!parts.length) push('\u00a0', {}); // an empty line keeps its height
    for (const { text, fmt } of parts) push(text, fmt);
  });
  const out = { runs, align: block.align, indent: block.indent, marker: block.marker, inList: block.inList };
  if (block.list) out.list = block.list;
  return out;
}

/** True when the HTML prints anything (a lone <br> or &nbsp; line counts as nothing). */
export function hasRichText(html) {
  return parseRichText(html).some((b) => b.runs.some((r) => r.text.replace(/[\s\u00a0]/g, '')));
}

/** Plain text: blocks joined by newlines, markers kept. */
export function richTextToPlain(html) {
  return parseRichText(html)
    .map((b) => `${b.marker ? `${b.marker} ` : ''}${b.runs.map((r) => r.text).join('')}`)
    .join('\n');
}

/**
 * A bare e-mail address: one "@" with something before it, no "/", and a "." inside what follows it
 * (not its first or last character). The same test as /^[^@/]+@[^@/]+\.[^@/]+$/, which took time
 * squared in the length of a long value with many dots and a "/" or "@" after them (each dot was tried
 * as the one, and each try read to the end): 20 000 dots and a slash, 195 ms, on every render of a
 * Website typed or pasted so (R5-HUNT11-WEBSITE-FREEZE-LEAD).
 */
function isBareEmail(v) {
  const at = v.indexOf('@');
  if (at < 1 || v.includes('/') || v.indexOf('@', at + 1) !== -1) return false;
  const dot = v.indexOf('.', at + 2); // not the domain's first character
  return dot !== -1 && dot < v.length - 1; // nor its last
}

/**
 * The host of an http(s) address past a leading "www.", '' when there is none ("https://www.",
 * "https:///", "http://www"): such an address links to nothing (R5-HUNT12-LINK-URL-OVERRIDE-BARE-SCHEME).
 * Any other address (mailto:, tel:) → true.
 */
function httpHost(v) {
  const m = /^https?:\/\/([^/?#]*)/i.exec(v);
  if (!m) return true;
  const host = m[1].replace(/^[^@]*@/, '').replace(/^www\./i, '');
  return host && !/^www\.?$/i.test(host) && !/^:/.test(host) ? host : '';
}

/**
 * A link target safe to put in a PDF, a .docx or an <a href>: http(s), mailto and tel only.
 * Bare "github.com/me" gets https://, a bare e-mail address gets mailto:. Anything else → null.
 */
export function safeHref(value) {
  const v = String(value || '').trim();
  if (!v || /\s/.test(v)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return /^[a-z]+:\/\/?$/i.test(v) || !httpHost(v) ? null : v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[^:/]+:\d+(\/|$)/.test(v)) return null; // javascript:, data:, …
  if (isBareEmail(v)) return `mailto:${v}`;
  if (/^(\/\/)?[\w-]+(\.[\w-]+)+([:/?#].*)?$/i.test(v)) return `https://${v.replace(/^\/\//, '')}`;
  return null;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/**
 * Canonical, safe HTML for the editor: only p, ul/ol/li, strong/em/u/s, a[href] (http, https,
 * mailto, tel), br and text-align. Everything else — scripts, event handlers, styles, colours,
 * classes — is gone. Idempotent: sanitizing its own output returns it unchanged.
 */
export function sanitizeRichText(html) {
  const blocks = parseRichText(html);
  let out = '';
  const open = []; // list stack: [{ tag, depth }]
  const closeLists = (depth) => {
    while (open.length && open[open.length - 1].depth > depth) out += `</li></${open.pop().tag}>`;
  };
  // A link's address is written once around each run of runs that share it, not around every run: a link of 10 000
  // characters with 1 000 bold and plain words in it wrote 10 MB (typing-freeze 7a). A link a block carries on into
  // many more blocks still writes it for each, so what the addresses may add up to, counted as written (escaped), is
  // 16 times the input and a little over; a link past that is its text alone, which no ordinary document reaches.
  // Runs of one link share its address string, so a run is told from the one before it by a pointer compare.
  let budget = 16 * `${html}`.length + 4096;
  const runsHtml = (runs) => {
    let line = '';
    let cur = ''; // the address of the anchor that is open
    let was; // the run's address as typed, before it is checked and escaped
    for (const r of runs) {
      let t = esc(r.text).replace(/\n/g, '<br>');
      if (r.strike) t = `<s>${t}</s>`;
      if (r.underline) t = `<u>${t}</u>`;
      if (r.italic) t = `<em>${t}</em>`;
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.href !== was) {
        const h = esc(safeHref((was = r.href)) || '');
        if (h !== cur) {
          if (cur) line += '</a>';
          budget -= (cur = h.length <= budget ? h : '').length;
          if (cur) line += `<a href="${cur}">`;
        }
      }
      line += t;
    }
    return cur ? `${line}</a>` : line;
  };
  const alignAttr = (b) => (b.align && b.align !== 'left' ? ` style="text-align: ${b.align};"` : '');

  for (const b of blocks) {
    const body = runsHtml(b.runs);
    if (b.marker) {
      const depth = Math.max(1, b.indent);
      const tag = /^[•–·]$/.test(b.marker) ? 'ul' : 'ol';
      closeLists(depth);
      const top = open[open.length - 1];
      const listId = b.list ? b.list.id : null;
      // A second numbered list next to the first stays its own list, so it keeps its own numbering.
      if (top && top.depth === depth && (top.tag !== tag || (tag === 'ol' && top.id !== listId))) {
        out += `</li></${open.pop().tag}>`;
      }
      if (!open.length || open[open.length - 1].depth < depth) {
        // The list keeps its number type (a., A., i., I.) and where it starts (R5-HUNT7-LIST-TYPE).
        const type = tag === 'ol' && b.list && b.list.type !== '1' ? b.list.type : null;
        const start = tag === 'ol' ? (b.list && b.list.number != null ? b.list.number : Number.parseInt(b.marker, 10)) : NaN;
        out += `<${tag}${type ? ` type="${type}"` : ''}${Number.isFinite(start) && start !== 1 ? ` start="${start}"` : ''}>`;
        open.push({ tag, depth, id: listId });
      } else {
        out += '</li>';
      }
      out += `<li${alignAttr(b)}>${body}`;
      continue;
    }
    // A block inside a list (the open item's paragraph, quote or text after a nested list) stays in
    // that item; a quote or <dd> after the list, indented as a top-level item is, is body text and
    // closes the list — or the first edit saved it as the last item's paragraph, and the ATS read it
    // as part of that bullet again (R4-SW-WT-01).
    if (open.length && b.indent >= 1 && b.inList) {
      closeLists(b.indent);
      if (open.length) { out += `<p${alignAttr(b)}>${body}</p>`; continue; }
    }
    closeLists(0);
    out += b.runs.length === 1 && b.runs[0].text === '\u00a0' ? '<p><br></p>' : `<p${alignAttr(b)}>${body}</p>`;
  }
  closeLists(0);
  return out;
}

/**
 * Whether `html` holds a data: URL's base64 payload inside a tag, as a browser's own paste of a picture stores it:
 * what /<[^>]*\bdata:[^\s"'>,;]*;base64,/i found, reading each "<" with no "data:" after it to the end of the
 * text (time squared in a run of them; typing-freeze 7a). One pass: each "data:" is checked once, against the last
 * "<" and ">" before it.
 */
export function hasDataUrlInTag(html) {
  const text = String(html);
  const found = /\bdata:/gi;
  let lt = -1; // the last "<" and ">" before `scanned`
  let gt = -1;
  let scanned = 0;
  let runEnd = -1; // the payload run of the last "data:" that was read, which no later "data:" inside it can change
  for (let m = found.exec(text); m; m = found.exec(text)) {
    for (; scanned < m.index; scanned += 1) {
      const c = text.charCodeAt(scanned);
      if (c === 60) lt = scanned;
      else if (c === 62) gt = scanned;
    }
    if (lt <= gt || m.index < runEnd) continue; // inside no tag, or in a run already read
    runEnd = m.index + 5;
    while (runEnd < text.length && !/[\s"'>,;]/.test(text[runEnd])) runEnd += 1;
    if (text.slice(runEnd, runEnd + 8).toLowerCase() === ';base64,') return true;
  }
  return false;
}

/** Plain text (a paste without HTML) as editor HTML: escaped, one line per <br>. */
export function plainTextToHtml(text) {
  return esc(String(text || '').replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');
}

/**
 * Sanitized HTML ready to insert at the caret: a single paragraph is unwrapped so pasting a
 * phrase into a line does not split the line.
 */
export function sanitizeForInsert(html) {
  const clean = sanitizeRichText(html);
  const single = /^<p>((?:(?!<\/?p[\s>]).)*)<\/p>$/s.exec(clean);
  return single ? single[1] : clean;
}
