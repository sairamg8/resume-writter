// Design → Name & Title Colors against the ground each template prints them on (NB-1). A colour
// picked for one template's header can vanish on another's: the Sidebar column's white name on
// Classic's white page, Classic's ink name on the dark Sidebar column, a blue title on Modern's
// blue banner. Plain data and functions (no react-pdf): the store's template switch and the
// saved-data normaliser read it.
import { headerTemplateId, templateId } from '@/constants/templates';
import { letterheadLook } from './letterhead';
import { contrast } from './pdfColors';
import { resolveTemplateSettings } from './templateSettings';

/** WCAG's floor for large text: a name or job title below 3:1 on its header does not read. */
export const HEADER_READS = 3;

/**
 * Below 2:1 a name or job title can hardly be seen at all: white, or the pale greys and blues of
 * a dark header, on the white page (1.0–1.5:1); a white page's inks on the Sidebar column
 * (1.2–1.9:1). From 2:1 up to 3:1 it is faint but seen, and may be picked on purpose there: a
 * vivid orange, sky or green title on Classic is 2.5–2.8:1.
 */
export const HEADER_SEEN = 2;

/**
 * The colour `template` prints the name and job title on, from a résumé's stored `settings`:
 * Modern's accent banner, the Sidebar column's background, else the white page (Classic, Minimal,
 * Executive). The letterhead's band is that same ground — the letter takes the résumé template's
 * look (letterheadLook, FIDB-51) — so reading it there keeps the two from drifting apart, and a
 * template added with a banner brings its ground with it.
 */
export function headerGround(settings, template) {
  // headerTemplateId, not templateId: the Sidebar's single column prints on the white page, and a
  // ground read from the column it no longer draws kept a white name white on white (TUI-1).
  const t = headerTemplateId(template, settings);
  return letterheadLook(t, resolveTemplateSettings(settings || {}, t)).band?.color || '#ffffff';
}

/**
 * `settings` with each picked Name or Job title colour that reads below `below`:1 on
 * `template`'s header set back to the template's own — '', as the Design panel's ↺ sets it —
 * where the template's own reads better there. With `from` (a template), only a colour that also
 * reads worse on `template`'s header than on `from`'s: one a template switch did not make
 * fainter stays. A colour the PDF cannot parse is left as it is. The same object when nothing
 * changes; settings that are not an object pass through.
 */
export function withHeaderColorsBack(settings, template, { below, from } = {}) {
  if (!settings || typeof settings !== 'object') return settings;
  const t = templateId(template);
  const ground = headerGround(settings, t);
  const wasOn = from === undefined ? null : headerGround(settings, from);
  const own = resolveTemplateSettings({ ...settings, nameColor: '', jobTitleColor: '' }, t);
  const back = ['nameColor', 'jobTitleColor'].filter((key) => {
    const k = contrast(settings[key], ground);
    if (k == null || k >= below || !(contrast(own[key], ground) > k)) return false;
    return wasOn === null || k < contrast(settings[key], wasOn);
  });
  if (!back.length) return settings;
  return { ...settings, ...Object.fromEntries(back.map((key) => [key, ''])) };
}

/**
 * The settings of a résumé switched from template `from` to `to`: a picked Name or Job title
 * colour that does not read on `to`'s header (below 3:1) and reads worse there than on `from`'s
 * goes back to `to`'s own — the Sidebar's white name on Classic, Minimal or Executive, Classic's
 * ink name on the Sidebar column or Modern's banner. One that reads there, or reads no worse
 * (Classic, Minimal and Executive share the white page), is kept.
 */
export const headerColorsOnSwitch = (settings, from, to) =>
  withHeaderColorsBack(settings, to, { below: HEADER_READS, from: templateId(from) });

/**
 * The Name and Job title colours `template`'s header prints in on the white page, from a résumé's
 * stored `settings`: the Word résumé's, which draws no band. Classic's, Minimal's and Executive's
 * header is the page: the colours their PDF prints, picked or the template's own. Modern's banner
 * and the Sidebar's column are bands: their header prints on the page as a switch to Classic
 * prints it (headerColorsOnSwitch) — a picked colour where it reads there, or reads no worse than
 * on the band; else the page's own, Classic's, from the template's Text colour and accent (its
 * own where none is stored): the Text colour for the name, the accent for the title. The band's
 * own colours (Header Text Color, the Sidebar's readable accent) are the band's, as its contact
 * colours are. CSS colours, as stored: a caller converts them.
 */
export function headerColorsOnPage(settings, template) {
  const t = templateId(template);
  const s = resolveTemplateSettings(settings || {}, t);
  if (!letterheadLook(t, s).band) return { nameColor: s.nameColor, jobTitleColor: s.jobTitleColor };
  const onPage = headerColorsOnSwitch({ ...settings, textColor: s.textColor, accentColor: s.accentColor }, t, 'classic');
  const page = resolveTemplateSettings(onPage, 'classic');
  return { nameColor: page.nameColor, jobTitleColor: page.jobTitleColor };
}
