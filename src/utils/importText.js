// A résumé read from text (R2-148): what a PDF, a Word file, a Markdown or a plain-text résumé says,
// as lines (importFile.js gets them out of the file), turned into a résumé of the app's. It is a
// best-effort read — a page of text does not say which line is a company and which a job title — so
// the rule is that nothing is lost: the name, the job title, the contacts and the summary go to the
// header; each known heading (the app's own titles and every alias the ATS check knows) starts a
// section of its type, whose entries are found by their dates; any other heading starts a custom
// section; and every line the reading cannot place lands in a custom section, as text to review.
//
// Pure: no DOM, no file reading, relative imports only, so Node's test runner loads it as it is.
import { newId } from './ids.js';
import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { SECTION_TYPE_DEFAULTS } from './defaultDataSectionTypes.js';
import { getStarterSettings } from './starterSettings.js';
import { DATA_VERSION } from './dataVersion.js';
import { ATS_STANDARD_SECTIONS } from './atsChecker.js';

// ── Headings ─────────────────────────────────────────────────────────────────

/** A heading's letters alone, lower case, "&" read as "and": "WORK  EXPERIENCE:" → "workexperience". */
const headingKey = (text) => String(text).toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');

/**
 * The headings the import knows, by their key: the ATS check's aliases for each type, the title
 * each section type gets in the editor, and the common others. `summary` and `contact` are the
 * header's; publications and references keep their heading in a custom section.
 */
const HEADING_TYPES = (() => {
  const map = new Map();
  const add = (type, titles) => titles.forEach((t) => { if (!map.has(headingKey(t))) map.set(headingKey(t), type); });
  for (const [type, { canonical, aliases }] of Object.entries(ATS_STANDARD_SECTIONS)) {
    add(SECTION_TYPE_DEFAULTS[type] ? type : 'custom', [canonical, ...aliases]);
  }
  // References keep their heading in a custom section: the import cannot tell a referee's lines apart.
  for (const [type, make] of Object.entries(SECTION_TYPE_DEFAULTS)) if (type !== 'custom' && type !== 'references') add(type, [make('x').title]);
  add('summary', ['Summary', 'Professional Summary', 'Profile', 'Professional Profile', 'About', 'About Me', 'Objective',
    'Career Objective', 'Career Summary', 'Executive Summary', 'Personal Statement', 'Overview', 'Personal Profile']);
  add('contact', ['Contact', 'Contacts', 'Contact Information', 'Contact Info', 'Contact Details', 'Personal Details', 'Personal Information']);
  add('experience', ['Employment', 'Professional Background', 'Internships', 'Internship Experience', 'Work', 'Experiences', 'Professional History']);
  add('education', ['Education and Training', 'Academic Qualifications', 'Educational Qualifications']);
  add('skills', ['Skill Set', 'Skillset', 'Core Skills', 'Tech Stack', 'Technologies', 'Tools', 'Tools and Technologies', 'Expertise', 'Technical Expertise']);
  add('languages', ['Language']);
  add('certifications', ['Certification', 'Licenses', 'Licenses and Certificates', 'Certificates and Licenses']);
  add('volunteering', ['Volunteer', 'Volunteer Work', 'Volunteering and Leadership']);
  add('interests', ['Hobbies', 'Hobbies and Interests', 'Personal Interests', 'Interests and Hobbies']);
  add('custom', ['References', 'Referees', 'Publications']);
  return map;
})();

/** The section type a heading names, or null for one the import does not know. */
export function headingType(text) {
  return HEADING_TYPES.get(headingKey(text)) ?? null;
}

// ── Lines ────────────────────────────────────────────────────────────────────

/** A list item's mark at the start of a line: •, -, *, 1., a), iv. … */
const BULLET = /^\s*(?:[•◦▪▫▸►‣⁃●○■□✓✔➢➤*+\-–—]|\(?\d{1,2}[.)]|\(?[a-z][.)]|\(?[ivx]{1,4}[.)])\s+/i;
const NUMBERED = /^\s*\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s+/i;
/** A line of dashes, equals or underscores under a heading (the ATS text's rule). */
const RULE = /^\s*[-=_─━—–]{3,}\s*$/;

const clean = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/[​­]/g, '').replace(/[ \f\v\r]+/g, ' ').replace(/ *\t[\t ]*/g, '\t').trim();

/** How far a list item is indented, in columns (a tab four): a nested item's is more than its parent's. */
const indentOf = (text) => {
  const lead = /^[ \t]*/.exec(String(text ?? ''))[0];
  return BULLET.test(String(text ?? '')) ? lead.replace(/\t/g, '    ').length : 0;
};

/**
 * Lines as the parser reads them: `{ text, hint, depth }`. `hint` is what the file itself says a line
 * is, where it says so — 'name', 'heading' (a Word Heading style, a Markdown ##) or 'entry' (###).
 * `depth`: a list item's nesting, where the file says it (Markdown's and a text file's indent, Word's
 * list level), 0 else — clean() takes the indent off (R4-LO-02).
 */
function toLines(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/\r\n|\r|\n/);
  return raw.flatMap((l) => {
    // Its links (a Markdown, Word or PDF line's, R4-LO-05) go with each of its lines: richText finds each by its text.
    // A line after a break that starts at a tab with nothing before it is set at the right tab stop, as
    // Word's entry header sets a location under its date ("⇥ Porto"): at the line's end, hint 'end'.
    // Only under a first line set with a tab (a title and its date), and a place's words, not a school's,
    // a degree's or a role's (an indented "⇥University of Porto" is a second field).
    if (l && typeof l === 'object') {
      const lines = String(l.text ?? '').split('\n');
      const atEnd = (text) => lines[0].includes('\t') && /^\t[^\t]*\S[^\t]*$/.test(text) && ![SCHOOL, DEGREE, ROLE].some((re) => re.test(text));
      return lines.map((text, i) => ({
        text: clean(text), hint: i ? (atEnd(text) ? 'end' : undefined) : l.hint, depth: i ? 0 : (l.depth || 0), ...(l.links?.length ? { links: l.links } : {}),
        ...(l.fields && !i ? { fields: l.fields } : {}),
      }));
    }
    return [{ text: clean(l), depth: indentOf(l) }];
  });
}

/** An address as a résumé prints it, to tell a link's label from its address: "https://www.x.com/" → "x.com". */
const bareAddress = (s) => String(s).trim().toLowerCase().replace(/^(?:mailto:|tel:)/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

/**
 * A link as its label and, where the label does not show it, the address it goes to: ["My profile",
 * "https://linkedin.com/in/pat"]; ["pat@example.com"] for a mailto: link that prints its address. A
 * link that goes nowhere a résumé can (a page anchor) is its label alone.
 */
function linkParts(label, href) {
  const text = String(label ?? '').trim();
  const to = String(href ?? '').trim();
  if (!/^(?:https?:\/\/|mailto:|tel:)\S+$/i.test(to) && !WEB.test(to)) return [text || to];
  // Always with its scheme, as the PDF follows it: "(linkedin.com/in/pat)" is not told apart from
  // a project's "(Next.js)" by the readers of linkText's form (LINKED).
  if (!/^[a-z]+:/i.test(to)) return linkParts(text, `https://${to}`);
  if (!text) return [to];
  if (bareAddress(text) === bareAddress(to)) return [text];
  if (/^tel:/i.test(to) && text.replace(/\D/g, '') === to.replace(/\D/g, '')) return [text];
  return [text, to];
}

/**
 * A link's text as the parser reads it: "LinkedIn (https://linkedin.com/in/pat)" — the header reads
 * the address in brackets as the contact (takeContacts), an entry as its URL. A PDF's and a Word
 * file's links come this way too (importFile.js). Before, only the label was kept: a contact shown as
 * "My profile" was dropped as a bare label, its address nowhere (R4-IMP-02, R4-IMP-10).
 */
export function linkText(label, href) {
  const [text, to] = linkParts(label, href);
  return to ? `${text} (${to})` : text;
}

/**
 * Markdown's inline marks off: bold and italics, links to their text (linkText; `as` 'label' the
 * label alone; an array, the label, each address pushed to it — an entry's title line gives them as
 * fields of their own at its end), escapes, inline code. `found`: each link's label and address pushed
 * to it, for the rich text to link (richText).
 */
function unmark(text, as, found) {
  // A link's address is no text to format: kept aside, as written, from the passes over the rest (R5-IMP-01).
  const kept = [];
  const keep = (address) => `\uE001${kept.push(address) - 1}\uE001`;
  return inlineOff(String(text)
    .replace(/!\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, '$1')
    // A label may hold escaped brackets ("\[draft\]", the export's) and a pair of its own ("[v2]").
    .replace(/\[((?:\\.|\[(?:\\.|[^\]\\])*\]|[^\]\\[])*)\]\(([^)\s]*)[^)]*\)/g, (_, label, href) => {
      if (as === 'label') return label || keep(href);
      const [t, to] = linkParts(label, href);
      if (found) {
        const url = to || linkParts('', href)[0];
        // Its label as the line prints it, its marks off too: "[**Bold**](url)" is found as "Bold" (R4-SW-I-04).
        if (/^(?:https?:|mailto:|tel:)/i.test(url)) found.push({ label: inlineOff(t), url });
      }
      if (!to) return t;
      if (Array.isArray(as)) { as.push(to); return t; }
      return `${t} (${keep(to)})`;
    })
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, (_, address) => keep(address)), kept)
    .replace(/ {2,}$/, '');
}
/**
 * An address written out in Markdown text: "https://x.com/_a_/b", "www.…", "mailto:…". It ends before
 * a closing emphasis mark or an escape ("**https://x.com**", the export's "https://x.com/\\_a\\_"), and
 * never takes in an address already kept aside (unmark), nor a backtick: an address in a code span
 * ("`https://x.com/a`") leaves both its backticks to the code pass, which takes them off (R5-IMP-01).
 */
const MD_ADDRESS = /\b(?:https?:\/\/|mailto:|www\.)[^\s<>()"`\uE001]*[^\s<>()"`.,;:!?'’*_\\\uE001]/gi;
/**
 * Inline code, bold, italics and strike-through, and backslash escapes off a run of Markdown text. An address in it is
 * kept as written: "https://x.com/_foo_" is not "https://x.com/foo" (R5-IMP-01). `kept`: addresses
 * unmark set aside, each written in the text as its index between two U+E001s (a private-use
 * character, never a résumé's), put back here.
 */
const inlineOff = (text, kept = []) => String(text)
  .replace(MD_ADDRESS, (address) => `\uE001${kept.push(address.replace(/\\([\\`*_{}[\]()#+\-.!|<>~=&])/g, '$1')) - 1}\uE001`)
  .replace(/`([^`]*)`/g, '$1')
  .replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/__(.+?)__/g, '$1')
  .replace(/~~(?!\s)(.+?)(?<![\s\\])~~/g, '$1') // GFM strike-through, the export's for struck text
  .replace(/(^|[^\w*\\])\*(?!\s)(.+?)(?<![\s\\])\*(?![\w*])/g, '$1$2')
  .replace(/(^|[^\w\\])_(?!\s)(.+?)(?<![\s\\])_(?!\w)/g, '$1$2')
  .replace(/\\([\\`*_{}[\]()#+\-.!|<>~=&])/g, '$1')
  .replace(/\uE001(\d+)\uE001/g, (_, i) => kept[i]);

/**
 * A "|" the Markdown escapes ("\|", the export's for one the user typed: "R&D \| Ops"), held as this
 * character through the parse, so no split at " | " parts it from its field (R4-SW-I-05); resumeFromText
 * gives it back as "|". A Unicode noncharacter: no file holds one. An unescaped " | " (the one the export
 * writes between a meta line's parts) still parts fields; a text or PDF file has no escapes.
 */
const TYPED_PIPE = '\uFDD0';
const typed = (text) => text.replace(/\\([\\|])/g, (m, c) => (c === '|' ? TYPED_PIPE : m));
/** `value` with each TYPED_PIPE back as "|": a string, or every string in an array or object. */
function untyped(value) {
  if (typeof value === 'string') return value.replaceAll(TYPED_PIPE, '|');
  if (Array.isArray(value)) return value.map(untyped);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, untyped(v)]));
  return value;
}

/**
 * An entry heading's fields where its marks show where each ends: the export's "**primary** — *secondary*",
 * or either alone. A dash typed inside one is the user's, not a field's edge: "**Deloitte - Consulting**
 * — *Engineer*" is the company "Deloitte - Consulting" and the role "Engineer", where splitting its
 * text at every " - " and " — " made three fields (R5-IMP-02). `{ fields }` only for a heading whose
 * fields hold such a dash, so every other line reads as before; a heading without these marks (a
 * hand-written "### Acme — Engineer", a text or PDF file's) is split at its dashes as it always was.
 */
function headingFields(raw, hint) {
  if (hint !== 'entry' && hint !== 'role') return {};
  const m = /^\*\*((?:\\.|[^*\\])+)\*\*(?:\s+—\s+\*((?:\\.|[^*\\])+)\*)?$|^\*((?:\\.|[^*\\])+)\*$/.exec(raw.trim());
  if (!m) return {};
  const fields = [m[1], m[2], m[3]].filter(Boolean).map((f) => unmark(f, []).trim());
  if (!fields.every(Boolean) || !fields.some((f) => fieldsOf(f).length > 1)) return {};
  // "**Acme - Engineer** — *Leeds, UK*": a place in the italic run is a hand-written heading's, company
  // and role bold and the place after them; the export's italic run is a role, a school or an issuer,
  // never a place. Split at its dashes as before, or the place became the company (IMP-REV-1).
  if (m[2] && PLACE.test(fields[1]) && !ROLE.test(fields[1]) && !SCHOOL.test(fields[1])) return {};
  // One bold or italic run alone is the export's only when the file shows it (markdownLines): people
  // and AI tools also bold a whole "### **Software Engineer — Google**", role and company in one.
  return { fields, ...(m[2] ? {} : { lone: true }) };
}

/**
 * A heading wholly bold or italic (headingFields' `lone`) is one field only where the file is the
 * export's: a grouped employer (a role heading under it with no date between, as roleEntries reads a
 * group) or a role under one, or a file whose entry headings use the export's "**primary** —
 * *secondary*" — its single-field entries print one run. Else it is hand-written, "### **Software
 * Engineer — Google**" with its date under it (and maybe a "#### Highlights"), and split at its dashes
 * as it always was.
 */
function loneFields(out) {
  const exported = out.some((l) => (l.hint === 'entry' || l.hint === 'role') && /^\*\*(?:\\.|[^*\\])+\*\*\s+—\s+\*(?:\\.|[^*\\])+\*$/.test(l.raw));
  let group = false; // whether the entry heading in force is a grouped employer
  out.forEach((l, k) => {
    if (l.hint === 'entry') {
      let next = k + 1;
      while (next < out.length && !out[next].hint) next += 1;
      group = out[next]?.hint === 'role' && !out.slice(k + 1, next).some(dated);
    } else if (l.hint && l.hint !== 'role') group = false;
    if (l.lone) {
      if (!exported && !group) delete l.fields;
      delete l.lone;
    }
    delete l.raw;
  });
  return out;
}

/**
 * A Markdown résumé as the parser's lines: "# " the name, "## " a heading, "### " an entry's title,
 * a list item a "• " line (a numbered one keeps its number), the rest as text with its marks off. A
 * deeper heading under an entry's is a 'role' of it: Experience's "Group roles by company" exports the
 * employer as "### Acme" and each role under it as "#### Senior Engineer" (R4-IMP-09).
 */
export function markdownLines(md) {
  const out = [];
  let named = false;
  let entryLevel = 0; // the level of the entry heading in force, 0 under none
  for (const line of String(md ?? '').split(/\r\n|\r|\n/)) {
    // A closing run of #s only after a space: "## C#" is the heading "C#" (R4-LO-07).
    const h = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      let hint = level === 1 && !named ? 'name' : (level <= 2 ? 'heading' : 'entry');
      if (hint === 'entry') {
        if (entryLevel && level > entryLevel) hint = 'role';
        else entryLevel = level;
      } else entryLevel = 0;
      // An entry's linked title keeps its address, as a field of its own at the line's end: a project's
      // URL; a linked company's address (in its description), never its role (R4-IMP-02).
      const links = [];
      const text = unmark(typed(h[2]), hint === 'entry' || hint === 'role' ? links : 'label') + links.map((u) => ` | ${u}`).join('');
      if (hint === 'name') named = true;
      out.push({ text, hint, raw: typed(h[2]).trim(), ...headingFields(typed(h[2]), hint) });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push({ text: '' }); continue; } // a thematic break
    const item = /^\s*(?:[-*+]|(\d{1,3}[.)]))\s+(.*)$/.exec(line);
    // Its links' labels and addresses, for the rich text (R4-LO-05).
    const links = [];
    const withLinks = (l) => (links.length ? { ...l, links } : l);
    if (item) { out.push(withLinks({ text: `${item[1] ? `${item[1]} ` : '• '}${unmark(typed(item[2]), undefined, links)}`, ...(indentOf(line) ? { depth: indentOf(line) } : {}) })); continue; }
    out.push(withLinks({ text: unmark(typed(line.replace(/^\s*>\s?/, '')), undefined, links) }));
  }
  return loneFields(out);
}

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const SEASON = '(?:spring|summer|fall|autumn|winter)';
/** One date as the app's Date formats print it, or as people type it: "Mar 2021", "03/2021", "2021-03", "2021". */
const DAY = `(?:${MONTH},?\\s+\\d{4}|${SEASON}\\s+\\d{4}|\\d{1,2}\\s*[/.]\\s*\\d{4}|\\d{1,2}-\\d{4}|\\d{4}\\s*[/.-]\\s*(?:0?[1-9]|1[0-2])(?!\\d)|(?:19|20)\\d{2})`;
const NOW = '(?:present|current|currently|now|today|ongoing|till date|to date)';
// A hyphen typed as Unicode's own, the non-breaking one ("2019‑2021" in a PDF of a Word file, text
// pasted from one) or the minus sign, is a dash too.
const DASHES = '\\u2010\\u2011\\u2012\\u2212';
const SEP = `\\s*(?:[-${DASHES}–—~]|to|until|through)\\s*`;
// "Expected May 2025", "Anticipated graduation date: 2025", "May 2025 (Expected)": a date still to
// come is when the entry ends, alone or after its start ("Aug 2021 – Expected May 2025"). So is one
// past: "Graduated May 2021", "Graduation: 2020", "Class of 2020", "May 2020 (Graduated)". Before,
// those were no date, and the education took them as its degree.
const AHEAD = '(?:(?:expected|anticipated)(?:\\s+(?:graduation|completion))?(?:\\s+date)?|graduated|graduation(?:\\s+date)?|class\\s+of)\\s*:?\\s*';
const AHEAD_AFTER = '\\s*\\(?\\s*(?:expected|anticipated|graduated)\\s*\\)?';
// "(4 years 9 months)", "· 3 yrs 2 mos": how long it lasted, after the range as LinkedIn's PDF prints it.
const LENGTH = '(?:less than (?:a|one) (?:year|month)|\\d+\\+?\\s*(?:years?|yrs?|months?|mos?)\\.?(?:,?\\s*(?:and\\s+)?\\d+\\s*(?:months?|mos?)\\.?)?)';
const LENGTH_AFTER = `(?:\\s*\\(\\s*${LENGTH}\\s*\\)?|\\s+[·•]\\s+${LENGTH})`;
const RANGE = new RegExp(`^(since\\s+)?(${DAY})(?:${SEP}(?:${AHEAD})?(${DAY}|${NOW}|\\d{2}(?!\\d)))?(${AHEAD_AFTER})?(?:${LENGTH_AFTER})?$`, 'i');
const LENGTH_ONLY = new RegExp(`^${LENGTH}$`, 'i');
const END_ONLY = new RegExp(`^(?:(?:[-${DASHES}–—]|to|until)\\s*(?:${AHEAD})?|${AHEAD})(${DAY}|${NOW})(?:${AHEAD_AFTER})?$`, 'i');
const IS_NOW = new RegExp(`^${NOW}$`, 'i');
// "Jun – Aug 2021", "May to August 2020": a range inside one year prints the year once, at its end.
// The first month takes the end's year (the year before when it comes later in the year: "Dec – Feb
// 2021"). Before, "Jun" was no date: it became the job's role and "Aug 2021" its start.
const SAME_YEAR = new RegExp(`^(${MONTH})(?=${SEP}(${MONTH}),?\\s+(\\d{4})(?!\\d))`, 'i');
const MONTH_AT = (m) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m.slice(0, 3).toLowerCase());
const withYear = (t) => t.replace(SAME_YEAR, (first, _, end, year) => `${first} ${MONTH_AT(first) > MONTH_AT(end) ? Number(year) - 1 : year}`);

/** A whole piece of text read as a date or a range: { start, end, current, text }, else null. */
export function readDateRange(text) {
  let t = String(text ?? '').trim().replace(/^[(*_[]+|[)*_\]]+$/g, '').trim();
  if (!t) return null;
  const tidy = (d) => d.replace(/\s+/g, ' ').replace(/(\d)\s*([/.-])\s*(?=\d)/g, '$1$2');
  let m = RANGE.exec(withYear(t));
  // "May 2025 (Expected)" lost its closing bracket with the trim above: the text as written.
  if (/\([^)]*$/.test(t)) t = `${t})`;
  // An academic year, "2019–21", "2019-21": the end year's last two digits, after the start year's.
  // "2011-12" is read as December 2011 above (the app's YYYY-MM Date format), so only a hyphen with
  // two digits over 12, or another dash, gets here.
  if (m && /^\d{2}$/.test(m[3] || '')) {
    if (!/^\d{4}$/.test(m[2]) || Number(m[3]) <= Number(m[2].slice(2))) m = null;
    else m[3] = m[2].slice(0, 2) + m[3];
  }
  if (m) {
    // "May 2025 (Expected)", "May 2020 (Graduated)": one date so marked is the end, not the start.
    if (m[4] && !m[3] && !m[1]) return { start: '', end: tidy(m[2]), current: false, text: t };
    // "Since 2019" is a range still running, as "2019 – Present" is.
    const now = m[3] ? IS_NOW.test(m[3]) : Boolean(m[1]);
    return { start: tidy(m[2]), end: m[3] && !now ? tidy(m[3]) : '', current: now, text: t };
  }
  m = END_ONLY.exec(t);
  if (m) {
    const now = IS_NOW.test(m[1]);
    return { start: '', end: now ? '' : tidy(m[1]), current: now, text: t };
  }
  return null;
}

/** A date at the end of a piece of text, after a dash, a comma or in brackets: "Name - Issuer - Jun 2022". */
function trailingDate(text) {
  if (text.length > 120) return null;
  // The earliest split whose rest is a date: "Role - Mar 2021 - Present" keeps the whole range.
  const seps = [...text.matchAll(/\s[-–—|]\s|,\s|\(/g)];
  for (const sep of seps) {
    const rest = text.slice(sep.index + sep[0].length).replace(/\)\s*$/, '');
    const date = readDateRange(rest);
    if (date) return { date, rest: text.slice(0, sep.index).trim() };
  }
  return null;
}

// ── Contacts ─────────────────────────────────────────────────────────────────

const EMAIL = /^(?:mailto:)?[^\s@|,;:<>()]+@[^\s@|,;:<>()]+\.[a-z]{2,}$/i;
const URL_LIKE = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;
const PHONE = /^(?:tel:)?\+?[\d\s().\-/\u2010\u2011\u2012\u2212]{7,}$/;
/**
 * "Portland, OR", "Leeds, United Kingdom", "Remote": a place as a header prints one. With its postcode
 * too ("Chicago, IL 60601", "Toronto, ON M5V 2T6"), and then its street before it ("123 Main St,
 * Chicago, IL 60601"): before, the digits failed the test, and the place printed as "Additional Information".
 */
const TOWN = "[\\p{L}][\\p{L}.'’\\- ]{0,40},\\s*[\\p{L}][\\p{L}.'’\\- ]{0,40}(?:,\\s*[\\p{L}][\\p{L}.'’\\- ]{0,30})?";
const POSTCODE = `,?\\s+(?:\\d{5}(?:-\\d{4})?|[a-z]\\d[a-z] ?\\d[a-z]\\d|[a-z]{1,2}\\d[a-z\\d]? ?\\d[a-z]{2})(?:,\\s*[\\p{L}][\\p{L}.'’\\- ]{0,30})?`;
const STREET = "\\d{1,6}[a-z]?\\s+[\\p{L}\\d.'’#\\- ]{1,40},\\s*";
const ONE_PLACE = new RegExp(`^(?:${TOWN}|(?:${STREET})?${TOWN}${POSTCODE}|remote|hybrid)$`, 'iu');
/** A part of a place with a "|" typed in it: "London" in "London | Remote". */
const PLACE_PART = /^[\p{L}][\p{L}.,'’\- ]{0,60}$/u;
/**
 * A place: ONE_PLACE, or places with a "|" the user typed between them (TYPED_PIPE, the Markdown's
 * "\|"): "Boston, MA | Remote", "London | Remote", one of them a place and the rest words. Before, the
 * typed "|" failed the test, so the export's own contact line gave no location — the whole of it went
 * to "Additional Information" — and a grouped employer's or an undated entry's place its description.
 */
const PLACE = {
  test(text) {
    const s = String(text);
    if (ONE_PLACE.test(s)) return true;
    const parts = s.split(TYPED_PIPE).map((p) => p.trim());
    return parts.length > 1 && parts.every((p) => PLACE_PART.test(p)) && parts.some((p) => ONE_PLACE.test(p));
  },
};
/**
 * A place's last part, a state, province or country: "…, SC", "…, Ohio", "…, United Kingdom". A job title
 * with a comma ("Product Manager, Payments", "Engineer, QA") ends in none (the header's title test).
 */
const REGION_END = {
  CODE: /,\s*(?:A[BKLRZ]|C[AOT]|D\.?C\.?|DE|FL|GA|HI|I[ADLN]|KS|KY|LA|M[ABDEINOST]|N[BCDEHJLMSTUVY]|O[HKNR]|P[AE]|QC|RI|S[CDK]|T[NX]|UT|V[AT]|W[AIVY]|YT|NSW|VIC|QLD|TAS|ACT|UK|USA?|UAE)\.?$/,
  NAME: /,\s*(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|ontario|quebec|british columbia|alberta|united states(?: of america)?|united kingdom|england|scotland|wales|ireland|canada|australia|new zealand|india|germany|france|spain|italy|netherlands|portugal|poland|sweden|switzerland|singapore|japan|china|brazil|mexico|south africa|nigeria|kenya|pakistan|philippines|united arab emirates)$/i,
  test(text) { return this.CODE.test(text) || this.NAME.test(text); },
};
/** A contact's name before it: "Email: …", "LinkedIn - …". */
const LABEL = /^(?:e-?mail|mail|phone|tel|telephone|mobile|cell|linkedin|github|website|web|site|portfolio|url|location|address|based in)\s*[:\-–]\s*/i;

/** A contact's name on a line of its own, over its value: the Sidebar template's "EMAIL", "PHONE". */
const BARE_LABEL = /^(?:e-?mail|mail|phone|tel|telephone|mobile|cell|linkedin|github|website|web|site|portfolio|url|location|address)$/i;

const digits = (s) => s.replace(/\D/g, '').length;

/** A link as linkText writes it: "LinkedIn (https://linkedin.com/in/pat)" → its label and address. */
const LINKED = /^(.*?)\s*\(((?:https?:\/\/|mailto:|tel:)[^()\s]+|www\.[^()\s]+|[^()\s]+\.[a-z]{2,}\/[^()\s]*)\)$/i;
/** An address alone, with its scheme: a link's (linkText, an entry title's field). */
const ADDRESS = /^(?:https?:\/\/|mailto:)[^\s()]+$/i;
/** The contacts a Display label can stand for (contacts.js: the `link` fields). */
const LABELLED_KEYS = new Set(['website', 'linkedin', 'github']);

/** What a piece of header text is: { key, value } for a contact, else null. */
function contactOf(segment) {
  const labelled = LABEL.exec(segment);
  const s = segment.replace(LABEL, '').trim();
  if (!s) return null;
  if (EMAIL.test(s)) return { key: 'email', value: s.replace(/^mailto:/i, '') };
  if (URL_LIKE.test(s) && !/^\d/.test(s)) {
    if (/(^|\.|\/)linkedin\.com\//i.test(s)) return { key: 'linkedin', value: s };
    if (/(^|\.|\/)github\.com\//i.test(s)) return { key: 'github', value: s };
    return { key: 'website', value: s };
  }
  if (PHONE.test(s) && digits(s) >= 7 && digits(s) <= 15) return { key: 'phone', value: s.replace(/^tel:/i, '') };
  if (PLACE.test(s) || (labelled && /^(location|address|based in)/i.test(labelled[0]))) return { key: 'location', value: s };
  return null;
}

/** A header line's pieces: split at tabs (a PDF's wide gaps, Word's tab stops) and at | • · ◆ ⋅ marks. */
const headerPieces = (text) => text.split(/\t|\s+[|•·◆⋅∙▪]\s+|\s{3,}/).map((s) => s.trim()).filter(Boolean);

/** Whether a header piece is a contact: one alone, or a link as linkText writes it, "GitHub (https://…)". */
const isContact = (piece) => Boolean(contactOf(piece) || (LINKED.exec(piece) && contactOf(LINKED.exec(piece)[2])));

/**
 * A header piece that is contacts set apart at dashes, slashes or commas ("alex@kim.dev — (206)
 * 555-0100 — Seattle, WA", "a@b.com, (206) 555-0100, Seattle, WA"), as its pieces — a place's own
 * comma kept ("Seattle, WA") — else null. Two contacts at least, one of them no place, and any other
 * piece short ("Backend Engineer"): a sentence with a dash in it stays whole. Before, headerPieces
 * split only at | • · and tabs, so such a line gave no contact and printed as "Additional Information".
 */
function contactRun(piece) {
  if (isContact(piece)) return null;
  const out = [];
  for (const part of piece.split(/\s+[—–/-]\s+/)) {
    if (isContact(part)) { out.push(part); continue; }
    const cells = part.split(/\s*,\s+/);
    for (let k = 0; k < cells.length;) {
      // The longest run of cells from here that is one contact: a place is two or three ("Austin, TX, USA").
      let j = Math.min(cells.length, k + 3);
      while (j > k + 1 && !isContact(cells.slice(k, j).join(', '))) j -= 1;
      out.push(cells.slice(k, j).join(', '));
      k = j;
    }
  }
  const found = out.filter(isContact);
  const ok = out.length > 1 && found.length >= 2 && found.some((p) => (contactOf(p) || {}).key !== 'location')
    && out.every((p) => isContact(p) || (p.length <= 40 && !/[.!?]$/.test(p)));
  return ok ? out : null;
}

// ── Entries ──────────────────────────────────────────────────────────────────

/** The pieces of an entry's header line: tabs and | · • marks. */
const pieces = (text) => text.split(/\t|\s+[|·•]\s+/).map((s) => s.trim()).filter(Boolean)
  // A range's length set apart at "·" ("Jan 2020 – Present · 3 yrs 2 mos") is part of its date.
  .reduce((out, p) => {
    if (out.length && LENGTH_ONLY.test(p) && readDateRange(out[out.length - 1])) out[out.length - 1] += ` · ${p}`;
    else out.push(p);
    return out;
  }, []);
/** Whether a line holds a date: an entry heading with one under it is no grouped employer (loneFields, roleEntries). */
const dated = (l) => pieces(l.text).some((p) => readDateRange(p) || trailingDate(p));
/** A header piece's fields: "Company — Role", "Company - Role". */
const fieldsOf = (text) => text.split(/\s+[—–]\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean);

/** "GPA: 3.8", "ID: X", "Link: …", "Technologies: …", "Expires: …": a field an export prints by name. */
const META = /^(gpa|cgpa|grade|id|credential id|credential|license|link|url|website|technologies|tech stack|tech|stack|tools|built with|expires|expiry|expiration|valid until|location)\s*:?\s+(.+)$/i;
const META_KEYS = { cgpa: 'gpa', grade: 'gpa', 'credential id': 'id', credential: 'id', license: 'id', url: 'link', website: 'link', 'tech stack': 'technologies', tech: 'technologies', stack: 'technologies', tools: 'technologies', 'built with': 'technologies', expiry: 'expires', expiration: 'expires', 'valid until': 'expires' };
function metaOf(piece) {
  const m = META.exec(piece);
  if (!m || (!piece.includes(':') && !/^(gpa|id)\b/i.test(piece))) return null;
  const key = m[1].toLowerCase();
  return { key: META_KEYS[key] || key, value: m[2].trim() };
}
/** A dated line's text fields, its date left out: "Acme Corp ⇥ Jan 2020 – Present", "Acme Corp, 2020" → ["Acme Corp"]. */
const datedFields = (text) => pieces(text).flatMap((p) => (readDateRange(p) ? [] : [trailingDate(p)?.rest ?? p])).filter(Boolean);
const isMetaLine = (text) => { const p = pieces(text); return p.length > 0 && p.every((x) => metaOf(x)); };

/** Words a job title holds, and a company's name rarely does: which of two fields is the role. */
const ROLE = /\b(engineer|developer|programmer|manager|director|lead|head|intern|analyst|designer|consultant|specialist|scientist|officer|assistant|associate|coordinator|architect|administrator|admin|president|vp|founder|co-founder|owner|teacher|professor|lecturer|researcher|nurse|technician|accountant|writer|editor|producer|representative|supervisor|executive|advisor|adviser|strategist|principal|chief|cto|ceo|cfo|coo|partner|fellow|trainee|apprentice|volunteer|tutor|mentor|chair|secretary|treasurer|clerk|agent|operator|instructor|coach|counselor|therapist|physician|attorney|paralegal|sales|marketer|recruiter|contractor|freelancer|freelance)s?\b/i;
/** Every role word in a text, for whether each is plural (sectionLeads). */
const ROLE_ALL = new RegExp(ROLE.source, 'gi');
const DEGREE = /\b(b\.?\s?[ase]\.?|b\.?sc|bsc|b\.?tech|b\.?eng|beng|bba|bfa|bcom|m\.?\s?[ase]\.?|m\.?sc|msc|m\.?tech|m\.?eng|meng|mba|mfa|ph\.?\s?d|phd|doctor(?:ate)?|bachelor'?s?|master'?s?|associate'?s?|diploma|certificate|high school|a-?levels?|gcse|degree|hnd|llb|llm|md|jd)\b/i;
/** A subject a degree is in, as a field of study names one: "Computer Science", "Business Administration". */
const SUBJECT = /\b(science|sciences|engineering|studies|mathematics|maths?|statistics|economics|business|administration|finance|accounting|marketing|management|psychology|biology|chemistry|physics|history|literature|english|philosophy|law|medicine|nursing|architecture|arts?|music|informatics|communications?|journalism|politics|political|sociology|linguistics|humanities|design|geography|anthropology|development|software|web|data|computing|technology|programming|stack)\b/i;
/** What may follow a degree after its comma and is no school: "First Class Honours", "Minor in Math". */
const HONOURS = /\b(honou?rs|distinction|merit|cum laude|summa|magna|first|second|third|class|minor|major|concentration|speciali[sz]ation|track|option|gpa|grade)\b/i;
/** A degree's own name, which is no subject it is in: the "of Science" of "Bachelor of Science". */
const DEGREE_NAME = /\b(?:bachelor|master|doctor|associate)'?s?\s+of\s+(?:fine\s+|applied\s+|liberal\s+)?(?:science|arts?|engineering|business\s+administration|laws?|philosophy|education|technology|commerce|music|nursing|medicine|social\s+work|public\s+(?:health|policy|administration)|architecture|design|computer\s+applications)\b/i;
const SCHOOL = /\b(university|universit[äéà]t?|college|institute|institut|school|academy|polytechnic|conservatory|seminary|lyc[ée]e|gymnasium)\b/i;
const WEB = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;

/**
 * A company's legal ending after its comma: "Acme, Inc.", "Blue Bottle, LLC" — a name, not a place.
 * No two-letter code a place shares: "Denver, CO", "Adelaide, SA", "Calgary, AB", "Reno, NV".
 */
const CORPORATE = /,\s*(?:inc|incorporated|llc|l\.l\.c|llp|pllc|ltd|limited|corp|corporation|gmbh|plc|pty\.?\s+ltd|pte\.?\s+ltd|s\.a|s\.r\.l|sarl|b\.v|n\.v)\.?$/i;
/** Types whose header has a second line under the title in the PDF and Word: the role, the degree. */
const SECOND_LINE = new Set(['experience', 'education', 'volunteering', 'custom']);
/** Types whose entries carry a location. */
const PLACED = new Set(['experience', 'education', 'volunteering', 'custom']);
/** Types whose header names a role and an organisation: a job, a volunteering post. */
const JOB = new Set(['experience', 'volunteering']);

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A web or mail address written out in body text: "https://…", "www.…", "mailto:…". */
const BARE_LINK = /\b(?:https?:\/\/|mailto:|www\.)[^\s<>()"]*[^\s<>()".,;:!?'’]/gi;

/**
 * A line's text as rich text, its links as links (R4-LO-05): each link the file gave (`links`, its
 * label and address — a Markdown [label](url), a Word hyperlink, a PDF's link box), read as linkText
 * wrote it, "label (url)", or as its label alone where that is its address; then every address written
 * out ("see https://…") outside them. Before, all of it was plain text.
 */
function linkedHtml(text, links = []) {
  const anchor = (url, label) => `<a href="${escapeHtml(url).replace(/"/g, '&quot;')}">${label}</a>`;
  let html = escapeHtml(text);
  let from = 0;
  for (const { label, url } of links) {
    const shown = escapeHtml(label);
    const withUrl = `${shown} (${escapeHtml(url)})`;
    let at = html.indexOf(withUrl, from);
    let length = withUrl.length;
    // The label alone (a link whose label is its address): a whole word of the text, not part of one ("Go" in "Google").
    for (let k = at < 0 ? html.indexOf(shown, from) : -1; k >= 0 && at < 0; k = html.indexOf(shown, k + 1)) {
      if (!/\w/.test(html[k - 1] || '') && !/\w/.test(html[k + shown.length] || '')) { at = k; length = shown.length; }
    }
    if (!shown || at < 0) continue;
    const a = anchor(url, shown);
    html = html.slice(0, at) + a + html.slice(at + length);
    from = at + a.length;
  }
  // Then every address written out, outside the links placed: on a line with a link of the file's
  // too, "… and https://b.com" is a link as it is on a line with none (R4-SW-I-03).
  return html.split(/(<a\b[^>]*>.*?<\/a>)/).map((part, i) => (i % 2 ? part : part.replace(BARE_LINK, (shown) => {
    const url = shown.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return anchor(/^www\./i.test(url) ? `https://${url}` : url, shown);
  }))).join('');
}

/**
 * Body lines as the editor's rich text: a run of list items as a list (numbered ones as <ol>),
 * every other line a paragraph of its own. A line is its text, or `{ text, links }` (linkedHtml).
 */
function richText(lines) {
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of lines) {
    const { text: raw, links } = typeof line === 'string' ? { text: line } : line;
    const text = String(raw ?? '').replace(/\t+/g, ' ').trim();
    if (!text) continue;
    if (BULLET.test(text)) {
      const kind = NUMBERED.test(text) && !/^\s*[-–—*+•]/.test(text) ? 'ol' : 'ul';
      if (list !== kind) { close(); html += `<${kind}>`; list = kind; }
      html += `<li>${linkedHtml(text.replace(BULLET, ''), links)}</li>`;
    } else {
      close();
      html += `<p>${linkedHtml(text, links)}</p>`;
    }
  }
  close();
  return html;
}

/** Title Case for a line typed in capitals ("PROFESSIONAL EXPERIENCE", "AVERY QUINN"); others as they are. */
const SMALL = new Set(['and', 'of', 'the', 'in', 'for', 'at', 'on', 'to', 'a', 'an', 'or', '&']);
function tamed(text) {
  if (!/\p{Lu}/u.test(text) || /\p{Ll}/u.test(text)) return text;
  return text.toLowerCase().split(/(\s+)/).map((w, i) => (i && SMALL.has(w) ? w : w.replace(/^(\p{L})/u, (c) => c.toUpperCase()).replace(/([-'’.])(\p{L})/gu, (_, a, c) => a + c.toUpperCase()))).join('');
}
const isCaps = (text) => /\p{Lu}/u.test(text) && !/\p{Ll}/u.test(text);

/** A blank entry of `type`, the editor's own, with `fields` over it. */
function itemOf(type, fields) {
  const blank = (SECTION_TYPE_DEFAULTS[type] || SECTION_TYPE_DEFAULTS.custom)('x').items[0];
  return { ...blank, ...fields, id: newId('item') };
}

/** A section of `type` titled `title`, with the editor's settings for it. */
function sectionOf(type, title, items) {
  const base = (SECTION_TYPE_DEFAULTS[type] || SECTION_TYPE_DEFAULTS.custom)(newId('sec'));
  return { ...base, title, visible: true, items };
}

/**
 * An entry's header lines read as its fields: `parts` its text fields in order, `date`, `location`
 * and the fields it names (`meta`). On a line with the date, what follows the date is the location
 * ("Mar 2021 – Present | Portland, OR"); on the line under the title, what sits at the right tab is
 * ("Senior Engineer ⇥ Portland, OR", the PDF's and Word's layout). A place alone on a line of its own
 * under the title is too: at the right margin (hint 'end', Executive's "Inline" jobs), or, for a job,
 * right under a line that held both the role and the company (the Timeline's jobs: "Role ⇥ Company",
 * "Role — Company", "Role, Company", R2-148).
 */
function readHeader(type, header) {
  const out = { parts: [], date: null, location: '', meta: {}, named: [] };
  const field = (p) => {
    // An address alone is the entry's link (a Markdown title's, R4-IMP-02): a project's or a
    // certificate's URL; another type's description keeps it.
    const meta = metaOf(p) || (ADDRESS.test(p) ? { key: 'link', value: p } : null);
    if (meta) out.meta[meta.key] = out.meta[meta.key] ? `${out.meta[meta.key]}, ${meta.value}` : meta.value;
    if (meta) out.named.push({ key: meta.key, text: p });
    return Boolean(meta);
  };
  const place = (p) => {
    if (!PLACED.has(type) || out.location) return false;
    out.location = p;
    return true;
  };
  // The text fields the line above gave: two when it held the role and the company ("Role ⇥ Company",
  // "Role — Company", a job's "Role, Company"); one a line when they are stacked (the Sidebar's school).
  let above = 0;
  header.forEach((line, k) => {
    const ps = pieces(line.text);
    // A Markdown heading's own fields (headingFields), kept whole where its text is still theirs.
    const whole = line.fields?.join(' — ');
    // The text fields found on the lines above this one: a title line came before it when there are any.
    const titled = out.parts.length;
    let at = -1;
    if (!out.date) {
      at = ps.findIndex((p) => readDateRange(p) || trailingDate(p));
      if (at >= 0) {
        const whole = readDateRange(ps[at]);
        const trail = whole ? null : trailingDate(ps[at]);
        out.date = whole || trail.date;
        ps[at] = whole ? '' : trail.rest;
      }
    }
    ps.forEach((p, j) => {
      if (!p || field(p)) return;
      // After the date on its line; or at the right tab of the line under the title. Under a date
      // alone ("Mar 2021 – Present" over "Role ⇥ Company", the Timeline's) that tab parts two fields.
      if (at >= 0 && j > at && place(p)) return;
      if (at < 0 && k > 0 && j > 0 && j === ps.length - 1 && line.text.includes('\t') && titled && place(p)) return;
      // A place alone on its line: at the right margin, or a job's, right under the line that held its
      // role and company. Not any place under two fields: the Sidebar's school stacks its degree, school,
      // field of study and place a line each, and that place is read by the education's own rule (entryOf).
      if (at < 0 && k > 0 && ps.length === 1 && (line.hint === 'end' || (JOB.has(type) && above >= 2 && PLACE.test(p) && !ROLE.test(p))) && place(p)) return;
      out.parts.push(...(p === whole ? line.fields : fieldsOf(p)));
    });
    const gave = out.parts.slice(titled);
    above = (JOB.has(type) ? inlinePair(gave) : gave).length;
  });
  return out;
}

/**
 * `parts` with a lone "Role, Company" split in two: Title "Inline" with an italic sub prints the role
 * and the company as one run joined by a comma (Executive's jobs: "Senior Data Engineer, Northwind
 * Analytics"). Split at the first comma with a job title's word on one side alone, so a company's own
 * comma ("Acme, Inc.") and a place ("Portland, OR") stay whole. Other parts as they are.
 */
function inlinePair(parts) {
  if (parts.length !== 1) return parts;
  const [text] = parts;
  for (const m of text.matchAll(/,\s+/g)) {
    const a = text.slice(0, m.index).trim();
    const b = text.slice(m.index + m[0].length).trim();
    if (a && b && ROLE.test(a) !== ROLE.test(b)) return [a, b];
  }
  return parts;
}

/** "Google, Mountain View, CA" → ["Google", "Mountain View, CA"]: a name, then its city and state or country after a comma; else null. */
function placeAfterComma(text) {
  const m = /^(.+?),\s*([^,]+),(\s*[^,]+)$/.exec(text);
  // "Google, Inc., CA": a legal ending is the company's, no city ("Inc., CA" was the job's location).
  if (!m || CORPORATE.test(`, ${m[2].trim()}`)) return null;
  const place = `${m[2]},${m[3]}`;
  return PLACE.test(place) && REGION_END.test(place) && !ROLE.test(m[1]) && !ROLE.test(place) ? [m[1].trim(), place.trim()] : null;
}

/** Whether of two fields the first is the role: true, false, or null when neither's words say. */
function roleLeadsOf(a, b) {
  if (ROLE.test(a) !== ROLE.test(b)) return ROLE.test(a);
  // With no role word on either side, a company's legal ending names the company: "Barista — Blue Bottle, LLC".
  if (CORPORATE.test(a) !== CORPORATE.test(b)) return CORPORATE.test(b);
  return null;
}

/** Two fields in the order the file printed them, `roleLeads` whether the role comes first when neither's words say. */
function roleFirst(a, b, roleLeads) {
  if (!b) return ROLE.test(a || '') ? [a, ''] : ['', a];
  return (roleLeadsOf(a, b) ?? roleLeads) ? [a, b] : [b, a];
}

/**
 * Whether a section's jobs lead with the role. A résumé prints every job in a section in one order:
 * the role first on Sidebar, Executive and Timeline, or where Design's Order says so, else the company.
 * The jobs whose words tell which field is the role say it for those where nothing does ("Sous Chef —
 * Chez Panisse" under "Kitchen Manager — Nopa"). Before, those always read company first, so a
 * role-first résumé's own export came back with the two swapped. None telling: the type's default.
 * A field whose role words are all plural ("Summit Partners", "Gensler Architects") names a firm, not
 * a job, so it tells nothing: it made "Summit Partners — Receptionist" swap "Starbucks — Barista" too.
 */
function sectionLeads(type, entries) {
  const firm = (t) => { const ms = [...t.matchAll(ROLE_ALL)]; return ms.length > 0 && ms.every((m) => m[0].length > m[1].length); };
  let score = 0;
  for (const e of entries) {
    if (e.header[0]?.group) continue;
    const [a = '', b = ''] = inlinePair(headerOf(type, e.header).parts);
    const lead = b ? roleLeadsOf(a, b) : null;
    if (lead !== null && !firm(lead ? a : b)) score += lead ? 1 : -1;
  }
  return score ? score > 0 : type === 'volunteering';
}

/** An entry's header lines read as entryOf reads them: readHeader's, with a job's place taken out of its title fields. */
function headerOf(type, header) {
  const h = readHeader(type, header);
  // "Google — Mountain View, CA" over "Software Engineer": a place after the company on its line is
  // the job's location, not its role; the title under it is. Only when neither names a role and a
  // field is left for the role: "Senior Engineer — Acme, Inc." keeps its company, and so does a title
  // with no role word ("Barista — Blue Bottle, LLC"): a company's legal ending is no place.
  if (JOB.has(type) && !header[0]?.group && !h.location && !h.meta.location && h.parts.length >= 3
    && !ROLE.test(h.parts[0]) && PLACE.test(h.parts[1]) && !ROLE.test(h.parts[1]) && !CORPORATE.test(h.parts[1])) h.location = h.parts.splice(1, 1)[0];
  // "Product Manager, Google — Mountain View, CA", "Software Engineer | Google | Mountain View, CA":
  // the role, its company, then a place is the job's location too. Before, the place became the
  // company (the role kept "Google"), or a paragraph of the description.
  if (JOB.has(type) && !header[0]?.group && !h.location && !h.meta.location && h.parts.length >= 2) {
    const place = h.parts[h.parts.length - 1];
    const pair = h.parts.length === 2 ? inlinePair(h.parts.slice(0, 1)) : h.parts.slice(0, -1);
    if (pair.length === 2 && ROLE.test(pair[0]) && !ROLE.test(pair[1]) && PLACE.test(place) && !ROLE.test(place) && !CORPORATE.test(place)) {
      h.location = place;
      h.parts = pair;
    }
  }
  // "Google, Mountain View, CA" beside "Software Engineer": a company with its place after a comma,
  // the city and a state or country, gives the job its location. Only beside a field that names the
  // role, so a place alone ("Portland, Oregon, USA") is not cut. Before, the company kept the place.
  if (JOB.has(type) && !header[0]?.group && !h.location && !h.meta.location) {
    const pair = inlinePair(h.parts);
    const at = pair.length >= 2 ? [0, 1].find((k) => ROLE.test(pair[1 - k]) && !ROLE.test(pair[k])) : undefined;
    const placed = at === undefined ? null : placeAfterComma(pair[at]);
    if (placed) {
      h.location = placed[1];
      h.parts = pair.map((p, k) => (k === at ? placed[0] : p));
    }
  }
  return h;
}

/**
 * One entry of `type` from its header and body lines. `aside(title, texts)`: text the entry has no
 * field for and no description to hold it — a certificate's — kept in "Additional Information" under
 * its name (R4-IMP-01); a description the app never shows would hide it. `roleLeads`: whether a job
 * whose words do not tell leads with its role (sectionLeads).
 */
function entryOf(type, header, body, aside = () => {}, roleLeads = type === 'volunteering') {
  const h = headerOf(type, header);
  const [p0 = '', p1 = '', ...rest] = JOB.has(type) ? inlinePair(h.parts) : h.parts;
  const d = h.date || { start: '', end: '', current: false, text: '' };
  const lead = rest.length ? [rest.join(' — ')] : [];
  // A field named on its line ("Technologies: …", "Link: …") that this type has a place for, taken;
  // one it has none for (a job's technologies) leads its description, as written (R4-IMP-07).
  const used = new Set();
  const take = (key) => { used.add(key); return h.meta[key] || ''; };
  const unnamed = () => h.named.filter((n) => !used.has(n.key)).map((n) => n.text);
  const description = (extra = []) => richText([...unnamed(), ...extra, ...body]);
  const dates = { startDate: d.start, endDate: d.end, current: d.current };
  switch (type) {
    case 'experience':
    case 'volunteering': {
      // A role under its employer (roleEntries): the employer and its place are the group's.
      const group = header[0]?.group;
      const [role, org] = group ? [[p0, p1].filter(Boolean).join(' — '), group.company] : roleFirst(p0, p1, roleLeads);
      const more = group ? group.lead.map((l) => l.text) : [];
      const location = h.location || take('location') || (group ? group.place : '');
      return itemOf(type, { [type === 'experience' ? 'company' : 'org']: org, role, location, ...dates, description: description([...more, ...lead]) });
    }
    case 'education': {
      const fields = { institution: '', degree: '', fieldOfStudy: '', gpa: take('gpa') };
      const left = [];
      for (const part of h.parts) {
        const gpa = /^(?:c?gpa|grade)\s*:?\s*(.+)$/i.exec(part);
        const field = /^in\s+(.+)$/i.exec(part);
        if (gpa && !fields.gpa) fields.gpa = gpa[1];
        else if (field && !fields.fieldOfStudy) fields.fieldOfStudy = field[1];
        else if (!fields.institution && SCHOOL.test(part) && !DEGREE.test(part.split(',')[0])) {
          // "Massachusetts Institute of Technology, BSc Computer Science": the school, then its degree.
          const pair = /^([^,]+),\s*(.+)$/.exec(part);
          // Not "Harvard University, Cambridge, MA": a place after the school, its state no degree ("MA", "MD").
          if (pair && !fields.degree && SCHOOL.test(pair[1]) && DEGREE.test(pair[2]) && !SCHOOL.test(pair[2]) && !PLACE.test(pair[2])) [fields.institution, fields.degree] = [pair[1].trim(), pair[2].trim()];
          else fields.institution = part;
        }
        else if (!fields.degree && DEGREE.test(part)) fields.degree = part;
        else left.push(part);
      }
      // A place on a line of its own (a side column's stacked fields): the location.
      let location = h.location || take('location');
      // Not "Bootcamp, Full Stack" nor "B.F.A., Graphic Design": a subject after the comma is a field.
      const placeAt = location ? -1 : left.findIndex((p) => PLACE.test(p) && !DEGREE.test(p) && !SUBJECT.test(p.split(',').slice(1).join(',')));
      if (placeAt >= 0) location = left.splice(placeAt, 1)[0];
      // No degree named: a subject alone is the field of study — the exports print "Computer Science -
      // MIT" for an entry with no degree — and the one field left beside it the school (R4-LO-06). Not
      // "B.F.A., Graphic Design": what leads a comma is a degree.
      const subjectAt = fields.degree || fields.fieldOfStudy ? -1 : left.findIndex((p) => SUBJECT.test(p.split(',')[0]) && !SCHOOL.test(p));
      if (subjectAt >= 0) fields.fieldOfStudy = left.splice(subjectAt, 1)[0];
      if (subjectAt < 0 || fields.institution || left.length > 1) {
        // Of two fields with no degree word, the one with a comma is the degree ("Bootcamp, Full Stack"),
        // wherever it prints (the PDF puts the school first).
        const commaAt = !fields.degree && left.length > 1 ? left.findIndex((p) => /,\s/.test(p) && !SCHOOL.test(p)) : -1;
        if (commaAt > 0) left.unshift(...left.splice(commaAt, 1));
        if (!fields.degree && left.length) fields.degree = left.shift();
      }
      if (!fields.institution && left.length) fields.institution = left.shift();
      // "B.S., Computer Science": the degree and its field, as the exports print them — a degree the
      // import does not know too ("Bootcamp, Full Stack"): the exports print a degree and its field so.
      const comma = /^([^,]+),\s*(.+)$/.exec(fields.degree);
      // "BSc Computer Science, Stanford University", "B.S. Computer Science, Georgia Tech": with no
      // school found, what follows a degree that names its subject is the school — a school's name,
      // or one that is no subject nor a grade ("Master of Science, Computer Science" is a field). A
      // degree's own name names no subject ("Bachelor of Science, Biochemistry" is a field), and a
      // grade ("2:1", "3.8/4.0") or a place ("Boston, MA") after the comma is no school.
      const school = comma && !fields.institution && DEGREE.test(comma[1]) && !DEGREE.test(comma[2])
        && (SCHOOL.test(comma[2]) || (SUBJECT.test(comma[1].replace(DEGREE_NAME, '').replace(DEGREE, '')) && !SUBJECT.test(comma[2])
          && !HONOURS.test(comma[2]) && /^\p{L}\D*$/u.test(comma[2]) && !PLACE.test(comma[2])));
      if (school) { fields.degree = comma[1].trim(); fields.institution = comma[2].trim(); }
      else if (comma && !fields.fieldOfStudy && (DEGREE.test(comma[1]) || !DEGREE.test(fields.degree))) { fields.degree = comma[1].trim(); fields.fieldOfStudy = comma[2].trim(); }
      // The degree and the school found, one field over, on a line of its own: the field of study.
      if (placeAt >= 0 && !fields.fieldOfStudy && left.length === 1) fields.fieldOfStudy = left.shift();
      return itemOf(type, { ...fields, location, ...dates, description: description(left) });
    }
    case 'projects': {
      // "Name (https://…)": a linked name, its address the URL (linkText); "Name (Rust, Kafka)" its stack.
      const linked = LINKED.exec(p0);
      const named = !linked && /^(.*?)\s*\(([^()]+)\)$/.exec(p0);
      const fields = linked
        ? { name: linked[1], technologies: take('technologies'), url: linked[2] }
        : { name: named ? named[1] : p0, technologies: named ? named[2] : take('technologies'), url: take('link') };
      const left = [];
      for (const part of h.parts.slice(1)) {
        if (!fields.url && WEB.test(part)) fields.url = part;
        else if (!fields.technologies) fields.technologies = part;
        else left.push(part);
      }
      return itemOf(type, { ...fields, ...dates, description: description(left) });
    }
    case 'certifications': {
      const fields = { name: p0, issuer: '', url: take('link'), credentialId: take('id'), date: d.start || d.end, expiry: take('expires') || (d.start ? d.end : '') };
      // Its link: an address, or a label with its address (linkText: "View Certificate (https://…)", the
      // Markdown export's link line under the entry) — the link's label kept as the Link label (R4-IMP-02).
      const link = (text, bare) => {
        const m = LINKED.exec(text);
        if (m && m[1] && /^https?:/i.test(m[2])) return { url: m[2], urlLabel: m[1] };
        // A header field may be a bare domain, as before; a line under it only an address with its
        // scheme or www. — "Node.js" there is no link.
        return (bare ? WEB.test(text) : /^(?:https?:\/\/|www\.)\S+$|^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S+$/i.test(text)) ? { url: text } : null;
      };
      const left = [];
      for (const part of h.parts.slice(1)) {
        const l = !fields.url && link(part, true);
        if (l) Object.assign(fields, l);
        else if (!fields.issuer) fields.issuer = part;
        else left.push(part);
      }
      const rest = body.filter((l) => {
        const found = !fields.url && link(l.text.replace(BULLET, '').trim());
        if (found) Object.assign(fields, found);
        return !found;
      });
      const extra = [...unnamed(), ...left, ...rest];
      if (extra.length) aside(fields.name || 'Certification', extra);
      return itemOf(type, fields);
    }
    case 'awards':
      return itemOf(type, { title: p0, issuer: p1, date: d.text ? (d.start || d.end) : '', description: description(lead) });
    default:
      return itemOf('custom', { title: p0, subtitle: [p1, ...rest].filter(Boolean).join(' — '), date: d.text ? d.text.replace(/\s+-\s+/, ' – ') : '', location: h.location || take('location'), description: description() });
  }
}

/**
 * A section's lines as entries of `type`. An entry is found by its date: a line with text and a
 * date is its title line ("Company ⇥ Mar 2021 – Present", the PDF's and Word's), with the role or
 * degree on the line under it; a line that starts with the date is its meta line ("Mar 2021 –
 * Present | Portland, OR", the ATS text's and Markdown's), under the title line(s) before it — or,
 * a date alone with none before it, over them (the Timeline's). A Markdown "### " line starts an
 * entry too. What follows up to the next entry is its body. With no dates at all, a line after a gap
 * or a list starts the next one.
 */
function entriesOf(type, lines, aside) {
  lines = roleEntries(type, lines);
  // A certificate or an award a list item each (R4-IMP-01): a section that opens with a list item is a
  // list of them, each with its date at its end ("• AWS Certified Solutions Architect – 2022"). A line
  // under an item is its own: its date or named fields, else its text. Before, the first item was the
  // one entry, and the others went into its description, which a certificate never shows.
  if ((type === 'certifications' || type === 'awards') && lines.length && BULLET.test(lines[0].text)) {
    const list = [];
    // A list item nested under another (an award's "◦ For the tapir parser") is its entry's text, not an
    // entry of its own: each became one (R4-LO-02).
    const top = lines[0].depth || 0;
    for (const l of lines) {
      const last = list[list.length - 1];
      if (BULLET.test(l.text) && !((l.depth || 0) > top)) list.push({ header: [{ ...l, text: l.text.replace(BULLET, '') }], body: [] });
      else if (!last.body.length && (isMetaLine(l.text) || readDateRange(l.text))) last.header.push(l);
      else last.body.push(l);
    }
    return list.map((e) => entryOf(type, e.header, e.body, aside));
  }
  const info = lines.map((l, index) => {
    const bullet = BULLET.test(l.text);
    let date = null;
    if (!bullet) {
      const ps = pieces(l.text);
      const at = ps.findIndex((p) => readDateRange(p) || trailingDate(p));
      if (at >= 0) {
        // Starts with its date: every piece before it is a date or a field by name ("Technologies: …").
        const first = ps.slice(0, at).every((p) => metaOf(p)) && Boolean(readDateRange(ps[at]));
        date = { first };
      }
    }
    return { ...l, index, bullet, date };
  });
  const entries = [];
  const preamble = [];
  let cur = null;
  const pool = () => (cur ? cur.body : preamble);
  const start = (header) => { cur = { header, body: [] }; entries.push(cur); };

  // Experience's "Group roles by company" in the PDF and Word (R4-LO-01; Markdown's: roleEntries): the
  // employer on a line of its own with no date — its place at its right ("Acme ⇥ Portland, OR") or on
  // the line under it (Word's) — then each role with its dates and one field, the role. Before, the
  // employer line went into the job above as text, and each role had no company.
  let group = null;
  /** The employer lines right over a dated line, taken out of the text above: { company, place }, or null. */
  const employerOver = (L, timeline = false) => {
    const body = pool();
    const titleish = (n) => n && !n.bullet && !n.date && n.hint !== 'entry' && n.text.length <= 80 && !/[.!?:;,]$/.test(n.text) && !isMetaLine(n.text);
    const over = (n, m) => n.index === m.index - 1 && !m.gap; // n on the line right over m
    // It starts a block: after a gap, first in the section, or right after a list (the job above's).
    const starts = (n) => n.gap || !info[n.index - 1] || info[n.index - 1].bullet;
    const one = (n) => titleish(n) && pieces(n.text).length === 1;
    const [a, b] = body.slice(-2).length === 2 ? body.slice(-2) : [null, body[body.length - 1]];
    if (!titleish(b) || !over(b, L)) return null;
    // "Senior Engineer" over "Acme Corp ⇥ Jan 2020 – Present": a job title over its company's dated
    // line is that job's own title (entriesOf), no employer over grouped roles. Before, the title
    // became the company and the company the role, and the next job took the same company.
    const [field = ''] = datedFields(L.text);
    if (!timeline && pieces(b.text).length === 1 && ROLE.test(b.text) && !ROLE.test(field)) return null;
    let found = null;
    // Word's: the employer, and its place on the line under it.
    // (Not over a Timeline role's date: there "Acme Corp" / "Senior Engineer" over a date is one job's title.)
    if (!timeline && one(a) && one(b) && over(a, b) && starts(a)) found = { n: 2, company: a.text, place: b.text };
    // Right after a list, only a line that is plainly an employer and its place: not a sentence ending the job above.
    else if ((b.gap || !info[b.index - 1] || pieces(b.text).length === 2) && starts(b) && pieces(b.text).length <= 2 && !(timeline && titleish(a) && over(a, b))) {
      // The PDF's: the employer, its place at the line's right end.
      const [company, place = ''] = pieces(b.text);
      found = { n: 1, company, place };
    }
    // "Google — Mountain View, CA" over "Software Engineer ⇥ Jan 2020 – Present": the employer and its
    // place on one line, split at its dash — neither names a role, and the second is a place.
    const [co, at, ...more] = found ? fieldsOf(found.company) : [];
    if (found && !found.place && at && !more.length && !ROLE.test(co) && !ROLE.test(at) && PLACE.test(at) && !CORPORATE.test(at)) found = { ...found, company: co, place: at };
    // "Acme Corp, Austin, TX": the place after a comma, as a city and its state or country.
    const placed = found && !found.place && placeAfterComma(found.company);
    if (placed) found = { ...found, company: placed[0], place: placed[1] };
    // One field: "Acme - Engineer" (the ATS text's job) is a job's title, not an employer over roles.
    if (!found || fieldsOf(found.company).length !== 1) return null;
    body.splice(body.length - found.n);
    return { company: found.company, place: found.place, lead: [] };
  };
  /** A dated `header` read as a role of `group` — or of a group whose employer is right over it — else no group. */
  const roleOfGroup = (header, active) => {
    const h = readHeader('experience', header);
    // A role's own place on the line under it, where it differs from the employer's (Word's).
    const placed = h.parts.length === 2 && header.length === 2 && pieces(header[1].text).length === 1 && PLACE.test(h.parts[1]);
    if (h.parts.length !== 1 && !placed) return null;
    const next = employerOver(header[0]) || (active && cur?.header[0]?.group?.company === active.company ? active : null);
    if (!next) return null;
    if (placed) header[header.length - 1] = { ...header[header.length - 1], hint: 'end' };
    header[0] = { ...header[0], group: next };
    return next;
  };

  // The title printed on the line over its dated line, one field before its date ("Bachelor of Science"
  // over "University of Oregon ⇥ 2014 – 2018", "Senior Engineer" over "Acme Corp ⇥ …"). A line is one
  // where it starts a block (first in the section or after a gap); right after the entry above (its
  // list or its title), only where it plainly names the role (or the degree) its dated line does not:
  // not the job above's last line ("Promoted twice in two years").
  const KIND = JOB.has(type) ? ROLE : type === 'education' ? DEGREE : null;
  const titleLine = (b) => !b.bullet && !b.date && b.hint !== 'entry' && b.text.length <= 100 && !/[.!?:;,]$/.test(b.text)
    && !isMetaLine(b.text) && pieces(b.text).length === 1;
  const oneField = (L) => Boolean(L.date && !L.date.first && !L.bullet && L.hint !== 'entry' && SECOND_LINE.has(type) && datedFields(L.text).length === 1);
  // How `b` names its entry over `L`: 'kind' for the role (or degree) its dated line does not name;
  // for a school, 'school' for the school over a dated line that names the degree ("Stanford
  // University" over "MBA ⇥ 2013 – 2015"), the mirror of the degree over its school. Else null.
  const way = (b, L) => {
    const [field = ''] = datedFields(L.text);
    if (KIND && KIND.test(b.text) && !KIND.test(field)) return 'kind';
    if (type === 'education' && SCHOOL.test(b.text) && !DEGREE.test(b.text) && DEGREE.test(field) && !SCHOOL.test(field)) return 'school';
    return null;
  };
  const names = (b, L) => Boolean(way(b, L));
  // A school right after the entry above is this entry's only where that entry's school is over its
  // dated line too: its header ends at its date (and named fields). Under "MBA ⇥ 2013 – 2015" over
  // "Stanford University", a line such as "Exchange semester at University of Tokyo" is that entry's
  // description, not the next degree's school (which is under the next degree's dated line).
  const schoolFirstAbove = () => {
    const last = cur?.header.filter((h) => !isMetaLine(h.text)).at(-1);
    return !cur || Boolean(last?.date);
  };
  /** That line over `L`, or null. */
  const titleOver = (L) => {
    const body = pool();
    const b = body[body.length - 1];
    const before = b && info[b.index - 1];
    return oneField(L) && b && b.index === L.index - 1 && !L.gap && titleLine(b)
      && (b.gap || !before || ((before.bullet || cur?.header.includes(before)) && names(b, L)
        && (way(b, L) !== 'school' || schoolFirstAbove()))) ? b : null;
  };
  // The line under a dated line that is the next entry's title over its own dated line (the next degree
  // over the next school), where this entry's is over it too and names its degree (or role) the same
  // way: that entry's, not this one's second line. Before, "Bachelor of Science" under "Stanford
  // University ⇥ 2018 – 2020" became Stanford's degree, Stanford's own ("Master of Science", over it)
  // went into its description, and the University of Oregon had none. So with each school over its
  // "Degree ⇥ dates" line: the next school became this entry's, and this one's its description.
  const titleOfNext = (L, n) => {
    const b = titleOver(L);
    const m = info[n.index + 1];
    return Boolean(b && names(b, L) && m && !m.gap && oneField(m) && titleLine(n) && way(n, m) === way(b, L));
  };

  for (let i = 0; i < info.length;) {
    const L = info[i];
    if (L.hint === 'entry') {
      const header = [L];
      i += 1;
      // Its date and named fields under it — a line of their own marked an entry too (a Word heading one
      // level deeper: Heading 3 "Mar 2021 – Present" under Heading 2 "Senior Engineer | Acme Corp").
      const under = (n) => (n.hint !== 'entry' ? Boolean(n.date) : Boolean(n.date?.first)) || isMetaLine(n.text);
      while (i < info.length && !info[i].bullet && !info[i].gap && header.length < 3 && under(info[i])) header.push(info[i++]);
      start(header);
      continue;
    }
    if (L.date && !L.bullet) {
      const header = [L];
      i += 1;
      // The Timeline's grouped roles: the employer, then each role's date alone over the role (R4-LO-01).
      const n = info[i];
      if (type === 'experience' && L.date.first && pieces(L.text).length === 1 && n && !n.bullet && !n.gap && !n.date && n.hint !== 'entry'
        && pieces(n.text).length === 1 && fieldsOf(n.text).length === 1 && n.text.length <= 60 && !/[.!?]$/.test(n.text)
        && !PLACE.test(n.text) && (ROLE.test(n.text) || pieces(pool()[pool().length - 1]?.text || '').length === 2)) {
        const g = employerOver(L, true) || (group && cur?.header[0]?.group?.company === group.company ? group : null);
        if (g) {
          group = g;
          header[0] = { ...L, group: g };
          header.push(info[i++]);
          if (info[i] && info[i].hint === 'end' && !info[i].gap) header.push(info[i++]);
          start(header);
          continue;
        }
      }
      if (L.date.first) {
        if (type === 'experience') group = null; // not a role of the group above
        // Its title line(s): the text lines right before it, not the previous entry's list.
        // A school in a side column stacks each field on a line of its own over its dates (Sidebar's
        // degree, school, field and place): up to four lines.
        const body = pool();
        let next = L;
        while (header.length < (type === 'education' ? 5 : 3) && body.length) {
          const prev = body[body.length - 1];
          if (prev.bullet || prev.index !== next.index - 1 || next.gap || prev.date) break;
          header.unshift(body.pop());
          next = prev;
        }
        // None over it, and the date alone on its line: the date prints above its entry's title (the
        // Timeline's rail: "Mar 2021 – Present", then "Role ⇥ Company", then the location). Its title is
        // the line under it, and for a type with a second line (a role, a degree) the one under that
        // when it holds two fields or a place. Before, such an entry had no title, and its title and
        // company went into its description (R2-148).
        const titleLike = (n) => n && !n.bullet && !n.gap && !n.date && n.hint !== 'entry' && n.text.length <= 100 && !/[.!?]$/.test(n.text) && !isMetaLine(n.text);
        if (header.length === 1 && pieces(L.text).length === 1 && titleLike(info[i])) {
          header.push(info[i++]);
          const n = info[i];
          if (SECOND_LINE.has(type) && titleLike(n) && (pieces(n.text).length > 1 || PLACE.test(n.text))) header.push(info[i++]);
        }
      } else if (SECOND_LINE.has(type) && i < info.length) {
        const n = info[i];
        if (!n.bullet && !n.gap && !n.date && n.hint !== 'entry' && n.text.length <= 100 && !/[.!?]$/.test(n.text)
          && !titleOfNext(L, n)) { header.push(n); i += 1; }
      }
      while (i < info.length && !info[i].bullet && !info[i].gap && isMetaLine(info[i].text)) header.push(info[i++]);
      if (type === 'experience' && !L.date.first) group = roleOfGroup(header, group);
      // Nothing under it but its named fields ("GPA: 3.9"), and its title over it (titleOver). Before,
      // that line went into the description, or the job above's.
      if (!header[0].group && header.slice(1).every((h) => isMetaLine(h.text)) && titleOver(L)) header.unshift(pool().pop());
      start(header);
      continue;
    }
    pool().push(L);
    i += 1;
  }

  if (!entries.length) {
    // No dates and no entry titles: an entry per line after a gap or a list (one line each for a
    // certificate or an award); a custom section's text stays one entry, as written.
    if (type === 'custom') return preamble.length ? [itemOf('custom', { description: richText(preamble) })] : [];
    for (const L of preamble) {
      const prev = cur?.body.length ? cur.body[cur.body.length - 1] : cur?.header[cur.header.length - 1];
      const starts = !L.bullet && (!cur || L.gap || prev?.bullet || type === 'certifications' || type === 'awards');
      if (starts) start([L]);
      else if (cur) cur.body.push(L);
      else start([{ ...L, text: L.text.replace(BULLET, '') }]);
    }
  } else if (preamble.length) {
    entries[0].body.unshift(...preamble);
  }
  const leads = JOB.has(type) ? sectionLeads(type, entries) : undefined;
  return entries.map((e) => entryOf(type, e.header, e.body, aside, leads));
}

/**
 * `lines` with Markdown's 'role' lines (markdownLines) as entries. A job's employer over its roles
 * (Experience's "Group roles by company": "### Acme", its place, then "#### Senior Engineer" and its
 * dates for each role) is no entry of its own: each role is one, `group` giving it the employer and
 * the place; a line under the employer that is no place leads the first role's description. Before,
 * the employer was an entry with no role and no dates, and each role one with no company (R4-IMP-09).
 * An entry with a date under it is no employer: a heading under it is an entry of its own.
 */
function roleEntries(type, lines) {
  if (!lines.some((l) => l.hint === 'role')) return lines;
  const out = [];
  let group = null;
  for (let k = 0; k < lines.length; k += 1) {
    const l = lines[k];
    if (l.hint === 'entry') {
      let next = k + 1;
      while (next < lines.length && !lines[next].hint) next += 1;
      const under = lines.slice(k + 1, next);
      const hasDate = under.some(dated);
      // Not an entry whose title holds a role and a company ("### Acme — Engineer" over "#### Highlights").
      const whole = (l.fields || fieldsOf(l.text)).length > 1 || pieces(l.text).length > 1;
      if (JOB.has(type) && lines[next]?.hint === 'role' && !hasDate && !whole) {
        const placeAt = under.findIndex((x) => PLACE.test(x.text));
        group = { company: l.text, place: placeAt >= 0 ? under[placeAt].text : '', lead: under.filter((x, i) => i !== placeAt), first: true };
        k = next - 1;
        continue;
      }
      group = null;
      out.push(l);
    } else if (l.hint === 'role') {
      out.push({ ...l, hint: 'entry', group: group && { ...group, lead: group.first ? group.lead : [] } });
      if (group) group.first = false;
    } else out.push(l);
  }
  return out;
}

/** Skills lines: "Category: a, b" as a group; a short line alone over a list as its category. */
function skillsOf(lines) {
  // Skills set apart at | • · as the editor writes them, at commas: "Python • SQL" is two skills, as
  // Tags, Bars and the Sidebar's Stacked print them. Before, each such line was one skill. A cell with
  // two categories in it ("Languages: Go | Tools: Git") is two groups.
  const NAMED = /^[^:,]{1,60}?\s*:/;
  const commas = (cell) => {
    const parts = cell.split(/\s+[|•·]\s+/).map((s) => s.trim()).filter(Boolean);
    const named = parts.filter((p) => NAMED.test(p)).length > 1;
    return parts.reduce((out, p) => (out.length && !(named && NAMED.test(p)) ? [...out.slice(0, -1), `${out[out.length - 1]}, ${p}`] : [...out, p]), []);
  };
  const texts = lines.map((l) => l.text.replace(BULLET, '').trim().split('\t').flatMap(commas).join('\t')).filter(Boolean);
  const items = [];
  for (let i = 0; i < texts.length; i += 1) {
    const cells = texts[i].split('\t').map((s) => s.trim()).filter(Boolean);
    for (const t of cells) {
      const m = /^([^:,]{1,60}?)\s*:\s*(.+)$/.exec(t);
      if (m) { items.push(itemOf('skills', { category: m[1], skills: m[2] })); continue; }
      const next = texts[i + 1];
      if (cells.length === 1 && next && !/[,:]/.test(t) && t.length <= 40 && /,/.test(next) && !/:/.test(next)) {
        items.push(itemOf('skills', { category: t, skills: next }));
        i += 1;
        continue;
      }
      items.push(itemOf('skills', { category: '', skills: t }));
    }
  }
  return items;
}

const LEVEL = /\b(native|bilingual|fluent|proficient|professional|full professional|working|limited|conversational|intermediate|advanced|basic|beginner|elementary|upper[- ]intermediate|mother tongue|[abc][12])\b.*$/i;

/** Language lines: "English: Native", "English — Native", "English (Native)", two to a row in a grid. */
function languagesOf(lines) {
  const items = [];
  for (const line of lines) {
    let bare = null; // the language before on this line, with no level yet
    let last = null; // the language before on this line
    // Cells: at tabs and | • ·, and at commas and semicolons outside brackets — "English, Spanish,
    // French" is three languages, "English (Native), Spanish (Fluent)" two (R4-IMP-11).
    const cells = line.text.replace(BULLET, '').split(/\t|\s+[|•·]\s+/).flatMap((c) => c.split(/[,;](?![^()]*\))/));
    for (const cell of cells.map((s) => s.trim()).filter(Boolean)) {
      const m = /^(.+?)\s*(?::|\s[—–-]\s|\()\s*(.+?)\)?$/.exec(cell);
      if (m) { last = itemOf('languages', { language: m[1], proficiency: m[2] }); items.push(last); bare = null; continue; }
      const level = LEVEL.exec(cell);
      // A level alone, set apart from its language ("English ⇥ Native", a PDF's grid cells two to a
      // row): the level of the language before it; a second one ("English: Full professional, C2") joins it.
      if (level && level.index === 0 && bare) { bare.proficiency = cell; bare = null; continue; }
      // So does a cell in lower case after a level ("Spanish: Working knowledge, written"): the level's rest.
      // (only the line's last cell: "Native, german, french" are languages).
      const rest = /^\p{Ll}/u.test(cell) && cell === cells.map((c) => c.trim()).filter(Boolean).at(-1);
      if (last?.proficiency && ((level && level.index === 0) || rest)) { last.proficiency = `${last.proficiency}, ${cell}`; continue; }
      if (level && level.index === 0 && last) { last.proficiency = cell; continue; }
      if (level && level.index > 0) { last = itemOf('languages', { language: cell.slice(0, level.index).trim(), proficiency: level[0].trim() }); items.push(last); bare = null; continue; }
      bare = itemOf('languages', { language: cell, proficiency: '' });
      last = bare;
      items.push(bare);
    }
  }
  return items;
}

// ── The résumé ───────────────────────────────────────────────────────────────

/**
 * A résumé of the app's from the text of one: `input` is the text (a string) or its lines (strings,
 * or `{ text, hint }` from markdownLines and importFile.js). Classic, in the starter settings a JSON
 * Resume import gets; the store gives it its id and runs normalizeResume over it, as for any import.
 */
export function resumeFromText(input) {
  const all = toLines(input);

  // Blank lines and rules: a gap before the next line, and a rule marks the line over it a heading.
  const lines = [];
  let gap = false;
  for (const l of all) {
    if (!l.text) { gap = true; continue; }
    if (RULE.test(l.text)) {
      if (lines.length) lines[lines.length - 1].ruled = true;
      gap = true;
      continue;
    }
    lines.push({ ...l, gap });
    gap = false;
  }

  // The name: the file's own, else the first line.
  const nameAt = Math.max(0, lines.findIndex((l) => l.hint === 'name'));
  // Only a heading after the name counts: a Word résumé whose name alone is styled Heading 1, its
  // section titles bold Normal text, marks no heading (R4-IMP-08).
  const hinted = lines.some((l, i) => i > nameAt && l.hint === 'heading');

  // Headings. A file that marks its headings (Word's Heading styles, Markdown's ##) is taken at its word;
  // and a known title in capitals or over a rule is one there too, as it is in a file with no marks (a
  // Word résumé with some sections styled as headings and the others typed in bold capitals).
  const headingAt = new Map();
  let seen = false;
  // In a file that marks its headings, an unmarked one in capitals must be of a type the file does not
  // mark itself; and inside an entry the file marks, not a part of that entry: "SKILLS" or "PROJECTS"
  // with another entry after it before the next heading (a job's own), or a title an entry uses for a
  // part of it anywhere ("KEY ACHIEVEMENTS", "OVERVIEW"). Any other title ("AWARDS", "EDUCATION", and
  // "SKILLS" after the last entry) starts its section: it stayed inside the last job (R4-LO-04).
  const marked = new Set(lines.filter((l, i) => i > nameAt && l.hint === 'heading').map((l) => headingType(l.text.replace(/\s*:$/, '').trim())));
  const entryAfter = (i) => {
    for (let j = i + 1; j < lines.length && lines[j].hint !== 'heading'; j += 1) if (lines[j].hint === 'entry' || lines[j].hint === 'role') return true;
    return false;
  };
  const ownPart = (text, i) => (['skills', 'projects'].includes(headingType(text)) && entryAfter(i)) || headingType(text) === 'summary'
    || /^(?:key)?achievements$|^recognitions$/.test(headingKey(text));
  let inEntry = false;
  // The type of the section a line is in, and whether the line under it holds a date: an employer or a
  // school typed in capitals over its entry's dated line ("ACME CORP" over "Senior Engineer ⇥ Jan 2020
  // – Present") is that entry's, not a section of its own. Before, it started a custom section named
  // after it, and the Experience or Education heading over it, left empty, was dropped.
  // Only first in its section (right under the heading), or where the section's first entry printed
  // its employer so: a line in capitals right after a job's list, over a dated line, in a section
  // whose entries do not ("TEACHING" over "Lecturer ⇥ Stanford ⇥ 2016 – 2017", with no blank line
  // between them: Word's spacing before a bold heading is none) still starts a section of its own.
  let within = null;
  let capsOver = false; // this section's first entry printed its employer or school in capitals over it
  const entriesIn = (t) => t && !['custom', 'summary', 'contact', 'skills', 'languages', 'interests'].includes(t);
  const overDate = (i) => {
    const n = lines[i + 1];
    return Boolean(n && !n.gap && !BULLET.test(n.text) && pieces(n.text).some((p) => readDateRange(p) || trailingDate(p)));
  };
  const capsEntry = (l, i) => entriesIn(within) && !l.gap && overDate(i) && (headingAt.has(i - 1) || capsOver);
  lines.forEach((l, i) => {
    if (i <= nameAt) return;
    if (l.hint === 'heading') inEntry = false;
    else if (l.hint === 'entry' || l.hint === 'role') inEntry = true;
    const text = l.text.replace(/\s*:$/, '').trim();
    const plain = !BULLET.test(l.text) && !/\t|\s\|\s|@/.test(text) && text.length <= 48 && !/[.!?,;]$/.test(text);
    let type = null;
    if (hinted) {
      if (l.hint === 'heading') type = headingType(text) || 'custom';
      else if (!l.hint && plain && !(inEntry && ownPart(text, i)) && (isCaps(text) || l.ruled) && !marked.has(headingType(text))) type = headingType(text);
    } else if (plain) {
      const known = headingType(text);
      if (known && (l.ruled || isCaps(text) || l.gap || l.text.endsWith(':') || i === nameAt + 1 || headingAt.size === 0)) type = known;
      else if (l.ruled && !/\d/.test(text)) type = 'custom';
      else if (seen && isCaps(text) && !capsEntry(l, i) && !/\d/.test(text) && text.replace(/[^\p{L}]/gu, '').length >= 4 && text.split(/\s+/).length <= 5 && !BARE_LABEL.test(text)) type = 'custom';
      if (!type && isCaps(text) && capsEntry(l, i)) capsOver = true;
    }
    if (type) { headingAt.set(i, { type, title: text }); seen = true; inEntry = false; within = type; capsOver = false; }
  });

  const firstHeading = [...headingAt.keys()][0] ?? lines.length;
  const personal = { name: '', title: '', email: '', phone: '', location: '', website: '', linkedin: '', github: '', summary: '', photo: null, hiddenFields: [] };
  const summary = [];
  const other = [];
  const asides = []; // entries' text with nowhere to go in them (entryOf's `aside`)

  /** Header lines: contacts to their fields, the rest to the summary (sentences) or aside. */
  const takeContacts = (ls, { spill }) => {
    for (const l of ls) {
      const leftover = [];
      for (const piece of headerPieces(l.text).flatMap((p) => contactRun(p) || [p])) {
        if (BARE_LABEL.test(piece)) continue; // the name over a contact: its value says what it is
        // A link shown as its label, "LinkedIn (https://…)": the address is the contact, and the label
        // it was shown as its Display label (R4-IMP-02).
        const linked = LINKED.exec(piece);
        const lc = linked && contactOf(linked[2]);
        if (lc && lc.key !== 'location') {
          if (personal[lc.key]) { leftover.push(piece); continue; }
          personal[lc.key] = lc.value;
          if (LABELLED_KEYS.has(lc.key) && linked[1]) personal[`${lc.key}Label`] = linked[1];
          continue;
        }
        const c = contactOf(piece);
        if (c && !personal[c.key]) personal[c.key] = c.value;
        else leftover.push(piece); // not a contact, or a second one of a kind
      }
      if (leftover.length) spill(leftover.join(' | '), l.links);
    }
  };

  // The header: the name, then the job title unless the next line is a contact line.
  const head = lines.slice(0, firstHeading);
  if (head.length) {
    const nameLine = head[Math.min(nameAt, head.length - 1)];
    const [name, ...more] = headerPieces(nameLine.text);
    personal.name = tamed(name || '');
    const rest = [...head.slice(0, nameAt), ...(more.length ? [{ text: more.join('\t') }] : []), ...head.slice(nameAt + 1)];
    // The job title is the next line, or the one field set beside the name on its line (Compact's
    // Inline layout, "Name ⇥ Job Title"); a name line with more fields than that is a contact line.
    const t = rest[0] && more.length <= 1 ? rest[0] : null;
    // A contact line set apart at dashes or commas is none either; one led by a field that is no
    // contact ("Backend Engineer — alex@kim.dev — Seattle, WA") gives the job title that field.
    const run = t && headerPieces(t.text).length === 1 ? contactRun(t.text) : null;
    // A job title with a comma in it ("Product Manager, Payments") reads as a place: a role word says
    // it is the title, as the entries' rules check. Before, it became the location, and the real one
    // on the contact line went to "Additional Information".
    // Not a town with a role word in its name ("Hilton Head, SC", "Mentor, Ohio", "Lead, SD") alone under
    // the name: one that ends in a state or country is the title only when the header has its place elsewhere.
    const contact = t && contactOf(t.text);
    const placeElsewhere = () => rest.slice(1).some((l) => headerPieces(l.text).flatMap((p) => contactRun(p) || [p]).some((p) => contactOf(p)?.key === 'location'));
    const role = contact?.key === 'location' && !LABEL.test(t.text) && ROLE.test(t.text) && (!REGION_END.test(t.text) || placeElsewhere());
    if (t && headerPieces(t.text).length === 1 && (!contact || role) && !run && t.text.length <= 80 && !/[.!?]$/.test(t.text)) {
      personal.title = t.text;
      rest.shift();
    } else if (run && !isContact(run[0])) {
      personal.title = run[0];
      rest[0] = { ...t, text: run.slice(1).join('\t') };
    }
    takeContacts(rest, {
      spill: (text, links) => ((text.length >= 60 || /[.!?]$/.test(text)) ? summary : other).push({ text, links }),
    });
  }

  // The sections, each heading to the next.
  const sections = [];
  const starts = [...headingAt.keys()];
  starts.forEach((at, k) => {
    const { type, title } = headingAt.get(at);
    const body = lines.slice(at + 1, starts[k + 1] ?? lines.length);
    const name = tamed(title);
    if (type === 'summary') { summary.push(...body); return; }
    if (type === 'contact') {
      takeContacts(body, { spill: (text, links) => other.push({ text, links }) });
      return;
    }
    // A heading with nothing under it keeps its words (R4-IMP-03): an unknown one is no section of its own.
    if (!body.length) { if (type === 'custom') other.push(title); return; }
    let items;
    if (type === 'skills') items = skillsOf(body);
    else if (type === 'languages') items = languagesOf(body);
    else if (type === 'interests') {
      const all = body.map((l) => l.text.replace(BULLET, '')).join(', ').split(/\s*[,;\t•·|]\s*/).filter(Boolean);
      items = [itemOf('interests', { interests: all.join(', ') })];
    } else items = entriesOf(type, body, (heading, texts) => asides.push(itemOf('custom', { title: heading, description: richText(texts) })));
    if (items.length) sections.push(sectionOf(type, name, items));
  });

  personal.summary = richText(summary);
  const extra = [...(other.length ? [itemOf('custom', { description: richText(other) })] : []), ...asides];
  if (extra.length) sections.push(sectionOf('custom', 'Additional Information', extra));

  return {
    id: newId('resume'),
    // The name the Dashboard shows, with a "|" the user typed in theirs back (untyped), as in personal.
    name: personal.name ? `${untyped(personal.name)} Resume` : 'Imported Resume',
    updatedAt: Date.now(),
    dataVersion: DATA_VERSION, // built now: no migration applies
    template: 'classic',
    settings: getStarterSettings('classic'),
    personal: untyped(personal),
    sections: untyped(sections),
    coverLetter: { ...BASE_COVER_LETTER },
  };
}
