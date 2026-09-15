// The PDF's per-template fallbacks and the settings every PDF renders with. Plain data and
// functions (no react-pdf): the templates, the cover letter and its Word export all read the
// résumé's colours through here, so the letter's Word file prints what its PDF prints (FIDB-51).
import { headerBorderOn } from '@/constants/templates';
import { readableOn } from './pdfColors';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX, DEFAULT_SECTION_GAP_PX } from './pdfUnits';

/**
 * Per-template fallbacks used only when the user has NOT set a value. Not part of TEMPLATES in
 * src/constants/templates.js: colours computed from other settings belong to the PDF, and an
 * unset Classic heading prints 'line', not the 'ruled' that picking Classic stores (R3-6).
 */
export const DEFAULTS = {
  classic: {
    accentColor: '#2563eb',
    textColor: '#1a1a1a',
    nameColor: (s) => s.nameColor || s.textColor || '#1a1a1a',
    jobTitleColor: (s) => s.jobTitleColor || s.accentColor || '#2563eb',
    headingStyle: 'line',
    sectionTitleCase: 'upper',
  },
  modern: {
    accentColor: '#2563eb',
    textColor: '#1f2937',
    // The header text colour (white by default) where it reads on the Sidebar Background; on a
    // light background, the least-darkened tint of it that does. A picked name colour wins (R2-2).
    nameColor: (s) => s.nameColor
      || readableOn(s.headerTextColor || '#ffffff', s.sidebarBg || DEFAULTS.sidebar.sidebarBg),
    jobTitleColor: (s) => s.jobTitleColor || s.headerTextColor || '#ffffff',
    headingStyle: 'line',
    sectionTitleCase: 'upper',
  },
  minimal: {
    accentColor: '#2563eb',
    textColor: '#111111',
    nameColor: (s) => s.nameColor || s.textColor || '#111111',
    jobTitleColor: (s) => s.jobTitleColor || '#555555',
    headingStyle: 'underline',
    sectionTitleCase: 'upper',
  },
  executive: {
    accentColor: '#2563eb',
    textColor: '#111111',
    nameColor: (s) => s.nameColor || s.textColor || '#111111',
    jobTitleColor: (s) => s.jobTitleColor || s.accentColor || '#2563eb',
    headingStyle: 'underline',
    sectionTitleCase: 'normal',
  },
  sidebar: {
    accentColor: '#2563eb',
    textColor: '#1e2937',
    // The header text colour (white by default) where it reads on the Sidebar Background; on a
    // light background, the least-darkened tint of it that does. A picked name colour wins (R2-2).
    nameColor: (s) => s.nameColor
      || readableOn(s.headerTextColor || '#ffffff', s.sidebarBg || DEFAULTS.sidebar.sidebarBg),
    // The accent on the dark sidebar only where it reads there; a dark accent (the default
    // #374151, or #111111) gets a light tint of itself instead (FIDB-42).
    jobTitleColor: (s) => s.jobTitleColor
      || readableOn(s.accentColor || '#2563eb', s.sidebarBg || DEFAULTS.sidebar.sidebarBg),
    headingStyle: 'plain',
    sectionTitleCase: 'upper',
    sidebarBg: '#1e293b',
  },
};

/**
 * Resolve design settings for PDF export.
 * - User-provided settings always win.
 * - Spacing values (CSS px from design panel) are converted to PDF points once.
 * - Font sizes stay as-is (already "pt" numbers on canvas).
 */
export function resolveTemplateSettings(settings = {}, templateKey) {
  const tConfig = DEFAULTS[templateKey] || DEFAULTS.classic;
  const s = { ...settings };

  s.accentColor = settings.accentColor || tConfig.accentColor;
  s.textColor = settings.textColor || tConfig.textColor;
  s.headingStyle = settings.headingStyle || tConfig.headingStyle;
  s.sectionTitleCase = settings.sectionTitleCase || tConfig.sectionTitleCase;
  s.headerTextColor = settings.headerTextColor || '#ffffff';

  s.nameColor = settings.nameColor
    || (typeof tConfig.nameColor === 'function' ? tConfig.nameColor(s) : tConfig.nameColor);
  s.jobTitleColor = settings.jobTitleColor
    || (typeof tConfig.jobTitleColor === 'function' ? tConfig.jobTitleColor(s) : tConfig.jobTitleColor);

  if (templateKey === 'sidebar') {
    s.sidebarBg = settings.sidebarBg || tConfig.sidebarBg;
  }

  // Font metrics — match canvas (pt numbers, no conversion)
  s.fontSizeBase = settings.fontSizeBase ?? 11;
  s.fontSizeNameDelta = settings.fontSizeNameDelta ?? 8;
  s.fontSizeSectionDelta = settings.fontSizeSectionDelta ?? 1;
  s.fontSizeEntryDelta = settings.fontSizeEntryDelta ?? 0;
  s.lineHeightValue = settings.lineHeightValue ?? 1.5;
  s.iconSize = settings.iconSize ?? 11;

  // Page margins (mm — used as mm in getPageStyle)
  s.marginV = settings.marginV ?? 14;
  s.marginH = settings.marginH ?? 18;

  // Spacing: convert CSS px → PDF pt exactly once
  const sectionGapPx = settings.sectionGap ?? DEFAULT_SECTION_GAP_PX;
  const itemGapPx = settings.itemGap ?? DEFAULT_ITEM_GAP_PX;
  s.sectionGap = sectionGapPx * CSS_PX_TO_PT;
  s.itemGap = itemGapPx * CSS_PX_TO_PT;
  // Keep raw px for any per-section override math that still expects px inputs
  s._sectionGapPx = sectionGapPx;
  s._itemGapPx = itemGapPx;

  s.sectionBorderWidth = settings.sectionBorderWidth ?? 1;
  s.sectionBorderColor = settings.sectionBorderColor || '';
  s.headerBorderWidth = settings.headerBorderWidth ?? 2;
  s.headerAlign = settings.headerAlign || 'left';
  s.headerLayout = settings.headerLayout || 'stack';
  s.headerInlineGap = (settings.headerInlineGap ?? 8) * CSS_PX_TO_PT;
  s.contactStyle = settings.contactStyle || 'icon';
  s.contactLayout = settings.contactLayout || 'justify';
  s.photoShape = settings.photoShape || 'circle';
  s.photoSize = settings.photoSize || 'md';
  s.photoBorder = settings.photoBorder || 'accent';
  s.photoHeight = settings.photoHeight || 'match';
  s.photoTextAlign = settings.photoTextAlign || 'center';
  // A boolean from here on: the stored choice, else the template's own default.
  s.showHeaderBorder = headerBorderOn(settings, templateKey);

  return s;
}
