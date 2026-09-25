// How the Word résumé prints a section's entries (buildSection's `look`): the sizes, the spacing of
// Design → Spacing (R2-062) and the colours (R2-063) its PDF prints the same section in.
import { accent2Hex, wordContentTwips } from '@/utils/wordExportUtils';
import { headerTemplateId, templateId } from '@/constants/templates';
import { isRtl } from '@/utils/resumeLanguage';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { getColumnWidth, getEffectiveSpacing } from '@/templates/pdf/shared/PdfSections';

/**
 * The colours of a section's entries, 'rrggbb', as the PDF prints them on the white page, from the
 * résumé's resolved settings `s` (resolveTemplateSettings) on template `tid` (R2-063):
 * - `text` — the Text colour: an entry's title, a language, a reference's name;
 * - `second` — an entry's second field (role or company, degree, organisation, subtitle), as
 *   ItemHeader prints it: the accent at 85 % on Modern, at 80 % on the Sidebar's page, else `sub`;
 * - `sub`, `meta`, `muted`, `body` — the Text colour's shades (textShades): skills, issuers and a
 *   reference's role; a relationship and a project's technologies; a location and a credential ID;
 *   descriptions and legacy bullets;
 * - `place` — an entry's location: `muted`, Compact's `meta`;
 * - `tech` — a project's technologies: the accent at 70 % in the two-column Sidebar's main column,
 *   else `meta` — its Single · ATS-safe prints Classic's projects (headerTemplateId);
 * - `bar` — a Bars skill: the Text colour at 80 %.
 * The Sidebar's side column prints light on its dark panel; Word has no panel, so it takes these too.
 */
export function entryInk(s, tid) {
  const shade = textShades(s.textColor);
  const hex = (color, fallback = '6b7280') => accent2Hex(solid(color), fallback);
  const accentAt = (alpha) => hex(solid(s.accentColor, alpha), accent2Hex(s.accentColor));
  const onAccent = { modern: 0.85, sidebar: 0.8 }[tid];
  return {
    text: hex(s.textColor, '1a1a1a'),
    second: onAccent ? accentAt(onAccent) : hex(shade.sub),
    sub: hex(shade.sub),
    meta: hex(shade.meta),
    muted: hex(shade.muted),
    // An entry's location: `muted`, but Compact's 9 pt one `meta`, which reads 4.5:1 (ItemHeader, T9).
    place: hex(tid === 'compact' ? shade.meta : shade.muted),
    body: hex(shade.body, '374151'),
    tech: headerTemplateId(tid, s) === 'sidebar' ? accentAt(0.7) : hex(shade.meta),
    bar: hex(solid(s.textColor, 0.8)),
  };
}

/**
 * The sizes, half-points, `section`'s entries print at in the PDF, from the résumé's resolved
 * settings `s` on template `tid` (R2-118):
 * - `base` and `entry` — Base and Design → Entry Header, an entry's title's size;
 * - `sub`, `place`, `date` and `link` — an entry's second field (ItemHeader's sub line), location,
 *   dates and a project's link: Base, and on the Sidebar page's job and project cards 1, 1, 1.5 and
 *   1.5 pt under Entry Header;
 * - `body` — its description and legacy bullets: half a point under Entry Header, a job's at it (not
 *   on the Sidebar page), an award's at Base.
 * Word printed the second field at Entry Header and descriptions at Base: the other way round.
 */
function entrySizes(section, s, tid, side) {
  const base = s.fontSizeBase ?? 11;
  const entry = base + (s.fontSizeEntryDelta ?? 0);
  const page = tid === 'sidebar' && !side;
  // The Sidebar page's cards (SidebarMainExperience, SidebarMainProjects); a job's Title "Inline" and
  // "Side by side" print as ItemHeader prints them.
  const card = page && (section.type === 'projects' || (section.type === 'experience' && (section.settings?.titleStyle || 'stacked') === 'stacked'));
  const step = section.type === 'experience' && !page ? 0 : 0.5;
  const half = (pt) => Math.round(pt * 2);
  return {
    base: half(base),
    entry: half(entry),
    sub: half(card ? entry - 1 : base),
    place: half(card ? entry - 1 : base),
    date: half(card ? entry - 1.5 : base),
    link: half(card ? entry - 1.5 : base),
    body: half(section.type === 'awards' ? base : entry - step),
  };
}

/**
 * Section Options → Grids as the PDF lays the section out on a text column `width` twips wide
 * (R2-070): `cols` entries to a row — the section's Grids; unset, Languages and References two, the
 * rest one — each `cell` twips wide (getColumnWidth's 48 %, 31 % or 23 %), the cells spread from edge
 * to edge (`starts`: where each begins). Grids over 4 (stored data; the editor offers 1 to 4) get
 * the whole column from getColumnWidth, and the PDF's row shrinks its cells alike: `cols` equal
 * cells, no gap. Null for one column, or a Grids that is no whole number; the Sidebar's side
 * column is always one.
 */
function gridOf(section, width, side) {
  const cols = side ? 1 : Number(section.settings?.columns) || (['languages', 'references'].includes(section.type) ? 2 : 1);
  if (!Number.isInteger(cols) || cols < 2) return null;
  const share = parseFloat(getColumnWidth(cols)) / 100;
  const cell = Math.round(width * (share < 1 ? share : 1 / cols));
  const gap = (width - cols * cell) / (cols - 1);
  return { cols, cell, width, starts: Array.from({ length: cols }, (_, i) => Math.round(i * (cell + gap))) };
}

/**
 * The `look` buildSection's builders print `section` in, from the résumé's `settings` and their
 * resolved `s`:
 * - `base`, `entry`, `sub`, `place`, `date`, `link` and `body` — the sizes of its fields,
 *   half-points (entrySizes);
 * - `grid` — Section Options → Grids (gridOf), or null for one entry to a row;
 * - `tab` — the dates' right tab, twips: the right margin (wordContentTwips), or in a grid its cell's;
 * - `line` — Design → Line Height; `bullet` — Design → Lists, the glyph of its bulleted items (R2-147);
 * - `gap` — the space between two entries, pt: Design → Between Items scaled by the section's
 *   Spacing preset, or its own Item gap (getEffectiveSpacing, R2-062);
 * - `title` — Section Options → Title: 'stacked' (unset), 'inline' or 'sidebyside'; the Sidebar's
 *   side column offers none and stacks its entries (R2-070);
 * - `side` — the section is in the Sidebar's side column; `template` — the template's id;
 * - `ink` — the entries' colours (entryInk).
 */
export function sectionLook(section, settings, s, template, side) {
  const tid = templateId(template);
  const cells = gridOf(section, wordContentTwips(settings), side);
  // A right-to-left résumé's grid runs from the right (gridTable, R2-148).
  const grid = cells && isRtl(settings) ? { ...cells, rtl: true } : cells;
  return {
    ...entrySizes(section, s, tid, side),
    grid,
    tab: grid ? grid.cell : wordContentTwips(settings),
    line: s.lineHeightValue,
    bullet: s.bulletStyle,
    gap: getEffectiveSpacing(section, s).itemGap,
    title: (!side && section.settings?.titleStyle) || 'stacked',
    side,
    template: tid,
    ink: entryInk(s, tid),
  };
}
