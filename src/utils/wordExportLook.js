// How the Word résumé prints a section's entries (buildSection's `look`): the sizes, the spacing of
// Design → Spacing (R2-062) and the colours (R2-063) its PDF prints the same section in — and the
// header's frame, the band or rule the résumé's header and the letter's letterhead sit in (R2-137).
import { BorderStyle, ShadingType, Table, TableBorders, TableCell, TableLayoutType, TableRow, VerticalAlign, WidthType } from 'docx';
import { accent2Hex, eighths, twips, wordContentTwips, wordMargins } from '@/utils/wordExportUtils';
import { headerTemplateId, templateId } from '@/constants/templates';
import { solid, textShades } from '@/templates/pdf/shared/pdfColors';
import { getColumnWidth, getEffectiveSpacing } from '@/templates/pdf/shared/PdfSections';
import { linkLook } from '@/utils/linkStyle';

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
 * - `links` — Design → Links' look on its links, on the white page (linkLook, R2-147);
 * - `gap` — the space between two entries, pt: Design → Between Items scaled by the section's
 *   Spacing preset, or its own Item gap (getEffectiveSpacing, R2-062);
 * - `title` — Section Options → Title: 'stacked' (unset), 'inline' or 'sidebyside'; the Sidebar's
 *   side column offers none and stacks its entries (R2-070);
 * - `side` — the section is in the Sidebar's side column; `template` — the template's id;
 * - `ink` — the entries' colours (entryInk).
 */
export function sectionLook(section, settings, s, template, side) {
  const tid = templateId(template);
  const grid = gridOf(section, wordContentTwips(settings), side);
  return {
    ...entrySizes(section, s, tid, side),
    grid,
    tab: grid ? grid.cell : wordContentTwips(settings),
    line: s.lineHeightValue,
    bullet: s.bulletStyle,
    links: linkLook(s.linkStyle, s.accentColor),
    gap: getEffectiveSpacing(section, s).itemGap,
    title: (!side && section.settings?.titleStyle) || 'stacked',
    side,
    template: tid,
    ink: entryInk(s, tid),
  };
}

/**
 * A colour as Word's 'rrggbb', opaque over `on` (the band a run sits on, else the white page), at
 * `alpha` times its own: what the PDF draws with that opacity (Word has none).
 */
export const hexOn = (color, on = '#ffffff', fallback, alpha = 1) => accent2Hex(solid(color, alpha, on), fallback);

/**
 * The fill Word shades a header band in (letterheadLook's `band`): the colour the PDF paints (a
 * translucent one as it shows over the white page), else — a colour Word cannot take — the look's
 * own band colour (band.fallback), so a template's band brings its fallback with it: Word chose it
 * by the look's name, the Sidebar's slate or else Modern's blue (FIDB-51-VF7-NB2).
 */
export const bandFill = (band) => hexOn(band.color, '#ffffff', hexOn(band.fallback));

/**
 * How far a band's fill runs past its text on each side, twips: Modern's band sits inside the page
 * margins, its text its Banner sides (padX) in; a band that bleeds (the Sidebar's, whose padX is 0)
 * keeps its text on the margins and runs its fill padY into them — never past the paper's edge.
 * The PDF runs that fill to the paper's edges; a Word table cannot reach above the top margin.
 */
function bandSide(band, settings) {
  if (!band) return 0;
  return band.bleed ? Math.min(twips(band.padY), wordMargins(settings).h) : twips(band.padX);
}

/**
 * The width a header frame (frameTable) leaves its text, twips: the page's text less a band's
 * padding on each side where the band sits inside the margins (Modern's).
 */
export const frameInner = (settings, band = null) => wordContentTwips(settings) - (band && !band.bleed ? 2 * bandSide(band, settings) : 0);

/**
 * The header's frame in Word (R2-137): a borderless table whose columns are `widths` (twips, summing
 * to frameInner), `rows` its rows of cells `{ children, span?, valign?, margins? }` — `margins` twips
 * added to the frame's own on that side of the cell (less where negative, never under 0). With
 * `band` (letterheadLook's): every cell shaded in its fill (bandFill), the band's padding as the
 * outer cells' margins, so the band is one block however its cells' heights differ — Modern's inside
 * the margins, a band that bleeds (bandSide) running into them, its text on them. With `rules` (the
 * letterhead's rules, top down; two are a double rule) and no band: the table's bottom border, `ruleGap`
 * pt under the text. The photo row of a header on the white page is this frame with neither.
 */
export function frameTable(rows, widths, { settings, band = null, rules = [], ruleGap = 0 } = {}) {
  const side = bandSide(band, settings);
  const padY = band ? twips(band.padY) : 0;
  const [rule, second] = band ? [] : rules;
  const fill = band ? bandFill(band) : null;
  const cols = widths.length;
  const colWidths = widths.map((w, i) => w + (i === 0 ? side : 0) + (i === cols - 1 ? side : 0));
  const total = colWidths.reduce((a, b) => a + b, 0);
  const under = padY + (rule ? twips(ruleGap) : 0);
  const at = (own, extra = 0) => Math.max(0, own + extra);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    // A band that bleeds starts its fill `side` left of the margin: in the compatibility mode docx writes
    // (Word 2013's), a table's indent is where its edge starts, not its text.
    ...(band?.bleed && side ? { indent: { size: -side, type: WidthType.DXA } } : {}),
    borders: rule
      ? { ...TableBorders.NONE, bottom: { style: second ? BorderStyle.DOUBLE : BorderStyle.SINGLE, size: eighths(rule.width), color: hexOn(rule.color) } }
      : TableBorders.NONE,
    rows: rows.map((row, r) => {
      let col = 0;
      return new TableRow({
        children: row.map((cell) => {
          const span = Math.min(cell.span || 1, cols - col);
          const [first, last] = [col === 0, col + span === cols];
          const width = colWidths.slice(col, col + span).reduce((a, b) => a + b, 0);
          col += span;
          const m = cell.margins || {};
          return new TableCell({
            children: cell.children,
            width: { size: width, type: WidthType.DXA },
            ...(span > 1 ? { columnSpan: span } : {}),
            verticalAlign: cell.valign || VerticalAlign.TOP,
            ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill } } : {}),
            margins: {
              marginUnitType: WidthType.DXA,
              top: at(r === 0 ? padY : 0, m.top),
              bottom: at(r === rows.length - 1 ? under : 0, m.bottom),
              left: at(first ? side : 0, m.left),
              right: at(last ? side : 0, m.right),
            },
          });
        }),
      });
    }),
  });
}
