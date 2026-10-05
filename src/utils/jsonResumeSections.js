// Each section type the app has, as a JSON Resume file (jsonresume.org, schema v1.0.0) holds it:
// the schema's key for its entries, and each entry both ways — `out` writes an entry of the app's
// as the schema's (one, or a list), `in` reads a run of the schema's entries back as the app's.
// Until R2-002 only six types were here: Languages, Volunteering, Interests and References were not
// in the file at all, and a file another builder wrote lost them on import. The schema's entries
// take properties of their own (additionalProperties), so a field the schema has no name for
// (a certificate's expiry, an education's description) goes out under the app's name and comes
// back. A custom section has no key in the schema: the export keeps it in `meta` (jsonResumeExport.js).
import { newId } from './ids.js';
import { SECTION_TYPE_DEFAULTS } from './defaultDataSectionTypes.js';
import { isText, storedText } from './storedText.js';
import { skillLevelOf } from './skills.js';
import { skillLevelFromText, skillLevelLabel } from '../constants/skillLevels.js';
import { described, descriptionFrom, entries, flattened, isoDate, joined, listOf, listText, month, richDescription, richFrom } from './jsonResumeText.js';

const text = (v) => storedText(v);
const lines = (parts, sep) => parts.filter(Boolean).join(sep);
const each = (fn) => (list) => list.map(fn);

/** A custom entry — title, subtitle, date, location, description — as the export keeps it in `meta`, and back. */
export function customEntry(item) {
  return { title: item.title || '', subtitle: item.subtitle || '', date: isoDate(item.date), location: item.location || '', ...described(item.description, item.bullets) };
}

export const customItem = (c) => ({
  id: newId('cust'),
  title: text(c.title),
  subtitle: text(c.subtitle),
  date: month(c.date),
  location: text(c.location),
  description: descriptionFrom(c.summary, c.highlights, c.descriptionHtml),
});

/**
 * An interest as it prints, one chip: its name, and the keywords another builder gave it in
 * brackets. " / " between keywords, not a comma: the PDF makes a chip of each comma-separated part.
 */
function interestName(e) {
  const keywords = Array.isArray(e.keywords) ? e.keywords.filter(isText).map((k) => String(k).trim()).filter(Boolean) : listOf(e.keywords);
  const name = text(e.name).trim();
  const more = keywords.join(' / ');
  return name && more ? `${name} (${more})` : name || more;
}

/**
 * The fields of a reference the app writes beyond its name — the editor's own, from its blank entry —
 * which the export keeps on the entry beside the schema's text.
 */
const REFERENCE_FIELDS = Object.keys(SECTION_TYPE_DEFAULTS.references('ref').items[0]).filter((k) => k !== 'id' && k !== 'name');

/**
 * An education's, project's or volunteering role's current flag (R2-150), out to the file and back:
 * without it a trip lost "Present" and the entry printed its start date alone. Only a flag the file
 * sets — another tool's entry with no end date stays as it was read before (no flag).
 */
const ongoing = (item) => (item?.current ? { current: true } : {});

/**
 * A skill group's levels as the file holds them (R2-147). The schema's `level` is one text for the group
 * and the app's levels are each skill's own, so `level` is the word (Beginner … Expert) when every keyword
 * has the same level, and otherwise — some differ, or only some are set — the levels ride beside it as
 * `keywordLevels` ({ "React": "Advanced" }), which the import puts back. No level set: neither is written.
 */
function levelFields(item, keywords) {
  const levels = keywords.map((k) => skillLevelOf(item.skillLevels, k));
  if (!levels.some(Boolean)) return {};
  if (levels.every((l) => l === levels[0])) return { level: skillLevelLabel(levels[0]) };
  return { keywordLevels: Object.fromEntries(keywords.flatMap((k, i) => (levels[i] ? [[k, skillLevelLabel(levels[i])]] : []))) };
}

/**
 * The `skillLevels` a file's skill group gives its skills (`skills`, the text the import stores): the
 * group's `keywordLevels` for the skills it names, and its `level` — the schema's one text, a word from
 * another tool ("Master") or a number — for every other skill of the group. A text that names no level
 * reads as none. `{}` when no skill has one, so a group without levels imports as it did.
 */
function levelsFrom(sk, skills) {
  const own = sk.keywordLevels && typeof sk.keywordLevels === 'object' && !Array.isArray(sk.keywordLevels) ? sk.keywordLevels : {};
  const group = skillLevelFromText(storedText(sk.level));
  const skillLevels = {};
  for (const name of skills.split(',').map((k) => k.trim()).filter(Boolean)) {
    const level = Object.hasOwn(own, name) ? skillLevelFromText(storedText(own[name])) : group;
    if (level) skillLevels[name] = level;
  }
  return Object.keys(skillLevels).length ? { skillLevels } : {};
}

/** The section types the schema has a key for, in the order an import with no `meta` lays them out. */
export const SECTION_KEYS = {
  experience: {
    key: 'work',
    out: (item) => ({
      name: item.company || '',
      position: item.role || '',
      location: item.location || '',
      startDate: isoDate(item.startDate),
      endDate: item.current ? '' : isoDate(item.endDate),
      current: Boolean(item.current),
      ...described(item.description, item.bullets),
    }),
    in: each((w) => {
      const startDate = month(w.startDate);
      const endDate = month(w.endDate);
      return {
        id: newId('exp'),
        company: text(w.name) || text(w.company), // `company`: the pre-1.0 schema's name for it
        role: text(w.position),
        location: text(w.location),
        startDate,
        endDate,
        // The export says whether the job is the current one (R2-006): a past job with no end date
        // came back current and printed "Present". A file with no flag — another tool's — keeps the
        // schema's convention: a job with a start and no end is the current one.
        current: typeof w.current === 'boolean' ? w.current : !endDate && Boolean(startDate),
        description: descriptionFrom(w.summary, w.highlights, w.descriptionHtml),
      };
    }),
  },
  education: {
    key: 'education',
    // The schema's education has courses, and no description: the app's goes out as a summary and highlights.
    out: (item) => ({
      institution: item.institution || '',
      area: item.fieldOfStudy || '',
      studyType: item.degree || '',
      location: item.location || '',
      startDate: isoDate(item.startDate),
      endDate: item.current ? '' : isoDate(item.endDate),
      ...ongoing(item),
      score: item.gpa || '',
      courses: [],
      ...described(item.description, item.bullets),
    }),
    in: each((ed) => ({
      id: newId('edu'),
      institution: text(ed.institution),
      degree: text(ed.studyType),
      fieldOfStudy: text(ed.area),
      location: text(ed.location),
      startDate: month(ed.startDate),
      endDate: month(ed.endDate),
      ...ongoing(ed),
      gpa: text(ed.score) || text(ed.gpa), // `gpa`: the pre-1.0 schema's name for it
      description: descriptionFrom(ed.summary, ed.highlights, ed.descriptionHtml, Array.isArray(ed.courses) && ed.courses.length > 0 ? `Relevant courses: ${joined(ed.courses)}` : ''),
    })),
  },
  skills: {
    key: 'skills',
    // A group with no category goes out with no name, and comes back with none (R2-006): it went out
    // as "Skills" and printed that label after the trip. A group of another tool's file with no
    // name at all still gets one.
    out: (item) => {
      const keywords = text(item.skills || item.name).split(/[,•;]+/).map((k) => k.trim()).filter(Boolean);
      return { name: text(item.category), ...levelFields(item, keywords), keywords };
    },
    in: each((sk) => {
      const skills = listText(sk.keywords);
      return {
        id: newId('sk'),
        category: 'name' in sk ? text(sk.name) : 'Technical Skills',
        skills,
        ...levelsFrom(sk, skills),
      };
    }),
  },
  projects: {
    key: 'projects',
    out: (item) => {
      const { summary, highlights, descriptionHtml } = described(item.description, item.bullets);
      return {
        name: item.name || '',
        description: summary,
        highlights,
        ...(descriptionHtml ? { descriptionHtml } : {}),
        keywords: listOf(item.technologies), // the schema's name for what the app calls Technologies
        url: item.url || item.link || '', // `link`: what earlier builds' import stored
        // No `roles`: a project's stored `role` (an earlier import's) prints nowhere, so it is not
        // written; the import puts a file's roles in the description (R5-HUNT11-JSON-RESUME-PROJECT-ROLE-INVISIBLE).
        startDate: isoDate(item.startDate),
        endDate: item.current ? '' : isoDate(item.endDate),
        ...ongoing(item),
      };
    },
    in: each((p) => ({
      id: newId('proj'),
      name: text(p.name),
      url: text(p.url), // the field the editor, PDF, Word and Markdown read (it was stored as `link`)
      technologies: listText(p.keywords),
      startDate: month(p.startDate),
      endDate: month(p.endDate),
      ...ongoing(p),
      // The roles as the description's last paragraph, as a degree's courses: a project has no Role
      // box and no export prints one, so a stored `role` was lost to the user while the Job Match
      // still counted it (R5-HUNT11-JSON-RESUME-PROJECT-ROLE-INVISIBLE).
      description: descriptionFrom(p.description, p.highlights, p.descriptionHtml, listText(p.roles).trim() ? `Role: ${listText(p.roles).trim()}` : ''),
    })),
  },
  certifications: {
    key: 'certificates',
    out: (item) => ({
      name: item.name || '',
      issuer: item.issuer || '',
      date: isoDate(item.date),
      url: item.url || '',
      expiry: isoDate(item.expiry),
      credentialId: item.credentialId || '',
      urlLabel: item.urlLabel || '',
    }),
    in: each((c) => ({
      id: newId('cert'),
      name: text(c.name),
      issuer: text(c.issuer),
      date: month(c.date),
      expiry: month(c.expiry),
      credentialId: text(c.credentialId),
      url: text(c.url),
      urlLabel: text(c.urlLabel),
      description: '',
    })),
  },
  awards: {
    key: 'awards',
    // The schema's award has one summary text: every line of the description goes in it, so any tool
    // prints them all — and, when that text alone would print differently (a list, bold), the
    // description itself beside it, which the import reads back (R2-006: a list came back as lines).
    out: (item) => {
      const { text: summary, html } = flattened(item.description);
      return { title: item.title || '', awarder: item.issuer || '', date: isoDate(item.date), summary, ...(html ? { summaryHtml: html } : {}) };
    },
    in: each((a) => ({
      id: newId('awd'),
      title: text(a.title),
      issuer: text(a.awarder),
      date: month(a.date),
      description: richFrom(a.summary, a.summaryHtml),
    })),
  },
  volunteering: {
    key: 'volunteer',
    out: (item) => ({
      organization: item.org || '',
      position: item.role || '',
      location: item.location || '',
      startDate: isoDate(item.startDate),
      endDate: item.current ? '' : isoDate(item.endDate),
      ...ongoing(item),
      ...described(item.description, item.bullets),
    }),
    in: each((v) => ({
      id: newId('vol'),
      org: text(v.organization),
      role: text(v.position),
      location: text(v.location),
      startDate: month(v.startDate),
      endDate: month(v.endDate),
      ...ongoing(v),
      description: descriptionFrom(v.summary, v.highlights, v.descriptionHtml),
    })),
  },
  languages: {
    key: 'languages',
    out: (item) => ({ language: item.language || '', fluency: item.proficiency || '' }),
    in: each((l) => ({ id: newId('lang'), language: text(l.language), proficiency: text(l.fluency) })),
  },
  interests: {
    key: 'interests',
    // One interest per chip the PDF prints; a section's come back as one entry, which prints the same chips.
    out: (item) => listOf(item.interests).map((name) => ({ name, keywords: [] })),
    in: (list) => {
      const names = list.map(interestName).filter(Boolean);
      return names.length ? [{ id: newId('int'), interests: names.join(', ') }] : [];
    },
  },
  references: {
    key: 'references',
    // The schema's reference is a name and a text: the text is what the PDF prints under the name,
    // for any tool; the fields themselves ride beside it and come back as they were.
    out: (item) => ({
      name: item.name || '',
      reference: [lines([item.jobTitle, item.company], ', '), item.relationship, lines([item.email, item.phone], ' | ')].filter(Boolean).join('\n'),
      ...Object.fromEntries(REFERENCE_FIELDS.map((k) => [k, item[k] || ''])),
    }),
    // Another builder's reference is a name and a quote: the quote prints under the name, in Relationship.
    in: each((r) => {
      const own = REFERENCE_FIELDS.some((k) => k in r);
      return {
        id: newId('ref'),
        name: text(r.name),
        ...Object.fromEntries(REFERENCE_FIELDS.map((k) => [k, own ? text(r[k]) : ''])),
        ...(own ? {} : { relationship: text(r.reference) }),
      };
    }),
  },
};

/** A section of another builder's file the app has no type for, read as a custom section of its own. */
export const PUBLICATIONS = {
  key: 'publications',
  title: 'Publications',
  in: each((p) => ({
    id: newId('pub'),
    title: text(p.name),
    subtitle: text(p.publisher),
    date: month(p.releaseDate),
    location: '',
    description: richDescription(p.summary, [], text(p.url) || text(p.website)), // `website`: the pre-1.0 schema's
  })),
};

/** The file's entries under `key`, each an object. */
export const fileEntries = (file, key) => entries(file?.[key]);
