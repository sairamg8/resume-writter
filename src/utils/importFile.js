// Import from a PDF, a Word file (.docx), Markdown or plain text (R2-148): the file's text as lines,
// read by importText.js into a new résumé. JSON stays with the importers it always had (the
// Dashboard's and the editor's); importDocument.js loads this on demand, and pdf.js only for a PDF.
import { linkText, markdownLines, resumeFromText } from './importText.js';

const NO_TEXT = 'No text could be read from that file. A scanned PDF holds pictures of its pages, not text: export it again as text, or import a Word, text or JSON file.';
const SCANNED = 'That PDF looks like a scanned image: its pages have no text layer to read. Export the résumé again as a text PDF from the program it was written in, save it as a Word file, or run the scan through OCR (text recognition) first, and import that.';

/** The largest file the import reads: a résumé is well under it; one over it would stall the page. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const TOO_BIG = 'That file is too large to be a résumé (over 20 MB). Import the résumé itself as a PDF, Word, text or JSON file.';
const DAMAGED = 'That Word file is damaged and cannot be read. Save it again as .docx (or PDF) and import that.';
const LOCKED = 'That PDF is password-protected. Save a copy without a password (or as a Word file) and import that.';

// ── Word (.docx) ─────────────────────────────────────────────────────────────

const decode = (bytes) => new TextDecoder().decode(bytes);

/** Deflated bytes inflated with the browser's own DecompressionStream: no library to download. */
async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot open Word files. Update it, or import the résumé as PDF, text or JSON.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** One file of a zip archive (a .docx is one), found through its central directory; null if absent. */
export async function unzipEntry(bytes, name) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('That is not a Word (.docx) file. An older .doc must be saved as .docx (or PDF) first.');
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  for (let n = 0; n < count && p + 46 <= bytes.length; n += 1) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const skip = nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    if (decode(bytes.subarray(p + 46, p + 46 + nameLen)) === name) {
      if (local + 30 > bytes.length) throw new Error(DAMAGED);
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      if (start + size > bytes.length) throw new Error(DAMAGED);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data).catch(() => { throw new Error(DAMAGED); });
      throw new Error('That Word file is compressed in a way this import cannot read.');
    }
    p += 46 + skip;
  }
  return null;
}

const xmlText = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');

/**
 * `xml` without its <mc:Fallback> copies (docxXmlLines): each from its start to its own end — a copy
 * may hold another AlternateContent, with a Fallback of its own — and a self-closing one alone.
 */
function withoutFallbacks(xml) {
  let out = '';
  let depth = 0;
  let from = 0;
  for (const m of xml.matchAll(/<mc:Fallback\b[^>]*?(\/?)>|<\/mc:Fallback>/g)) {
    if (m[0].startsWith('</')) {
      if (depth && --depth === 0) from = m.index + m[0].length;
    } else if (!m[1]) {
      if (depth++ === 0) out += xml.slice(from, m.index);
    } else if (!depth) {
      out += xml.slice(from, m.index);
      from = m.index + m[0].length;
    }
  }
  return depth ? out : out + xml.slice(from);
}

/**
 * word/document.xml as lines: a paragraph a line (its breaks as more lines, its tabs as tabs), a
 * list paragraph behind a "• ", an empty one as a blank line. A Heading style marks a heading, the
 * Title style the name — the app's Word export writes its section titles as Heading 1.
 *
 * A text box's paragraphs sit inside the paragraph that anchors it: each is a line of its own, after
 * the anchoring paragraph's own text (what comes before and after the box). Word saves every text box
 * twice, the drawing in <mc:Choice> and a VML copy in <mc:Fallback>: the copy is not read, or each
 * line of a designed résumé's header or side column came out twice (R4-IMP-04).
 *
 * `links`: the part's hyperlink targets by relationship id (docxLinks). A hyperlink whose text is not
 * its address — a contact shown as its Display label, "My profile" — reads as "My profile (https://…)"
 * (linkText), so the address is kept: the label alone was dropped, the URL nowhere (R4-IMP-10).
 */
export function docxXmlLines(xml, links = {}) {
  const body = withoutFallbacks(String(xml).split(/<w:body\b[^>]*>/)[1] ?? String(xml));
  const lines = [];
  const levels = []; // each line's Heading level, 0 for none
  const open = []; // the paragraphs being read, the innermost last
  const TOKEN = /<w:p(?=[\s>])[^>]*>|<\/w:p>|<w:pPr>([\s\S]*?)<\/w:pPr>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr)(?:\s[^>]*)?\/>|<w:hyperlink\b([^>]*)>|<\/w:hyperlink>/g;
  for (const m of body.matchAll(TOKEN)) {
    const para = open[open.length - 1];
    if (m[4] !== undefined) {
      const id = /\br:id="([^"]*)"/.exec(m[4])?.[1];
      if (para && !m[0].endsWith('/>')) para.link = { to: links[id], at: para.text.length };
    } else if (m[0] === '</w:hyperlink>') {
      if (para?.link?.to) para.text = para.text.slice(0, para.link.at) + linkText(para.text.slice(para.link.at), para.link.to);
      if (para) para.link = null;
    } else if (m[0] === '</w:p>') {
      if (!para) continue;
      open.pop();
      const style = /<w:pStyle w:val="([^"]*)"/.exec(para.props)?.[1] ?? '';
      const list = /<w:numPr>/.test(para.props);
      const heading = /^(?:heading|berschrift|titre)\s*(\d)?/i.exec(style);
      // Its own line before its text boxes' lines, read while it was open: a side column's box is
      // anchored to the first paragraph, often the name, and the name comes first. A heading's after
      // them: a box of the name and contacts anchored to the first section's title ("PROFILE") is the
      // page's header, over that title.
      const at = heading ? lines.length : para.start;
      levels.splice(at, 0, heading ? Number(heading[1] || 1) : 0);
      lines.splice(at, 0, { text: list && para.text.trim() ? `• ${para.text}` : para.text, hint: heading ? 'heading' : (/^title$/i.test(style) ? 'name' : undefined) });
    } else if (m[0].startsWith('<w:p') && !m[0].startsWith('<w:pPr')) {
      if (!m[0].endsWith('/>')) open.push({ text: '', props: '', start: lines.length }); // <w:p/>: an empty one, no line (as before)
    }
    else if (!para) continue;
    else if (m[1] !== undefined) para.props = m[1];
    else if (m[2] !== undefined) para.text += xmlText(m[2]);
    else para.text += m[3] === 'tab' ? '\t' : '\n';
  }
  return headingLevels(lines, levels);
}

/**
 * The Heading levels a Word file uses, as Markdown's: the top one used starts the sections ('heading'),
 * a deeper one an entry ('entry'), as Word's own résumé templates set them (Heading 1 "Experience",
 * Heading 2 "Senior Engineer | Acme Corp", Heading 3 its dates). Every level was a section, so a job's
 * title line became a section with nothing under it and was dropped (R4-IMP-03). A top-level heading
 * that is the file's first line and its only one of that level, over deeper ones, is the name.
 */
function headingLevels(lines, levels) {
  const used = levels.filter(Boolean);
  if (!used.length) return lines;
  let top = Math.min(...used);
  const first = lines.findIndex((l) => l.text.trim());
  const named = !lines.some((l) => l.hint === 'name') && levels[first] === top
    && used.filter((v) => v === top).length === 1 && used.some((v) => v > top);
  if (named) top = Math.min(...used.filter((v) => v !== top));
  return lines.map((l, i) => {
    if (!levels[i]) return l;
    if (named && i === first) return { ...l, hint: 'name' };
    return levels[i] > top ? { ...l, hint: 'entry' } : l;
  });
}

/** A part's relationships file (word/_rels/<part>.rels) as its relationships: { id, type, target }. */
function docxRels(rels) {
  return [...String(rels ?? '').matchAll(/<Relationship\b([^>]*)>/g)].map(([, attrs]) => {
    const attr = (name) => xmlText(new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? '');
    return { id: attr('Id'), type: attr('Type'), target: attr('Target') };
  });
}

/** A part's relationships file as its hyperlinks' targets, by id. */
export function docxLinks(rels) {
  return Object.fromEntries(docxRels(rels).filter((r) => r.type.endsWith('/hyperlink') && r.target).map((r) => [r.id, r.target]));
}

/** One part of a .docx (word/document.xml, word/header1.xml) as lines, with its own hyperlinks' targets. */
async function docxPartLines(bytes, part) {
  const xml = await unzipEntry(bytes, `word/${part}`);
  if (!xml) return null;
  const rels = await unzipEntry(bytes, `word/_rels/${part}.rels`);
  return docxXmlLines(decode(xml), docxLinks(rels && decode(rels)));
}

const FURNITURE = /^(?:curriculum vitae|cv|r[ée]sum[ée]|confidential|draft|page\s*\d*(?:\s*of\s*\d+)?|\d{1,3})$/i;
const FURNITURE_TAIL = /(?:\s+[-–—|·•]\s+|\s*\t\s*)(?:curriculum vitae|cv|r[ée]sum[ée]|confidential|draft|page\s*\d*(?:\s*of\s*\d+)?)\s*$/i;

/**
 * The page header the first page shows, as lines, else []: many résumés set the name and the contact
 * line in Word's page header (Insert → Header), which is not in word/document.xml — they were lost,
 * and the first body line ("Summary") became the name (R4-IMP-05). The first section's "first page"
 * header when it has a different first page (<w:titlePg/>), else its default one. The app's own export
 * has a different first page with no header on it, its running header ("Name · Page 2") on the others:
 * none of that is read.
 */
async function docxHeaderLines(bytes, xml) {
  const sect = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/.exec(xml)?.[0] ?? '';
  const titlePage = /<w:titlePg(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(sect);
  const ref = [...sect.matchAll(/<w:headerReference\b[^>]*>/g)].map(([tag]) => tag)
    .find((tag) => new RegExp(`w:type="${titlePage ? 'first' : 'default'}"`).test(tag));
  const id = ref && /\br:id="([^"]*)"/.exec(ref)?.[1];
  if (!id) return [];
  const rels = await unzipEntry(bytes, 'word/_rels/document.xml.rels');
  const target = docxRels(rels && decode(rels)).find((r) => r.id === id)?.target.replace(/^\/?word\//, '');
  const lines = (target && await docxPartLines(bytes, target)) || [];
  // A header's furniture is no name: "Curriculum Vitae", "Confidential", "Page 1"; and "Robin Vale –
  // Resume" is the name alone.
  return lines
    .map((l) => ({ ...l, text: l.text.replace(FURNITURE_TAIL, '') }))
    .filter((l) => !FURNITURE.test(l.text.trim()));
}

/**
 * A .docx file's text as lines (docxXmlLines), its hyperlinks' targets read from its relationships:
 * the first page's header first (docxHeaderLines), less any line the body starts with too, then the body.
 */
export async function docxLines(bytes) {
  const xml = await unzipEntry(bytes, 'word/document.xml');
  if (!xml) throw new Error('That Word file has no document in it.');
  const text = decode(xml);
  const rels = await unzipEntry(bytes, 'word/_rels/document.xml.rels');
  const body = docxXmlLines(text, docxLinks(rels && decode(rels)));
  const opening = new Set(body.map((l) => l.text.trim()).filter(Boolean).slice(0, 12));
  const header = (await docxHeaderLines(bytes, text)).filter((l) => !l.text.trim() || !opening.has(l.text.trim()));
  return header.some((l) => l.text.trim()) ? [...header, { text: '', hint: undefined }, ...body] : body;
}

// ── PDF ──────────────────────────────────────────────────────────────────────

const MARKER = /^(?:[•◦▪▸‣⁃●○■–-]|\d{1,2}[.)]|[a-z][.)]|[ivx]{1,4}[.)])$/i;

const heightOf = (it) => it.h || 10;
const sizeRatio = (a, b) => Math.max(heightOf(a), heightOf(b)) / Math.min(heightOf(a), heightOf(b));
/** Two baselines close enough, for their text's size, to be one line. */
const sameLine = (y1, h1, y2, h2) => Math.abs(y1 - y2) <= Math.max(1.5, Math.min(h1, h2) * 0.35);

/** Text items with text, grouped by baseline `{ y, h, items }`, top to bottom. */
function rowsOf(items) {
  const rows = [];
  const sorted = items.filter((it) => typeof it.str === 'string' && it.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of sorted) {
    const h = heightOf(it);
    let row = rows.find((r) => sameLine(r.y, r.h, it.y, h));
    if (!row) { row = { y: it.y, h, items: [] }; rows.push(row); }
    row.h = Math.max(row.h, h);
    row.items.push(it);
  }
  return rows.sort((a, b) => b.y - a.y);
}

/** The narrowest empty band, in pt, a gutter between two columns leaves; the narrowest column. */
const GUTTER = 10;
const MIN_COLUMN = 60;

/**
 * A run of rows read as two columns at the gutter `at` when they are two: most of its lines have
 * text on one side of it alone, and each side has lines of its own, three or more one after another
 * with no line shared across (a side column's labels and a main column's paragraphs fall on
 * baselines of their own). A right-aligned date or a second contact shares its line with the text
 * at its left, and a location under a date sits alone between such lines (Executive's): that is one
 * column of entries with fields at the right, not two columns.
 */
function isTwoColumns(rows, at) {
  const alone = { left: 0, right: 0 };
  const streak = { left: 0, right: 0 };
  const most = { left: 0, right: 0 };
  for (const row of rows) {
    const l = row.items.some((it) => it.x < at);
    const r = row.items.some((it) => it.x >= at);
    if (l && r) { streak.left = 0; streak.right = 0; continue; }
    const side = l ? 'left' : 'right';
    alone[side] += 1;
    streak[side] += 1;
    most[side] = Math.max(most[side], streak[side]);
  }
  return most.left >= 3 && most.right >= 3 && alone.left + alone.right >= rows.length / 2;
}

/**
 * One page's text items as blocks to read one after another (R2-148). A two-column page — the
 * Sidebar template's coloured side column beside its main one — read by baseline across the whole
 * width interleaves the columns line by line. So: find a gutter, an x band at least GUTTER wide that
 * no item crosses (a line that does, such as a full-width header or footer, is read across the page
 * as before); each run of rows between such lines that really is two columns (isTwoColumns) is read
 * column by column, the left one first, as a page is read. Each side is split the same way in turn,
 * so a page in three or more columns is read a column at a time, left to right (R2-148-b); every
 * block inside a side is a column's. A page with no gutter is one block.
 */
export function pdfPageBlocks(items) {
  const one = [{ items, column: false }];
  const texts = items.filter((it) => typeof it.str === 'string' && it.str.trim());
  if (texts.length < 8) return one;
  const minX = Math.min(...texts.map((it) => it.x));
  const maxX = Math.max(...texts.map((it) => it.x + (it.w || 0)));
  // Candidates: where an item starts, the right column's edge. The one fewest lines cross wins.
  let best = null;
  for (const at of new Set(texts.map((it) => it.x))) {
    if (at - minX < MIN_COLUMN || maxX - at < MIN_COLUMN) continue;
    const crossing = texts.filter((it) => it.x < at - 0.5 && it.x + (it.w || 0) > at - GUTTER).length;
    if (crossing * 5 > texts.length) continue;
    if (!best || crossing < best.crossing) best = { at: at - 0.5, crossing };
  }
  if (!best) return one;
  const { at } = best;
  const crosses = (row) => row.items.some((it) => it.x < at && it.x + (it.w || 0) > at + 0.5 - GUTTER);

  // Runs of rows no line crosses, between the rows that cross the gutter.
  const blocks = [];
  let whole = [];
  let run = [];
  const endRun = () => {
    if (run.length && isTwoColumns(run, at)) {
      if (whole.length) blocks.push({ items: whole, column: false });
      whole = [];
      const its = run.flatMap((r) => r.items);
      // Either side may be columns of its own (a third column beside the second): split it again.
      // Each call has fewer items than the last, both sides holding lines, so this ends.
      const side = (part) => pdfPageBlocks(part).map((b) => ({ items: b.items, column: true }));
      blocks.push(...side(its.filter((it) => it.x < at)), ...side(its.filter((it) => it.x >= at)));
    } else whole.push(...run.flatMap((r) => r.items));
    run = [];
  };
  for (const row of rowsOf(texts)) {
    if (crosses(row)) { endRun(); whole.push(...row.items); } else run.push(row);
  }
  endRun();
  if (whole.length) blocks.push({ items: whole, column: false });
  return blocks.some((b) => b.column) ? blocks : one;
}

/**
 * One page's text items `{ str, x, y, w, h }` (y the baseline from the page's foot, pt) as lines, top
 * to bottom: items on one baseline are one line, in x order — a word gap a space, a wider gap (a date
 * at the right margin, two contacts, two grid cells; the app sets two fields on a line at least 0.7 em
 * apart, PdfItemHeader's fieldGap) a tab. A list item's marker
 * joins its text with a space. Each line keeps where it starts and ends, and its text height.
 */
export function pdfPageLines(items) {
  return rowsOf(items).map((row) => {
    const its = row.items.sort((a, b) => a.x - b.x);
    let text = '';
    let textX = its[0].x;
    // A marker in one run with its text ("• Built …", as Sidebar's main column sets a list item):
    // its text starts the marker's share of the run in, where a wrapped line of the item starts.
    const inline = /^\s*[•◦▪▸‣⁃●○■–-]\s+/.exec(its[0].str);
    if (inline && its[0].w) textX = its[0].x + (its[0].w * inline[0].length) / its[0].str.length;
    its.forEach((it, i) => {
      if (i) {
        const prev = its[i - 1];
        const gap = it.x - (prev.x + prev.w);
        const marker = i === 1 && MARKER.test(prev.str.trim());
        if (marker) { text = `${text.trim()} `; textX = it.x; }
        // A run in a much larger or smaller size is a field of its own: the name and the job title
        // set on one line (Compact's Inline layout) are only the Name & Title gap apart.
        else if (gap > Math.max(5, row.h * 0.55) || (gap > 2 && sizeRatio(prev, it) >= 1.4)) text = `${text.trimEnd()}\t`;
        else if (gap > row.h * 0.12 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      }
      text += it.str;
    });
    const last = its[its.length - 1];
    return { text: text.replace(/[ ]{2,}/g, ' ').trim(), x: its[0].x, textX, right: last.x + last.w, y: row.y, h: row.h };
  });
}

/**
 * In a column: whether `line`'s first word would have fitted at the end of `prev` (its width guessed,
 * a little on the short side, from its share of the line's letters) — then `prev` ended there, it
 * did not wrap. In a narrow side column every short line ends near the column's right edge ("AWS
 * Certified Data Engineer" over its issuer), so being near the edge alone does not make it wrapped;
 * nor does a line of one word there (a heading, an email address over a phone number).
 */
function fitsAfter(prev, line, right) {
  const word = line.text.split(/\s/)[0];
  const width = ((line.right - line.x) * word.length) / Math.max(1, line.text.length);
  return prev.right + width * 0.8 < right;
}
/** In a column: a line that starts with a name and a colon ("PLATFORMS: Spark, …") is a field of its own. */
const LABELLED = /^\p{Lu}[^:.!?]{0,30}:\s/u;

/**
 * Page `index`'s furniture, not the résumé's text: the running header the app prints atop every page
 * after the first ("Pat Lee · Page 2", ATS-7) and Design → Page numbers' footer ("Page 1 of 3",
 * R2-147) — the page's first or last line, and only with that page's own number.
 */
function isPageFurniture(line, index, first) {
  const n = index + 1;
  if (first && index > 0 && new RegExp(`^(?:.+ · )?Page ${n}$`).test(line.text)) return true;
  return !first && new RegExp(`^Page ${n} of \\d+$`).test(line.text);
}

/**
 * Page `index`'s items without its furniture (isPageFurniture): its last row when that is the page
 * number, then its first when that is the running header. Taken off the items, before the page is
 * split into columns (pdfPageBlocks), so neither is read into a column's text.
 */
function withoutPageFurniture(items, index) {
  let rows = rowsOf(items);
  const drop = new Set();
  const lineOf = (row) => pdfPageLines(row.items)[0];
  if (rows.length && isPageFurniture(lineOf(rows[rows.length - 1]), index, false)) {
    rows[rows.length - 1].items.forEach((it) => drop.add(it));
    rows = rows.slice(0, -1);
  }
  if (rows.length && isPageFurniture(lineOf(rows[0]), index, true)) rows[0].items.forEach((it) => drop.add(it));
  return drop.size ? items.filter((it) => !drop.has(it)) : items;
}

/**
 * The lines of every page as the parser takes them: a line the PDF wrapped joined back to the one
 * it continues (a list item's next line starts under its text; a paragraph's line before it ran to
 * the right margin), a larger gap than a line's as a blank line, a page break as one too. A page in
 * two or more columns is read a column at a time (pdfPageBlocks), each to its own right margin, with a
 * blank line after each. A page's running header and page number (isPageFurniture) are left out. A line
 * that is one field alone at a block's right margin carries hint 'end' (a location under a date).
 */
export function pdfLinesOfPages(pages) {
  const out = [];
  for (const [index, page] of pages.entries()) {
    for (const { items, column } of pdfPageBlocks(withoutPageFurniture(page, index))) {
      const lines = pdfPageLines(items);
      const right = Math.max(0, ...lines.map((l) => l.right));
      const left = Math.min(...lines.map((l) => l.x));
      let prev = null;
      for (const line of lines) {
        if (prev) {
          const dy = prev.y - line.y;
          const near = dy <= Math.max(prev.h, line.h) * 1.9;
          const sameSize = Math.abs(prev.h - line.h) < 1;
          const plain = !line.text.includes('\t') && !prev.text.includes('\t') && !MARKER.test(line.text.split(' ')[0]);
          const listed = MARKER.test(prev.text.split(' ')[0]) || prev.listed;
          const continues = near && sameSize && plain && (
            (listed && Math.abs(line.x - prev.textX) < 2 && line.x > prev.x + 2)
            || (!listed && Math.abs(line.x - prev.x) < 2 && prev.right >= right - 60 && !/[.!?:]$/.test(prev.text)
              && !(column && (!/\s/.test(prev.text) || fitsAfter(prev, line, right) || LABELLED.test(line.text))))
          );
          if (continues) {
            const last = out[out.length - 1];
            last.text = last.text.endsWith('-') && /^\p{Ll}/u.test(line.text) ? last.text + line.text : `${last.text} ${line.text}`;
            prev = { ...line, x: prev.x, textX: prev.textX, listed };
            continue;
          }
          if (!near) out.push({ text: '' });
        }
        // One field alone at the right margin, well right of the left edge: set at the end of its line
        // on purpose, as a location right-aligned under a date is (Title "Inline" and "Side by side",
        // Executive's jobs). Hinted, so the parser reads it as the entry's location (importText.js).
        const atEnd = !line.text.includes('\t') && Math.abs(line.right - right) <= 2 && line.x - left > (right - left) / 2;
        out.push(atEnd ? { text: line.text, hint: 'end' } : { text: line.text });
        prev = { ...line, listed: false };
      }
      out.push({ text: '' });
    }
  }
  return out;
}

/** pdf.js, as the preview loads it (the legacy build, its worker from the bundle). */
async function loadPdfjs() {
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

/**
 * A page's text items with its links' addresses: the text a Link annotation covers, when it is not
 * the address itself (a contact shown as its Display label, "My profile"), reads as "My profile
 * (https://…)" (linkText) — the text layer holds only the label, and the URL was lost (R4-IMP-10).
 * An item mostly inside the link's box is its text; one that runs well past it — a contact line set
 * as one run of text ("a | b | c", Design → Contact style Bar or Bullet), which pdf.js reads as one
 * item — gives it the letters its share of the width holds, to the nearest word's edge.
 */
function withLinks(items, links) {
  if (!links.length) return items;
  const out = items.map((it) => ({ ...it }));
  const whole = new Set();
  const inserts = new Map(); // item → [{ at, text }], put in once every link is read
  const edge = (str, i) => {
    for (let d = 0; d <= 8; d += 1) {
      for (const j of [i - d, i + d]) {
        if (j >= 0 && j <= str.length && (j === 0 || j === str.length || /\s/.test(str[j]) || /\s/.test(str[j - 1]))) return j;
      }
    }
    return Math.max(0, Math.min(str.length, i));
  };
  for (const { rect, url } of links) {
    const [x1, y1, x2, y2] = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
    const hits = [];
    for (const it of out) {
      if (whole.has(it) || !it.str.trim()) continue;
      // Its letters sit above its baseline, y.
      const cy = it.y + heightOf(it) * 0.3;
      if (cy < y1 - 1 || cy > y2 + 1) continue;
      const w = it.w || 0;
      const a = Math.max(x1 - 1, it.x);
      const b = Math.min(x2 + 1, it.x + w);
      if (!w ? it.x < x1 - 1 || it.x > x2 + 1 : b <= a) continue;
      if (!w || (b - a) / w >= 0.8) hits.push({ it, from: 0, to: it.str.length });
      else {
        const n = it.str.length;
        const from = edge(it.str, Math.round(((a - it.x) / w) * n));
        const to = edge(it.str, Math.round(((b - it.x) / w) * n));
        if (to > from) hits.push({ it, from, to });
      }
    }
    if (!hits.length) continue;
    hits.sort((p, q) => q.it.y - p.it.y || p.it.x - q.it.x);
    const label = hits.map((h) => h.it.str.slice(h.from, h.to)).join(' ').replace(/^[\s|•·]+|[\s|•·]+$/g, '').replace(/\s+/g, ' ');
    if (!label) continue;
    // An address set in pieces ("linkedin.com/in/" "pat") is still the address.
    if (linkText(label.replace(/\s+/g, ''), url) === label.replace(/\s+/g, '')) continue;
    const text = linkText(label, url);
    if (text === label) continue;
    hits.forEach((h) => { if (h.from === 0 && h.to === h.it.str.length) whole.add(h.it); });
    const last = hits[hits.length - 1];
    // Never after the separator past its label: a box a little wider than its letters.
    const end = last.it.str.slice(0, last.to).replace(/[\s|•·]+$/, '').length;
    inserts.set(last.it, [...(inserts.get(last.it) || []), { at: end, text: text.slice(label.length) }]);
  }
  for (const [it, list] of inserts) {
    for (const { at, text } of list.sort((p, q) => q.at - p.at)) it.str = it.str.slice(0, at) + text + it.str.slice(at);
  }
  return out;
}

/** A PDF's text as lines (pdfLinesOfPages). `lib`: pdf.js, loaded here when not given (the tests give Node's). */
export async function pdfLines(bytes, lib) {
  const pdfjs = lib || await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 });
  try {
    // A PDF that needs a password to open: pdf.js's own words are "No password given".
    const doc = await task.promise.catch((e) => { throw e?.name === 'PasswordException' ? new Error(LOCKED) : e; });
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // A marked-content item (pdf.js's beginMarkedContent) has no str and no transform: not text.
      const items = content.items.filter((it) => typeof it.str === 'string' && it.transform).map((it) => ({
        str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]),
      }));
      const annotations = await Promise.resolve(page.getAnnotations?.()).catch(() => []);
      pages.push(withLinks(items, (annotations || []).filter((a) => a?.subtype === 'Link' && a.url && a.rect)));
    }
    // Pages, but not a letter of text on them: the pages are pictures, a scan or a photo.
    if (pages.length && !pages.some((p) => p.some((it) => it.str.trim()))) throw new Error(SCANNED);
    return pdfLinesOfPages(pages);
  } finally {
    await task.destroy();
  }
}

// ── Any of them ──────────────────────────────────────────────────────────────

/**
 * A text or Markdown file's text, in the encoding Windows saved it in: Notepad's "Unicode" is UTF-16
 * behind its byte-order mark; Word's "Save as Plain Text" is Windows-1252 by default, where • – — and
 * curly quotes are bytes UTF-8 cannot read (they became "�", and no date or list was found).
 */
function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // UTF-8 with a stray bad byte (a paste, a cut-off file) stays UTF-8, its one bad byte a "�": read as
    // Windows-1252, every "–" and "é" in it would turn to "â€“". A file with no UTF-8 letter at all is
    // Windows-1252.
    const utf8 = new TextDecoder('utf-8').decode(bytes);
    return /[\u0080-\ufffc\ufffe\uffff]/.test(utf8) ? utf8 : new TextDecoder('windows-1252').decode(bytes);
  }
}

/** A file's text as the parser's lines, by its kind. `bytes` its contents. */
export async function documentLines(name, bytes, { pdfjs } = {}) {
  if (/\.pdf$/i.test(name)) return pdfLines(bytes, pdfjs);
  // An older .doc is not a zip: docxLines says to save it as .docx (a .docx named .doc reads as one).
  if (/\.docx?$/i.test(name)) return docxLines(bytes);
  const text = decodeText(bytes).replace(/^﻿/, '');
  return /\.(md|markdown)$/i.test(name) ? markdownLines(text) : text;
}

/**
 * A résumé from a PDF, .docx, Markdown or text `file` (a File, or anything with a name and
 * arrayBuffer()). Throws, with a message to show, when the file holds no text to read.
 */
export async function resumeFromFile(file, options) {
  if (Number(file?.size) > MAX_IMPORT_BYTES) throw new Error(TOO_BIG);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const lines = await documentLines(file.name, bytes, options);
  const count = (Array.isArray(lines) ? lines.map((l) => l.text ?? l).join('') : lines).replace(/\s/g, '').length;
  if (!count) throw new Error(NO_TEXT);
  return resumeFromText(lines);
}
