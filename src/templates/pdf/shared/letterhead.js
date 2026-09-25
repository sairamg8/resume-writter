// The cover letter's letterhead in the résumé template's look (FIDB-51). Worked out once, from
// the résumé's own resolved colours, for the letter's PDF and its Word export: the letter used
// to print Classic's letterhead under every template, so a Modern or Sidebar résumé and its
// letter never read as a set. Plain data (no react-pdf).
import { hasHeaderControls, headerBorderOn, headerTemplateId, letterheadCentered, templateId } from '@/constants/templates';
import { HEADER_GAPS, setGapPt, templateGapPt } from '@/constants/headerSpacing';
import { contrast, sidebarShades, solid, textShades } from './pdfColors';
import { CSS_PX_TO_PT, MODERN_HEADER_PAD_X_PT, MODERN_HEADER_PAD_Y_PT } from './pdfUnits';
import { DEFAULTS } from './templateSettings';
import { railColor, TIMELINE_RAIL } from './timelineRail';
import { bannerPadY } from './bannerBand';

/**
 * Space under the letterhead's text, above its rule (or the gap under the letterhead, with none),
 * where the résumé's header prints no Text ↔ Border gap of its own (letterheadLook's ruleGap) —
 * and the gap under the letterhead where the résumé sets no Header ↔ First section (gapBelow).
 */
const LETTERHEAD_PAD = 12;
export const LETTERHEAD_GAP = 16;
/** Right of Name: the space between the name side and the contacts on its right, pt (contactsSideGap unset). */
export const LETTER_CONTACTS_GAP = 12;

/** Space between the two lines of Executive's double rule, pt. */
export const DOUBLE_RULE_GAP = 1.5;

/**
 * The letter's grey on the paper — its contacts under a rule, their icons, the signature's
 * designation — for the Text colour `text`: the shade the résumé's header prints its contacts in
 * (textShades().sub, PdfContactRow), so the letterhead matches the résumé's header. It reads at
 * 4.58:1 or more on white at every Text colour the Design panel offers and every template's
 * default; the lighter `meta` the letter used read at 3.3:1 at Dark Gray and Slate (R9-13).
 */
export const letterGrey = (text) => textShades(text || '#1e293b').sub;

/** The contacts' colour's share in the marks on a band — the opacity Modern's banner prints its summary at. */
const MARK_ALPHA = 0.85;
/** WCAG's floor for a graphic: a mark below 3:1 on its band is not seen. */
const MARK_READS = 3;

/**
 * The Bar "|" and Bullet "•" marks' colour on a band: the contacts' colour `contacts` over the
 * band's `ground` at MARK_ALPHA — a step lighter than the values, as the page's light greys are
 * (PdfContactRow) — or at the least more of it that reads 3:1 there. Contacts that read less
 * than that themselves (a Header text colour picked for another accent) give their own colour:
 * a mark never stands out over the values. A colour it cannot read passes through.
 */
function bandMarks(contacts, ground) {
  const own = contrast(contacts, ground);
  if (own == null) return contacts;
  for (let alpha = MARK_ALPHA; own >= MARK_READS && alpha < 1; alpha += 0.05) {
    const mark = solid(contacts, alpha, ground);
    if (contrast(mark, ground) >= MARK_READS) return mark;
  }
  return solid(contacts, 1, ground);
}

/**
 * Header Customization → Name & Title Layout "Inline" on the letterhead (V2FIDB-51-3) and in the
 * Word résumé (ONB-3-NB1): null where the résumé's header stacks them — Stack, a layout the panel
 * never writes, Modern's banner and the Sidebar's column (no header controls) — else `{ gap }`, the
 * résumé's Name & Title Spacing in pt (resolved `s`). A stored value outside its range prints at the
 * range's end, one that is not a number as the template's own (header_spacing_spec.md D9): the
 * letter and the .docx keep printing whatever an imported file carries.
 */
export function inlineLayout(look, s) {
  if (!hasHeaderControls(look) || s.headerLayout !== 'inline') return null;
  const { min, max } = HEADER_GAPS.headerInlineGap;
  const gap = Number.isFinite(s.headerInlineGap)
    ? Math.min(max * CSS_PX_TO_PT, Math.max(min * CSS_PX_TO_PT, s.headerInlineGap))
    : templateGapPt(look, 'headerInlineGap');
  return { gap };
}

/**
 * Each template's letterhead (V2FIDB-51-6): the look's changes to letterheadLook()'s shared `base`,
 * given the résumé's resolved settings `s`, its `accent` and the résumé header's rule `rule` (null
 * where the résumé prints none). One entry per template the app offers, pinned to TEMPLATE_IDS by
 * tests/pdf/15-design-defaults: it was a switch whose `default:` was Classic's, so a template added
 * to TEMPLATES without its letterhead printed Classic's letter with every test green.
 */
export const LOOKS = {
  classic: (base, { rule }) => ({ ...base, rules: rule || [] }),
  modern: (base, { s, accent }) => {
    // Modern's banner: the accent, its padding and corners; everything on it in the header text colour.
    // Its padding is the résumé banner's: Header spacing's Banner top & bottom and sides, else 15 / 18 pt.
    const headerText = s.headerTextColor || '#ffffff';
    return {
      ...base,
      title: { ...base.title, opacity: 0.9 },
      contacts: headerText,
      marks: bandMarks(headerText, solid(accent)),
      band: {
        color: accent, fallback: DEFAULTS.modern.accentColor, radius: 2,
        padX: s.headerGaps?.headerPadX ?? MODERN_HEADER_PAD_X_PT, padY: s.headerGaps?.headerPadY ?? MODERN_HEADER_PAD_Y_PT,
      },
      photo: ['#ffffff', { onBanner: true }],
    };
  },
  // Minimal's light name and a hairline in its summary bar's pale accent.
  minimal: (base, { accent, rule }) => ({
    ...base,
    name: { ...base.name, weight: 300, letterSpacing: -0.3 },
    rules: rule || [{ width: 0.75, color: solid(accent, 0.4) }],
  }),
  executive: (base, { accent, rule }) => ({
    ...base,
    rules: rule || [{ width: 0.75, color: solid(accent) }, { width: 0.75, color: solid(accent) }],
  }),
  sidebar: (base, { s, accent }) => {
    // The Sidebar column's background and its colours on it (sidebarShades, R2-2).
    const bg = s.sidebarBg || '#1e293b';
    const { value } = sidebarShades(bg);
    return {
      ...base,
      contacts: value,
      marks: bandMarks(value, solid(bg)),
      band: { color: bg, fallback: DEFAULTS.sidebar.sidebarBg, padX: 0, padY: MODERN_HEADER_PAD_Y_PT, bleed: true },
      photo: [accent, { lightBorder: true }],
    };
  },
  // Timeline's rail laid flat: a line in the rail's colour and width (PdfTimeline.jsx) under the letterhead.
  timeline: (base, { accent, rule }) => ({
    ...base,
    rules: rule || [{ width: TIMELINE_RAIL.width, color: railColor(accent) }],
  }),
  // Banner's band: the accent from the paper's top and side edges, the text on the page margins, the
  // band's padding under it, everything on it in the header text colour (BannerTemplatePDF.jsx) —
  // the résumé header's rule too, drawn on the band under the text, at its Thickness.
  banner: (base, { s, accent, rule }) => {
    const headerText = s.headerTextColor || '#ffffff';
    return {
      ...base,
      contacts: headerText,
      marks: bandMarks(headerText, solid(accent)),
      band: { color: accent, fallback: DEFAULTS.banner.accentColor, padX: 0, padY: bannerPadY(s), bleed: true },
      rules: rule ? [{ width: rule[0].width, color: solid(headerText, 1, solid(accent)) }] : [],
      photo: ['#ffffff', { onBanner: true }],
    };
  },
  // Academic's letterhead: its résumé's centred header — the position under the name in italic, as
  // AcademicTemplatePDF prints it — over the hairline its section titles print on (sectionHeadingLook),
  // 0.75 pt, where the résumé's header rule is off.
  academic: (base, { s, accent, rule }) => ({
    ...base,
    title: { ...base.title, italic: true },
    rules: rule || [{ width: ACADEMIC_HAIRLINE, color: solid(s.sectionBorderColor || accent, s.sectionBorderColor ? 1 : 0.55) }],
  }),
  // Compact's letterhead: its résumé's header — the title on the name's line where the résumé prints it
  // Inline (its default; `inline`) — over a 1 pt rule in the colour of its section titles' short rules
  // (a picked Border colour, else the accent), where the résumé's header rule is off.
  compact: (base, { s, accent, rule }) => ({
    ...base,
    rules: rule || [{ width: COMPACT_RULE, color: solid(s.sectionBorderColor || accent) }],
  }),
};

/** The hairline under Academic's letterhead, pt: Minimal's. */
export const ACADEMIC_HAIRLINE = 0.75;

/** The rule under Compact's letterhead, pt: its section titles' short rule at the default Border thickness. */
export const COMPACT_RULE = 1;

/**
 * The letterhead of a letter whose résumé prints with `template`, from the résumé's resolved
 * settings `s` (resolveTemplateSettings): the same fonts (the page's), accent, name and title
 * colours, header text colour and alignment as the résumé's header.
 *   look      the template whose look it takes (LOOKS; an id the app does not offer is Classic)
 *   centered  the résumé's header is centred (letterheadCentered): photo, name and contacts on the centre line
 *   inline    null, or { gap }: the résumé's header prints the title on the name's line (inlineLayout)
 *   name      { color, weight, letterSpacing? }: Design → Name color, else the template's own
 *   title     { color, opacity?, italic? }: Design → Job title color, else the template's own (Academic's italic)
 *   contacts  the colour of the contact icons and values
 *   marks     the colour of the Bar and Bullet marks on a band (bandMarks), else null: the
 *             page's light greys, as the résumé's header prints them
 *   band      null, or the filled band the letterhead sits in: { color, fallback, padX, padY, radius?, bleed? }
 *             — Modern's accent banner inside the margins; the Sidebar panel's colour to the page
 *             edges (bleed: the content keeps the page margins, the fill runs to the paper's edge).
 *             `fallback` is the look's own band colour (its template's default), which Word prints
 *             where it cannot take `color` (a colour name, an import's "#12345", FIDB-51-VF7-NB2)
 *   rules     the rules under the letterhead, top down, [{ width, color }] — two are a double rule:
 *             the résumé header's rule wherever the résumé prints one (Header Customization →
 *             Header Bottom Border and its Thickness, V2FIDB-51-2), else the look's own mark
 *   ruleGap   the space under the text, above the rules — with none, added to the gap under the
 *             letterhead — in pt: the résumé header's Text ↔ Border gap wherever its header prints
 *             one (Header Bottom Border on: headerGaps.headerRuleGap, FIDB-51-VF3-NB3), else 12
 *   gapBelow  the gap under the letterhead (its band, rule or ruleGap), pt: the résumé's Header ↔
 *             First section where it sets one (Personal Info → Header spacing), else 16
 *   photo     [the ring colour of Photo → Border "Accent", getPdfPhotoStyle options]: a ring that
 *             shows on the band, as on the résumé's (white on Modern's accent, a readable accent
 *             on the Sidebar panel)
 * Classic is the letterhead every letter printed before, less its fixed 2.5 pt accent rule: its
 * rule is the résumé's, so a résumé with the border off (every new one's) pairs with a letter
 * without one, and a Thickness reaches both.
 */
/**
 * The job title's font size, pt: Design → Typography → Job Title (fontSizeTitleDelta, R2-146), else
 * Entry Header (fontSizeEntryDelta), over the base font size. Every résumé header, the cover letter's
 * letterhead and Word's print the title at this size (FIDB-51-VF4-NB2).
 */
export function headerTitleSize(settings = {}) {
  return (settings?.fontSizeBase || 11) + (settings?.fontSizeTitleDelta ?? settings?.fontSizeEntryDelta ?? 0);
}

export function letterheadLook(template, s = {}) {
  // The Sidebar's ATS-safe single column prints Classic's page, so its letter takes Classic's
  // letterhead too — headerTemplateId, as every other header caller resolves it (TUI-2). With
  // templateId here the page lost its column while the letter kept the column's dark band, and
  // headerGround (which reads this look) told the colour rescue the name sat on that band.
  const look = headerTemplateId(template, s);
  const accent = s.accentColor || '#2563eb';
  const text = s.textColor || '#1e293b';
  const base = {
    look,
    centered: letterheadCentered(s, look),
    inline: inlineLayout(look, s),
    name: { color: s.nameColor || text, weight: 'bold' },
    title: { color: s.jobTitleColor || accent, size: headerTitleSize(s) },
    // Contacts in the Text colour's grey (R1-13): the résumé header's (letterGrey, R9-13).
    contacts: letterGrey(text),
    marks: null,
    band: null,
    rules: [],
    // The résumé pads its header by its Text ↔ Border gap wherever the border is on, a Thickness it
    // draws no rule at included (getHeaderBorderStyle); the letter's rule sat 12 pt under its text
    // whatever that gap. Modern's banner and the Sidebar panel have none (null): 12, unused there.
    ruleGap: headerBorderOn(s, look) ? s.headerGaps?.headerRuleGap ?? LETTERHEAD_PAD : LETTERHEAD_PAD,
    // The letter's own 16 pt under its letterhead, unless the résumé set the gap under its header (spec D5).
    gapBelow: setGapPt(s, 'headerGapBelow') ?? LETTERHEAD_GAP,
    photo: [accent, {}],
  };
  // The résumé header's rule (headerRule) replaces Minimal's hairline and Executive's double rule —
  // one rule under a header, as on the résumé; Modern's banner and the Sidebar panel take none.
  const drawn = headerRule(s, look);
  return (LOOKS[look] || LOOKS.classic)(base, { s, accent, rule: drawn ? [drawn] : null });
}

/**
 * The résumé header's bottom rule as getHeaderBorderStyle (PdfPage.jsx) draws it, `{ width, color }`
 * in pt, or null: on where the résumé (resolved `s`) stores it on, or stores nothing and `template`
 * draws one (headerBorderOn), at its Thickness, in the accent. A Thickness it draws no rule at (an
 * import's -3 or "abc") is none — and no width Word rejects. The letterhead and the Word résumé
 * (FIDB-51-VF3-NB2) draw it from here; only Classic, Minimal and Executive draw it on the résumé.
 */
export function headerRule(s, template) {
  const width = Number(s.headerBorderWidth || 2);
  return headerBorderOn(s, template) && Number.isFinite(width) && width > 0 ? { width, color: solid(s.accentColor || '#2563eb') } : null;
}
