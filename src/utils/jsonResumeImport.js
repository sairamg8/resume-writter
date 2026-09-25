// A JSON Resume file (jsonresume.org) read as a résumé of the app's: its basics as the header, and
// each list the schema has as the section the app prints it in (jsonResumeSections.js).
import { newId } from './ids.js';
import { BASE_COVER_LETTER } from './defaultDataContent.js';
import { SECTION_TYPE_DEFAULTS } from './defaultDataSectionTypes.js';
import { getStarterSettings } from './starterTemplates.js';
import { DATA_VERSION } from './dataVersion.js';
import { isText, storedText } from './storedText.js';
import { entries, richFrom } from './jsonResumeText.js';
import { customItem, fileEntries, PUBLICATIONS, SECTION_KEYS } from './jsonResumeSections.js';
import { CONTACT_FIELDS } from './contacts.js';
import { templateId } from '../constants/templates.js';
import { presetOf, presetSettings } from '../constants/templatePresets.js';
import { DATE_FORMATS } from './dates.js';
import { DEFAULT_PAGE_SIZE, pageSizeOf } from '../constants/pageSize.js';

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** The title a section of `type` gets when it is added in the editor. */
const defaultTitle = (type) => (Object.hasOwn(SECTION_TYPE_DEFAULTS, type) ? SECTION_TYPE_DEFAULTS[type] : SECTION_TYPE_DEFAULTS.custom)('sec').title;

/** A section as the import builds one; `settings` only when the file carries the section's own. */
function sectionOf(type, title, items, settings) {
  return { id: newId('sec'), type, title, visible: true, ...(isRecord(settings) ? { settings } : {}), items };
}

/**
 * The file's sections. The export lists the résumé's sections in `meta.sections` (the schema's home
 * for "any other tooling configuration", which every other tool ignores): each one's type, title,
 * settings and how many of its key's entries are its own — in the résumé's order, a custom
 * section's entries with it. Read that way, a round trip brings back every section as it was:
 * two Experience sections stay two, a renamed one keeps its name, the order holds. The entries no
 * section in `meta` claims (every one, in a file another tool wrote; one added by hand) are not
 * lost: they join the last section of their type, or one of their own, in the order below.
 */
function sectionsOf(file) {
  const types = Object.keys(SECTION_KEYS);
  const pools = Object.fromEntries(types.map((type) => [type, { list: fileEntries(file, SECTION_KEYS[type].key), at: 0 }]));
  const sections = [];
  const layout = Array.isArray(file?.meta?.sections) ? entries(file.meta.sections) : [];

  for (const m of layout) {
    const type = storedText(m.type);
    const title = isText(m.title) ? storedText(m.title) : defaultTitle(type);
    // By its own key only: a type named like an Object member ('constructor') is a custom section (R2-109).
    const kind = Object.hasOwn(SECTION_KEYS, type) ? SECTION_KEYS[type] : undefined;
    if (!kind) {
      sections.push(sectionOf('custom', title, entries(m.items).map(customItem), m.settings));
      continue;
    }
    const pool = pools[type];
    const count = Number.isInteger(m.entries) && m.entries >= 0 ? m.entries : pool.list.length - pool.at;
    const run = pool.list.slice(pool.at, pool.at + count);
    pool.at += run.length;
    sections.push(sectionOf(type, title, kind.in(run), m.settings));
  }

  for (const type of types) {
    const pool = pools[type];
    addRest(sections, type, SECTION_KEYS[type].in(pool.list.slice(pool.at)));
    // Another builder's publications: a custom section of their own, after the volunteering (the schema's order).
    if (type === 'volunteering') {
      const publications = PUBLICATIONS.in(fileEntries(file, PUBLICATIONS.key));
      if (publications.length > 0) sections.push(sectionOf('custom', PUBLICATIONS.title, publications));
    }
  }
  return sections;
}

/**
 * The display label and link URL of the website, LinkedIn and GitHub the export writes beside the
 * schema's fields (R2-006); only the ones the file holds, so a header from another tool's file has
 * none.
 */
function linkFields(b) {
  const out = {};
  for (const { key } of CONTACT_FIELDS.filter((f) => f.link)) {
    for (const k of [`${key}Label`, `${key}Url`]) {
      const v = storedText(b[k]);
      if (v.trim()) out[k] = v;
    }
  }
  return out;
}

/** Entries of `type` no section in `meta` claimed: into the last section of that type, or a new one. */
function addRest(sections, type, items) {
  if (items.length === 0) return;
  const last = [...sections].reverse().find((s) => s.type === type);
  if (last) last.items.push(...items);
  else sections.push(sectionOf(type, defaultTitle(type), items));
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
    ...linkFields(b),
    summary: richFrom(b.summary, b.summaryHtml),
    photo: typeof b.image === 'string' && b.image ? b.image : null,
    hiddenFields: [],
  };

  /**
   * The template the file names, as the app writes it: the export puts it in the schema's `meta`
   * (TUI-4), and templateId reads it however another tool cased or spaced it (" Modern " is Modern,
   * R5-5). Classic when the file names none — every file written by hand or by another tool — or one
   * the app does not offer, which is what every import landed on before, including the exports of
   * Modern, Sidebar, Executive and Minimal résumés, silently.
   *
   * Its starter settings, not always Classic's: a Modern file would otherwise open with Classic's
   * ruled headings under Modern's banner. That is the whole of what the template brings here —
   * JSON Resume carries no design settings of its own, so the rest of an exported résumé's design
   * (its colours, fonts and spacing) is still not in the file to restore. The Sidebar's Layout is:
   * the export writes `meta.layout: 'single'` for Single · ATS-safe, a page of its own.
   */
  const template = templateId(jsonResume?.meta?.template);
  // The Date format the export wrote (one this build knows), over the starter's.
  const dateFormat = jsonResume?.meta?.dateFormat;
  const single = template === 'sidebar' && jsonResume?.meta?.layout === 'single';
  // The design the export names (R2-138), where it is one of this build's over that template: its look
  // over the starter's, as picking it sets it.
  const design = presetOf({ templatePreset: jsonResume?.meta?.design }, template) ? presetSettings(jsonResume.meta.design) : {};
  // The paper the export wrote (R2-136), read as the PDF reads it: a size this build does not offer,
  // or none — every file another tool wrote — is the A4 a résumé with none prints on.
  const pageSize = pageSizeOf({ pageSize: jsonResume?.meta?.pageSize });

  return {
    id,
    name: personal.name ? `${personal.name} Resume` : 'Imported Resume',
    updatedAt: Date.now(),
    dataVersion: DATA_VERSION, // built now, from a file with no app history: no migration applies
    template,
    settings: { ...getStarterSettings(template), ...design, ...(DATE_FORMATS.includes(dateFormat) ? { dateFormat } : {}), ...(single ? { sidebarSingleColumn: true } : {}), ...(pageSize !== DEFAULT_PAGE_SIZE ? { pageSize } : {}) },
    personal,
    sections: sectionsOf(jsonResume),
    coverLetter: { ...BASE_COVER_LETTER },
  };
}
