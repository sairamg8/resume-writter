// The PDF's per-template fallbacks and the settings every PDF renders with. Plain data and
// functions (no react-pdf): the templates, the cover letter and its Word export all read the
// résumé's colours through here, so the letter's Word file prints what its PDF prints (FIDB-51).
import { headerBorderOn, headerTemplateId } from '@/constants/templates';
import { headerGapsPt } from '@/constants/headerSpacing';
import { pageMargins } from '@/constants/pageMargins';
import { PHOTO_OPTIONS, photoOption } from '@/constants/photoOptions';
import { contrast, readableOn } from './pdfColors';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX, DEFAULT_SECTION_GAP_PX } from './pdfUnits';

/**
 * Design → Header Text Color (white when unset) on `ground`, the colour its template prints it on:
 * as picked where it reaches `min`:1 there, else the least-shifted tint of it that reaches 4.5:1
 * (readableOn). Idempotent: resolved settings resolved again print the same.
 */
function headerTextOn(s, ground, min) {
  const color = s.headerTextColor || '#ffffff';
  return contrast(color, ground) >= min ? color : readableOn(color, ground);
}

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
    // Everything on the accent banner — the name, title, contacts and their icons, the summary, and
    // the letter's band — prints the header text colour where it reads on the accent, else one
    // readable tint of it: a dark one on a dark accent, or the default white on a light accent,
    // printed invisible (ONB-1). Measured on the accent, never on the Sidebar Background, which
    // Modern does not draw (R7-0). The banner's text is one colour, so the name's size does not
    // decide it: 3:1, where a header's name and title read (HEADER_READS) — the Orange and Teal
    // presets' white (3.6:1, 3.7:1) prints white at any name size. A picked Name or Job title
    // colour wins, as on the Sidebar.
    headerTextColor: (s) => headerTextOn(s, s.accentColor, 3),
    nameColor: (s) => s.nameColor || s.headerTextColor,
    jobTitleColor: (s) => s.jobTitleColor || s.headerTextColor,
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
    // light background, the least-darkened tint of it that does (headerTextOn). A picked name
    // colour wins (R2-2). The bold name is WCAG large text from 14 pt (19 by default), where 3:1
    // reads: a Header Text Color that reaches that prints as picked, as it did before R2-2; one
    // that does not gets the tint that reaches 4.5:1, as since R2-2 (R7-13).
    // The ATS-safe single column (sidebarSingleColumn) prints on white, not the dark band, so it
    // falls back dark-on-white like Classic — the light-on-dark tint would be invisible there.
    nameColor: (s) => s.nameColor
      || (s.sidebarSingleColumn
        ? (s.textColor || '#1a1a1a')
        : headerTextOn(s, s.sidebarBg || DEFAULTS.sidebar.sidebarBg,
          (s.fontSizeBase ?? 11) + (s.fontSizeNameDelta ?? 8) >= 14 ? 3 : 4.5)),
    // The accent on the dark sidebar only where it reads there; a dark accent (the default
    // #374151, or #111111) gets a light tint of itself instead (FIDB-42). On white (single column)
    // the accent prints as picked.
    jobTitleColor: (s) => s.jobTitleColor
      || (s.sidebarSingleColumn
        ? (s.accentColor || '#2563eb')
        : readableOn(s.accentColor || '#2563eb', s.sidebarBg || DEFAULTS.sidebar.sidebarBg)),
    headingStyle: 'plain',
    sectionTitleCase: 'upper',
    sidebarBg: '#1e293b',
  },
  // The white page, as Classic: the name in the Text colour, the title in the accent the rail is drawn in.
  timeline: {
    accentColor: '#2563eb',
    textColor: '#1a1a1a',
    nameColor: (s) => s.nameColor || s.textColor || '#1a1a1a',
    jobTitleColor: (s) => s.jobTitleColor || s.accentColor || '#2563eb',
    headingStyle: 'plain',
    sectionTitleCase: 'upper',
  },
  // The band is the accent, and everything on it — name, title, contacts, icons, marks, the header
  // rule — prints the header text colour as it reads there, as Modern's banner does (3:1, one
  // colour for the band). The body is the white page in the Text colour; headings are filled chips.
  banner: {
    accentColor: '#2563eb',
    textColor: '#1a1a1a',
    headerTextColor: (s) => headerTextOn(s, s.accentColor, 3),
    nameColor: (s) => s.nameColor || s.headerTextColor,
    jobTitleColor: (s) => s.jobTitleColor || s.headerTextColor,
    headingStyle: 'box',
    sectionTitleCase: 'upper',
  },
};

/** The photo controls resolveTemplateSettings clamps, from the one list the panel offers. */
const PHOTO_KEYS = Object.keys(PHOTO_OPTIONS);

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
  // Modern's banner text: the header text colour as it reads on the accent (DEFAULTS.modern).
  if (typeof tConfig.headerTextColor === 'function') s.headerTextColor = tConfig.headerTextColor(s);

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
  const margins = pageMargins(settings);
  s.marginV = margins.v;
  s.marginH = margins.h;

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
  // Each photo control's stored value when the panel offers it, else that control's default (AUD-25).
  for (const key of PHOTO_KEYS) s[key] = photoOption(key, settings[key]);
  // A boolean from here on: the stored choice, else the template's own default.
  s.showHeaderBorder = headerBorderOn(settings, templateKey);

  // The header's spacing in pt: the résumé's own gaps, else the template's (header_spacing_spec.md) —
  // Classic's for the Sidebar's single column, which prints Classic's page (headerTemplateId).
  s.headerGaps = headerGapsPt(settings, headerTemplateId(templateKey, settings), { contactLayout: s.contactLayout, sectionGapPt: s.sectionGap });

  return s;
}
