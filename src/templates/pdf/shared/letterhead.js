// The cover letter's letterhead in the résumé template's look (FIDB-51). Worked out once, from
// the résumé's own resolved colours, for the letter's PDF and its Word export: the letter used
// to print Classic's letterhead under every template, so a Modern or Sidebar résumé and its
// letter never read as a set. Plain data (no react-pdf).
import { letterheadCentered, templateId } from '@/constants/templates';
import { sidebarShades, solid, textShades } from './pdfColors';
import { MODERN_HEADER_PAD_X_PT, MODERN_HEADER_PAD_Y_PT } from './pdfUnits';

/** Space under the letterhead's text, above its rule — and the gap under the letterhead. */
export const LETTERHEAD_PAD = 12;
export const LETTERHEAD_GAP = 16;

/** Space between the two lines of Executive's double rule, pt. */
export const DOUBLE_RULE_GAP = 1.5;

/**
 * The letterhead of a letter whose résumé prints with `template`, from the résumé's resolved
 * settings `s` (resolveTemplateSettings): the same fonts (the page's), accent, name and title
 * colours, header text colour and alignment as the résumé's header.
 *   look      the template whose look it takes (an id the app does not offer is Classic)
 *   centered  the résumé's header is centred (letterheadCentered): photo, name and contacts on the centre line
 *   name      { color, weight, letterSpacing? }: Design → Name color, else the template's own
 *   title     { color, opacity? }: Design → Job title color, else the template's own
 *   contacts  the colour of the contact icons and values
 *   band      null, or the filled band the letterhead sits in: { color, padX, padY, radius?, bleed? }
 *             — Modern's accent banner inside the margins; the Sidebar panel's colour to the page
 *             edges (bleed: the content keeps the page margins, the fill runs to the paper's edge)
 *   rules     the rules under the letterhead, top down, [{ width, color }] — two are a double rule
 *   photo     [the ring colour of Photo → Border "Accent", getPdfPhotoStyle options]: a ring that
 *             shows on the band, as on the résumé's (white on Modern's accent, a readable accent
 *             on the Sidebar panel)
 * Classic is the letterhead every letter printed before: a 2.5 pt accent rule.
 */
export function letterheadLook(template, s = {}) {
  const look = templateId(template);
  const accent = s.accentColor || '#2563eb';
  const text = s.textColor || '#1e293b';
  const base = {
    look,
    centered: letterheadCentered(s, look),
    name: { color: s.nameColor || text, weight: 'bold' },
    title: { color: s.jobTitleColor || accent },
    // Contacts in the Text colour's grey (R1-13), as the letter always printed them.
    contacts: textShades(text).meta,
    band: null,
    rules: [],
    photo: [accent, {}],
  };
  switch (look) {
    case 'modern':
      // Modern's banner: the accent, its padding and corners; everything on it in the header text colour.
      return {
        ...base,
        title: { ...base.title, opacity: 0.9 },
        contacts: s.headerTextColor || '#ffffff',
        band: { color: accent, padX: MODERN_HEADER_PAD_X_PT, padY: MODERN_HEADER_PAD_Y_PT, radius: 2 },
        photo: ['#ffffff', { onBanner: true }],
      };
    case 'sidebar': {
      // The Sidebar column's background and its colours on it (sidebarShades, R2-2).
      const bg = s.sidebarBg || '#1e293b';
      return {
        ...base,
        contacts: sidebarShades(bg).value,
        band: { color: bg, padX: 0, padY: MODERN_HEADER_PAD_Y_PT, bleed: true },
        photo: [accent, { lightBorder: true }],
      };
    }
    case 'minimal':
      // Minimal's light name and a hairline in its summary bar's pale accent.
      return {
        ...base,
        name: { ...base.name, weight: 300, letterSpacing: -0.3 },
        rules: [{ width: 0.75, color: solid(accent, 0.4) }],
      };
    case 'executive':
      return { ...base, rules: [{ width: 0.75, color: solid(accent) }, { width: 0.75, color: solid(accent) }] };
    default:
      return { ...base, rules: [{ width: 2.5, color: solid(accent) }] };
  }
}
