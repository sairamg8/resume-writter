// The parity matrix's résumé and store: the résumé every control is tried on (every section type, a
// photo, every contact field, a long description), and the store's own actions applied to it — the
// writes the walker records are replayed exactly as the editor's store applies them
// (src/hooks/useResumeStore.js, useResumeSectionActions.js), so a render is what the preview shows
// after that click.
import { loadModule, resume, section } from '../harness.mjs';
import { inSidebarColumn } from '../../../src/constants/templates.js';
import { sectionsOnSwitch } from '../../../src/templates/pdf/shared/templateSectionDefaults.js';
import { PNG_2X2 } from '../extractors.mjs';

export const PERSONAL = {
  name: 'Jordan Rivera', title: 'Principal Platform Engineer', email: 'jordan@example.com', phone: '+1 555 0100',
  location: 'Lisbon, Portugal', website: 'jordan.dev', linkedin: 'linkedin.com/in/jordanr', github: 'github.com/jordanr',
  summary: '<p>Platform engineer who ships reliable systems and grows the people around them.</p>',
  photo: PNG_2X2,
};

/**
 * Two entries per section type (a Grids choice has something to lay side by side), each with text the
 * matrix finds again (MARKS), one paragraph long enough to wrap on every template (Line Height), and one
 * date typed as text ("Sep 2013", as an import brings it) — with only the picker's MM/YYYY, "As entered"
 * and MM/YYYY would print the same.
 */
export const SECTION_ITEMS = {
  experience: [
    { company: 'Northwind Labs', role: 'Staff Engineer', location: 'Lisbon', startDate: '01/2021', endDate: '', current: true,
      description: '<p>Led the <strong>billing platform</strong> rewrite across four teams and <em>cut</em> incidents by <u>half</u>.</p><ul><li>Designed the event ledger</li><li>Mentored six engineers</li></ul>' },
    // A second role at the first job's company, right under it: Group roles by company (R2-147) has two
    // roles to print under one employer.
    { company: 'Northwind Labs', role: 'Lead Engineer', location: 'Lisbon', startDate: '06/2019', endDate: '12/2020',
      description: '<p>Moved the payment jobs onto one shared scheduler.</p>' },
    { company: 'Contoso Retail', role: 'Senior Engineer', location: 'Braga', startDate: '03/2017', endDate: '12/2020',
      description: '<p>Built the checkout service that handled every order for three years, moved it from a nightly batch to streaming events, wrote the runbooks the on-call rota still uses, and trained the support team to read its dashboards without an engineer on the line.</p>' },
  ],
  education: [
    { institution: 'University of Coimbra', degree: 'MSc Computer Science', location: 'Coimbra', startDate: 'Sep 2013', endDate: '06/2015', description: '<p>Thesis on distributed consensus.</p>' },
    { institution: 'Porto Polytechnic', degree: 'BSc Informatics', location: 'Faro', startDate: '09/2010', endDate: '06/2013', description: '' },
  ],
  // A third skill group, certification and award: Compact lays them out two to a row (T9), and a row gap
  // needs a second row to space.
  skills: [{ category: 'Coding', skills: 'TypeScript, Go, SQL' }, { category: 'Platforms', skills: 'Kubernetes, Postgres, Kafka' }, { category: 'Tooling', skills: 'Bazel, Terraform' }],
  projects: [
    { name: 'Ledgerline', url: 'github.com/jordanr/ledgerline', technologies: 'Go', startDate: '02/2022', endDate: '08/2022', description: '<p>An open-source double-entry ledger.</p>' },
    { name: 'Queuebird', url: '', technologies: 'Rust', startDate: '01/2020', endDate: '06/2020', description: '<p>A tiny durable queue.</p>' },
  ],
  languages: [{ language: 'Portuguese', proficiency: 'Native' }, { language: 'English', proficiency: 'Fluent' }, { language: 'Spanish', proficiency: 'Conversational' }],
  certifications: [
    { name: 'Certified Kubernetes Administrator', issuer: 'CNCF', date: '05/2023' },
    { name: 'AWS Solutions Architect', issuer: 'Amazon', date: '02/2021' },
    { name: 'Google Cloud Architect', issuer: 'Google', date: '07/2019' },
  ],
  awards: [
    { title: 'Engineering Excellence Award', issuer: 'Northwind Labs', date: '11/2022', description: '<p>For the ledger migration.</p>' },
    { title: 'Hackathon Winner', issuer: 'Web Summit', date: '11/2018', description: '' },
    { title: 'Open Source Grant', issuer: 'Sovereign Tech Fund', date: '03/2017', description: '' },
  ],
  volunteering: [
    { org: 'Code for Lisbon', role: 'Mentor', location: 'Lisbon', startDate: '01/2019', endDate: '', current: true, description: '<p>Weekly mentoring sessions.</p>' },
    { org: 'Food Bank Porto', role: 'Driver', location: 'Aveiro', startDate: '01/2016', endDate: '12/2017', description: '' },
  ],
  references: [
    { name: 'Morgan Blake', jobTitle: 'VP Engineering', company: 'Northwind Labs', relationship: 'Manager', email: 'morgan@example.com' },
    { name: 'Riley Chen', jobTitle: 'CTO', company: 'Contoso Retail', relationship: 'Former manager', email: '' },
    { name: 'Sam Okafor', jobTitle: 'Staff PM', company: 'Northwind Labs', relationship: 'Peer', email: '' },
  ],
  interests: [{ interests: 'Trail running, Film photography' }, { interests: 'Chess' }],
  custom: [
    { title: 'Open Source Talk', subtitle: 'FOSDEM', location: 'Brussels', date: '02/2024', description: '<p>Spoke on ledger design.</p>' },
    { title: 'Meetup Host', subtitle: 'Lisbon Go', location: 'Sintra', date: '03/2019', description: '' },
  ],
};
/** Text every render must still print, whatever a control does (dates and locations are a control's to hide), by where it prints. */
const MARKS_BY = {
  header: ['Jordan Rivera', 'Principal Platform Engineer', 'jordan@example.com', 'Platform engineer who ships'],
  experience: ['Northwind Labs', 'Staff Engineer', 'Lead Engineer', 'billing platform', 'Designed the event ledger', 'Mentored six engineers', 'Contoso Retail', 'without an engineer on the line'],
  education: ['University of Coimbra', 'Porto Polytechnic'],
  skills: ['TypeScript', 'Kubernetes'],
  projects: ['Ledgerline', 'Queuebird'],
  languages: ['Portuguese', 'Spanish'],
  certifications: ['Certified Kubernetes Administrator', 'AWS Solutions Architect'],
  awards: ['Engineering Excellence Award', 'Hackathon Winner'],
  volunteering: ['Code for Lisbon', 'Food Bank Porto'],
  references: ['Morgan Blake', 'Riley Chen'],
  interests: ['Trail running', 'Chess'],
  custom: ['Open Source Talk', 'Meetup Host'],
};
/** The marks `r` must print: the header's and each of its sections'. */
export const marksOf = (r) => [...MARKS_BY.header, ...r.sections.flatMap((sec) => MARKS_BY[sec.type] || [])];
export const SECTION_TYPES = Object.keys(SECTION_ITEMS);

/**
 * Per section type: its first and second entries' marks, the first entry's date and its own location (one
 * no other entry prints); `cells`: the marks that open each entry's cell in a grid (a skill wraps under
 * its category in a narrow one); `seq`: every entry's mark in order, where two share a row (a grid of
 * two by default — Languages and References, and Awards on Compact, T9) or a line (Interests' chips).
 * Experience: `second` is its first job at another company (the entry after the next); its first two
 * entries, a grid's first row, are two roles at one company, told apart by their roles (`cells`), whose
 * second is `grouped` (Group roles by company, R2-147).
 */
export const TYPE_MARKS = {
  experience: { first: 'Northwind Labs', second: 'Contoso Retail', date: '01/2021', location: 'Braga', title: 'Staff Engineer', cells: ['Staff', 'Lead'], grouped: 'Lead Engineer' },
  education: { first: 'University of Coimbra', second: 'Porto Polytechnic', date: 'Sep 2013', location: 'Faro', title: 'MSc Computer Science' },
  skills: { first: 'TypeScript', second: 'Kubernetes', label: 'Coding', cells: ['Coding', 'Platforms'], seq: ['Coding', 'Platforms', 'Tooling'] },
  projects: { first: 'Ledgerline', second: 'Queuebird', date: '02/2022' },
  languages: { first: 'Portuguese', second: 'English', seq: ['Portuguese', 'English', 'Spanish'] },
  certifications: { first: 'Certified Kubernetes', second: 'AWS Solutions Architect', date: '05/2023', seq: ['Certified Kubernetes', 'AWS Solutions Architect', 'Google Cloud Architect'] },
  awards: { first: 'Engineering Excellence Award', second: 'Hackathon Winner', date: '11/2022', seq: ['Engineering Excellence Award', 'Hackathon Winner', 'Open Source Grant'] },
  volunteering: { first: 'Code for Lisbon', second: 'Food Bank Porto', date: '01/2019', location: 'Aveiro', title: 'Mentor' },
  references: { first: 'Morgan Blake', second: 'Riley Chen', seq: ['Morgan Blake', 'Riley Chen', 'Sam Okafor'] },
  interests: { first: 'Trail running', second: 'Chess', seq: ['Trail running', 'Film photography', 'Chess'] },
  custom: { first: 'Open Source Talk', second: 'Meetup Host', date: '02/2024', title: 'FOSDEM' },
};

/** The sections a Design or Personal Info control is tried with: the body kinds every template prints, both columns of the Sidebar. */
export const COMPACT_TYPES = ['experience', 'education', 'skills', 'languages'];

/**
 * The résumé every control is tried on: `template`, `settings` over its defaults, and every section
 * type — or, `compact`, COMPACT_TYPES (one page: half the render time, for controls that style the whole page).
 */
export function baseResume(template, settings = {}, { compact = false, types: only = null } = {}) {
  const types = only || (compact ? COMPACT_TYPES : SECTION_TYPES);
  const r = resume({
    template,
    personal: PERSONAL,
    sections: types.map((type) => section(type, SECTION_ITEMS[type])),
  });
  // Stable ids: an action's section write names its section by type. Each section as the app creates it
  // on `template` — in its own Grids where it has one (Compact's grid, T9: newSectionGrid), as a résumé
  // started there prints and a switch to it leaves (sectionsOnSwitch).
  r.sections = sectionsOnSwitch(r.sections.map((s) => ({ ...s, id: `sec_${s.type}` })), null, template);
  r.settings = { ...r.settings, ...settings };
  return r;
}

/**
 * A section's options are tried on a page of three: another section of its column, the section, and a
 * third after it — so Space before and Space after always have a neighbour to move, and the page renders
 * in a third of the time of all eleven.
 */
export function aroundTypes(template, settings, type) {
  const col = (t) => inSidebarColumn(template, t, settings);
  const others = SECTION_TYPES.filter((t) => t !== type && col(t) === col(type));
  return [others[0], type, others[1]].filter(Boolean);
}

let helpers = null;
export async function loadStore() {
  if (helpers) return helpers;
  const [colors, templates, data, sectionActions, sectionDefaults, templateSwitch, presets] = await Promise.all([
    loadModule('/src/templates/pdf/shared/headerColors.js'),
    loadModule('/src/constants/templates.js'),
    loadModule('/src/utils/defaultData.js'),
    loadModule('/src/hooks/useResumeSectionActions.js'),
    loadModule('/src/templates/pdf/shared/templateSectionDefaults.js'),
    loadModule('/src/utils/templateSwitch.js'),
    loadModule('/src/constants/templatePresets.js'),
  ]);
  helpers = { colors, templates, data, sectionActions, sectionDefaults, templateSwitch, presets };
  return helpers;
}

/**
 * `r` after `writes`, as the store applies them. `sectionId`: the section a Section Options write
 * belongs to. Needs loadStore() first.
 */
export function applyWrites(r, writes, sectionId = null) {
  const { colors, data, sectionActions, sectionDefaults } = helpers;
  let out = r;
  const patchActive = (fn) => { out = fn(out); };
  const sections = sectionActions.createSectionActions(patchActive);
  for (const w of writes) {
    if (w.kind === 'setting') {
      const settings = { ...out.settings, [w.key]: w.value };
      out = { ...out, settings: w.key === 'sidebarSingleColumn' ? colors.withHeaderColorsBack(settings, out.template, { below: colors.HEADER_READS }) : settings };
    } else if (w.kind === 'section') {
      sections.updateSectionSettings(w.sectionId ?? sectionId, w.key, w.value);
    } else if (w.kind === 'hide') {
      const hidden = out.personal.hiddenFields || [];
      out = { ...out, personal: { ...out.personal, hiddenFields: hidden.includes(w.key) ? hidden.filter((f) => f !== w.key) : [...hidden, w.key] } };
    } else if (w.kind === 'clear') {
      const settings = { ...out.settings };
      for (const k of w.keys) delete settings[k];
      out = { ...out, settings };
    } else if (w.kind === 'template') {
      // As useResumeStore.setTemplate: the style the template brings, and what the old one brought leaving with it (T8);
      // a section's Grids its template's own where it kept the one it was created with (Compact's grid, T9).
      out = {
        ...out, template: w.value, settings: colors.headerColorsOnSwitch(data.styleOnSwitch(out.settings, out.template, w.value), out.template, w.value),
        sections: sectionDefaults.sectionsOnSwitch(out.sections, out.template, w.value),
      };
    } else if (w.kind === 'preset') {
      // As useResumeStore.setTemplate(engine, preset): the design's engine and its whole look (withTemplate).
      out = helpers.templateSwitch.withTemplate(out, helpers.presets.TEMPLATE_PRESETS[w.value].engine, w.value);
    } else if (w.kind === 'resetAll') {
      out = { ...out, settings: data.settingsAfterReset(out) };
    } else if (w.kind === 'personal') {
      out = { ...out, personal: { ...out.personal, [w.key]: w.value } };
    } else {
      throw new Error(`unknown write kind ${w.kind}`);
    }
  }
  return out;
}
