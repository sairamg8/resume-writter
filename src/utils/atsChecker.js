import { decodeEntities, hasRichText, parseRichText } from './richText.js';
import { contactItems } from './contacts.js';
import { skillGroup } from './skills.js';
import { ACTION_VERBS, hasMetric, leadsWithActionVerb } from './bulletOptimizer.js';
import { ATS_TIER_POINTS, atsRating, hasHeaderControls, inSidebarColumn, templateId, templateLabel, TEMPLATE_PICKER } from '../constants/templates.js';
import { resolveSection } from '../templates/pdf/shared/templateSectionDefaults.js';

// The ATS plain-text export lives in its own module; the ATS tab and Export menu import it from here.
export { generateAtsPlainText } from './atsPlainText.js';

/**
 * Extracts bullet points from a resume item.
 * Supports both legacy/explicit `item.bullets` array and `item.description`
 * rich text (HTML lists <li>, bullet characters • / -, or multi-line achievements).
 */
export function extractBulletsFromItem(item) {
  if (!item || typeof item !== 'object') return [];
  const bullets = [];

  // 1. Direct bullets array (if populated)
  if (Array.isArray(item.bullets)) {
    for (const b of item.bullets) {
      const clean = String(b || '').replace(/<[^>]+>/g, '').trim();
      if (clean) bullets.push(clean);
    }
  }

  // 2. Rich text / HTML / plain-text description
  if (item.description && typeof item.description === 'string') {
    const desc = item.description;

    // Check for <li> tags
    const liMatches = [...desc.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    if (liMatches.length > 0) {
      for (const m of liMatches) {
        const clean = decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim();
        if (clean && !bullets.includes(clean)) {
          bullets.push(clean);
        }
      }
    } else {
      // Look for bullet characters or line breaks (<br>, </p>, </div>, \n)
      const textWithNewlines = desc
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|tr|blockquote)>/gi, '\n')
        .replace(/<[^>]+>/g, '');
      const decoded = decodeEntities(textWithNewlines);
      const lines = decoded
        .split(/[\r\n]+/)
        .map(l => l.trim())
        .filter(Boolean);

      const hasBulletMarkers = lines.some(l => /^[\s•\-*–—◦▪▸‣⁃]/.test(l) || /^\d+[.)]\s/.test(l));

      if (hasBulletMarkers) {
        for (const line of lines) {
          const stripped = line.replace(/^[\s•\-*–—◦▪▸‣⁃]+/, '').replace(/^\d+[.)]\s*/, '').trim();
          if (stripped && !bullets.includes(stripped)) {
            bullets.push(stripped);
          }
        }
      } else if (lines.length > 1) {
        for (const line of lines) {
          if (line && !bullets.includes(line)) {
            bullets.push(line);
          }
        }
      }
    }
  }

  return bullets;
}

// ── 1. High-Impact Action Verbs: the one list the score and the STAR Optimizer read (R2-025) ──
export { ACTION_VERBS };

// Weak or passive phrases that hurt ATS score and recruiter impression
export const WEAK_PHRASES = [
  'responsible for', 'responsibilities included', 'duties included',
  'worked on', 'worked with', 'helped with', 'helped to', 'assisted with',
  'assisted in', 'tasked with', 'handled', 'was involved in', 'participated in',
  'tried to', 'attempted to',
];

// Standard ATS Section Categories & Workday Canonical Headings
export const ATS_STANDARD_SECTIONS = {
  experience: {
    canonical: 'Professional Experience',
    aliases: [
      'professional experience', 'work experience', 'employment history',
      'work history', 'experience', 'career history', 'relevant experience',
    ],
  },
  education: {
    canonical: 'Education',
    aliases: [
      'education', 'academic background', 'academic history',
      'education & qualifications', 'educational background', 'academic training',
    ],
  },
  skills: {
    canonical: 'Skills',
    aliases: [
      'skills', 'technical skills', 'core competencies', 'skills & competencies',
      'technical proficiencies', 'areas of expertise', 'key skills', 'competencies',
    ],
  },
  projects: {
    canonical: 'Projects',
    aliases: [
      'projects', 'personal projects', 'key projects', 'technical projects',
      'selected projects', 'academic projects',
    ],
  },
  certifications: {
    canonical: 'Certifications',
    aliases: [
      'certifications', 'licenses & certifications', 'certifications & licenses',
      'certificates', 'credentials', 'professional certifications',
    ],
  },
  awards: {
    canonical: 'Awards & Honors',
    aliases: [
      'awards & honors', 'honors & awards', 'awards', 'honors', 'achievements',
      'key achievements', 'recognitions',
    ],
  },
  volunteering: {
    canonical: 'Volunteering',
    aliases: [
      'volunteering', 'volunteer experience', 'community involvement',
      'volunteer work', 'community service',
    ],
  },
  languages: {
    canonical: 'Languages',
    aliases: [
      'languages', 'language proficiencies', 'language skills',
    ],
  },
  publications: {
    canonical: 'Publications',
    aliases: [
      'publications', 'published works', 'research papers',
    ],
  },
};

// Common conversational stop words for the JD matcher
const COMMON_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if',
  'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves', 'will', 'must', 'shall', 'may', 'might', 'including', 'years', 'experience', 'ability',
  'demonstrated', 'strong', 'work', 'working', 'skills', 'role', 'team', 'ideal', 'candidate', 'responsibilities',
  'qualifications', 'requirements', 'preferred', 'required', 'plus', 'opportunity', 'company', 'job',
  'position', 'join', 'looking', 'equal', 'employment', 'status', 'race', 'color', 'religion', 'seeking',
  'big', 'expertise', 'strong', 'solid', 'demonstrated', 'familiarity', 'proficient', 'knowledge',
  // Abbreviations with one dot, which LETTER_ABBREVIATION does not catch (R2-023).
  'etc', 'vs',
]);

/**
 * The résumé's own field `key` as every export prints it: '' when the user hid it on Personal Info
 * (the eye beside Email, Phone, …, Summary; `hiddenFields`). The ATS score and the job match read
 * the personal fields through this, so a hidden one counts as absent, as it is from the PDF, Word,
 * Markdown and ATS text (R2-033; AUD-12 did the same for hidden entries and the photo).
 */
const shownField = (p, key) => ((Array.isArray(p?.hiddenFields) && p.hiddenFields.includes(key)) ? '' : p?.[key]);

/** Whether the user filled `key` in and then hid it: its item then says so, not "missing". */
const hiddenByUser = (p, key) => !shownField(p, key) && Boolean(String(p?.[key] || '').trim());

/**
 * Rich text (the summary, a description) as the words it prints: parseRichText, the parse the PDF
 * and Word print from, so no tag, list marker or entity is read as a word, and a cleared editor
 * ('<p><br></p>') reads as nothing (R2-020).
 */
const printedText = (html) => parseRichText(html).map((b) => b.runs.map((r) => r.text).join('')).join('\n');

/** The fields Section Options → Show dates takes off an entry, and the types Show location applies to. */
const DATE_FIELDS = ['startDate', 'endDate', 'date', 'expiry'];
const LOCATION_TYPES = new Set(['experience', 'education', 'volunteering']);

/**
 * An entry as it prints: each field hidden with the eye beside it (`item.hiddenFields`: Company, Job
 * Title, Location, dates, Description, a skill group's title or skills) blanked, and a hidden End
 * Date is no end — not "Present" — as the PDF and Word print it. The corpus and the score read
 * entries through this, as they read the personal fields through shownField (R2-033). `off`: the
 * fields its section's options take off every entry (sectionOff).
 */
function printedItem(item, off = []) {
  const hidden = [...(Array.isArray(item?.hiddenFields) ? item.hiddenFields : []), ...off];
  if (!hidden.length) return item;
  const out = { ...item };
  for (const key of hidden) out[key] = '';
  if (hidden.includes('endDate')) out.current = false;
  return out;
}

/** Whether Section Options → Show dates is off on `s`, as the PDF and Word resolve it on `template`. */
const datesOff = (s, template) => resolveSection(s, template).settings.showDates === false;

/**
 * The fields a section's options take off all its entries on `template`: Show dates off prints no
 * dates, nor "Present", on any template, and Show location off no location on a job, a degree or a
 * volunteer role — in the PDF and in Word (R2-020).
 */
function sectionOff(s, template) {
  const { showLocation } = resolveSection(s, template).settings;
  return [
    ...(datesOff(s, template) ? DATE_FIELDS : []),
    ...(showLocation === false && LOCATION_TYPES.has(s.type) ? ['location'] : []),
  ];
}

/** A section's shown entries, as they print on `template` (printedItem, sectionOff). */
function shownItems(s, template) {
  const off = sectionOff(s, template);
  return (Array.isArray(s?.items) ? s.items : [])
    .filter((item) => item && typeof item === 'object' && item.visible !== false)
    .map((item) => printedItem(item, off));
}

/**
 * The fields an entry prints as they are, whatever its type (the PDF's and Word's): a job's or
 * volunteer role's company / org, role and location; a degree's institution, degree, field and GPA;
 * a project's name and technologies; a certificate's name, issuer and ID; an award's or a custom
 * entry's title and subtitle; a language and its proficiency; a reference's name, job title,
 * company, relationship, email and phone; interests. A link, the description, bullets and a skill
 * group are read apart; dates are left out, as the matcher reads no numbers.
 */
const PRINTED_FIELDS = [
  'company', 'org', 'role', 'location', 'institution', 'degree', 'fieldOfStudy', 'gpa',
  'name', 'technologies', 'issuer', 'credentialId', 'title', 'subtitle',
  'language', 'proficiency', 'jobTitle', 'relationship', 'email', 'phone', 'interests',
];

/** A stored field as text: a number from imported data as written, anything else not text as ''. */
const fieldText = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

/**
 * Extracts searchable text corpus from an entire resume object — what it prints: no hidden entry,
 * section or field (R2-033), every field an export prints, the header's contact lines as it prints
 * them, and rich text as its words, never its markup (R2-022).
 */
export function extractResumeCorpus(resume) {
  if (!resume) return '';
  const parts = [];
  const p = resume.personal || {};
  if (p.name) parts.push(p.name);
  if (p.title) parts.push(p.title);
  for (const { value } of contactItems(p)) parts.push(value);
  parts.push(printedText(shownField(p, 'summary')));

  const sections = Array.isArray(resume.sections) ? resume.sections : [];
  const template = templateId(resume.template);
  for (const s of sections) {
    if (s.visible === false) continue;
    if (s.title) parts.push(s.title);
    for (const item of shownItems(s, template)) {
      if (s.type === 'skills') {
        const { category, skills } = skillGroup(item);
        parts.push(category, skills);
        continue;
      }
      parts.push(...PRINTED_FIELDS.map((key) => fieldText(item[key])));
      // A certificate prints its link's label where it has one, a project its link.
      parts.push(fieldText(item.urlLabel) || fieldText(item.url));
      parts.push(printedText(fieldText(item.description)));
      if (Array.isArray(item.bullets)) parts.push(...item.bullets.map(fieldText));
    }
  }
  return parts.filter(Boolean).join(' ');
}

function chooseBestCasing(newWord, oldWord) {
  if (!oldWord) return newWord;
  if (newWord === oldWord) return oldWord;
  const oldHasUpper = /[A-Z]/.test(oldWord);
  const newHasUpper = /[A-Z]/.test(newWord);
  if (!oldHasUpper && newHasUpper) return newWord;
  if (oldHasUpper && !newHasUpper) return oldWord;
  const newIsUpper = newWord === newWord.toUpperCase();
  const oldIsUpper = oldWord === oldWord.toUpperCase();
  if (newIsUpper && !oldIsUpper && newWord.length <= 5) return newWord;
  return oldWord;
}

/**
 * An abbreviation of single letters and dots — "e.g", "i.e", "U.S", "a.m" once the trailing dot is
 * trimmed — which is no keyword: it used to be listed as a missing one, and "+" wrote it into
 * Skills (R2-023). "Ph.D", "Node.js" and "ASP.NET" have longer parts and stay.
 */
const LETTER_ABBREVIATION = /^(?:\p{L}\.)+\p{L}?$/u;

/**
 * Extracts keywords & tech terms from a job description. A word is Unicode letters, their marks and
 * digits: `\w` is ASCII, and read with it "München" was the keyword "nchen" (R2-023). The text is
 * read composed (NFC), and a combining mark is part of its word: pasted from a PDF or a Mac, "ü" is
 * often "u" + U+0308, and a Hindi or Tamil word holds vowel signs no composed letter replaces.
 */
export function extractJobKeywords(jobDescriptionText) {
  if (!jobDescriptionText || typeof jobDescriptionText !== 'string') return [];
  // Tokenize words, normalizing punctuation
  const clean = jobDescriptionText.normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}_\s+#.-]/gu, ' ')
    .replace(/\s+/g, ' ');

  const tokens = clean.split(' ');
  const counts = new Map();
  const casingMap = new Map();

  for (let raw of tokens) {
    let word = raw.trim();
    // Strip trailing periods/commas
    word = word.replace(/^[^\p{L}\p{M}\p{N}_+#]+|[^\p{L}\p{M}\p{N}_+#]+$/gu, '');
    if (word.length < 2 || word.length > 30) continue;
    if (LETTER_ABBREVIATION.test(word)) continue;
    const lower = word.toLowerCase();
    if (COMMON_STOP_WORDS.has(lower)) continue;
    if (/^\d+\+?$/.test(lower)) continue; // skip pure numbers and numbers with + (e.g. 5+)

    // Keep capitalization if it looks like an acronym or tech (AWS, SQL, CI/CD, React)
    counts.set(lower, (counts.get(lower) || 0) + 1);
    casingMap.set(lower, chooseBestCasing(word, casingMap.get(lower)));
  }

  // Also check for common multi-word technical phrases
  const multiWordPhrases = [
    'machine learning', 'artificial intelligence', 'data science', 'deep learning',
    'front end', 'frontend', 'back end', 'backend', 'full stack', 'fullstack',
    'cloud computing', 'continuous integration', 'continuous delivery', 'ci/cd',
    'unit testing', 'test driven development', 'object oriented', 'rest api',
    'agile methodology', 'scrum master', 'version control', 'relational database',
    'microservices architecture', 'problem solving', 'system design',
  ];

  const lowerJd = jobDescriptionText.toLowerCase();
  for (const phrase of multiWordPhrases) {
    const idx = lowerJd.indexOf(phrase);
    if (idx !== -1) {
      counts.set(phrase, Math.max(counts.get(phrase) || 0, 2));
      const actual = jobDescriptionText.slice(idx, idx + phrase.length);
      casingMap.set(phrase, actual || phrase);
    }
  }

  // Sort by frequency
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([lowerKey, count]) => ({ keyword: casingMap.get(lowerKey) || lowerKey, count }));
}

/**
 * Matches resume content against a job description
 */
export function matchResumeWithJob(resume, jobDescriptionText) {
  if (!resume) return null;
  const jdKeywords = extractJobKeywords(jobDescriptionText);
  if (!jdKeywords.length) return null;

  // Composed, as the keywords are read (extractJobKeywords).
  const resumeCorpus = extractResumeCorpus(resume).normalize('NFC').toLowerCase();
  const matched = [];
  const missing = [];

  for (const item of jdKeywords) {
    const kw = item.keyword;
    const lowerKw = kw.toLowerCase();
    // Word boundary regex for single words, direct include for phrases
    let isPresent = false;
    if (lowerKw.includes(' ') || lowerKw.includes('/') || lowerKw.includes('.')) {
      isPresent = resumeCorpus.includes(lowerKw);
    } else {
      // Boundaries of Unicode letters, as the keywords are read: with `\w` the keyword "rich" was
      // found inside "Zürich" (R2-023).
      const esc = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lead = /^[\p{L}\p{M}\p{N}_]/u.test(lowerKw) ? '(?<![\\p{L}\\p{M}\\p{N}_])' : '(?<!\\S)';
      const trail = /[\p{L}\p{M}\p{N}_]$/u.test(lowerKw) ? '(?![\\p{L}\\p{M}\\p{N}_])' : '(?![\\p{L}\\p{M}\\p{N}_+#])';
      const regex = new RegExp(`${lead}${esc}${trail}`, 'iu');
      isPresent = regex.test(resumeCorpus);
    }

    if (isPresent) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const matchPercentage = Math.round((matched.length / jdKeywords.length) * 100);
  return {
    matchPercentage,
    matchedKeywords: matched,
    missingKeywords: missing,
    totalJdKeywords: jdKeywords.length,
  };
}

/**
 * Whether the ATS report flags this section's heading: the section is shown and its title is not on
 * its type's alias list. The one rule for both the report's std_headings item (analyzeAtsScore) and
 * the fix it offers (standardizeSectionsForAts), so the button cannot change a heading the report
 * passed — it did, and hidden sections too, before TUI-7.
 */
function needsAtsTitle(section) {
  return !!section && section.visible !== false && !isStandardAtsTitle(section);
}

/**
 * Renames the headings the ATS report flags to their canonical Workday / Taleo title, and nothing
 * else. A hidden section, a title already on its type's alias list ("Work Experience", "Technical
 * Skills") and a custom section are returned as the same object. It writes no title order: leading
 * experience entries with the job title is the report's separate "Put Job Title First" fix, and this
 * one used to set it on every experience section behind a label that only names headings (TUI-7).
 */
export function standardizeSectionsForAts(sections) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((s) => {
    const spec = needsAtsTitle(s) && ATS_STANDARD_SECTIONS[s.type];
    return spec ? { ...s, title: spec.canonical } : s;
  });
}

/**
 * Whether `section` is one the report's exp_title_order item reads as leading with the company: a
 * shown experience section whose title order, as the PDF resolves it on `template` (its own setting,
 * else the template's — Executive, Sidebar and Timeline lead with the role), is not Role / Co. The
 * one rule of the item and of its fix, jobTitleFirst, so the button cannot rewrite a section the
 * report never read — a hidden one, before R2-079.
 */
function leadsWithCompany(section, template) {
  return !!section && section.visible !== false && section.type === 'experience'
    && resolveSection(section, template).settings.titleOrder !== 'role';
}

/**
 * "Put Job Title First": Role / Co. on each section leadsWithCompany names, and nothing else. Every
 * other section is returned as the same object.
 */
export function jobTitleFirst(sections, template) {
  if (!Array.isArray(sections)) return sections;
  const t = templateId(template);
  return sections.map((s) => (leadsWithCompany(s, t) ? { ...s, settings: { ...s.settings, titleOrder: 'role' } } : s));
}

/**
 * The types whose entries run to several lines — a heading, dates, a description. Printed two or
 * more to a row (Section Options → Grids), their lines sit side by side, and a parser that reads a
 * page line by line interleaves them. A skill group, a language, a certificate, an award or a
 * reference card is one short cell: a grid of those is the template tier's business (Compact's).
 */
const MULTI_LINE_TYPES = new Set(['experience', 'education', 'projects', 'volunteering', 'custom']);

/**
 * Whether `section` prints two or more of its entries side by side, as the PDF lays it out on
 * `template`: shown, of a multi-line type, in the main column (the Sidebar's side column prints one
 * column whatever Grids says), its Grids above 1 (resolveSection, as the PDF reads it) and more than
 * one shown entry to fill a row. The one rule of the layout report's section_grids item and of its
 * fix, entriesInOneColumn (R2-021).
 */
function printsSideBySide(section, template, settings) {
  return !!section && section.visible !== false && MULTI_LINE_TYPES.has(section.type)
    && !inSidebarColumn(template, section.type, settings)
    && Number(resolveSection(section, template).settings.columns || 1) > 1
    && shownItems(section, template).length > 1;
}

/**
 * The layout warning's fix: Section Options → Grids 1 on each section that prints its entries side
 * by side (printsSideBySide), and nothing else. Every other section is returned as the same object.
 */
export function entriesInOneColumn(sections, template, settings) {
  if (!Array.isArray(sections)) return sections;
  const t = templateId(template);
  return sections.map((s) => (printsSideBySide(s, t, settings) ? { ...s, settings: { ...s.settings, columns: 1 } } : s));
}

/**
 * Where the job scanner's "+" writes a missing keyword so that it prints: `{ section, item }`, the
 * first skill group that prints its skills — shown, its Skills not hidden with the eye — in a shown
 * Skills section; `{ section }` when a shown Skills section has no such group (a new group goes
 * there); null when no Skills section is shown. It wrote into the first group whatever it was: into a
 * hidden one the keyword never printed and stayed missing (R2-024).
 */
export function keywordSkillTarget(sections) {
  const shown = (Array.isArray(sections) ? sections : []).filter((s) => s?.type === 'skills' && s.visible !== false);
  for (const section of shown) {
    const item = (Array.isArray(section.items) ? section.items : [])
      .find((i) => i && typeof i === 'object' && i.visible !== false && !(i.hiddenFields || []).includes('skills'));
    if (item) return { section, item };
  }
  return shown.length ? { section: shown[0] } : null;
}

/**
 * Checks whether a section title is ATS-friendly for its section type
 */
export function isStandardAtsTitle(section) {
  if (!section || !section.type) return true;
  // By its own key only: a type named like an Object member ('constructor') is a custom section (R2-109).
  const spec = Object.hasOwn(ATS_STANDARD_SECTIONS, section.type) ? ATS_STANDARD_SECTIONS[section.type] : undefined;
  if (!spec) return true; // custom sections are exempt
  const current = String(section.title || '').trim().toLowerCase();
  return spec.aliases.includes(current);
}

/**
 * Complete ATS Compatibility Analysis Engine
 * Returns a comprehensive score (0-100), sub-scores, checklist items, and actionable fixes.
 */
export function analyzeAtsScore(resume, jobDescriptionText = '') {
  const results = {
    totalScore: 0,
    maxScore: 100,
    grade: 'C',
    gradeLabel: 'Needs Work',
    categories: {
      contact: { score: 0, max: 20, label: 'Contact & Header Information', items: [] },
      headings: { score: 0, max: 20, label: 'ATS Standard Section Headings', items: [] },
      experience: { score: 0, max: 25, label: 'Work Experience & Action Verbs', items: [] },
      education: { score: 0, max: 15, label: 'Education & Credentials', items: [] },
      skills: { score: 0, max: 10, label: 'Skills & Keyword Density', items: [] },
      layout: { score: 0, max: 10, label: 'ATS Layout & Parser Safety', items: [] },
    },
    criticalCount: 0,
    warningCount: 0,
    passedCount: 0,
    jobMatch: null,
    recommendations: [],
  };

  if (!resume) return results;

  const p = resume.personal || {};
  const sections = Array.isArray(resume.sections) ? resume.sections : [];
  const settings = resume.settings || {};
  // A field the user hid prints nowhere, so it scores as absent — and its item says it is hidden (R2-033).
  const shown = (key) => shownField(p, key);
  const HIDDEN_DETAIL = 'You hid it on Personal Info, so no export prints it: show it again (the eye beside the field) for parsers to read it.';
  // templateId, not the raw field: an imported file carries "Modern" or " sidebar ", and an
  // un-normalised id used to fall through to the Sidebar branch and be scored as two columns.
  const currentTemplate = templateId(resume.template);

  // ── 1. Contact Information Analysis (20 pts) ──────────────────────
  let contactPts = 0;

  // Name check (4 pts)
  const nameTrimmed = String(p.name || '').trim();
  const nameWords = nameTrimmed.split(/\s+/).filter(Boolean);
  if (nameWords.length >= 2 && !/[0-9@#$%^&*()_+=]/.test(nameTrimmed)) {
    contactPts += 4;
    results.categories.contact.items.push({
      id: 'name', status: 'pass', text: 'Full Name detected (First & Last Name)',
      detail: `Name: "${nameTrimmed}" is well-formatted for candidate identity parsing.`,
    });
  } else if (nameWords.length === 1) {
    contactPts += 2;
    results.categories.contact.items.push({
      id: 'name', status: 'warn', text: 'Incomplete name detected',
      detail: 'Provide both First and Last Name so ATS can populate candidate profile fields correctly.',
    });
  } else {
    results.categories.contact.items.push({
      id: 'name', status: 'fail', text: 'Missing or invalid candidate name',
      detail: 'A full first and last name is mandatory for all ATS candidate tracking systems.',
    });
  }

  // Email check (4 pts)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(String(shown('email') || '').trim())) {
    contactPts += 4;
    results.categories.contact.items.push({
      id: 'email', status: 'pass', text: 'Valid professional email address',
      detail: `Email "${p.email}" will parse reliably across all job portals.`,
    });
  } else if (hiddenByUser(p, 'email')) {
    results.categories.contact.items.push({
      id: 'email', status: 'fail', text: 'Email address is hidden on the résumé',
      detail: `Workday and Greenhouse require a valid email to link your application. ${HIDDEN_DETAIL}`,
    });
  } else {
    results.categories.contact.items.push({
      id: 'email', status: 'fail', text: 'Missing or invalid email address',
      detail: 'Workday and Greenhouse require a valid email to link your application.',
    });
  }

  // Phone check (4 pts)
  const phoneDigits = String(shown('phone') || '').replace(/\D/g, '');
  if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
    contactPts += 4;
    results.categories.contact.items.push({
      id: 'phone', status: 'pass', text: 'Valid phone number format',
      detail: `Phone "${p.phone}" contains sufficient digits for phone screen routing.`,
    });
  } else if (phoneDigits.length >= 7) {
    contactPts += 2;
    results.categories.contact.items.push({
      id: 'phone', status: 'warn', text: 'Short phone number format',
      detail: 'Include area code and country code for international compatibility.',
    });
  } else if (hiddenByUser(p, 'phone')) {
    results.categories.contact.items.push({
      id: 'phone', status: 'fail', text: 'Phone number is hidden on the résumé',
      detail: `Recruiters and automated scheduling systems need a reachable phone number. ${HIDDEN_DETAIL}`,
    });
  } else {
    results.categories.contact.items.push({
      id: 'phone', status: 'fail', text: 'Missing or invalid phone number',
      detail: 'Recruiters and automated scheduling systems need a reachable phone number (at least 7-10 digits).',
    });
  }

  // Location check (3 pts)
  const loc = String(shown('location') || '').trim();
  if (loc.includes(',') || loc.length >= 5) {
    contactPts += 3;
    results.categories.contact.items.push({
      id: 'location', status: 'pass', text: 'Location specified (City, State / Country)',
      detail: `Location "${loc}" allows ATS geographic proximity filtering.`,
    });
  } else if (loc.length > 0) {
    contactPts += 1.5;
    results.categories.contact.items.push({
      id: 'location', status: 'warn', text: 'Vague location format',
      detail: 'Use "City, State" (e.g. "Austin, TX") or "City, Country" for 100% Workday parsing.',
    });
  } else if (hiddenByUser(p, 'location')) {
    results.categories.contact.items.push({
      id: 'location', status: 'warn', text: 'Location is hidden on the résumé',
      detail: `Many ATS filter candidates based on location/commute radius. ${HIDDEN_DETAIL}`,
    });
  } else {
    results.categories.contact.items.push({
      id: 'location', status: 'warn', text: 'Missing location',
      detail: 'Many ATS filter candidates based on location/commute radius.',
    });
  }

  // LinkedIn / Online Profile check (2 pts)
  if (String(shown('linkedin') || '').trim()) {
    contactPts += 2;
    results.categories.contact.items.push({
      id: 'linkedin', status: 'pass', text: 'LinkedIn profile link present',
      detail: 'Workday and Lever enrich candidate records automatically using LinkedIn URLs.',
    });
  } else if (hiddenByUser(p, 'linkedin')) {
    results.categories.contact.items.push({
      id: 'linkedin', status: 'warn', text: 'LinkedIn profile is hidden on the résumé',
      detail: `Workday and Lever enrich candidate records automatically using LinkedIn URLs. ${HIDDEN_DETAIL}`,
    });
  } else {
    results.categories.contact.items.push({
      id: 'linkedin', status: 'warn', text: 'No LinkedIn profile linked',
      detail: 'Adding a LinkedIn URL increases recruiter engagement by up to 40%.',
    });
  }

  // Summary / Objective check (3 pts) — its words as they print, not its markup (R2-020)
  const summaryWords = printedText(shown('summary')).split(/\s+/).filter(Boolean);
  if (summaryWords.length >= 25 && summaryWords.length <= 150) {
    contactPts += 3;
    results.categories.contact.items.push({
      id: 'summary', status: 'pass', text: 'Optimal Professional Summary length',
      detail: `Summary contains ${summaryWords.length} words (sweet spot is 25-150 words).`,
    });
  } else if (summaryWords.length > 150) {
    contactPts += 1.5;
    results.categories.contact.items.push({
      id: 'summary', status: 'warn', text: 'Lengthy Professional Summary',
      detail: `Summary is ${summaryWords.length} words. Consider shortening to under 150 words for fast parsing.`,
    });
  } else if (summaryWords.length > 0) {
    contactPts += 1.5;
    results.categories.contact.items.push({
      id: 'summary', status: 'warn', text: 'Brief summary',
      detail: 'Expand your summary to 2-3 impactful sentences highlighting your core value.',
    });
  } else if (hiddenByUser(p, 'summary') && hasRichText(p.summary)) {
    results.categories.contact.items.push({
      id: 'summary', status: 'warn', text: 'Professional Summary is hidden on the résumé',
      detail: `A strong summary helps parsers index your seniority and primary domain immediately. ${HIDDEN_DETAIL}`,
    });
  } else {
    results.categories.contact.items.push({
      id: 'summary', status: 'warn', text: 'No Professional Summary',
      detail: 'A strong summary helps parsers index your seniority and primary domain immediately.',
    });
  }

  results.categories.contact.score = Math.min(20, Math.round(contactPts));

  // ── 2. Section Headings & ATS Taxonomy (20 pts) ───────────────────
  let headingsPts = 0;
  const visibleSections = sections.filter(s => s.visible !== false);
  const typesPresent = new Set(visibleSections.map(s => s.type));

  // Experience section present (6 pts)
  if (typesPresent.has('experience')) {
    headingsPts += 6;
    results.categories.headings.items.push({
      id: 'has_exp', status: 'pass', text: 'Work Experience section present',
      detail: 'Essential section found.',
    });
  } else {
    results.categories.headings.items.push({
      id: 'has_exp', status: 'fail', text: 'Missing Work Experience section',
      detail: 'Workday and Taleo require an experience section to calculate career progression.',
    });
  }

  // Education section present (5 pts)
  if (typesPresent.has('education')) {
    headingsPts += 5;
    results.categories.headings.items.push({
      id: 'has_edu', status: 'pass', text: 'Education section present',
      detail: 'Essential section found.',
    });
  } else {
    results.categories.headings.items.push({
      id: 'has_edu', status: 'fail', text: 'Missing Education section',
      detail: 'ATS parsers check for education credentials against job requirement thresholds.',
    });
  }

  // Skills section present (5 pts)
  if (typesPresent.has('skills')) {
    headingsPts += 5;
    results.categories.headings.items.push({
      id: 'has_skills', status: 'pass', text: 'Skills section present',
      detail: 'Dedicated skills section found.',
    });
  } else {
    results.categories.headings.items.push({
      id: 'has_skills', status: 'fail', text: 'Missing Skills section',
      detail: 'Without a skills section, keyword ranking drops dramatically in automated scoring.',
    });
  }

  // Heading naming standardization check (4 pts) — needsAtsTitle, the rule its fix also uses
  const nonStandard = sections.filter(needsAtsTitle)
    .map(s => ({ title: s.title, type: s.type, canonical: ATS_STANDARD_SECTIONS[s.type]?.canonical }));

  if (nonStandard.length === 0) {
    headingsPts += 4;
    results.categories.headings.items.push({
      id: 'std_headings', status: 'pass', text: '100% Standard ATS Headings',
      detail: 'All section titles match standard Workday and Taleo taxonomy dictionaries.',
    });
  } else {
    const listStr = nonStandard.map(n => `"${n.title}" → "${n.canonical}"`).join(', ');
    results.categories.headings.items.push({
      id: 'std_headings', status: 'warn', text: `${nonStandard.length} Non-standard heading(s) detected`,
      detail: `Custom headings can confuse older ATS: ${listStr}. Click "Standardize Headings" below to fix.`,
      fixable: true,
      action: 'standardize_headings',
    });
  }

  results.categories.headings.score = Math.min(20, Math.round(headingsPts));

  // ── 3. Work Experience & Action Verbs (25 pts) ─────────────────────
  let expPts = 0;
  const expSections = visibleSections.filter(s => s.type === 'experience');
  const allExpItems = expSections.flatMap(s => shownItems(s, currentTemplate));
  // "…" names of the sections whose Show dates is off and that print an entry: those entries print
  // no dates (R2-020). An empty one is not why a role lacks its dates.
  const datesOffTitles = (secs) => secs.filter(s => datesOff(s, currentTemplate) && shownItems(s, currentTemplate).length)
    .map(s => `"${String(s.title || '').trim() || ATS_STANDARD_SECTIONS[s.type]?.canonical}"`).join(', ');

  if (allExpItems.length === 0) {
    results.categories.experience.items.push({
      id: 'exp_empty', status: 'fail', text: 'No experience entries found',
      detail: 'Add at least one role with company, title, dates, and achievement bullets.',
    });
  } else {
    // 1. Roles have title and company (6 pts)
    const completeRoles = allExpItems.filter(i => i.role && i.company);
    if (completeRoles.length === allExpItems.length) {
      expPts += 6;
      results.categories.experience.items.push({
        id: 'role_company', status: 'pass', text: 'All roles have Job Title and Company Name',
        detail: `${allExpItems.length} position(s) properly identified.`,
      });
    } else {
      expPts += 3;
      results.categories.experience.items.push({
        id: 'role_company', status: 'warn', text: 'Some roles missing Job Title or Company',
        detail: 'Ensure every job item lists both the official job title and employer name.',
      });
    }

    // 2. Dates formatted correctly (4 pts)
    const withDates = allExpItems.filter(i => i.startDate && (i.endDate || i.current));
    if (withDates.length === allExpItems.length) {
      expPts += 4;
      results.categories.experience.items.push({
        id: 'exp_dates', status: 'pass', text: 'All roles have clear employment dates',
        detail: 'Start and end dates (or "Present") present on all jobs.',
      });
    } else {
      expPts += 2;
      const off = datesOffTitles(expSections);
      results.categories.experience.items.push({
        id: 'exp_dates', status: 'warn',
        text: off ? 'Employment dates are not printed (Show dates is off)' : 'Missing employment dates on some roles',
        detail: off
          ? `Section Options → Show dates is off on ${off}, so the PDF and Word print no dates for those roles. Parsers use employment dates to calculate total years of experience: turn Show dates on.`
          : 'Parsers use employment dates to calculate total years of experience.',
      });
    }

    // 3. Title Order check (Job Title leads Role / Co. for 100% ATS indexing) (3 pts)
    const hasCompanyLeading = expSections.some(s => leadsWithCompany(s, currentTemplate));

    if (!hasCompanyLeading) {
      expPts += 3;
      results.categories.experience.items.push({
        id: 'exp_title_order', status: 'pass', text: 'Job Title leads Experience entries (Role / Co.)',
        detail: 'Leading with Job Title ensures Workday, Taleo, and Greenhouse parse your seniority and title accurately.',
      });
    } else {
      results.categories.experience.items.push({
        id: 'exp_title_order', status: 'warn', text: 'Company Name leads Experience entries instead of Job Title',
        detail: 'Workday and Taleo parse the primary bold heading as the job title. Leading with Company causes parsers to mistake the company name for your job title.',
        fixable: true,
        action: 'set_title_order_role',
      });
    }

    // 4. Bullet points & Action Verbs analysis (12 pts)
    const allBullets = allExpItems.flatMap(i => extractBulletsFromItem(i))
      .map(b => String(b || '').trim())
      .filter(Boolean);

    if (allBullets.length === 0) {
      results.categories.experience.items.push({
        id: 'bullets_count', status: 'fail', text: 'No bullet points in experience roles',
        detail: 'Add 3-5 achievement bullet points per role to highlight responsibilities and impact.',
      });
    } else {
      if (allBullets.length < 3) {
        results.categories.experience.items.push({
          id: 'bullets_count', status: 'warn', text: 'Few bullet points across roles',
          detail: 'Aim for 3-5 bullet points per role to highlight responsibilities and wins.',
        });
      }
      let actionVerbCount = 0;
      let weakPhraseCount = 0;
      let metricCount = 0;

      for (const bullet of allBullets) {
        const lower = bullet.toLowerCase();
        // Check first word for action verb — the STAR Optimizer's own check (R2-025)
        if (leadsWithActionVerb(bullet)) {
          actionVerbCount++;
        }
        // Check for weak phrases
        for (const wp of WEAK_PHRASES) {
          if (lower.includes(wp)) {
            weakPhraseCount++;
            break;
          }
        }
        // Check for numbers / quantifiable metrics — the optimizer's rule too (R2-025)
        if (hasMetric(bullet)) {
          metricCount++;
        }
      }

      const actionVerbRatio = actionVerbCount / allBullets.length;
      if (actionVerbRatio >= 0.6) {
        expPts += 6;
        results.categories.experience.items.push({
          id: 'action_verbs', status: 'pass', text: `Strong Action Verbs (${Math.round(actionVerbRatio * 100)}% of bullets)`,
          detail: `${actionVerbCount} of ${allBullets.length} bullets begin with power action verbs.`,
        });
      } else {
        expPts += Math.round(actionVerbRatio * 6);
        results.categories.experience.items.push({
          id: 'action_verbs', status: 'warn', text: `Limited Action Verbs (${Math.round(actionVerbRatio * 100)}% of bullets)`,
          detail: 'Start each bullet point with a strong action verb (e.g., Spearheaded, Developed, Optimized).',
        });
      }

      // Quantifiable Metrics (6 pts)
      const metricRatio = metricCount / allBullets.length;
      if (metricRatio >= 0.4) {
        expPts += 6;
        results.categories.experience.items.push({
          id: 'metrics', status: 'pass', text: `Quantifiable Impact & Metrics (${Math.round(metricRatio * 100)}% of bullets)`,
          detail: `${metricCount} bullets include measurable outcomes (%, $, metrics, scale).`,
        });
      } else if (metricCount > 0) {
        expPts += 3;
        results.categories.experience.items.push({
          id: 'metrics', status: 'warn', text: 'Add more quantifiable metrics',
          detail: 'Include numbers, percentages, or dollar amounts to prove measurable business impact.',
        });
      } else {
        results.categories.experience.items.push({
          id: 'metrics', status: 'warn', text: 'No quantifiable metrics detected',
          detail: 'Recruiters and hiring managers prioritize candidates with concrete numbers (e.g. "+35% revenue", "reduced latency by 200ms").',
        });
      }

      if (weakPhraseCount > 0) {
        results.categories.experience.items.push({
          id: 'weak_phrases', status: 'warn', text: `Avoid passive language (${weakPhraseCount} instances)`,
          detail: 'Replace passive phrases like "responsible for" or "helped with" with direct action verbs.',
        });
      }
    }
  }

  results.categories.experience.score = Math.min(25, Math.round(expPts));

  // ── 4. Education & Credentials (15 pts) ───────────────────────────
  let eduPts = 0;
  const eduSections = visibleSections.filter(s => s.type === 'education');
  const allEduItems = eduSections.flatMap(s => shownItems(s, currentTemplate));

  if (allEduItems.length === 0) {
    results.categories.education.items.push({
      id: 'edu_none', status: 'fail', text: 'No education entries listed',
      detail: 'Add your degree, university/college, and graduation year.',
    });
  } else {
    // Has institution (5 pts)
    const withInst = allEduItems.filter(i => i.institution && i.institution.trim());
    if (withInst.length === allEduItems.length) {
      eduPts += 5;
      results.categories.education.items.push({
        id: 'institution', status: 'pass', text: 'Academic Institution clearly listed',
        detail: `${allEduItems.length} institution(s) identified.`,
      });
    } else {
      eduPts += 2.5;
      results.categories.education.items.push({
        id: 'institution', status: 'warn', text: 'Missing institution name on some entries',
        detail: 'Ensure the school or university name is filled in.',
      });
    }

    // Has degree / field of study (5 pts)
    const withDegree = allEduItems.filter(i => i.degree || i.fieldOfStudy);
    if (withDegree.length === allEduItems.length) {
      eduPts += 5;
      results.categories.education.items.push({
        id: 'degree', status: 'pass', text: 'Degree and Major / Field of Study present',
        detail: 'Degree qualifications clearly specified.',
      });
    } else {
      eduPts += 2.5;
      results.categories.education.items.push({
        id: 'degree', status: 'warn', text: 'Degree not specified on some entries',
        detail: 'Include degree type (e.g. B.S., M.S., B.A.) and major.',
      });
    }

    // Has graduation date (5 pts)
    const withDates = allEduItems.filter(i => i.endDate || i.startDate);
    if (withDates.length === allEduItems.length) {
      eduPts += 5;
      results.categories.education.items.push({
        id: 'edu_dates', status: 'pass', text: 'Graduation date listed',
        detail: 'Dates verify educational timeline.',
      });
    } else {
      eduPts += 2;
      const off = datesOffTitles(eduSections);
      results.categories.education.items.push({
        id: 'edu_dates', status: 'warn',
        text: off ? 'Graduation year is not printed (Show dates is off)' : 'Missing graduation year',
        detail: off
          ? `Section Options → Show dates is off on ${off}, so the PDF and Word print no year for those degrees: turn Show dates on.`
          : 'Specify the year of graduation or expected graduation.',
      });
    }
  }

  results.categories.education.score = Math.min(15, Math.round(eduPts));

  // ── 5. Skills & Keyword Density (10 pts) ──────────────────────────
  let skillsPts = 0;
  const skillSections = visibleSections.filter(s => s.type === 'skills');
  // Each group as every export reads it (skillGroup): skills stored as a list (imported data) are
  // its skills too — reading them as a string threw, and the ATS Check tab went down (R2-020).
  const allSkillItems = skillSections.flatMap(s => shownItems(s, currentTemplate)).map(skillGroup);

  // Count individual skills
  const skillsSet = new Set();
  for (const item of allSkillItems) {
    item.skills.split(/[,;\n•|]+/).map(s => s.trim()).filter(Boolean).forEach(s => skillsSet.add(s.toLowerCase()));
  }

  if (skillsSet.size >= 8) {
    skillsPts += 7;
    results.categories.skills.items.push({
      id: 'skills_count', status: 'pass', text: `Strong Skill Depth (${skillsSet.size} skills listed)`,
      detail: 'Rich skill inventory provides high keyword indexing in ATS matching algorithms.',
    });
  } else if (skillsSet.size >= 4) {
    skillsPts += 4;
    results.categories.skills.items.push({
      id: 'skills_count', status: 'warn', text: `Moderate Skill Count (${skillsSet.size} skills listed)`,
      detail: 'We recommend including at least 8-15 core competencies and technical tools.',
    });
  } else {
    results.categories.skills.items.push({
      id: 'skills_count', status: 'fail', text: 'Very few skills listed',
      detail: 'Add specific tools, languages, and methodologies relevant to your target role.',
    });
  }

  // Skills categorized (3 pts)
  const hasCategories = allSkillItems.some(i => i.category);
  if (hasCategories) {
    skillsPts += 3;
    results.categories.skills.items.push({
      id: 'skills_cat', status: 'pass', text: 'Skills grouped by category',
      detail: 'Categorized skills (e.g. "Languages", "Frameworks", "Cloud") help ATS categorize competency areas.',
    });
  } else if (skillsSet.size > 0) {
    skillsPts += 1.5;
    results.categories.skills.items.push({
      id: 'skills_cat', status: 'warn', text: 'Uncategorized skills list',
      detail: 'Group your skills into categories (e.g. Tools, Frontend, Leadership) for better readability.',
    });
  }

  results.categories.skills.score = Math.min(10, Math.round(skillsPts));

  // ── 6. ATS Layout & Parser Safety (10 pts) ────────────────────────
  let layoutPts = 0;

  // Template check (5 pts). The rating is the app's single answer (atsRating, TUI-5) — the Design
  // panel's badge reads the same one, so the two surfaces cannot say different things about a
  // template again. It is settings-aware: the Sidebar's Single · ATS-safe prints Classic's page.
  const isSidebarSingle = currentTemplate === 'sidebar' && Boolean(settings.sidebarSingleColumn);
  const rating = atsRating(currentTemplate, settings);
  // Section Options → Grids prints a section's entries side by side on any template, and those are
  // two columns whatever the template is: the text flow then earns what two columns do (R2-021).
  const sideBySide = sections.filter(s => printsSideBySide(s, currentTemplate, settings));
  layoutPts += sideBySide.length ? Math.min(rating.points, ATS_TIER_POINTS.risky) : rating.points;
  if (rating.tier === 'certified') {
    const label = isSidebarSingle ? 'SIDEBAR (SINGLE · ATS-SAFE)' : templateLabel(currentTemplate).toUpperCase();
    results.categories.layout.items.push({
      id: 'template', status: 'pass', text: `ATS-Certified Template: "${label}"`,
      detail: sideBySide.length
        ? 'The template prints one column of text, which Workday, Taleo, and Greenhouse parse in order — but not the entries printed side by side below.'
        : 'Single-column text flow ensures 100% sequential parsing on Workday, Taleo, and Greenhouse.',
    });
  } else if (rating.tier === 'good') {
    results.categories.layout.items.push({
      id: 'template', status: 'pass', text: `${templateLabel(currentTemplate)} Single-Column Layout`,
      detail: rating.note || 'Single-column body parses reliably. Ensure header contrast remains legible.',
    });
  } else {
    // Which fixes the ATS Check tab can offer, cheapest first — the checker names them by id, the
    // panel words them (TUI-3). The Layout toggle is named only where it would really make this
    // résumé safe, and that is asked of atsRating itself, with the toggle on: the same single
    // answer the tier above came from, so no second list of templates decides it (TUI-5). Today
    // only the Sidebar's two columns reach this branch and the toggle always applies, but a
    // template rated risky without one would still get an honest list.
    const singleColumnFixesIt = atsRating(currentTemplate, { ...settings, sidebarSingleColumn: true }).safe;
    const safeLabels = TEMPLATE_PICKER.filter(t => t.ats).map(t => t.label);
    results.categories.layout.items.push({
      id: 'template', status: 'warn', text: 'Multi-column / Sidebar layout detected',
      detail: [
        'While modern AI parsers handle sidebars, older Workday/Taleo systems may interleave columns.',
        // The advice is the buttons' order: the toggle keeps the résumé's design, the switch does not.
        singleColumnFixesIt && `${templateLabel(currentTemplate)}'s single-column Layout parses like the certified templates and keeps the template, its heading style and its title case.`,
        `Switching template — ${safeLabels.join(', ')} — replaces all three.`,
      ].filter(Boolean).join(' '),
      fixable: true,
      actions: [...(singleColumnFixesIt ? ['sidebar_single_column'] : []), 'switch_to_classic'],
    });
  }

  // The sections that print entries side by side, each by name, with their fix: Grids 1 on exactly
  // these (entriesInOneColumn). The template item above stays the template's own verdict, the one the
  // Design panel's badge shows (TUI-5).
  if (sideBySide.length) {
    const names = sideBySide.map(s => `"${String(s.title || '').trim() || ATS_STANDARD_SECTIONS[s.type]?.canonical || s.type}"`).join(', ');
    results.categories.layout.items.push({
      id: 'section_grids', status: 'warn', text: `Entries printed side by side: ${names}`,
      detail: 'Section Options → Grids prints these entries two or more to a row. Poppler and older Workday/Taleo parsers read a page line by line, across the row, so the entries\' lines interleave. Grids 1 prints them one under another.',
      fixable: true,
      actions: ['grids_one_column'],
    });
  }

  // Contact layout columns check (2 pts). Read the header as PdfContactRow prints it (AUD-27): only
  // Contact Details → Layout "2 Grid" sets contacts in two columns, only the templates whose header
  // takes the Layout (hasHeaderControls) print it, and a lone visible contact fills one cell. The
  // check used to read `contactCols`, which no control writes, so it passed every grid.
  const gridContacts = hasHeaderControls(currentTemplate, settings)
    && settings.contactLayout === '2grid' && contactItems(p).length > 1;
  if (!gridContacts) {
    layoutPts += 2;
    results.categories.layout.items.push({
      id: 'contact_layout', status: 'pass', text: 'Linear contact formatting',
      detail: 'Standard contact arrangement guarantees reliable phone and email extraction.',
    });
  } else {
    layoutPts += 1;
    results.categories.layout.items.push({
      id: 'contact_layout', status: 'warn', text: 'Multi-column contact header',
      detail: 'Contact Details → Layout "Single" or "Justify" is safest for primitive parsers.',
    });
  }

  // Photo check (3 pts) - US/UK ATS recommend no photo
  const photoHidden = (p.hiddenFields || []).includes('photo');
  const hasPhoto = Boolean(p.photo) && !photoHidden;
  if (!hasPhoto) {
    layoutPts += 3;
    results.categories.layout.items.push({
      id: 'photo', status: 'pass', text: 'No photo attached (ATS Standard)',
      detail: 'US, UK, and multinational ATS systems favor resumes without headshots to comply with anti-bias employment standards.',
    });
  } else {
    results.categories.layout.items.push({
      id: 'photo', status: 'warn', text: 'Profile photo included',
      detail: 'In North America and the UK, photos can cause ATS rejection due to strict EEO anti-bias compliance. Keep photo only if applying in regions where it is standard practice (e.g. parts of Europe/Asia).',
    });
  }

  results.categories.layout.score = Math.min(10, Math.round(layoutPts));

  // ── Calculate Total Score & Grade ─────────────────────────────────
  const total = results.categories.contact.score +
                results.categories.headings.score +
                results.categories.experience.score +
                results.categories.education.score +
                results.categories.skills.score +
                results.categories.layout.score;

  results.totalScore = Math.max(0, Math.min(100, total));

  if (results.totalScore >= 90) {
    results.grade = 'A+';
    results.gradeLabel = 'Workday & ATS Ready';
  } else if (results.totalScore >= 80) {
    results.grade = 'A';
    results.gradeLabel = 'Highly Compatible';
  } else if (results.totalScore >= 70) {
    results.grade = 'B';
    results.gradeLabel = 'Good - Minor Tweaks Needed';
  } else if (results.totalScore >= 55) {
    results.grade = 'C';
    results.gradeLabel = 'Fair - Needs Optimization';
  } else {
    results.grade = 'D';
    results.gradeLabel = 'Critical Parsing Issues';
  }

  // Count item statuses
  for (const cat of Object.values(results.categories)) {
    for (const item of cat.items) {
      if (item.status === 'pass') results.passedCount++;
      else if (item.status === 'warn') results.warningCount++;
      else if (item.status === 'fail') results.criticalCount++;
    }
  }

  // Job Matcher if job description provided
  if (jobDescriptionText && jobDescriptionText.trim()) {
    results.jobMatch = matchResumeWithJob(resume, jobDescriptionText);
  }

  return results;
}
