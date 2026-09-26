/**
 * What a résumé parser reads from the PDF — the ATS tab's "What a parser reads" (R2-141): pdf.js's
 * text items, in the order it reads them, as lines of runs. The same two rules the ATS battery holds
 * an item-based parser to (tests/pdf/ats-entry-header.mjs, OpenResume's documented rules), which it
 * checks every template against:
 *
 *   1. A new line starts where the baseline moves, by more than 2 pt.
 *   2. On a line, an item that starts within about a character's width (half its size) of the end of
 *      the one before it merges into it: one run, which a parser reads as one field. Text set further
 *      apart (a date at the line's right end) is a run of its own.
 *
 * Plain data in and out, and no imports: node's unit tests load it as it is.
 */

/** A baseline move beyond this starts a new line, pt. */
const LINE_MOVE_PT = 2;
/** Items closer than this share a run, in ems of the larger one. */
const MERGE_EM = 0.5;
/** Runs closer than this join without a space (a font change inside a word), pt. */
const TOUCH_PT = 0.8;
/** How the text shows two runs on one line: set apart, as the page sets them. */
export const RUN_GAP = '   ';

/** One pdf.js text item as { str, x, y, w, h }: `transform` holds its origin; `height` is its size. */
const itemOf = (it) => ({
  str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0,
  h: it.height || Math.abs(it.transform[3]) || 0,
});

/** One line's items as the texts of its runs (rule 2), in the order pdf.js read them. */
function runsOf(items) {
  const runs = [];
  for (const it of items) {
    const prev = runs[runs.length - 1];
    if (prev && it.x - prev.end <= MERGE_EM * Math.max(it.h, prev.h)) {
      const noSpace = /\s$/.test(prev.text) || /^\s/.test(it.str) || it.x - prev.end < TOUCH_PT;
      prev.text += (noSpace ? '' : ' ') + it.str;
      prev.end = Math.max(prev.end, it.x + it.w);
    } else {
      runs.push({ text: it.str, end: it.x + it.w, h: it.h });
    }
  }
  return runs.map((r) => r.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * A page's text items (pdf.js getTextContent().items) as its lines, each the texts of its runs:
 * [['Senior Engineer', '03/2021 – Present'], ['Northwind Traders', 'Austin, TX'], …]. Items with
 * no text (pdf.js's end-of-line and space markers) carry nothing a parser reads, and are skipped.
 */
export function textLines(items) {
  const lines = [];
  let cur = null;
  for (const raw of Array.isArray(items) ? items : []) {
    if (typeof raw?.str !== 'string' || !raw.str.trim() || !Array.isArray(raw.transform)) continue;
    const it = itemOf(raw);
    if (!cur || Math.abs(it.y - cur.y) > LINE_MOVE_PT) {
      cur = { y: it.y, items: [] };
      lines.push(cur);
    }
    cur.items.push(it);
  }
  return lines.map((l) => runsOf(l.items)).filter((runs) => runs.length);
}

/**
 * Every page's lines (textLines) as one plain text: a line to a line, its runs RUN_GAP apart, a
 * blank line between pages. What the ATS tab shows and copies.
 */
export const parserText = (pages) => (Array.isArray(pages) ? pages : [])
  .map((lines) => lines.map((runs) => runs.join(RUN_GAP)).join('\n'))
  .filter(Boolean)
  .join('\n\n');

/**
 * Reads the PDF `data` (bytes) with pdf.js — `pdfjs` is { lib, worker }: the library, and the worker
 * to run it on (none: pdf.js starts its own) — into each page's lines (textLines). The document is
 * freed once read, whether or not that worked.
 */
export async function readPdfLines(data, { lib, worker } = {}) {
  const task = lib.getDocument({ data, ...(worker ? { worker } : {}), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      pages.push(textLines((await page.getTextContent()).items));
    }
    return pages;
  } finally {
    // Freed in the background: a failure to free it is no failure to read it.
    Promise.resolve(task.destroy()).catch(() => {});
  }
}

/** Text as compared: lower case, one space between words. */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
/** A run's text less the separators a template sets around a field ("Austin, TX |", "· 2021"). */
const bare = (s) => norm(s).replace(/^[\s|·•,:;–—-]+|[\s|·•,:;–—-]+$/g, '');
/**
 * A date's words and marks — a month's name, short or whole, a season ("Summer 2020" prints as it is
 * stored, as the battery's DATE_WORDS reads it), "Present" — each a whole word, so a word that only
 * starts like a month ("Marketing", "Decatur") stays: what is left once they are gone is some other
 * field's text.
 */
const DATE_WORDS = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|autumn|winter|present|current|now|today|to|since)\b\.?|\d+|[\s/.,'–—-]+/gi;
const YEAR = /\b(?:19|20)\d{2}\b/;

/**
 * How one value comes out of the lines: 'own' — a run of its own, which a parser files as a field;
 * 'joined' — inside a run with other text, which a parser must split to file it; 'missing' — in no
 * run (not printed, or broken across lines).
 */
function fieldIn(lines, value) {
  const want = norm(value);
  if (!want) return null;
  let joined = false;
  for (const runs of lines) {
    for (const run of runs) {
      if (bare(run) === want) return 'own';
      if (norm(run).includes(want)) joined = true;
    }
  }
  return joined ? 'joined' : 'missing';
}

/** How a job's dates come out: its start year's run holds nothing but dates ('own'), or other text too. */
function datesIn(lines, years) {
  if (!years.length) return null;
  let joined = false;
  for (const runs of lines) {
    for (const run of runs) {
      if (!years.some((y) => run.includes(y))) continue;
      if (!run.replace(DATE_WORDS, '').trim()) return 'own';
      joined = true;
    }
  }
  return joined ? 'joined' : 'missing';
}

/**
 * For each job (`jobs`: the entries as they print — atsChecker's printedJobs), whether its title,
 * company, dates and location come out of `pages` (readPdfLines) as fields a parser can file: each
 * 'own', 'joined' or 'missing' (fieldIn), or null where the job prints none. A job is looked for from
 * where the one before it was found, over its header — the line with its title (with its company
 * near it, where it can), the line above and the three below — so two jobs at one company are each
 * read at their own place.
 */
export function jobFields(pages, jobs) {
  const all = (Array.isArray(pages) ? pages : []).flat();
  const list = Array.isArray(jobs) ? jobs : [];
  const out = [];
  let from = 0;
  for (const job of list) {
    const title = norm(job?.role);
    const company = norm(job?.company);
    const around = (i) => all.slice(Math.max(from, i - 1), i + 4);
    const holds = (lines, want) => lines.some((runs) => runs.some((r) => norm(r).includes(want)));
    const find = (want, near) => (want ? all.findIndex((runs, i) => i >= from && holds([runs], want) && (!near || holds(around(i), near))) : -1);
    // A later role of a group (printedJobs' `groupLead`) prints under its employer header, which the
    // group's first role was read at: its company, and a location it shares with that role, are
    // printed there once, so they take that role's outcome — read in its own header they were red
    // "not found" on every role but the first (R4-CL-06). Its title is looked for alone.
    const lead = Number.isInteger(job?.groupLead) && job.groupLead < out.length ? job.groupLead : -1;
    // Its title with its company beside it — the headline under the name can repeat a job's title, and
    // a company can head the job before it too — then either one alone.
    const tries = lead >= 0 ? [find(title)] : [find(title, company), find(company, title), find(title), find(company)];
    const at = tries.find((i) => i >= 0) ?? -1;
    const header = at >= 0 ? around(at) : all;
    if (at >= 0) from = at + 1;
    const years = [job?.startDate, job?.current ? '' : job?.endDate]
      .map((d) => String(d ?? '').match(YEAR)?.[0]).filter(Boolean);
    const sharesPlace = lead >= 0 && norm(job?.location) === norm(list[lead]?.location);
    out.push({
      title: fieldIn(header, job?.role),
      company: lead >= 0 ? out[lead].company : fieldIn(header, job?.company),
      dates: datesIn(header, years),
      location: sharesPlace ? out[lead].location : fieldIn(header, job?.location),
    });
  }
  return out;
}
