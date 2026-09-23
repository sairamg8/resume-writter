// A résumé of the app's written as a JSON Resume file (jsonresume.org, schema v1.0.0): its header
// as the basics, each section's entries under the schema's key for its type (jsonResumeSections.js),
// and in `meta` what the schema has no place for, which the import reads back.
import { storedText } from './storedText.js';
import { entries, plain } from './jsonResumeText.js';
import { customEntry, SECTION_KEYS } from './jsonResumeSections.js';
import { templateId } from '../constants/templates.js';

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

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

  const lists = Object.fromEntries(Object.values(SECTION_KEYS).map(({ key }) => [key, []]));

  /**
   * Every section, in the résumé's order: its type, title and own settings, and how many of its
   * type's entries in the file are its own; a custom section — the schema has no key for one — with
   * its entries. Until R2-002 a Languages, Volunteering, Interests, References or custom section was
   * not in the file at all, and a round trip retitled, reordered and merged the rest.
   */
  const layout = [];
  for (const s of Array.isArray(resume.sections) ? entries(resume.sections) : []) {
    const items = entries(s.items);
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
