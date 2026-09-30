// A résumé of the app's written as a JSON Resume file (jsonresume.org, schema v1.0.0): its header
// as the basics, each section's entries under the schema's key for its type (jsonResumeSections.js),
// and in `meta` what the schema has no place for, which the import reads back.
import { isText, storedText } from './storedText.js';
import { entries, flattened, isoDate } from './jsonResumeText.js';
import { customEntry, SECTION_KEYS } from './jsonResumeSections.js';
import { CONTACT_FIELDS, CONTACT_KEYS, contactHref, contactItems, displayUrl, linkOverride } from './contacts.js';
import { entryPrints } from './entryPrints.js';
import { headerTemplateId, templateId } from '../constants/templates.js';
import { ownDesign, presetOf } from '../constants/templatePresets.js';
import { DEFAULT_DATE_FORMAT, dateFormatOf } from './dates.js';
import { DEFAULT_PAGE_SIZE, pageSizeOf } from '../constants/pageSize.js';

const isRecord = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * What the résumé prints, and only that, goes in the file (R2-007): a hidden section, a hidden
 * entry and each field hidden with its eye stay out, as every other export leaves them out. The
 * file held all of them, and the import brought each one back visible — a hidden phone, job or
 * section printed again. The Backup JSON is the copy that keeps them. An entry that prints nothing
 * (entryPrints: a new section's blank entry, a job with every eye off, a language row holding only
 * its default "Professional") stays out too, as the PDF, Word, Markdown and ATS text leave it out:
 * other tools printed a lone "Professional" and an empty job. Its section keeps its place in
 * `meta.sections` with no entries, so a round trip keeps the layout, and prints nothing
 * (R5-HUNT10-JSON-RESUME-WRITES-UNPRINTED-ENTRIES).
 */
const shownItems = (type, list) => entries(list).filter((item) => entryPrints(type, item)).map(shown);

/** An entry with each field its eye hides blank — a hidden end date is no "Present" either, as the PDF prints none. */
function shown(item) {
  const { hiddenFields, ...rest } = item;
  const hidden = Array.isArray(hiddenFields) ? hiddenFields : [];
  for (const key of hidden) if (typeof key === 'string' && key in rest) rest[key] = '';
  if (hidden.includes('endDate')) rest.current = false;
  return rest;
}

/**
 * The address a shown website, LinkedIn or GitHub links to, as the schema's `url` fields take it: its
 * Link URL override when set and one the PDF follows (contactHref), else the value as typed. The file
 * wrote the typed value ('jdoe', 'My site'), a dead link in every other JSON Resume tool, while the
 * PDF, Word, Markdown and ATS text link to the override (R5-HUNT6-JSON-RESUME-IGNORES-LINK-URL-OVERRIDE).
 * A bare scheme with no host ("https://", "www.") is no address: a Display label prints over it unlinked
 * in the PDF (contactHref is null), so the file's url is '' — not "https://", a link to nothing beside
 * the label (R5-HUNT11-JSON-RESUME-BARE-SCHEME-URL-WITH-LABEL). The value as typed rides as `${key}Text`.
 */
function linkUrl(p, key) {
  const override = linkOverride(key, p);
  const href = contactHref(key, p);
  if (override && href) return override;
  return !href && !displayUrl(p[key]) ? '' : p[key];
}

/**
 * The display label and link URL of the website, LinkedIn and GitHub, the ones set on a shown
 * field, under the app's names beside the schema's (R2-006): the contact line prints the label and
 * links to the URL, and a round trip printed the bare address instead. The value as typed rides as
 * `${key}Text` when the schema's url holds the Link URL instead, or none (linkUrl), for the import to
 * put back.
 */
function linkFields(p, shows) {
  const out = {};
  for (const { key } of CONTACT_FIELDS.filter((f) => f.link && shows(f.key))) {
    for (const k of [`${key}Label`, `${key}Url`]) if (isText(p[k]) && String(p[k]).trim()) out[k] = String(p[k]);
    if (linkUrl(p, key) !== p[key]) out[`${key}Text`] = String(p[key]);
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
  // A contact goes in only when the résumé prints it (contactItems): a website, LinkedIn or GitHub
  // typed as just "https://" or "www.", or an e-mail of only spaces, prints nothing and was written as
  // a link to nothing (R5-HUNT11-JSON-RESUME-EMPTY-SCHEME-CONTACT).
  const printed = new Set(contactItems(p, [...hidden]).map(({ key }) => key));
  const shows = (key) => (CONTACT_KEYS.includes(key) ? printed.has(key) : Boolean(p[key]) && !hidden.has(key));
  const field = (key) => (shows(key) ? p[key] : '');

  const NET_LI = ['Linked', 'In'].join('');
  const NET_GH = ['Git', 'Hub'].join('');
  const profiles = [];
  // A profile with no address (a bare "https://" under a Display label) is no profile: the label and the
  // typed value ride in `basics` (linkFields), and the import reads them back.
  if (shows('linkedin') && linkUrl(p, 'linkedin')) profiles.push({ network: NET_LI, url: linkUrl(p, 'linkedin') });
  if (shows('github') && linkUrl(p, 'github')) profiles.push({ network: NET_GH, url: linkUrl(p, 'github') });
  const summary = flattened(field('summary'));

  const lists = Object.fromEntries(Object.values(SECTION_KEYS).map(({ key }) => [key, []]));

  /**
   * Every section, in the résumé's order: its type, title and own settings, and how many of its
   * type's entries in the file are its own; a custom section — the schema has no key for one — with
   * its entries. Until R2-002 a Languages, Volunteering, Interests, References or custom section was
   * not in the file at all, and a round trip retitled, reordered and merged the rest.
   */
  const layout = [];
  // A résumé As entered prints each date as it is stored — the month picker's "Jan 2020" — and the
  // file holds it as ISO "2020-01": each stored form that differs goes in `meta.enteredDates`, by its
  // ISO date, for the import to put back. Before, a round trip printed "2020-01 – 2023-03".
  const entered = {};
  const asEntered = dateFormatOf(resume.settings) === DEFAULT_DATE_FORMAT;
  for (const s of entries(resume.sections).filter((section) => section.visible !== false)) {
    const items = shownItems(s.type, s.items);
    for (const item of asEntered ? items : []) {
      // Not a current entry's kept End Date: the file writes none (R4-DUX-26).
      for (const key of ['startDate', ...(item.current ? [] : ['endDate']), 'date', 'expiry']) {
        const text = storedText(item[key]).trim();
        const iso = isoDate(item[key]);
        if (text && iso !== text && !Object.hasOwn(entered, iso)) entered[iso] = text;
      }
    }
    // By its own key only: a type named like an Object member ('constructor') is a custom section (R2-109).
    const kind = Object.hasOwn(SECTION_KEYS, s.type) ? SECTION_KEYS[s.type] : undefined;
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
      url: shows('website') ? linkUrl(p, 'website') : '',
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
    // The sections' layout rides beside it (above; read back by jsonResumeImport.js), and the Date
    // format, which changes what every date prints as: without it a résumé "As entered" came back
    // in the starter's "Jan 2024" form. So does the Sidebar's Layout "Single · ATS-safe", which
    // decides the page itself: without it the import reopened the two columns a portal may
    // interleave. Written only where it prints (headerTemplateId). And the paper (Design → Spacing →
    // Page size), which decides every page break: without it a US Letter résumé came back on A4
    // (R2-136) — written only when it is not the A4 a résumé with none prints on.
    meta: {
      template: templateId(resume.template),
      dateFormat: dateFormatOf(resume.settings),
      ...(Object.keys(entered).length ? { enteredDates: entered } : {}),
      ...(headerTemplateId(resume.template, resume.settings) !== templateId(resume.template) ? { layout: 'single' } : {}),
      // The design the résumé is on (R2-138): the import brings its look back, as picking it would.
      ...(presetOf(resume.settings, resume.template) ? { design: resume.settings.templatePreset } : {}),
      // A design the user saved (B4) is theirs, not this build's: its look rides with its id.
      ...(presetOf(resume.settings, resume.template) && ownDesign(resume.settings, resume.settings.templatePreset)
        ? { designLook: ownDesign(resume.settings, resume.settings.templatePreset) } : {}),
      ...(pageSizeOf(resume.settings) !== DEFAULT_PAGE_SIZE ? { pageSize: pageSizeOf(resume.settings) } : {}),
      sections: layout,
    },
  };
}
