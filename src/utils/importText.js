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

/**
 * Lines as the parser reads them: `{ text, hint }`. `hint` is what the file itself says a line is,
 * where it says so — 'name', 'heading' (a Word Heading style, a Markdown ##) or 'entry' (###).
 */
function toLines(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/\r\n|\r|\n/);
  return raw.flatMap((l) => {
    if (l && typeof l === 'object') return String(l.text ?? '').split('\n').map((text, i) => ({ text: clean(text), hint: i ? undefined : l.hint }));
    return [{ text: clean(l) }];
  });
}

/** An address as a résumé prints it, to tell a link's label from its address: "https://www.x.com/" → "x.com". */
const bareAddress = (s) => String(s).trim().toLowerCase().replace(/^(?:mailto:|tel:)/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

/**
 * A link as its label and, where the label does not show it, the address it goes to: ["LinkedIn",
 * "https://linkedin.com/in/pat"]; ["pat@example.com"] for a mailto: link that prints its address. A
 * link that goes nowhere a résumé can (a page anchor) is its label alone.
 */
function linkParts(label, href) {
  const text = String(label ?? '').trim();
  const to = String(href ?? '').trim();
  if (!/^(?:https?:\/\/|mailto:|tel:)\S+$/i.test(to) && !WEB.test(to)) return [text || to];
  if (!text) return [to];
  if (bareAddress(text) === bareAddress(to)) return [text];
  if (/^tel:/i.test(to) && text.replace(/\D/g, '') === to.replace(/\D/g, '')) return [text];
  return [text, to];
}

/**
 * A link's text as the parser reads it: "LinkedIn (https://linkedin.com/in/pat)" — the header reads
 * the address in brackets as the contact (takeContacts), an entry as its URL. A PDF's and a Word
 * file's links come this way too (importFile.js). Before, only the label was kept: a contact shown as
 * "LinkedIn" was dropped as a bare label, its address nowhere (R4-IMP-02, R4-IMP-10).
 */
export function linkText(label, href) {
  const [text, to] = linkParts(label, href);
  return to ? `${text} (${to})` : text;
}

/**
 * Markdown's inline marks off: bold and italics, links to their text (linkText; `as` 'label' the
 * label alone, 'field' "label | address", a field of its own on an entry's title line), escapes,
 * inline code.
 */
function unmark(text, as) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g, (_, label, href) => {
      if (as === 'label') return label || href;
      const [t, to] = linkParts(label, href);
      if (!to) return t;
      return as === 'field' ? `${t} | ${to}` : `${t} (${to})`;
    })
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^\w*\\])\*(?!\s)(.+?)(?<![\s\\])\*(?![\w*])/g, '$1$2')
    .replace(/(^|[^\w\\])_(?!\s)(.+?)(?<![\s\\])_(?!\w)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1')
    .replace(/ {2,}$/, '');
}

/**
 * A Markdown résumé as the parser's lines: "# " the name, "## " a heading, "### " an entry's title,
 * a list item a "• " line (a numbered one keeps its number), the rest as text with its marks off.
 */
export function markdownLines(md) {
  const out = [];
  let named = false;
  for (const line of String(md ?? '').split(/\r\n|\r|\n/)) {
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const hint = h[1].length === 1 && !named ? 'name' : (h[1].length <= 2 ? 'heading' : 'entry');
      // An entry's linked title keeps its address as a field of its own: a project's URL (R4-IMP-02).
      const text = unmark(h[2], hint === 'entry' ? 'field' : 'label');
      if (hint === 'name') named = true;
      out.push({ text, hint });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push({ text: '' }); continue; } // a thematic break
    const item = /^\s*(?:[-*+]|(\d{1,3}[.)]))\s+(.*)$/.exec(line);
    if (item) { out.push({ text: `${item[1] ? `${item[1]} ` : '• '}${unmark(item[2])}` }); continue; }
    out.push({ text: unmark(line.replace(/^\s*>\s?/, '')) });
  }
  return out;
}

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const SEASON = '(?:spring|summer|fall|autumn|winter)';
/** One date as the app's Date formats print it, or as people type it: "Mar 2021", "03/2021", "2021-03", "2021". */
const DAY = `(?:${MONTH},?\\s+\\d{4}|${SEASON}\\s+\\d{4}|\\d{1,2}\\s*[/.]\\s*\\d{4}|\\d{1,2}-\\d{4}|\\d{4}\\s*[/.-]\\s*\\d{1,2}(?!\\d)|(?:19|20)\\d{2})`;
const NOW = '(?:present|current|currently|now|today|ongoing|till date|to date)';
const SEP = '\\s*(?:[-–—~]|to|until|through)\\s*';
const RANGE = new RegExp(`^(?:since\\s+)?(${DAY})(?:${SEP}(${DAY}|${NOW}))?$`, 'i');
const END_ONLY = new RegExp(`^(?:[-–—]|to|until)\\s*(${DAY}|${NOW})$`, 'i');
const IS_NOW = new RegExp(`^${NOW}$`, 'i');

/** A whole piece of text read as a date or a range: { start, end, current, text }, else null. */
export function readDateRange(text) {
  const t = String(text ?? '').trim().replace(/^[(*_[]+|[)*_\]]+$/g, '').trim();
  if (!t) return null;
  const tidy = (d) => d.replace(/\s+/g, ' ').replace(/(\d)\s*([/.-])\s*(?=\d)/g, '$1$2');
  let m = RANGE.exec(t);
  if (m) {
    const now = m[2] && IS_NOW.test(m[2]);
    return { start: tidy(m[1]), end: m[2] && !now ? tidy(m[2]) : '', current: Boolean(now), text: t };
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
const PHONE = /^(?:tel:)?\+?[\d\s().\-/]{7,}$/;
/** "Portland, OR", "Leeds, United Kingdom", "Remote": a place as a header prints one. */
const PLACE = /^(?:[\p{L}][\p{L}.'’\- ]{0,40},\s*[\p{L}][\p{L}.'’\- ]{0,40}(?:,\s*[\p{L}][\p{L}.'’\- ]{0,30})?|remote|hybrid)$/iu;
/** A contact's name before it: "Email: …", "LinkedIn - …". */
const LABEL = /^(?:e-?mail|mail|phone|tel|telephone|mobile|cell|linkedin|github|website|web|site|portfolio|url|location|address|based in)\s*[:\-–]\s*/i;

/** A contact's name on a line of its own, over its value: the Sidebar template's "EMAIL", "PHONE". */
const BARE_LABEL = /^(?:e-?mail|mail|phone|tel|telephone|mobile|cell|linkedin|github|website|web|site|portfolio|url|location|address)$/i;

const digits = (s) => s.replace(/\D/g, '').length;

/** A link as linkText writes it: "LinkedIn (https://linkedin.com/in/pat)" → its label and address. */
const LINKED = /^(.*?)\s*\(((?:https?:\/\/|mailto:|tel:)[^()\s]+|[^()\s]+\.[a-z]{2,}(?:[/?#][^()\s]*)?)\)$/i;
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

// ── Entries ──────────────────────────────────────────────────────────────────

/** The pieces of an entry's header line: tabs and | · • marks. */
const pieces = (text) => text.split(/\t|\s+[|·•]\s+/).map((s) => s.trim()).filter(Boolean);
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
const isMetaLine = (text) => { const p = pieces(text); return p.length > 0 && p.every((x) => metaOf(x)); };

/** Words a job title holds, and a company's name rarely does: which of two fields is the role. */
const ROLE = /\b(engineer|developer|programmer|manager|director|lead|head|intern|analyst|designer|consultant|specialist|scientist|officer|assistant|associate|coordinator|architect|administrator|admin|president|vp|founder|co-founder|owner|teacher|professor|lecturer|researcher|nurse|technician|accountant|writer|editor|producer|representative|supervisor|executive|advisor|adviser|strategist|principal|chief|cto|ceo|cfo|coo|partner|fellow|trainee|apprentice|volunteer|tutor|mentor|chair|secretary|treasurer|clerk|agent|operator|instructor|coach|counselor|therapist|physician|attorney|paralegal|sales|marketer|recruiter|contractor|freelancer|freelance)s?\b/i;
const DEGREE = /\b(b\.?\s?[ase]\.?|b\.?sc|bsc|b\.?tech|b\.?eng|beng|bba|bfa|bcom|m\.?\s?[ase]\.?|m\.?sc|msc|m\.?tech|m\.?eng|meng|mba|mfa|ph\.?\s?d|phd|doctor(?:ate)?|bachelor'?s?|master'?s?|associate'?s?|diploma|certificate|high school|a-?levels?|gcse|degree|hnd|llb|llm|md|jd)\b/i;
const SCHOOL = /\b(university|universit[äéà]t?|college|institute|institut|school|academy|polytechnic|conservatory|seminary|lyc[ée]e|gymnasium)\b/i;
const WEB = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;

/** Types whose header has a second line under the title in the PDF and Word: the role, the degree. */
const SECOND_LINE = new Set(['experience', 'education', 'volunteering', 'custom']);
/** Types whose entries carry a location. */
const PLACED = new Set(['experience', 'education', 'volunteering', 'custom']);
/** Types whose header names a role and an organisation: a job, a volunteering post. */
const JOB = new Set(['experience', 'volunteering']);

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Body lines as the editor's rich text: a run of list items as a list (numbered ones as <ol>),
 * every other line a paragraph of its own.
 */
function richText(lines) {
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of lines) {
    const text = line.replace(/\t+/g, ' ').trim();
    if (!text) continue;
    if (BULLET.test(text)) {
      const kind = NUMBERED.test(text) && !/^\s*[-–—*+•]/.test(text) ? 'ol' : 'ul';
      if (list !== kind) { close(); html += `<${kind}>`; list = kind; }
      html += `<li>${escapeHtml(text.replace(BULLET, ''))}</li>`;
    } else {
      close();
      html += `<p>${escapeHtml(text)}</p>`;
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
    const meta = metaOf(p);
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
      out.parts.push(...fieldsOf(p));
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

/** Two fields in the order the file printed them, `lead` the one that names the role when either does. */
function roleFirst(a, b, roleLeads) {
  if (!b) return ROLE.test(a || '') ? [a, ''] : ['', a];
  if (ROLE.test(a) && !ROLE.test(b)) return [a, b];
  if (ROLE.test(b) && !ROLE.test(a)) return [b, a];
  return roleLeads ? [a, b] : [b, a];
}

/**
 * One entry of `type` from its header and body lines. `aside(title, texts)`: text the entry has no
 * field for and no description to hold it — a certificate's — kept in "Additional Information" under
 * its name (R4-IMP-01); a description the app never shows would hide it.
 */
function entryOf(type, header, body, aside = () => {}) {
  const h = readHeader(type, header);
  const [p0 = '', p1 = '', ...rest] = JOB.has(type) ? inlinePair(h.parts) : h.parts;
  const d = h.date || { start: '', end: '', current: false, text: '' };
  const lead = rest.length ? [rest.join(' — ')] : [];
  // A field named on its line ("Technologies: …", "Link: …") that this type has a place for, taken;
  // one it has none for (a job's technologies) leads its description, as written (R4-IMP-07).
  const used = new Set();
  const take = (key) => { used.add(key); return h.meta[key] || ''; };
  const unnamed = () => h.named.filter((n) => !used.has(n.key)).map((n) => n.text);
  const description = (extra = []) => richText([...unnamed(), ...extra, ...body.map((l) => l.text)]);
  const dates = { startDate: d.start, endDate: d.end, current: d.current };
  switch (type) {
    case 'experience': {
      const [role, company] = roleFirst(p0, p1, false);
      return itemOf(type, { company, role, location: h.location || take('location'), ...dates, description: description(lead) });
    }
    case 'volunteering': {
      const [role, org] = roleFirst(p0, p1, true);
      return itemOf(type, { org, role, location: h.location || take('location'), ...dates, description: description(lead) });
    }
    case 'education': {
      const fields = { institution: '', degree: '', fieldOfStudy: '', gpa: take('gpa') };
      const left = [];
      for (const part of h.parts) {
        const gpa = /^(?:c?gpa|grade)\s*:?\s*(.+)$/i.exec(part);
        const field = /^in\s+(.+)$/i.exec(part);
        if (gpa && !fields.gpa) fields.gpa = gpa[1];
        else if (field && !fields.fieldOfStudy) fields.fieldOfStudy = field[1];
        else if (!fields.institution && SCHOOL.test(part) && !DEGREE.test(part.split(',')[0])) fields.institution = part;
        else if (!fields.degree && DEGREE.test(part)) fields.degree = part;
        else left.push(part);
      }
      // A place on a line of its own (a side column's stacked fields): the location.
      let location = h.location || take('location');
      const placeAt = location ? -1 : left.findIndex((p) => PLACE.test(p) && !DEGREE.test(p));
      if (placeAt >= 0) location = left.splice(placeAt, 1)[0];
      if (!fields.degree && left.length) fields.degree = left.shift();
      if (!fields.institution && left.length) fields.institution = left.shift();
      // "B.S., Computer Science": the degree and its field, as the exports print them.
      const comma = /^([^,]+),\s*(.+)$/.exec(fields.degree);
      if (comma && !fields.fieldOfStudy && DEGREE.test(comma[1])) { fields.degree = comma[1].trim(); fields.fieldOfStudy = comma[2].trim(); }
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
      const link = (text) => {
        const m = LINKED.exec(text);
        if (m && m[1] && WEB.test(m[2].replace(/^https?:\/\//i, ''))) return { url: m[2], urlLabel: m[1] };
        return WEB.test(text) ? { url: text } : null;
      };
      const left = [];
      for (const part of h.parts.slice(1)) {
        const l = !fields.url && link(part);
        if (l) Object.assign(fields, l);
        else if (!fields.issuer) fields.issuer = part;
        else left.push(part);
      }
      const rest = body.filter((l) => {
        const found = !fields.url && link(l.text.replace(BULLET, '').trim());
        if (found) Object.assign(fields, found);
        return !found;
      });
      const extra = [...unnamed(), ...left, ...rest.map((l) => l.text)];
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
  // A certificate or an award a list item each (R4-IMP-01): a section that opens with a list item is a
  // list of them, each with its date at its end ("• AWS Certified Solutions Architect – 2022"). A line
  // under an item is its own: its date or named fields, else its text. Before, the first item was the
  // one entry, and the others went into its description, which a certificate never shows.
  if ((type === 'certifications' || type === 'awards') && lines.length && BULLET.test(lines[0].text)) {
    const list = [];
    for (const l of lines) {
      const last = list[list.length - 1];
      if (BULLET.test(l.text)) list.push({ header: [{ ...l, text: l.text.replace(BULLET, '') }], body: [] });
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
      if (L.date.first) {
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
        if (!n.bullet && !n.gap && !n.date && n.hint !== 'entry' && n.text.length <= 100 && !/[.!?]$/.test(n.text)) { header.push(n); i += 1; }
      }
      while (i < info.length && !info[i].bullet && !info[i].gap && isMetaLine(info[i].text)) header.push(info[i++]);
      start(header);
      continue;
    }
    pool().push(L);
    i += 1;
  }

  if (!entries.length) {
    // No dates and no entry titles: an entry per line after a gap or a list (one line each for a
    // certificate or an award); a custom section's text stays one entry, as written.
    if (type === 'custom') return preamble.length ? [itemOf('custom', { description: richText(preamble.map((l) => l.text)) })] : [];
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
  return entries.map((e) => entryOf(type, e.header, e.body, aside));
}

/** Skills lines: "Category: a, b" as a group; a short line alone over a list as its category. */
function skillsOf(lines) {
  const texts = lines.map((l) => l.text.replace(BULLET, '').trim()).filter(Boolean);
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
    for (const cell of line.text.replace(BULLET, '').split(/\t|\s+[|•·]\s+/).map((s) => s.trim()).filter(Boolean)) {
      const m = /^(.+?)\s*(?::|\s[—–-]\s|\()\s*(.+?)\)?$/.exec(cell);
      if (m) { items.push(itemOf('languages', { language: m[1], proficiency: m[2] })); bare = null; continue; }
      const level = LEVEL.exec(cell);
      // A level alone, set apart from its language ("English ⇥ Native", a PDF's grid cells two to a
      // row): the level of the language before it.
      if (level && level.index === 0 && bare) { bare.proficiency = cell; bare = null; continue; }
      if (level && level.index > 0) { items.push(itemOf('languages', { language: cell.slice(0, level.index).trim(), proficiency: level[0].trim() })); bare = null; continue; }
      bare = itemOf('languages', { language: cell, proficiency: '' });
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
  lines.forEach((l, i) => {
    if (i <= nameAt) return;
    const text = l.text.replace(/\s*:$/, '').trim();
    const plain = !BULLET.test(l.text) && !/\t|\s\|\s|@/.test(text) && text.length <= 48 && !/[.!?,;]$/.test(text);
    let type = null;
    if (hinted) {
      if (l.hint === 'heading') type = headingType(text) || 'custom';
      else if (!l.hint && plain && (isCaps(text) || l.ruled)) type = headingType(text);
    } else if (plain) {
      const known = headingType(text);
      if (known && (l.ruled || isCaps(text) || l.gap || l.text.endsWith(':') || i === nameAt + 1 || headingAt.size === 0)) type = known;
      else if (l.ruled && !/\d/.test(text)) type = 'custom';
      else if (seen && isCaps(text) && !/\d/.test(text) && text.replace(/[^\p{L}]/gu, '').length >= 4 && text.split(/\s+/).length <= 5 && !BARE_LABEL.test(text)) type = 'custom';
    }
    if (type) { headingAt.set(i, { type, title: text }); seen = true; }
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
      for (const piece of headerPieces(l.text)) {
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
      if (leftover.length) spill(leftover.join(' | '), l);
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
    if (t && headerPieces(t.text).length === 1 && !contactOf(t.text) && t.text.length <= 80 && !/[.!?]$/.test(t.text)) {
      personal.title = t.text;
      rest.shift();
    }
    takeContacts(rest, {
      spill: (text) => ((text.length >= 60 || /[.!?]$/.test(text)) ? summary : other).push(text),
    });
  }

  // The sections, each heading to the next.
  const sections = [];
  const starts = [...headingAt.keys()];
  starts.forEach((at, k) => {
    const { type, title } = headingAt.get(at);
    const body = lines.slice(at + 1, starts[k + 1] ?? lines.length);
    const name = tamed(title);
    if (type === 'summary') { summary.push(...body.map((l) => l.text)); return; }
    if (type === 'contact') {
      takeContacts(body, { spill: (text) => other.push(text) });
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
    name: personal.name ? `${personal.name} Resume` : 'Imported Resume',
    updatedAt: Date.now(),
    dataVersion: DATA_VERSION, // built now: no migration applies
    template: 'classic',
    settings: getStarterSettings('classic'),
    personal,
    sections,
    coverLetter: { ...BASE_COVER_LETTER },
  };
}
