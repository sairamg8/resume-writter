import { StyleSheet } from '@react-pdf/renderer';

export const DEFAULTS = {
  classic: {
    accentColor: '#2563eb',
    textColor: '#1a1a1a',
    nameColor: (s) => s.textColor || '#1a1a1a',
    jobTitleColor: (s) => s.accentColor || '#2563eb',
    headingStyle: 'line',
    sectionTitleCase: 'upper',
  },
  modern: {
    accentColor: '#2563eb',
    textColor: '#1f2937',
    nameColor: (s) => s.nameColor || s.headerTextColor || '#ffffff',
    jobTitleColor: (s) => s.jobTitleColor || s.headerTextColor || '#ffffff',
    headingStyle: 'line',
    sectionTitleCase: 'upper',
  },
  minimal: {
    accentColor: '#2563eb',
    textColor: '#111111',
    nameColor: (s) => s.textColor || '#111111',
    jobTitleColor: () => '#555555',
    headingStyle: 'underline',
    sectionTitleCase: 'upper',
  },
  executive: {
    accentColor: '#2563eb',
    textColor: '#111111',
    nameColor: (s) => s.textColor || '#111111',
    jobTitleColor: (s) => s.accentColor || '#2563eb',
    headingStyle: 'underline',
    sectionTitleCase: 'normal',
  },
  sidebar: {
    accentColor: '#2563eb',
    textColor: '#1e2937',
    nameColor: (s) => s.nameColor || s.headerTextColor || '#ffffff',
    jobTitleColor: (s) => s.jobTitleColor || s.accentColor || '#2563eb',
    headingStyle: 'plain',
    sectionTitleCase: 'upper',
    sidebarBg: '#1e293b',
  },
};

export function resolveTemplateSettings(settings = {}, templateKey) {
  const tConfig = DEFAULTS[templateKey] || DEFAULTS.classic;
  const s = { ...settings };

  // Resolve base colors
  s.accentColor       = settings.accentColor       || tConfig.accentColor;
  s.textColor         = settings.textColor         || tConfig.textColor;
  s.headingStyle      = settings.headingStyle      || tConfig.headingStyle;
  s.sectionTitleCase  = settings.sectionTitleCase  || tConfig.sectionTitleCase;

  // Resolve dependent template-specific colors
  s.nameColor         = settings.nameColor         || (typeof tConfig.nameColor === 'function' ? tConfig.nameColor(s) : tConfig.nameColor);
  s.jobTitleColor     = settings.jobTitleColor     || (typeof tConfig.jobTitleColor === 'function' ? tConfig.jobTitleColor(s) : tConfig.jobTitleColor);

  if (templateKey === 'sidebar') {
    s.sidebarBg       = settings.sidebarBg       || tConfig.sidebarBg;
  }

  // Common font/spacing configurations
  s.fontSizeBase      = settings.fontSizeBase      || 11;
  s.lineHeightValue   = settings.lineHeightValue   || 1.5;
  s.marginV           = settings.marginV           || 14;
  s.marginH           = settings.marginH           || 18;
  s.sectionGap        = (settings.sectionGap       ?? 16) * 0.75;
  s.itemGap           = (settings.itemGap          ?? 12) * 0.75;

  return s;
}

export function getPageStyle(settings) {
  return StyleSheet.create({
    page: {
      fontFamily:      settings._pdfFontFamily || 'NotoSans',
      paddingTop:      `${settings.marginV}mm`,
      paddingBottom:   `${settings.marginV}mm`,
      paddingLeft:     `${settings.marginH}mm`,
      paddingRight:    `${settings.marginH}mm`,
      fontSize:        settings.fontSizeBase,
      lineHeight:      settings.lineHeightValue,
      color:           settings.textColor,
      backgroundColor: 'white',
    }
  }).page;
}
