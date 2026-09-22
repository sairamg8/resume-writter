// Personal Info → Header Customization → Header spacing (header_spacing_spec.md, 03-ui): the gaps it
// offers, top to bottom as the header prints them, each only where it prints. Plain data (no React):
// the panel and tests read it.
import { HEADER_GAPS, storedGapPx, templateGapPt } from '@/constants/headerSpacing';
import { hasHeaderControls, headerTemplateId } from '@/constants/templates';
import { contactItems } from '@/utils/contacts';
import { isDrawableImage } from '@/utils/imageUpload';
import { CSS_PX_TO_PT } from '@/templates/pdf/shared/pdfUnits';

/** Each row's visible label and its accessible name ("↔" reads badly aloud). */
const TEXT = {
  photoTextGap: ['Photo ↔ Text', 'Photo to text spacing'],
  nameTitleGap: ['Name ↔ Title', 'Name to title spacing'],
  headerInlineGap: ['Name ↔ Title', 'Name to title spacing'],
  titleContactsGap: ['Title ↔ Contacts', 'Title to contacts spacing'],
  iconTextGap: ['Icon ↔ Text', 'Icon to text spacing'],
  contactGapX: ['Between contacts', 'Space between contacts'],
};
/** Without a title the contacts follow the name, and Title ↔ Contacts is the name's gap. */
const NAME_CONTACTS = ['Name ↔ Contacts', 'Name to contacts spacing'];
/** Contact Style "Bullet" prints a bullet where "Icon" prints an icon. */
const BULLET_TEXT = ['Bullet ↔ Text', 'Bullet to text spacing'];

/**
 * One stepper row, in CSS px like Between Sections: `valuePx` is what prints — the résumé's value
 * when it set one (`set`), else the template's own (`defaultPx`, not always whole: 1 pt = 1.33 px).
 * `name` is the row's accessible name.
 */
function gapRow(key, template, settings, [label, name] = TEXT[key]) {
  const { min, max } = HEADER_GAPS[key];
  const defaultPx = templateGapPt(template, key) / CSS_PX_TO_PT;
  const stored = storedGapPx(settings, key);
  return { key, label, name, valuePx: stored ?? defaultPx, defaultPx, set: stored != null, min, max };
}

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
  return rows;
}
