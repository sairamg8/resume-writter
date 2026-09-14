import { BLANK_PERSONAL, blankSections, BASE_COVER_LETTER } from '@/utils/defaultDataContent';
import { templateStyleDefaults } from '@/constants/templates';
import { DATA_VERSION } from '@/utils/normalizeResume';

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
  itemGap: 12,
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

export { SECTION_TYPE_DEFAULTS } from '@/utils/defaultDataSectionTypes';

/**
 * A fresh, empty résumé (Classic template, ATS-safe settings). It is current data, so it carries
 * DATA_VERSION: no migration ever runs on what its user types.
 */
export function createBlankResume({ id, name = 'Untitled Resume', template = 'classic' } = {}) {
  return {
    id,
    name,
    updatedAt: Date.now(),
    dataVersion: DATA_VERSION,
    template,
    settings: { ...ATS_DEFAULTS },
    personal: { ...BLANK_PERSONAL, hiddenFields: [] },
    sections: blankSections(),
    coverLetter: { ...BASE_COVER_LETTER },
  };
}
