// Import from a PDF, a Word file (.docx), Markdown or plain text (R2-148): the file's text as lines,
// read by importText.js into a new résumé. JSON stays with the importers it always had (the
// Dashboard's and the editor's); importDocument.js loads this on demand, and pdf.js only for a PDF.
import { markdownLines, resumeFromText } from './importText.js';

const NO_TEXT = 'No text could be read from that file. A scanned PDF holds pictures of its pages, not text: export it again as text, or import a Word, text or JSON file.';

/** The largest file the import reads: a résumé is well under it; one over it would stall the page. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const TOO_BIG = 'That file is too large to be a résumé (over 20 MB). Import the résumé itself as a PDF, Word, text or JSON file.';
const DAMAGED = 'That Word file is damaged and cannot be read. Save it again as .docx (or PDF) and import that.';

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
 * word/document.xml as lines: a paragraph a line (its breaks as more lines, its tabs as tabs), a
 * list paragraph behind a "• ", an empty one as a blank line. A Heading style marks a heading, the
 * Title style the name — the app's Word export writes its section titles as Heading 1.
 */
export function docxXmlLines(xml) {
  const body = String(xml).split(/<w:body\b[^>]*>/)[1] ?? String(xml);
  const lines = [];
  for (const para of body.split(/<\/w:p>/)) {
    // The paragraph's own start (not a <w:pPr> or <w:pStyle> inside it, nor a table's markup before it).
    const starts = [...para.matchAll(/<w:p[\s>]/g)];
    if (!starts.length) continue;
    const p = para.slice(starts[starts.length - 1].index);
    const props = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(p)?.[1] ?? '';
    const style = /<w:pStyle w:val="([^"]*)"/.exec(props)?.[1] ?? '';
    const list = /<w:numPr>/.test(props);
    const runs = p.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, '');
    const text = [...runs.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr)(?:\s[^>]*)?\/>/g)]
      .map((m) => (m[1] !== undefined ? xmlText(m[1]) : (m[2] === 'tab' ? '\t' : '\n'))).join('');
    const hint = /^(heading|berschrift|titre)/i.test(style) ? 'heading' : (/^title$/i.test(style) ? 'name' : undefined);
    lines.push({ text: list && text.trim() ? `• ${text}` : text, hint });
  }
  return lines;
}

/** A .docx file's text as lines (docxXmlLines). */
export async function docxLines(bytes) {
  const xml = await unzipEntry(bytes, 'word/document.xml');
  if (!xml) throw new Error('That Word file has no document in it.');
  return docxXmlLines(decode(xml));
}

// ── PDF ──────────────────────────────────────────────────────────────────────

const MARKER = /^(?:[•◦▪▸‣⁃●○■–-]|\d{1,2}[.)]|[a-z][.)]|[ivx]{1,4}[.)])$/i;

/**
 * One page's text items `{ str, x, y, w, h }` (y the baseline from the page's foot, pt) as lines, top
 * to bottom: items on one baseline are one line, in x order — a word gap a space, a wider gap (a date
 * at the right margin, two contacts, two grid cells; the app sets two fields on a line at least 0.7 em
 * apart, PdfItemHeader's fieldGap) a tab. A list item's marker
 * joins its text with a space. Each line keeps where it starts and ends, and its text height.
 */
export function pdfPageLines(items) {
  const rows = [];
  const sorted = items.filter((it) => typeof it.str === 'string' && it.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const it of sorted) {
    const h = it.h || 10;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(1.5, Math.min(r.h, h) * 0.35));
    if (!row) { row = { y: it.y, h, items: [] }; rows.push(row); }
    row.h = Math.max(row.h, h);
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const its = row.items.sort((a, b) => a.x - b.x);
    let text = '';
    let textX = its[0].x;
    its.forEach((it, i) => {
      if (i) {
        const prev = its[i - 1];
        const gap = it.x - (prev.x + prev.w);
        const marker = i === 1 && MARKER.test(prev.str.trim());
        if (marker) { text = `${text.trim()} `; textX = it.x; }
        else if (gap > Math.max(5, row.h * 0.55)) text = `${text.trimEnd()}\t`;
        else if (gap > row.h * 0.12 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      }
      text += it.str;
    });
    const last = its[its.length - 1];
    return { text: text.replace(/[ ]{2,}/g, ' ').trim(), x: its[0].x, textX, right: last.x + last.w, y: row.y, h: row.h };
  });
}

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
 * The lines of every page as the parser takes them: a line the PDF wrapped joined back to the one
 * it continues (a list item's next line starts under its text; a paragraph's line before it ran to
 * the right margin), a larger gap than a line's as a blank line, a page break as one too. A page's
 * running header and page number (isPageFurniture) are left out.
 */
export function pdfLinesOfPages(pages) {
  const out = [];
  for (const [index, page] of pages.entries()) {
    const lines = pdfPageLines(page);
    if (lines.length && isPageFurniture(lines[lines.length - 1], index, false)) lines.pop();
    if (lines.length && isPageFurniture(lines[0], index, true)) lines.shift();
    const right = Math.max(0, ...lines.map((l) => l.right));
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
          || (!listed && Math.abs(line.x - prev.x) < 2 && prev.right >= right - 60 && !/[.!?:]$/.test(prev.text))
        );
        if (continues) {
          const last = out[out.length - 1];
          last.text = last.text.endsWith('-') && /^\p{Ll}/u.test(line.text) ? last.text + line.text : `${last.text} ${line.text}`;
          prev = { ...line, x: prev.x, textX: prev.textX, listed };
          continue;
        }
        if (!near) out.push({ text: '' });
      }
      out.push({ text: line.text });
      prev = { ...line, listed: false };
    }
    out.push({ text: '' });
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

/** A PDF's text as lines (pdfLinesOfPages). `lib`: pdf.js, loaded here when not given (the tests give Node's). */
export async function pdfLines(bytes, lib) {
  const pdfjs = lib || await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const content = await (await doc.getPage(i)).getTextContent();
      pages.push(content.items.map((it) => ({
        str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]),
      })));
    }
    return pdfLinesOfPages(pages);
  } finally {
    await task.destroy();
  }
}

// ── Any of them ──────────────────────────────────────────────────────────────

/** A file's text as the parser's lines, by its kind. `bytes` its contents. */
export async function documentLines(name, bytes, { pdfjs } = {}) {
  if (/\.pdf$/i.test(name)) return pdfLines(bytes, pdfjs);
  // An older .doc is not a zip: docxLines says to save it as .docx (a .docx named .doc reads as one).
  if (/\.docx?$/i.test(name)) return docxLines(bytes);
  const text = decode(bytes).replace(/^﻿/, '');
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
