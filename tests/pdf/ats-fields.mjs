/**
 * How an applicant-tracking system reads a résumé into FIELDS — the stage after text extraction.
 * ats-parse.mjs answers "did every fact survive the text pipeline?"; this answers the harder
 * question a real parser (Sovren, RChilli, Affinda, HireAbility, the open pyresparser/spaCy ones)
 * actually has to: from that flat text, can it recover the candidate's name, contacts, each job as
 * a {title, company, dates} record, the section it belongs to, and the skills — or does the layout
 * scramble the association? Vendor parsers are closed, so this models their common denominator:
 * contact regexes, first-line name detection, header synonyms for section segmentation, and
 * date-range anchoring for work history. A résumé that scores here is one a portal can file into
 * the right boxes; one that does not is a résumé that imports as mush even when every word is there.
 *
 * Run scoreFields(truthFields(r), text) on text from ats-parse.mjs readers().
 */
import { norm } from './ats-parse.mjs';

const lower = (s) => norm(s).toLowerCase();
const digits = (s) => String(s || '').replace(/\D/g, '');
/** The 4-digit year in a date string in any format the app writes ("03/2021", "Jul 2017", "2015"). */
const yearOf = (d) => (String(d || '').match(/\b(?:19|20)\d{2}\b/) || [])[0] || null;

// ── Ground truth ───────────────────────────────────────────────────────────

/** Canonical section words an ATS recognises as a header, by the section type they open. */
export const SECTION_SYNONYMS = {
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history'],
  education: ['education', 'academic background', 'academics', 'qualifications'],
  skills: ['skills', 'technical skills', 'core skills', 'core competencies', 'competencies', 'expertise'],
  projects: ['projects', 'personal projects', 'selected projects'],
};

/**
 * The résumé as the fields a parser must recover: contact block, one record per experience entry
 * (title, company, the years its dates carry), education records, the flat skills list, and the
 * section headings that segment it. Dates reduce to their year — the one part that survives every
 * date format the app can render (numbers, month names, year only).
 */
export function truthFields(r) {
  const P = r.personal || {};
  const hidden = P.hiddenFields || [];
  const has = (k) => !hidden.includes(k) && P[k];
  const sections = (r.sections || []).filter((s) => s.visible !== false);
  const exp = sections.find((s) => s.type === 'experience');
  const edu = sections.find((s) => s.type === 'education');
  const skillSecs = sections.filter((s) => s.type === 'skills');
  return {
    name: has('name') ? norm(P.name) : null,
    email: has('email') ? norm(P.email) : null,
    phone: has('phone') ? norm(P.phone) : null,
    location: has('location') ? norm(P.location) : null,
    links: ['linkedin', 'github', 'website'].filter(has).map((k) => norm(P[k])),
    experience: (exp?.items || []).map((it) => ({
      title: norm(it.role), company: norm(it.company),
      startYear: yearOf(it.startDate), endYear: it.current ? 'present' : yearOf(it.endDate),
    })),
    education: (edu?.items || []).map((it) => ({ institution: norm(it.institution), degree: norm(it.degree || it.fieldOfStudy) })),
    skills: skillSecs.flatMap((s) => (s.items || []).flatMap((it) => String(it.skills || '').split(',').map(norm).filter(Boolean))),
    sectionTitles: sections.map((s) => norm(s.title)).filter(Boolean),
  };
}

// ── The parser model: text → fields ─────────────────────────────────────────

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A phone-ish run: an optional +cc, then 7+ digits with the usual separators, no letters glued on.
const PHONE_RE = /(?<![A-Za-z0-9])\+?\d(?:[\d\s().-]{5,}\d)(?![A-Za-z0-9])/g;
const URL_RE = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;

/** The candidate name a first-line parser reads: the first line that looks like a person's name. */
export function extractName(lines) {
  for (const raw of lines.slice(0, 6)) {
    const t = raw.trim();
    if (!t || t.includes('@') || /\d/.test(t)) continue;
    // A header, or a contact/skills line, is not a name.
    if (t.length > 45) continue;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 6) continue;
    // Names are letters, spaces, hyphens, apostrophes and dots (initials, "Jr.").
    if (words.every((w) => /^[\p{L}][\p{L}'’.-]*$/u.test(w))) return norm(t);
  }
  return null;
}

/** Every email / phone / URL a parser can pull whole out of `text`. */
export function extractContacts(text) {
  return {
    emails: (norm(text).match(EMAIL_RE) || []).map(norm),
    phones: (norm(text).match(PHONE_RE) || []).map((p) => digits(p)).filter((d) => d.length >= 7 && d.length <= 15),
    urls: (norm(text).match(URL_RE) || []).map((u) => lower(u.replace(/^https?:\/\//, '').replace(/\/$/, ''))),
  };
}

/** The line index of every section header, by matching a header synonym or the résumé's own titles. */
function headerLines(lines, ownTitles) {
  const own = new Set(ownTitles.map(lower));
  const syn = new Set(Object.values(SECTION_SYNONYMS).flat());
  const idx = [];
  lines.forEach((line, i) => {
    const t = lower(line).replace(/[:.\s]+$/, '');
    if (!t || t.length > 40) return;
    if (own.has(t) || syn.has(t)) idx.push(i);
  });
  return idx;
}

/** The text of the section whose header matches one of `titles` (case-insensitive), to the next header. */
function sectionText(lines, ownTitles, titles) {
  const heads = headerLines(lines, ownTitles);
  const want = new Set(titles.map(lower));
  for (let h = 0; h < heads.length; h += 1) {
    if (want.has(lower(lines[heads[h]]).replace(/[:.\s]+$/, ''))) {
      const end = heads[h + 1] ?? lines.length;
      return lines.slice(heads[h] + 1, end).join('\n');
    }
  }
  return null;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/** Every start index of `needle` in `low` (already lower-cased). */
function occurrences(low, needle) {
  const n = String(needle).toLowerCase();
  const out = [];
  for (let i = low.indexOf(n); i >= 0; i = low.indexOf(n, i + 1)) out.push(i);
  return out;
}

/**
 * Within `hay`, is there a window of `window` characters that holds an occurrence of EVERY needle?
 * Considers every occurrence, not the first, so a title that also appears in the summary ("Senior
 * Frontend Engineer" vs the entry's "Frontend Engineer") is still matched where it sits by its job.
 */
function coLocated(hay, needles, window) {
  const low = hay.toLowerCase();
  const lists = needles.map((n) => occurrences(low, n));
  if (lists.some((l) => l.length === 0)) return false;
  const events = lists.flatMap((list, id) => list.map((pos) => ({ pos, id }))).sort((a, b) => a.pos - b.pos);
  const count = Array.from({ length: needles.length }, () => 0);
  let have = 0;
  let l = 0;
  for (let rIdx = 0; rIdx < events.length; rIdx += 1) {
    if (count[events[rIdx].id]++ === 0) have += 1;
    while (events[rIdx].pos - events[l].pos > window) { if (--count[events[l].id] === 0) have -= 1; l += 1; }
    if (have === needles.length) return true;
  }
  return false;
}

/**
 * Score one reader's text against the résumé's fields.
 *   name        the first-line name equals the résumé's (startsWith, so a name+title header still counts)
 *   email/phone recovered by the same regexes a parser runs, not just present as a substring
 *   links       each profile URL pulled whole (a wrapped or spaced URL fails, as it does in a parser)
 *   sections    section headers found as their own lines (a header glued to body is lost)
 *   experience  entries whose title, company and start year all land in one section, co-located (≤ 240 ch)
 *                and in the résumé's order (no two entries swapped) — dateAttached: the year near its job
 *   skills      skills found in the detected Skills section
 */
export function scoreFields(truth, rawText) {
  const text = norm(rawText);
  const low = text.toLowerCase();
  const lines = String(rawText).split('\n').map((l) => l.trim()).filter(Boolean);
  const contacts = extractContacts(rawText);

  // Contact block
  const name = truth.name ? (extractName(lines) || '').toLowerCase().startsWith(truth.name.toLowerCase()) : null;
  const email = truth.email ? contacts.emails.some((e) => e.toLowerCase() === truth.email.toLowerCase()) : null;
  const phoneD = truth.phone ? digits(truth.phone) : null;
  const phone = phoneD ? contacts.phones.some((d) => d.endsWith(phoneD.slice(-9)) || phoneD.endsWith(d.slice(-9))) : null;
  // A link counts only when an extracted URL holds the WHOLE profile link — a truncated "linkedin.com"
  // (wrapped or split at a space) does not stand in for "linkedin.com/in/pat-lee".
  const linksFound = truth.links.filter((l) => contacts.urls.some((u) => u.includes(lower(l))));

  // Sections
  const sectionsFound = truth.sectionTitles.filter((t) => headerLines(lines, truth.sectionTitles).map((i) => lower(lines[i]).replace(/[:.\s]+$/, '')).includes(lower(t)));

  // Work history: anchor each entry on its year, inside the detected experience section.
  const expText = sectionText(lines, truth.sectionTitles, SECTION_SYNONYMS.experience) || text;
  const entries = truth.experience.map((e) => {
    const needles = [e.title, e.company, e.startYear].filter(Boolean);
    const recovered = coLocated(expText, needles, 240);
    const dateAttached = e.startYear ? coLocated(expText, [e.title, e.startYear], 160) : true;
    return { ...e, recovered, dateAttached };
  });
  // Order: the entries' title positions must be non-decreasing (no two jobs swapped).
  const positions = truth.experience.map((e) => low.indexOf(e.title.toLowerCase())).filter((i) => i >= 0);
  let swapped = 0;
  for (let i = 1; i < positions.length; i += 1) if (positions[i] < positions[i - 1]) swapped += 1;

  // Skills
  const skillsText = sectionText(lines, truth.sectionTitles, SECTION_SYNONYMS.skills) || text;
  const skillsFound = truth.skills.filter((s) => skillsText.toLowerCase().includes(s.toLowerCase()));

  const recoveredEntries = entries.filter((e) => e.recovered).length;
  return {
    name, email, phone,
    links: { found: linksFound.length, total: truth.links.length },
    sections: { found: sectionsFound.length, total: truth.sectionTitles.length },
    experience: {
      total: truth.experience.length, recovered: recoveredEntries,
      dateAttached: entries.filter((e) => e.dateAttached).length, swapped, entries,
    },
    skills: { found: skillsFound.length, total: truth.skills.length },
  };
}

/** One line per field a parser would get wrong; empty when every field is recovered. */
export function fieldProblems(name, s, { requireLinks = true, requireSkills = true } = {}) {
  const out = [];
  if (s.name === false) out.push(`${name}: name not first-line recoverable`);
  if (s.email === false) out.push(`${name}: email not extractable as a field`);
  if (s.phone === false) out.push(`${name}: phone not extractable as a field`);
  if (requireLinks && s.links.total && s.links.found < s.links.total) out.push(`${name}: ${s.links.total - s.links.found}/${s.links.total} profile link(s) not whole`);
  if (s.sections.total && s.sections.found < s.sections.total) out.push(`${name}: ${s.sections.total - s.sections.found}/${s.sections.total} section header(s) undetected`);
  if (s.experience.total && s.experience.recovered < s.experience.total) {
    const lost = s.experience.entries.filter((e) => !e.recovered).map((e) => JSON.stringify(`${e.title} @ ${e.company}`.slice(0, 40)));
    out.push(`${name}: ${s.experience.total - s.experience.recovered}/${s.experience.total} job(s) not recovered as title+company+date — ${lost.slice(0, 3).join(', ')}`);
  }
  if (s.experience.dateAttached < s.experience.total) out.push(`${name}: ${s.experience.total - s.experience.dateAttached}/${s.experience.total} job(s) with the date detached from the title`);
  if (s.experience.swapped) out.push(`${name}: ${s.experience.swapped} job(s) read out of order`);
  if (requireSkills && s.skills.total && s.skills.found < s.skills.total) out.push(`${name}: ${s.skills.total - s.skills.found}/${s.skills.total} skill(s) not in the Skills section`);
  return out;
}
