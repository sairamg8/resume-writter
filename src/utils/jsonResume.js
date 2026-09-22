import { newId } from './ids.js';
import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { getStarterSettings, STARTER_DATA_VERSION } from './starterTemplates.js';
import { isText, storedText } from './storedText.js';
import { parseMonthYear } from './dates.js';
import { parseRichText, plainTextToHtml } from './richText.js';

/**
 * Checks if a parsed JSON object matches the JSON Resume standard (jsonresume.org).
 */
export function isJsonResume(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (obj.basics && typeof obj.basics === 'object') return true;
  if (Array.isArray(obj.work) && Array.isArray(obj.education) && !Array.isArray(obj.sections)) return true;
  return false;
}

/** A list's entries that are objects: a null (or other value) in one of the file's lists is skipped. */
const entries = (list) => (Array.isArray(list) ? list.filter((v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)) : []);

/** A list's text and numbers joined with ', ' as they are, which is what the import always stored for a list of text. */
const joined = (list) => list.filter(isText).join(', ');

/**
 * A JSON Resume text value (a summary, a highlight, a course list) as the rich text the app stores:
 * escaped, a line break as <br>. It went in as it was, and the editor, the PDF and Word read it as
 * HTML: "Owned the <ingest> pipeline" printed "Owned the pipeline", "<b>cost</b>" printed bold.
 */
const richText = (v) => plainTextToHtml(storedText(v));

/**
 * A date as the import stores it: an ISO day or time as its month ('2021-03-01' → '2021-03'), and
 * anything else whole — a year, 'YYYY-MM', the month picker's "Jan 2024" (what earlier builds
 * exported) or other text. It used to keep the first 7 characters of every date: "Jan 2024" came
 * back as "Jan 202" and "September 2023" as "Septemb".
 */
function month(v) {
  const text = storedText(v).trim();
  const iso = /^(\d{4}-\d{2})-\d{2}(?:[T ].*)?$/.exec(text);
  return iso ? iso[1] : text;
}

/**
 * A stored date as JSON Resume writes one — ISO 8601: 'YYYY-MM', or 'YYYY' for a year alone —
 * whatever form the app stored it in ("Jan 2024", "05/2023", 2019; src/utils/dates.js). Text that is
 * no month and year ("Summer 2020") goes out as it is: the schema wants ISO, but nothing is dropped.
 */
function isoDate(v) {
  const d = parseMonthYear(v);
  if (!d) return storedText(v).trim();
  return d.m ? `${d.y}-${String(d.m).padStart(2, '0')}` : String(d.y);
}

/**
 * Converts a standard JSON Resume (jsonresume.org schema) to a CPWT-CV resume object. Each value
 * is stored as text (storedText): a file written by hand or by another tool can hold a number, a
 * list or an object where the schema has text. Such a value either stopped the import here or was
 * stored as it came, and the cover letter generator threw on it later.
 */
export function jsonResumeToCpwtResume(jsonResume, customId) {
  const id = customId || newId('resume');
  const b = jsonResume?.basics || {};

  // Parse location string
  let locStr = '';
  if (typeof b.location === 'string') {
    locStr = b.location;
  } else if (b.location && typeof b.location === 'object') {
    const parts = [b.location.city, b.location.region, b.location.countryCode].map(storedText).filter(Boolean);
    locStr = parts.length > 0 ? parts.join(', ') : storedText(b.location.address);
  }

  // Extract profiles
  let linkedin = '';
  let github = '';
  for (const p of entries(b.profiles)) {
    const net = storedText(p.network).toLowerCase();
    const url = storedText(p.url);
    if (!linkedin && (net.includes('linkedin') || url.includes('linkedin.com'))) linkedin = url;
    if (!github && (net.includes('github') || url.includes('github.com'))) github = url;
  }

  const personal = {
    name: storedText(b.name),
    title: storedText(b.label),
    email: storedText(b.email),
    phone: storedText(b.phone),
    location: locStr,
    website: storedText(b.url),
    linkedin,
    github,
    summary: richText(b.summary),
    photo: typeof b.image === 'string' && b.image ? b.image : null,
    hiddenFields: [],
  };

  const sections = [];

  // Work / Experience
  const work = entries(jsonResume.work);
  if (work.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'experience',
      title: 'Professional Experience',
      visible: true,
      items: work.map(w => {
        let desc = richText(w.summary);
        if (Array.isArray(w.highlights) && w.highlights.length > 0) {
          const list = w.highlights.map(h => `<li>${richText(h)}</li>`).join('');
          desc = desc ? `<p>${desc}</p><ul>${list}</ul>` : `<ul>${list}</ul>`;
        }
        const startDate = month(w.startDate);
        const endDate = month(w.endDate);
        return {
          id: newId('exp'),
          company: storedText(w.name),
          role: storedText(w.position),
          location: storedText(w.location),
          startDate,
          endDate,
          current: !endDate && Boolean(startDate),
          description: desc,
        };
      }),
    });
  }

  // Education
  const education = entries(jsonResume.education);
  if (education.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'education',
      title: 'Education',
      visible: true,
      items: education.map(ed => {
        let desc = '';
        if (Array.isArray(ed.courses) && ed.courses.length > 0) {
          desc = richText(`Relevant courses: ${joined(ed.courses)}`);
        }
        return {
          id: newId('edu'),
          institution: storedText(ed.institution),
          degree: storedText(ed.studyType),
          fieldOfStudy: storedText(ed.area),
          location: storedText(ed.location),
          startDate: month(ed.startDate),
          endDate: month(ed.endDate),
          gpa: storedText(ed.score),
          description: desc,
        };
      }),
    });
  }

  // Skills
  const skills = entries(jsonResume.skills);
  if (skills.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'skills',
      title: 'Skills',
      visible: true,
      items: skills.map(sk => ({
        id: newId('sk'),
        category: storedText(sk.name) || 'Technical Skills',
        skills: Array.isArray(sk.keywords) ? joined(sk.keywords) : storedText(sk.keywords),
      })),
    });
  }

  // Projects
  const projects = entries(jsonResume.projects);
  if (projects.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'projects',
      title: 'Projects',
      visible: true,
      items: projects.map(p => {
        let desc = richText(p.description);
        if (Array.isArray(p.highlights) && p.highlights.length > 0) {
          const list = p.highlights.map(h => `<li>${richText(h)}</li>`).join('');
          desc = desc ? `<p>${desc}</p><ul>${list}</ul>` : `<ul>${list}</ul>`;
        }
        return {
          id: newId('proj'),
          name: storedText(p.name),
          url: storedText(p.url), // the field the editor, PDF, Word and Markdown read (it was stored as `link`)
          role: Array.isArray(p.roles) ? joined(p.roles) : storedText(p.roles),
          startDate: month(p.startDate),
          endDate: month(p.endDate),
          description: desc,
        };
      }),
    });
  }

  // Certificates
  const certificates = entries(jsonResume.certificates);
  if (certificates.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'certifications',
      title: 'Certifications',
      visible: true,
      items: certificates.map(c => ({
        id: newId('cert'),
        name: storedText(c.name),
        issuer: storedText(c.issuer),
        date: month(c.date),
        url: storedText(c.url),
        description: '',
      })),
    });
  }

  // Awards
  const awards = entries(jsonResume.awards);
  if (awards.length > 0) {
    sections.push({
      id: newId('sec'),
      type: 'awards',
      title: 'Awards & Honors',
      visible: true,
      items: awards.map(a => ({
        id: newId('awd'),
        title: storedText(a.title),
        issuer: storedText(a.awarder),
        date: month(a.date),
        description: richText(a.summary),
      })),
    });
  }

  return {
    id,
    name: personal.name ? `${personal.name} Resume` : 'Imported Resume',
    updatedAt: Date.now(),
    dataVersion: STARTER_DATA_VERSION,
    template: 'classic',
    settings: getStarterSettings('classic'),
    personal,
    sections,
    coverLetter: { ...BASE_COVER_LETTER },
  };
}

/** A bullet typed as text at the start of a paragraph: "• …", "- …", "* …", "– …". */
const TYPED_BULLET = /^[•\-*–—◦▪]\s+/;

/** One block of rich text as plain text (a <br> inside it stays a line break). */
const blockText = (b) => b.runs.map((r) => r.text).join('').trim();

/**
 * An entry's rich-text description as JSON Resume holds it: `highlights`, one per list item — or
 * per paragraph typed as a bullet ("• …") — and `summary`, the other paragraphs as plain text, one
 * per line, entities decoded. Every line once: the summary used to repeat every bullet as well
 * (and was cut at 300 characters), so an export imported back printed each bullet twice.
 */
function describe(html) {
  const summary = [];
  const highlights = [];
  for (const b of parseRichText(html)) {
    const text = blockText(b);
    if (!text) continue;
    if (b.marker) highlights.push(text);
    else if (TYPED_BULLET.test(text)) highlights.push(text.replace(TYPED_BULLET, '').trim());
    else summary.push(text);
  }
  return { summary: summary.join('\n'), highlights };
}

/** Rich text (the summary, an award's description) as plain text: one line per paragraph or list item. */
const plain = (html) => parseRichText(html).map(blockText).filter(Boolean).join('\n');

/**
 * Converts a CPWT-CV resume object to official JSON Resume standard (jsonresume.org).
 */
export function cpwtResumeToJsonResume(resume) {
  if (!resume) return {};
  const p = resume.personal || {};

  const NET_LI = ['Linked', 'In'].join('');
  const NET_GH = ['Git', 'Hub'].join('');
  const profiles = [];
  if (p.linkedin) profiles.push({ network: NET_LI, url: p.linkedin });
  if (p.github) profiles.push({ network: NET_GH, url: p.github });

  const sections = Array.isArray(resume.sections) ? resume.sections : [];

  const work = [];
  const education = [];
  const skills = [];
  const projects = [];
  const certificates = [];
  const awards = [];

  for (const s of sections) {
    const items = Array.isArray(s.items) ? s.items : [];
    if (s.type === 'experience') {
      for (const item of items) {
        const { summary, highlights } = describe(item.description);
        work.push({
          name: item.company || '',
          position: item.role || '',
          location: item.location || '',
          startDate: isoDate(item.startDate),
          endDate: item.current ? '' : isoDate(item.endDate),
          summary,
          highlights,
        });
      }
    } else if (s.type === 'education') {
      for (const item of items) {
        education.push({
          institution: item.institution || '',
          area: item.fieldOfStudy || '',
          studyType: item.degree || '',
          location: item.location || '',
          startDate: isoDate(item.startDate),
          endDate: isoDate(item.endDate),
          score: item.gpa || '',
          courses: [],
        });
      }
    } else if (s.type === 'skills') {
      for (const item of items) {
        const keywords = (item.skills || item.name || '')
          .split(/[,•;]+/)
          .map(k => k.trim())
          .filter(Boolean);
        skills.push({
          name: item.category || 'Skills',
          keywords,
        });
      }
    } else if (s.type === 'projects') {
      for (const item of items) {
        const { summary, highlights } = describe(item.description);
        projects.push({
          name: item.name || '',
          description: summary,
          highlights,
          url: item.url || item.link || '', // `link`: what earlier builds' import stored
          roles: item.role ? [item.role] : [],
          startDate: isoDate(item.startDate),
          endDate: isoDate(item.endDate),
        });
      }
    } else if (s.type === 'certifications') {
      for (const item of items) {
        certificates.push({
          name: item.name || '',
          issuer: item.issuer || '',
          date: isoDate(item.date),
          url: item.url || '',
        });
      }
    } else if (s.type === 'awards') {
      for (const item of items) {
        awards.push({
          title: item.title || '',
          awarder: item.issuer || '',
          date: isoDate(item.date),
          summary: plain(item.description),
        });
      }
    }
  }

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: p.name || '',
      label: p.title || '',
      image: p.photo || '',
      email: p.email || '',
      phone: p.phone || '',
      url: p.website || '',
      summary: plain(p.summary),
      location: {
        address: p.location || '',
      },
      profiles,
    },
    work,
    education,
    skills,
    projects,
    certificates,
    awards,
  };
}
