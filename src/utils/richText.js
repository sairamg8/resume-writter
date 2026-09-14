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
 * Block: { runs, align, indent, marker }
 *   runs   [{ text, bold, italic, underline, strike, href }] — "\n" inside a run is a <br>
 *   align  'left' | 'center' | 'right' | 'justify' | null (null: the caller's alignment)
 *   indent list depth: 0 for body text; list items at depth n and their continuation
 *          paragraphs share indent n + 1 for the text, the marker hangs in the gutter
 *   marker '•' / '–' / '·' (by depth) or '1.' / 'a.' / 'i.' for list items, else null
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

/** Tolerant HTML → tree of { tag, attrs, children } / text strings. */
function buildTree(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const closeTo = (tag) => {
    for (let i = stack.length - 1; i > 0; i -= 1) {
      if (stack[i].tag === tag) { stack.length = i; return true; }
    }
    return false;
  };
  const inScope = (tag, stopAt) => {
    for (let i = stack.length - 1; i > 0; i -= 1) {
      if (stack[i].tag === tag) return true;
      if (stopAt.includes(stack[i].tag)) return false;
    }
    return false;
  };

  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>|<\?[^>]*>|<\/?([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
  let m;
  let skipping = null;
  while ((m = re.exec(html))) {
    const token = m[0];
    const rawTag = m[1];
    if (skipping) {
      if (rawTag && token[1] === '/' && rawTag.toLowerCase() === skipping) skipping = null;
      continue;
    }
    if (!rawTag) {
      if (token.startsWith('<!') || token.startsWith('<?')) continue; // comments, doctype, CDATA
      top().children.push(decodeEntities(token));
      continue;
    }
    const tag = rawTag.toLowerCase();
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
      if (!/\/\s*>$/.test(token)) skipping = tag;
      continue;
    }
    const node = { tag, attrs: parseAttrs(m[2] || ''), children: [] };
    if (CLOSES_P.has(tag) && inScope('p', ['li', 'td', 'th', 'blockquote', 'div', 'ul', 'ol'])) closeTo('p');
    if (tag === 'li' && inScope('li', ['ul', 'ol'])) closeTo('li');
    if ((tag === 'dt' || tag === 'dd') && inScope(tag, ['dl'])) closeTo(tag);
    top().children.push(node);
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
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

function toRoman(n) {
  const table = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  let rest = n;
  for (const [v, s] of table) while (rest >= v) { out += s; rest -= v; }
  return out;
}

function toAlpha(n) {
  let out = '';
  let rest = n;
  while (rest > 0) { rest -= 1; out = String.fromCharCode(97 + (rest % 26)) + out; rest = Math.floor(rest / 26); }
  return out;
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

const sameFormat = (a, b) => a.bold === b.bold && a.italic === b.italic
  && a.underline === b.underline && a.strike === b.strike && a.href === b.href;

export function parseRichText(html) {
  if (html == null) return [];
  const src = String(html);
  if (!src.trim()) return [];
  const tree = buildTree(src);
  const blocks = [];
  let cur = null; // { parts: [{ text, fmt } | { br: true }], align, indent, marker }

  const start = (ctx) => {
    cur = { parts: [], align: ctx.align || null, indent: ctx.indent, marker: null };
    if (ctx.li && !ctx.li.used) {
      cur.marker = ctx.li.marker;
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

  const walk = (node, ctx) => {
    for (const child of node.children) {
      if (typeof child === 'string') { addText(child, ctx); continue; }
      const { tag, attrs } = child;
      if (tag === 'br') { addBreak(ctx); continue; }
      if (tag === 'img' || tag === 'input' || tag === 'wbr') continue;
      if (tag === 'hr') { flush(); continue; }
      if (!BLOCK_TAGS.has(tag)) {
        walk(child, { ...ctx, fmt: formatOf(tag, attrs, ctx.fmt) });
        continue;
      }
      const align = alignOf(attrs) || (tag === 'center' ? 'center' : ctx.align);
      if (tag === 'ul' || tag === 'ol') {
        flush();
        const depth = ctx.depth + 1;
        const list = { ordered: tag === 'ol', type: listType(attrs), next: Number.parseInt(attrs.start, 10) };
        if (!Number.isFinite(list.next)) list.next = 1;
        walk(child, { ...ctx, align, depth, list, li: null, indent: depth });
        flush();
        continue;
      }
      if (tag === 'li') {
        flush();
        const depth = Math.max(ctx.depth, 1);
        const list = ctx.list || { ordered: false, type: '1', next: 1 };
        let marker;
        if (list.ordered) {
          const value = Number.parseInt(attrs.value, 10);
          if (Number.isFinite(value)) list.next = value;
          marker = numberMarker(list.next, list.type);
          list.next += 1;
        } else {
          marker = BULLETS[(depth - 1) % BULLETS.length];
        }
        const li = { marker, used: false };
        walk(child, { ...ctx, align, depth, indent: depth, li, fmt: formatOf(tag, attrs, ctx.fmt) });
        flush();
        continue;
      }
      flush();
      const indent = tag === 'blockquote' || tag === 'dd' ? ctx.indent + 1 : ctx.indent;
      walk(child, { ...ctx, align, indent, fmt: formatOf(tag, attrs, ctx.fmt) });
      flush();
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
  return { runs, align: block.align, indent: block.indent, marker: block.marker };
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
 * A link target safe to put in a PDF, a .docx or an <a href>: http(s), mailto and tel only.
 * Bare "github.com/me" gets https://, a bare e-mail address gets mailto:. Anything else → null.
 */
export function safeHref(value) {
  const v = String(value || '').trim();
  if (!v || /\s/.test(v)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return /^[a-z]+:\/\/?$/i.test(v) ? null : v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[^:/]+:\d+(\/|$)/.test(v)) return null; // javascript:, data:, …
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(v)) return `mailto:${v}`;
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
  const runsHtml = (runs) => runs.map((r) => {
    let t = esc(r.text).replace(/\n/g, '<br>');
    if (r.strike) t = `<s>${t}</s>`;
    if (r.underline) t = `<u>${t}</u>`;
    if (r.italic) t = `<em>${t}</em>`;
    if (r.bold) t = `<strong>${t}</strong>`;
    const href = r.href && safeHref(r.href);
    if (href) t = `<a href="${esc(href)}">${t}</a>`;
    return t;
  }).join('');
  const alignAttr = (b) => (b.align && b.align !== 'left' ? ` style="text-align: ${b.align};"` : '');

  for (const b of blocks) {
    const body = runsHtml(b.runs);
    if (b.marker) {
      const depth = Math.max(1, b.indent);
      const tag = /^[•–·]$/.test(b.marker) ? 'ul' : 'ol';
      closeLists(depth);
      const top = open[open.length - 1];
      if (top && top.depth === depth && top.tag !== tag) {
        out += `</li></${open.pop().tag}>`;
      }
      if (!open.length || open[open.length - 1].depth < depth) {
        const start = tag === 'ol' ? Number.parseInt(b.marker, 10) : NaN;
        out += `<${tag}${Number.isFinite(start) && start !== 1 ? ` start="${start}"` : ''}>`;
        open.push({ tag, depth });
      } else {
        out += '</li>';
      }
      out += `<li${alignAttr(b)}>${body}`;
      continue;
    }
    if (open.length && b.indent >= 1) {
      closeLists(b.indent);
      if (open.length) { out += `<p${alignAttr(b)}>${body}</p>`; continue; }
    }
    closeLists(0);
    out += b.runs.length === 1 && b.runs[0].text === '\u00a0' ? '<p><br></p>' : `<p${alignAttr(b)}>${body}</p>`;
  }
  closeLists(0);
  return out;
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
