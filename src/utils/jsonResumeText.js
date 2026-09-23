// Text and dates as a JSON Resume file (jsonresume.org) holds them, read in and written out: what
// the import (jsonResumeImport.js), the export (jsonResumeExport.js) and each section's entries
// (jsonResumeSections.js) share. Plain data: Node loads it as well as Vite.
import { isText, storedText } from './storedText.js';
import { parseMonthYear } from './dates.js';
import { parseRichText, plainTextToHtml } from './richText.js';

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
  for (const b of Array.isArray(bullets) ? bullets : []) {
    const text = storedText(b).replace(/\s+/g, ' ').trim();
    if (text) highlights.push(text);
  }
  return { summary: summary.join('\n'), highlights };
}

/** Rich text (the summary, an award's description) as plain text: one line per paragraph or list item. */
export const plain = (html) => parseRichText(html).map(blockText).filter(Boolean).join('\n');
