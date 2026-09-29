// Text and dates as a JSON Resume file (jsonresume.org) holds them, read in and written out: what
// the import (jsonResumeImport.js), the export (jsonResumeExport.js) and each section's entries
// (jsonResumeSections.js) share. Plain data: Node loads it as well as Vite.
import { isText, storedText } from './storedText.js';
import { parseMonthYear } from './dates.js';
import { parseRichText, plainTextToHtml, sanitizeRichText } from './richText.js';

/** A list's entries that are objects: a null (or other value) in one of the file's lists is skipped. */
export const entries = (list) => (Array.isArray(list) ? list.filter((v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)) : []);

/** A list's text and numbers joined with ', ' as they are, which is what the import always stored for a list of text. */
export const joined = (list) => list.filter(isText).join(', ');

/** A value the schema has as a list of text (a project's roles, its keywords) as the text the app stores. */
export const listText = (v) => (Array.isArray(v) ? joined(v) : storedText(v));

/** Text the app stores as a comma-separated list ("React, Node") as the schema's list of text. */
export const listOf = (v) => storedText(v).split(',').map((k) => k.trim()).filter(Boolean);

/**
 * A JSON Resume text value (a summary, a highlight, a course list) as the rich text the app stores:
 * escaped, a line break as <br>. It went in as it was, and the editor, the PDF and Word read it as
 * HTML: "Owned the <ingest> pipeline" printed "Owned the pipeline", "<b>cost</b>" printed bold.
 */
export const richText = (v) => plainTextToHtml(storedText(v));

/**
 * An entry's rich text from the file's `summary` and `highlights` (the schema's list of bullets),
 * and a last paragraph (`after`: an education's courses, a publication's link). Text alone stays a
 * bare paragraph, as the import always stored it.
 */
export function richDescription(summary, highlights, after = '') {
  const text = richText(summary);
  const list = Array.isArray(highlights) && highlights.length > 0 ? `<ul>${highlights.map((h) => `<li>${richText(h)}</li>`).join('')}</ul>` : '';
  const tail = richText(after);
  if (!list && !tail) return text;
  if (!text && !list) return tail;
  return [text && `<p>${text}</p>`, list, tail && `<p>${tail}</p>`].join('');
}

/**
 * A date as the import stores it: an ISO day or time as its month ('2021-03-01' → '2021-03'), and
 * anything else whole — a year, 'YYYY-MM', the month picker's "Jan 2024" (what earlier builds
 * exported) or other text. It used to keep the first 7 characters of every date: "Jan 2024" came
 * back as "Jan 202" and "September 2023" as "Septemb".
 */
export function month(v) {
  const text = storedText(v).trim();
  const iso = /^(\d{4}-\d{2})-\d{2}(?:[T ].*)?$/.exec(text);
  return iso ? iso[1] : text;
}

/**
 * A stored date as JSON Resume writes one — ISO 8601: 'YYYY-MM', or 'YYYY' for a year alone —
 * whatever form the app stored it in ("Jan 2024", "05/2023", 2019; src/utils/dates.js). Text that is
 * no month and year ("Summer 2020") goes out as it is: the schema wants ISO, but nothing is dropped.
 */
export function isoDate(v) {
  const d = parseMonthYear(v);
  if (!d) return storedText(v).trim();
  return d.m ? `${d.y}-${String(d.m).padStart(2, '0')}` : String(d.y);
}

/** A bullet typed as text at the start of a paragraph: "• …", "- …", "* …", "– …". */
const TYPED_BULLET = /^[•\-*–—◦▪]\s+/;

/** One block of rich text as plain text (a <br> inside it stays a line break). */
const blockText = (b) => b.runs.map((r) => r.text).join('').trim();

/**
 * An entry's rich-text description as JSON Resume holds it: `highlights`, one per list item — or
 * per paragraph typed as a bullet ("• …") — and `summary`, the other paragraphs as plain text, one
 * per line, entities decoded. Every line once: the summary used to repeat every bullet as well
 * (and was cut at 300 characters), so an export imported back printed each bullet twice. The
 * entry's legacy `bullets` (an old save's, an old import's) print after its description as list
 * items, so they are highlights too: they were left out of the file.
 */
export function describe(html, bullets) {
  const summary = [];
  const highlights = [];
  for (const b of parseRichText(html)) {
    const text = blockText(b);
    if (!text) continue;
    if (b.marker) highlights.push(text);
    else if (TYPED_BULLET.test(text)) highlights.push(text.replace(TYPED_BULLET, '').trim());
    else summary.push(text);
  }
  highlights.push(...legacyBullets(bullets));
  return { summary: summary.join('\n'), highlights };
}

/** An entry's legacy `bullets` as the text each prints (describe). */
const legacyBullets = (bullets) => (Array.isArray(bullets) ? bullets : []).map((b) => storedText(b).replace(/\s+/g, ' ').trim()).filter(Boolean);

/**
 * An entry's description as the file holds it: `summary` and `highlights` (describe) for every
 * tool, and — when those alone would come back differently (richDescription): a paragraph after a
 * list, a second paragraph, bold, a link, a numbered or nested list — the description itself,
 * sanitized, with its legacy bullets as the list they print as, under `descriptionHtml`. The import
 * reads it back while the summary and highlights are still the ones written beside it
 * (descriptionFrom). Until then a trip put every paragraph above one flat list of plain bullets.
 */
export function described(html, bullets) {
  const out = describe(html, bullets);
  const legacy = legacyBullets(bullets);
  const clean = sanitizeRichText(`${storedText(html)}${legacy.length ? `<ul>${legacy.map((b) => `<li>${richText(b)}</li>`).join('')}</ul>` : ''}`);
  return sanitizeRichText(richDescription(out.summary, out.highlights)) === clean ? out : { ...out, descriptionHtml: clean };
}

/**
 * An entry's rich text from the file: `html`, the export's own copy (described), while the
 * `summary` and `highlights` beside it are still the ones it was written with — sanitized, as the
 * editor reads any HTML — and a last paragraph (`after`) as richDescription adds one. Otherwise
 * (another tool's file, or one edited since the export) the summary and highlights (richDescription).
 */
export function descriptionFrom(summary, highlights, html, after = '') {
  if (typeof html === 'string' && html) {
    const clean = sanitizeRichText(html);
    const own = describe(clean);
    const list = Array.isArray(highlights) ? highlights.map(storedText) : [];
    if (own.summary === storedText(summary) && own.highlights.length === list.length && own.highlights.every((h, i) => h === list[i])) {
      const tail = richText(after);
      return tail ? `${clean}<p>${tail}</p>` : clean;
    }
  }
  return richDescription(summary, highlights, after);
}

/** Rich text (the summary, an award's description) as plain text: one line per paragraph or list item. */
export const plain = (html) => parseRichText(html).map(blockText).filter(Boolean).join('\n');

/**
 * Rich text (the summary, an award's description) for a field the schema holds as one plain text:
 * `text`, one line per paragraph or list item, which every tool reads — and `html`, the rich text
 * itself, sanitized, only when the text alone would print differently: a list, a second paragraph,
 * bold. The import reads `html` back while the text is still the one written beside it (richFrom).
 * Until R2-006 only the text went out, and a list in the summary came back as plain lines.
 */
export function flattened(html) {
  const clean = sanitizeRichText(html);
  const text = plain(clean);
  return sanitizeRichText(richText(text)) === clean ? { text } : { text, html: clean };
}

/**
 * A field's rich text from the file: `html`, the export's formatted copy (flattened), while `text`
 * is still the plain text written beside it — sanitized, as the editor reads any HTML, so a file
 * can bring in nothing the editor would not keep. Otherwise `text` (another tool's file, or one
 * whose text was edited since the export), a line break per line.
 */
export function richFrom(text, html) {
  if (typeof html === 'string' && html) {
    const clean = sanitizeRichText(html);
    if (plain(clean) === storedText(text)) return clean;
  }
  return richText(text);
}
