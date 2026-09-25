// Personal Info → Header Customization → Header spacing (header_spacing_spec.md, 03-ui): the gaps it
// offers, top to bottom as the header prints them, each only where it prints. Plain data (no React):
// the panel and tests read it.
import { HEADER_GAPS, HEADER_GAP_KEYS, storedGapPx, templateGapPt } from '@/constants/headerSpacing';
import { hasHeaderControls, headerBorderOn, headerTemplateId } from '@/constants/templates';
import { contactItems } from '@/utils/contacts';
import { isDrawableImage } from '@/utils/imageUpload';
import { hasRichText } from '@/utils/richText';
import { CSS_PX_TO_PT, DEFAULT_SECTION_GAP_PX } from '@/templates/pdf/shared/pdfUnits';
import { LETTER_CONTACTS_GAP } from '@/templates/pdf/shared/letterhead';

/** Each row's visible label and its accessible name ("↔" reads badly aloud). */
const TEXT = {
  photoTextGap: ['Photo ↔ Text', 'Photo to text spacing'],
  nameTitleGap: ['Name ↔ Title', 'Name to title spacing'],
  headerInlineGap: ['Name ↔ Title', 'Name to title spacing'],
  titleContactsGap: ['Title ↔ Contacts', 'Title to contacts spacing'],
  iconTextGap: ['Icon ↔ Text', 'Icon to text spacing'],
  contactGapX: ['Between contacts', 'Space between contacts'],
  contactGapY: ['Between contact rows', 'Space between contact rows'],
  summaryGap: ['Contacts ↔ Summary', 'Contacts to summary spacing'],
  headerRuleGap: ['Text ↔ Border', 'Text to border spacing'],
  headerPadY: ['Banner top & bottom', 'Banner top and bottom padding'],
  headerPadX: ['Banner sides', 'Banner side padding'],
  headerGapBelow: ['Header ↔ First section', 'Header to first section spacing'],
};
/** Without a title the contacts follow the name, and Title ↔ Contacts is the name's gap. */
const NAME_CONTACTS = ['Name ↔ Contacts', 'Name to contacts spacing'];
/** Contact Style "Bullet" prints a bullet where "Icon" prints an icon. */
const BULLET_TEXT = ['Bullet ↔ Text', 'Bullet to text spacing'];
/** Without contacts the summary follows the title, or the name. */
const TITLE_SUMMARY = ['Title ↔ Summary', 'Title to summary spacing'];
const NAME_SUMMARY = ['Name ↔ Summary', 'Name to summary spacing'];
/** Banner's band: its padding is under its text only (the top is the page's margin), and the summary prints under it. */
const BAND_PAD = ['Banner padding', 'Banner padding under the text'];
const BAND_SUMMARY = ['Banner ↔ Summary', 'Banner to summary spacing'];

/**
 * What a template's own gap depends on, as resolveTemplateSettings reads it: Contact Layout, and
 * Between Sections in pt — the gap under the header follows it where it is wider (templateHeaderGaps).
 */
const gapContext = (settings) => ({
  contactLayout: settings?.contactLayout,
  sectionGapPt: (settings?.sectionGap ?? DEFAULT_SECTION_GAP_PX) * CSS_PX_TO_PT,
});

/**
 * One stepper row, in CSS px like Between Sections: `valuePx` is what prints — the résumé's value
 * when it set one (`set`), else the template's own (`defaultPx`, not always whole: 1 pt = 1.33 px).
 * `name` is the row's accessible name.
 */
function gapRow(key, template, settings, [label, name] = TEXT[key]) {
  const { min, max } = HEADER_GAPS[key];
  const defaultPx = templateGapPt(template, key, gapContext(settings)) / CSS_PX_TO_PT;
  const stored = storedGapPx(settings, key);
  return { key, label, name, valuePx: stored ?? defaultPx, defaultPx, set: gapIsSet(key, template, settings), min, max };
}

/**
 * Has this résumé set `key`, or is it only carrying the gap its template prints anyway? A stored
 * value the template would print by itself is not a choice anyone made: the defaults and the role
 * starters store `headerInlineGap: 8`, which is every template's own 6 pt, so reading "set" as
 * `stored != null` showed Name ↔ Title as user-set — a dark value and a ↺ that changed nothing — on
 * a résumé nobody had touched (AUD-34), and Reset could only tell the difference by hardcoding
 * that 8 (AUD-19). A gap the template does not have is junk a stored value left behind: set, so
 * Reset can clear it, which is the row the header never shows (AUD-19).
 */
export function gapIsSet(key, template, settings) {
  const stored = storedGapPx(settings, key);
  if (stored == null) return false;
  const ownPt = templateGapPt(headerTemplateId(template, settings), key, gapContext(settings));
  if (ownPt == null) return true;
  // Compared as the stepper shows them (formatPx, one decimal): 1 pt is 1.33 px, never whole.
  return Math.round(stored * 10) !== Math.round((ownPt / CSS_PX_TO_PT) * 10);
}

/**
 * Every header gap this résumé has set — including ones whose row the header does not show now
 * (a photo since removed, Stack ↔ Inline), which is what Reset exists to clear (AUD-19).
 */
export const headerGapKeysSet = (template, settings = {}) =>
  HEADER_GAP_KEYS.filter((key) => gapIsSet(key, template, settings));

/**
 * The header's spacing rows for `template` with `settings` and `personal`:
 *   Photo ↔ Text      a photo prints (one the PDF can draw, not hidden) — beside the name, or above
 *                     it in a centred header and the Sidebar column
 *   Name ↔ Title      a job title prints; it writes the gap of the layout the header prints in —
 *                     `headerInlineGap` beside the name (Inline, the templates with header controls),
 *                     else `nameTitleGap` under it (Stack, and always in Modern and Sidebar) (spec D3)
 *   Title ↔ Contacts  a contact prints, in a header that has the gap (not the Sidebar column, whose
 *                     contacts are a section of their own); "Name ↔ Contacts" without a title
 *   Icon ↔ Text       a contact prints with a mark before it: Modern's and the Sidebar's icons, or
 *                     Contact Style Icon — or Bullet, one contact to a cell (Single, 2 Grid): in a
 *                     Justify line a bullet is text between two values ("Bullet ↔ Text")
 *   Between contacts  two contacts or more side by side in a flowing row: Modern's, and Icon with
 *                     Justify (a Bar or Bullet line spaces them with its separator, a 2 Grid's
 *                     columns are its own — spec D7)
 *   Between contact    two contacts or more on rows of their own: Modern's and Icon + Justify's once
 *   rows               they wrap, the Sidebar column's, Single's; a 2 Grid's from the third
 *   Contacts ↔ Summary the summary prints, in a header that has the gap (not the Sidebar column's
 *                     page, whose summary is its main column's About Me): "Title ↔ Summary" or
 *                     "Name ↔ Summary" without contacts, "Banner ↔ Summary" under Banner's band
 *   Text ↔ Border     Header Bottom Border is on, in a header that takes it (the rule's padding)
 *   Banner top &       Modern's banner padding, and Banner's band's under its text ("Banner padding");
 *   bottom, sides      the side padding is Modern's only (Banner's text keeps the page margins)
 *   Header ↔ First     every header: the space between it (the summary where it follows the header)
 *   section            and what follows — the Sidebar column's under its name
 */
export function headerGapRows(template, settings = {}, personal = {}) {
  const t = headerTemplateId(template, settings); // the Sidebar's single column prints Classic's header
  const hidden = personal?.hiddenFields || [];
  const hc = hasHeaderControls(t); // Classic, Minimal, Executive: the header controls apply
  const rows = [];
  if (!hidden.includes('photo') && isDrawableImage(personal?.photo)) rows.push(gapRow('photoTextGap', t, settings));
  if (personal?.title) {
    const inline = hc && settings?.headerLayout === 'inline';
    rows.push(gapRow(inline ? 'headerInlineGap' : 'nameTitleGap', t, settings));
  }
  const contacts = contactItems(personal || {}).length;
  const has = (key) => templateGapPt(t, key) != null;
  if (contacts && has('titleContactsGap')) rows.push(gapRow('titleContactsGap', t, settings, personal?.title ? undefined : NAME_CONTACTS));
  // Contact Style and Layout as PdfContactRow reads them, in the templates that take them.
  const style = hc ? settings?.contactStyle || 'icon' : 'icon';
  const inCells = ['single', '2grid'].includes(settings?.contactLayout);
  if (contacts && (style === 'icon' || (style === 'bullet' && inCells))) rows.push(gapRow('iconTextGap', t, settings, style === 'bullet' ? BULLET_TEXT : undefined));
  const flowing = t === 'modern' || (hc && style === 'icon' && !inCells); // icons in a row that wraps
  if (contacts > 1 && flowing) rows.push(gapRow('contactGapX', t, settings));
  const layout = hc ? settings?.contactLayout : null;
  if ((contacts > 1 && (flowing || t === 'sidebar' || layout === 'single')) || (contacts > 2 && layout === '2grid')) rows.push(gapRow('contactGapY', t, settings));
  // Banner prints its summary under the band, so it follows the band's rows; every other header ends in it.
  const summary = !hidden.includes('summary') && hasRichText(personal?.summary) && has('summaryGap');
  const band = t === 'banner';
  const summaryRow = () => gapRow('summaryGap', t, settings, band ? BAND_SUMMARY : contacts ? undefined : personal?.title ? TITLE_SUMMARY : NAME_SUMMARY);
  if (summary && !band) rows.push(summaryRow());
  if (hc && headerBorderOn(settings, t) && has('headerRuleGap')) rows.push(gapRow('headerRuleGap', t, settings));
  if (has('headerPadY')) rows.push(gapRow('headerPadY', t, settings, band ? BAND_PAD : undefined));
  if (has('headerPadX')) rows.push(gapRow('headerPadX', t, settings));
  if (summary && band) rows.push(summaryRow());
  if (has('headerGapBelow')) rows.push(gapRow('headerGapBelow', t, settings));
  return rows;
}

/**
 * The cover letter's one gap of its own (Cover Letter → Header Layout, under Right of Name): the space
 * between the name side and the contacts on its right — contactsSideGap, else the letterhead's 12 pt.
 * No résumé header prints it, so Personal Info offers no row for it (R2-137).
 */
export function letterSideGapRow(settings = {}) {
  const { min, max } = HEADER_GAPS.contactsSideGap;
  const defaultPx = LETTER_CONTACTS_GAP / CSS_PX_TO_PT;
  const stored = storedGapPx(settings, 'contactsSideGap');
  return {
    key: 'contactsSideGap', label: 'Name ↔ Contacts', name: 'Name to contacts spacing', valuePx: stored ?? defaultPx, defaultPx,
    set: stored != null && Math.round(stored * 10) !== Math.round(defaultPx * 10), min, max,
  };
}
