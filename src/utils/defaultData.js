import { SAIRAM_PERSONAL, SAIRAM_SECTIONS, BASE_COVER_LETTER } from '@/utils/defaultDataContent';

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

export { SECTION_TYPE_DEFAULTS } from '@/utils/defaultDataSectionTypes';

export const defaultResumeData = {
  id: 'resume_default',
  name: 'Classic',
  updatedAt: Date.now(),
  template: 'classic',
  settings: { ...ATS_DEFAULTS, accentColor: '#111111', textColor: '#111111', headingStyle: 'ruled', headerAlign: 'left' },
  personal: SAIRAM_PERSONAL,
  sections: SAIRAM_SECTIONS,
  coverLetter: BASE_COVER_LETTER,
};

export const defaultResumeDataModern = {
  id: 'resume_modern',
  name: 'Modern',
  updatedAt: Date.now(),
  template: 'modern',
  settings: { ...ATS_DEFAULTS, accentColor: '#1d4ed8', textColor: '#1a1a1a', headingStyle: 'line', headerAlign: 'left', fontSizeNameDelta: 10, sectionGap: 14, itemGap: 10 },
  personal: SAIRAM_PERSONAL,
  sections: SAIRAM_SECTIONS,
  coverLetter: BASE_COVER_LETTER,
};

export const defaultResumeDataMinimal = {
  id: 'resume_minimal',
  name: 'Minimal',
  updatedAt: Date.now(),
  template: 'minimal',
  settings: { ...ATS_DEFAULTS, accentColor: '#374151', textColor: '#111827', headingStyle: 'underline', sectionGap: 18, itemGap: 10, marginH: 20, marginV: 16 },
  personal: SAIRAM_PERSONAL,
  sections: SAIRAM_SECTIONS,
  coverLetter: BASE_COVER_LETTER,
};

export const defaultResumeDataDark = {
  id: 'resume_dark',
  name: 'Dark',
  updatedAt: Date.now(),
  template: 'dark',
  settings: { ...ATS_DEFAULTS, accentColor: '#0f172a', textColor: '#1a1a1a', headingStyle: 'ruled', sidebarBg: '#0f172a', headerTextColor: '#ffffff', nameColor: '#ffffff', jobTitleColor: '#cbd5e1' },
  personal: SAIRAM_PERSONAL,
  sections: SAIRAM_SECTIONS,
  coverLetter: BASE_COVER_LETTER,
};

export const defaultResumeDataSidebar = {
  id: 'resume_sidebar',
  name: 'Sidebar',
  updatedAt: Date.now(),
  template: 'sidebar',
  settings: { ...ATS_DEFAULTS, accentColor: '#1e40af', textColor: '#1a1a1a', headingStyle: 'plain', sidebarBg: '#1e40af', headerTextColor: '#ffffff', nameColor: '#ffffff', jobTitleColor: '#bfdbfe', sectionGap: 14, itemGap: 10 },
  personal: SAIRAM_PERSONAL,
  sections: SAIRAM_SECTIONS,
  coverLetter: BASE_COVER_LETTER,
};

export const defaultResumeDataExecutive = {
  ...defaultResumeData,
  id: 'resume_executive',
  name: 'Executive',
  updatedAt: Date.now(),
  template: 'executive',
  settings: { ...ATS_DEFAULTS, accentColor: '#2563eb', textColor: '#111111', headingStyle: 'underline', sectionTitleCase: 'normal', contactStyle: 'icon', contactLayout: 'justify', fontSizeNameDelta: 9, sectionGap: 16, itemGap: 10 },
};
