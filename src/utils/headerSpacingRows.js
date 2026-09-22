// Personal Info → Header Customization → Header spacing (header_spacing_spec.md, 03-ui): the gaps it
// offers, top to bottom as the header prints them, each only where it prints. Plain data (no React):
// the panel and tests read it.
import { HEADER_GAPS, storedGapPx, templateGapPt } from '@/constants/headerSpacing';
import { hasHeaderControls, templateId } from '@/constants/templates';
import { isDrawableImage } from '@/utils/imageUpload';
import { CSS_PX_TO_PT } from '@/templates/pdf/shared/pdfUnits';

/** Each row's visible label and its accessible name ("↔" reads badly aloud). */
const TEXT = {
  photoTextGap: ['Photo ↔ Text', 'Photo to text spacing'],
  nameTitleGap: ['Name ↔ Title', 'Name to title spacing'],
  headerInlineGap: ['Name ↔ Title', 'Name to title spacing'],
};

/**
 * One stepper row, in CSS px like Between Sections: `valuePx` is what prints — the résumé's value
 * when it set one (`set`), else the template's own (`defaultPx`, not always whole: 1 pt = 1.33 px).
 * `name` is the row's accessible name.
 */
function gapRow(key, template, settings) {
  const [label, name] = TEXT[key];
  const { min, max } = HEADER_GAPS[key];
  const defaultPx = templateGapPt(template, key) / CSS_PX_TO_PT;
  const stored = storedGapPx(settings, key);
  return { key, label, name, valuePx: stored ?? defaultPx, defaultPx, set: stored != null, min, max };
}

/**
 * The header's spacing rows for `template` with `settings` and `personal`:
 *   Photo ↔ Text   a photo prints (one the PDF can draw, not hidden) — beside the name, or above it
 *                  in a centred header and the Sidebar column
 *   Name ↔ Title   a job title prints; it writes the gap of the layout the header prints in —
 *                  `headerInlineGap` beside the name (Inline, the templates with header controls),
 *                  else `nameTitleGap` under it (Stack, and always in Modern and Sidebar) (spec D3)
 */
export function headerGapRows(template, settings = {}, personal = {}) {
  const t = templateId(template);
  const hidden = personal?.hiddenFields || [];
  const rows = [];
  if (!hidden.includes('photo') && isDrawableImage(personal?.photo)) rows.push(gapRow('photoTextGap', t, settings));
  if (personal?.title) {
    const inline = hasHeaderControls(t) && settings?.headerLayout === 'inline';
    rows.push(gapRow(inline ? 'headerInlineGap' : 'nameTitleGap', t, settings));
  }
  return rows;
}
