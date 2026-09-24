// A résumé of the app's written as a JSON Resume file (jsonresume.org, schema v1.0.0): its header
// as the basics, each section's entries under the schema's key for its type (jsonResumeSections.js),
// and in `meta` what the schema has no place for, which the import reads back.
import { isText, storedText } from './storedText.js';
import { entries, flattened } from './jsonResumeText.js';
import { customEntry, SECTION_KEYS } from './jsonResumeSections.js';
import { CONTACT_FIELDS } from './contacts.js';
import { templateId } from '../constants/templates.js';

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * What the résumé prints, and only that, goes in the file (R2-007): a hidden section, a hidden
 * entry and each field hidden with its eye stay out, as every other export leaves them out. The
 * file held all of them, and the import brought each one back visible — a hidden phone, job or
 * section printed again. The Backup JSON is the copy that keeps them.
 */
const shownItems = (list) => entries(list).filter((item) => item.visible !== false).map(shown);

/** An entry with each field its eye hides blank — a hidden end date is no "Present" either, as the PDF prints none. */
function shown(item) {
  const { hiddenFields, ...rest } = item;
  const hidden = Array.isArray(hiddenFields) ? hiddenFields : [];
  for (const key of hidden) if (typeof key === 'string' && key in rest) rest[key] = '';
  if (hidden.includes('endDate')) rest.current = false;
  return rest;
}

/**
 * The display label and link URL of the website, LinkedIn and GitHub, the ones set on a shown
 * field, under the app's names beside the schema's (R2-006): the contact line prints the label and
 * links to the URL, and a round trip printed the bare address instead.
 */
function linkFields(p, shows) {
  const out = {};
  for (const { key } of CONTACT_FIELDS.filter((f) => f.link && shows(f.key))) {
    for (const k of [`${key}Label`, `${key}Url`]) if (isText(p[k]) && String(p[k]).trim()) out[k] = String(p[k]);
  }
  return out;
}

/**
 * Converts a CPWT-CV resume object to official JSON Resume standard (jsonresume.org).
 */
export function cpwtResumeToJsonResume(resume) {
  if (!resume) return {};
  const p = resume.personal || {};
  const hidden = new Set(Array.isArray(p.hiddenFields) ? p.hiddenFields : []);
  const shows = (key) => Boolean(p[key]) && !hidden.has(key);
  const field = (key) => (shows(key) ? p[key] : '');

  const NET_LI = ['Linked', 'In'].join('');
  const NET_GH = ['Git', 'Hub'].join('');
  const profiles = [];
  if (shows('linkedin')) profiles.push({ network: NET_LI, url: p.linkedin });
  if (shows('github')) profiles.push({ network: NET_GH, url: p.github });
  const summary = flattened(field('summary'));

  const lists = Object.fromEntries(Object.values(SECTION_KEYS).map(({ key }) => [key, []]));

  /**
   * Every section, in the résumé's order: its type, title and own settings, and how many of its
   * type's entries in the file are its own; a custom section — the schema has no key for one — with
   * its entries. Until R2-002 a Languages, Volunteering, Interests, References or custom section was
   * not in the file at all, and a round trip retitled, reordered and merged the rest.
   */
  const layout = [];
  for (const s of entries(resume.sections).filter((section) => section.visible !== false)) {
    const items = shownItems(s.items);
    const kind = SECTION_KEYS[s.type];
    const own = { type: kind ? s.type : 'custom', title: storedText(s.title), ...(isRecord(s.settings) ? { settings: s.settings } : {}) };
    if (kind) {
      const out = items.flatMap((item) => kind.out(item));
      lists[kind.key].push(...out);
      layout.push({ ...own, entries: out.length });
    } else {
      layout.push({ ...own, items: items.map(customEntry) });
    }
  }

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: p.name || '',
      label: p.title || '',
      image: field('photo'),
      email: field('email'),
      phone: field('phone'),
      url: field('website'),
      // Plain text for every tool; the summary itself beside it when that alone would print
      // differently — a list, a second paragraph, bold (R2-006: a list came back as lines).
      summary: summary.text,
      ...(summary.html ? { summaryHtml: summary.html } : {}),
      location: {
        address: field('location'),
      },
      profiles,
      ...linkFields(p, shows),
    },
    ...lists,
    // The template the résumé prints with, in `meta` — the schema's own home for "any other tooling
    // configuration", so the file stays valid JSON Resume and every other tool ignores it. The import
    // reads it back (TUI-4): until it was written, an exported Modern, Sidebar, Executive or Minimal
    // résumé came back Classic. templateId: what the PDF actually drew, so a résumé holding an id the
    // app no longer offers exports as the Classic it was printing as, not as that dead id.
    // The sections' layout rides beside it (above; read back by jsonResumeImport.js).
    meta: { template: templateId(resume.template), sections: layout },
  };
}
