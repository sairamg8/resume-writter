import { BLANK_PERSONAL, blankSections, BASE_COVER_LETTER } from '@/utils/defaultDataContent';
import { templateStyleDefaults } from '@/constants/templates';
import { DATA_VERSION } from '@/utils/normalizeResume';
import { DEFAULT_DATE_FORMAT } from '@/utils/dates';

// ATS-safe defaults — proper dimensions, neutral colors, standard font
export const ATS_DEFAULTS = {
  font: 'notosans',
  fontSize: 'normal',
  fontSizeBase: 11,
  fontSizeNameDelta: 8,
  fontSizeSectionDelta: 1,
  fontSizeEntryDelta: 0,
  lineHeight: 'normal',
  margins: 'normal',
  accentColor: '#374151',
  textColor: '#111111',
  headingStyle: 'ruled',
  sectionTitleCase: 'upper',
  /** Design → Date format (src/utils/dates.js): As entered prints every date as stored, as before PAR-06. */
  dateFormat: DEFAULT_DATE_FORMAT,
  sectionBorderWidth: 1,
  sectionBorderColor: '',
  headerAlign: 'left',
  headerLayout: 'stack',
  headerInlineGap: 8,
  contactStyle: 'icon',
  /** Built-in pack: filled | lucide | refined | minimal | bold. Overridden per-field by customContactIcons. */
  iconSet: 'filled',
  /** Optional per-field icon images: { email, phone, location, website, linkedin, github } as data URLs */
  customContactIcons: {},
  contactCols: 1,
  contactLayout: 'justify',
  photoShape: 'circle',
  photoSize: 'md',
  photoBorder: 'accent',
  photoHeight: 'match',
  photoTextAlign: 'center',
  showHeaderBorder: false,
  headerBorderWidth: 2,
  customFont: '',
  iconSize: 11,
  lineHeightValue: 1.5,
  sectionGap: 16,
  itemGap: 8, // px: the Normal preset's gap (R2-1)
  marginH: 18,
  marginV: 14,
  sidebarBg: '#1e293b',
  headerTextColor: '#ffffff',
  nameColor: '',
  jobTitleColor: '',
};

/**
 * The design settings Reset returns a résumé to: the ATS-safe defaults with the heading style
 * and title case its template brings (the same ones picking the template sets).
 */
export function defaultSettings(template) {
  return { ...ATS_DEFAULTS, ...templateStyleDefaults(template) };
}

/**
 * Design → Reset: `settings` back to the template's defaults, keeping the contact icons uploaded
 * under Personal Info → Fields. They are stored with the design settings but are the user's own
 * images, and Reset deleted them with no undo (R5-6). A value that is not a map of them (none in
 * older data) resets to none.
 */
export function resetDesignSettings(settings, template) {
  const icons = settings?.customContactIcons;
  const uploads = icons && typeof icons === 'object' && !Array.isArray(icons) ? { ...icons } : {};
  return { ...defaultSettings(template), customContactIcons: uploads };
}

export { SECTION_TYPE_DEFAULTS } from '@/utils/defaultDataSectionTypes';

/**
 * A fresh, empty résumé (Classic unless `template` names another), with the ATS-safe settings and
 * the heading style and title case its template brings — what picking it or Reset gives (R5-7).
 * It is current data, so it carries DATA_VERSION: no migration ever runs on what its user types.
 */
export function createBlankResume({ id, name = 'Untitled Resume', template = 'classic' } = {}) {
  return {
    id,
    name,
    updatedAt: Date.now(),
    dataVersion: DATA_VERSION,
    template,
    settings: defaultSettings(template),
    personal: { ...BLANK_PERSONAL, hiddenFields: [] },
    sections: blankSections(),
    coverLetter: { ...BASE_COVER_LETTER },
  };
}
