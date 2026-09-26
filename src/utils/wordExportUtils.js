import {
  Paragraph, TextRun, BorderStyle, TabStopType, ExternalHyperlink, AlignmentType, HeadingLevel, LineRuleType,
  LevelFormat, Table, TableBorders, TableCell, TableLayoutType, TableRow, WidthType,
} from 'docx';
import { DEFAULT_BULLET_STYLE, bulletAt, bulletStyleOf, parseRichText, safeHref } from '@/utils/richText';
import { PAGE_MARKS } from '@/templates/pdf/shared/pdfColors';
import { MARGIN_MM, pageMargins } from '@/constants/pageMargins';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { storedNumber } from '@/constants/spacingNumbers';

/** Points as twips, Word's 1/20 pt. */
export const twips = (pt) => Math.round(pt * 20);

/**
 * The .docx page margins, twips: Design → Spacing's Top / Bottom (`v`) and Left / Right (`h`), in mm
 * as the PDF prints them (pageMargins) — the résumé's and its letter's (R2-062). A stored value that
 * is no number prints the default, and one past the editor's range its end, as normalizeResume()
 * stores it.
 */
export function wordMargins(settings) {
  const { v, h } = pageMargins(settings);
  const own = pageMargins({});
  const mm = (n, fallback) => Math.min(MARGIN_MM.max, Math.max(MARGIN_MM.min, storedNumber(n) ?? fallback));
  const toTwips = (n) => Math.round((n * 1440) / 25.4);
  return { v: toTwips(mm(v, own.v)), h: toTwips(mm(h, own.h)) };
}

/** The width between Word's left and right margins on the résumé's paper (A4 or US Letter), twips. */
export const wordContentTwips = (settings) => PAGE_SIZES[pageSizeOf(settings)].twips.width - 2 * wordMargins(settings).h;

/**
 * A paragraph's line spacing for Design → Line Height `lineHeight` (a multiple of the font size),
 * its text `size` half-points: at least that many times the size, as the PDF's line box is (R2-062).
 * "At least", so a Line Height under the font's own single spacing prints single-spaced, where an
 * exact one would cut the tops off its letters. None for no Line Height.
 */
export const lineSpacing = (lineHeight, size) => (lineHeight > 0 && size > 0
  ? { line: Math.round(lineHeight * size * 10), lineRule: LineRuleType.AT_LEAST }
  : {});

/**
 * Space of `pt` points (Between Sections, Between Items): an empty paragraph exactly that tall, as the
 * PDF's margin is — an empty paragraph of Word's own height is a whole line of text. None for 0.
 */
export const gapPara = (pt) => (pt > 0
  ? [new Paragraph({ children: [], spacing: { before: 0, after: 0, line: Math.max(1, twips(pt)), lineRule: LineRuleType.EXACT } })]
  : []);

/**
 * A section's entries in Section Options → Grids (R2-070): a borderless table of `grid`'s columns
 * (sectionLook's), `cells` (each an entry's paragraphs) in reading order, row by row, as the PDF's
 * RenderColGrid lays them out. Each column starts where the PDF's cell does; its text is as wide as the
 * PDF's cell, the gap to the next cell its right margin. Rows after the first stand `gapPt` below
 * the one above (Between Items), and a short last row is filled with empty cells.
 */
export function gridTable(cells, { cols, cell, starts, width }, gapPt) {
  const widths = starts.map((x, i) => (starts[i + 1] ?? width) - x);
  const rows = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    rows: rows.map((row, r) => new TableRow({
      children: widths.map((w, c) => new TableCell({
        children: row[c] || [new Paragraph({ children: [] })],
        width: { size: w, type: WidthType.DXA },
        margins: { marginUnitType: WidthType.DXA, top: r ? twips(gapPt) : 0, bottom: 0, left: 0, right: w - cell },
      })),
    })),
  });
}

/** A '#rrggbb' colour as Word's 'rrggbb'; anything else gives `fallback`. */
export function accent2Hex(color, fallback = '2563eb') {
  const hex = String(color || '').replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
}

export function bold(text, extra = {}) {
  return new TextRun({ text: String(text || ''), bold: true, ...extra });
}

export function normal(text, extra = {}) {
  return new TextRun({ text: String(text || ''), ...extra });
}

/**
 * What Design → Links adds to a link's run in Word (`look`: linkLook's { underline, color }, R2-147):
 * the PDF's underline, or its accent colour. {} for Plain, and for no look: a link prints as before.
 */
export const linkRun = (look) => ({
  ...(look?.underline && { underline: {} }),
  ...(look?.color && { color: accent2Hex(look.color) }),
});

/** Text that links to `href` when it is a safe link, plain text otherwise; `look`: Design → Links' on the link (linkRun). */
export function linked(text, href, extra = {}, look = null) {
  const link = href && safeHref(href);
  const run = new TextRun({ text: String(text || ''), ...extra, ...(link && linkRun(look)) });
  return link ? new ExternalHyperlink({ link, children: [run] }) : run;
}

/**
 * The run between two contact values in Contact Style `contactStyle`, `style` the values' run
 * style: the PDF's Bullet "•", else its Bar "|" — Icon prints as Bar, Word draws no icons — in
 * `markColor` ('rrggbb', a band's marks), else in the page's greys the PDF draws them in.
 */
export function contactSeparator(contactStyle, style, markColor) {
  const mark = contactStyle === 'bullet' ? 'bullet' : 'bar';
  return normal(mark === 'bullet' ? '  •  ' : '  |  ', { ...style, color: markColor || accent2Hex(PAGE_MARKS[mark]) });
}

/** Calibri's space, em (463 of its 2048 units): the documents' font (wordExport.js buildDocument). */
const SPACE_EM = 463 / 2048;

/**
 * The run between the name and the title on one line (Name & Title Layout "Inline", inlineLayout):
 * a real space — the line reads and copies as words — widened to the PDF's `gap` (pt), at the
 * title's `size` (half-points). The résumé's header and the letter's letterhead print it alike.
 */
export function inlineGap(gap, size) {
  return normal(' ', { size, characterSpacing: Math.round((gap - SPACE_EM * (size / 2)) * 20) });
}

/** An empty paragraph: `after` twips of space. */
export const spacer = (after = 60) => new Paragraph({ children: [], spacing: { after } });

/** Points as Word's border widths: eighths of a point, ¼–12 pt. */
export const eighths = (n) => Math.min(96, Math.max(2, Math.round(n * 8)));

/** A paragraph's options that centre it when `centered` (Section Options → Alignment "Center"). */
export const centredIf = (centered) => (centered ? { alignment: AlignmentType.CENTER } : {});

/**
 * A section's title paragraph; `title` prints as given (buildSection applies Design → Title case).
 * `heading`: Design → Section Headings as the PDF draws them (buildSection's headingOf, ONB-12-NB1)
 * — `{ color, border?, shading? }`; without one (the Sidebar's side column, whose titles take no
 * Section Headings), the accent over an accent underline. It may also carry `size` (half-points),
 * `before` (the space above it, twips: a section's own Spacing Override Before — the gap under the
 * section above is that section's, sectionSpaceAfter) and `lineHeight` (Design → Line Height, which
 * the PDF's title takes too).
 * The title is a Word Heading 1 (Microsoft's guidance: the Navigation pane, screen readers and
 * parsers find the sections, ATS-6). Its whole look is still the direct formatting below, and the
 * Heading 1 style (wordExport.js buildDocument) sets only the document font and outline level, so
 * the style changes nothing on the page.
 */
export function sectionHeading(title, accentHex, centered = false, heading = null) {
  const base = heading?.color
    ? heading
    : { color: accentHex, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: accentHex, space: 4 } }, ...heading };
  const { color, size, before = 180, lineHeight, tracking, font, ...frame } = base;
  const titleSize = size ?? 24;
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    // `tracking`: Design → Title Spacing, twips (wordExportBuilders.js trackingOf, R2-146).
    // `font`: Typography → Heading Font (wordFonts.js wordHeadingFont, R2-146).
    children: [new TextRun({ text: String(title || ''), bold: true, size: titleSize, color, ...(font ? { font } : {}), ...(tracking ? { characterSpacing: tracking } : {}) })],
    ...frame,
    spacing: { before, after: 60, ...lineSpacing(lineHeight, titleSize) },
    keepNext: true,
    ...centredIf(centered),
  });
}

const BULLET_REFERENCE = 'bullet-style';

/**
 * Design → Lists → Bullet in the .docx (settings.bulletStyle, R2-147): for a style other than Bullet,
 * a bullet numbering of its own (the document's `numbering.config`, buildDocument's) that draws the
 * style's glyph at every level (bulletAt, the PDF's), indented as docx's default bullets are — 720
 * twips a level, the glyph hanging 360 in front — so only the glyph changes; None's levels draw no
 * glyph, and the tab after it still takes the text to its place. Bullet, and a résumé storing no
 * style, keep docx's default bullets (● ○ ■): no numbering is added, the file is as before.
 */
export function bulletNumbering(style) {
  if (bulletStyleOf(style) === DEFAULT_BULLET_STYLE) return [];
  const levels = Array.from({ length: 9 }, (_, level) => {
    const glyph = bulletAt(level + 1, style);
    return {
      level,
      format: glyph ? LevelFormat.BULLET : LevelFormat.NONE,
      text: glyph,
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    };
  });
  return [{ reference: BULLET_REFERENCE, levels }];
}

/** A bulleted list item's numbering at `level` (0: the top) under Design → Lists `style`: docx's default bullets, or bulletNumbering's. */
const listItem = (level, style) => (bulletStyleOf(style) === DEFAULT_BULLET_STYLE
  ? { bullet: { level } }
  : { numbering: { reference: BULLET_REFERENCE, level } });

/**
 * A legacy bullet (an entry's `bullets[]`) in `run`'s size and colour, at Design → Line Height
 * `lineHeight`, behind Design → Lists `style`'s glyph.
 */
export function bulletPoint(text, centered = false, run = { size: 20 }, lineHeight = 0, style = undefined) {
  return new Paragraph({
    children: [new TextRun({ text: String(text || ''), ...run })],
    ...listItem(0, style),
    spacing: { before: 20, after: 20, ...lineSpacing(lineHeight, run.size) },
    indent: { left: 360 },
    ...centredIf(centered),
  });
}

const ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};
const LEVEL_TWIPS = 360;

function runsToDocx(runs, base) {
  const out = [];
  for (const run of runs) {
    const textRuns = run.text.split('\n').map((text, i) => new TextRun({
      text,
      break: i > 0 ? 1 : undefined,
      size: base.size,
      color: base.color,
      bold: run.bold || base.bold || undefined,
      italics: run.italic || base.italics || undefined,
      underline: run.underline ? {} : undefined,
      strike: run.strike || undefined,
      // Design → Links (R2-147) on a link's text, as the PDF's.
      ...(run.href && safeHref(run.href) && linkRun(base.links)),
    }));
    const link = run.href && safeHref(run.href);
    if (link) out.push(new ExternalHyperlink({ link, children: textRuns }));
    else out.push(...textRuns);
  }
  return out;
}

/**
 * The editor's HTML as Word paragraphs — the same parse the PDF uses, so line breaks, blank
 * lines, nested and numbered lists, marks, alignment and links match the PDF.
 * `base` sets size (half-points), colour, whole-block bold/italics, `lineHeight` (Design → Line
 * Height, R2-062), `bullet`, the glyph a bulleted item prints behind (Design → Lists, R2-147), and
 * `links`, Design → Links' look on its links (linkLook, R2-147);
 * `align` is the alignment of a block the editor did not align (a centred section's: 'center'), as
 * in the PDF.
 */
export function descriptionToParagraphs(html, base = { size: 20, color: '374151' }, align = null, frame = {}) {
  return parseRichText(html).map((block) => {
    const children = runsToDocx(block.runs, base);
    const spacing = { before: 20, after: 20, ...lineSpacing(base.lineHeight, base.size) };
    const options = { spacing, alignment: ALIGN[block.align || align], ...frame };
    if (block.marker) {
      const level = Math.max(0, block.indent - 1);
      if (block.marker.length === 1) {
        return new Paragraph({ ...options, children, ...listItem(Math.min(level, 8), base.bullet) });
      }
      // Numbers are written out, so start="3", value and a/i numbering print exactly as in the PDF.
      const left = LEVEL_TWIPS * (level + 1);
      return new Paragraph({
        ...options,
        children: [new TextRun({ text: `${block.marker}\t`, size: base.size, color: base.color }), ...children],
        indent: { left, hanging: LEVEL_TWIPS },
        tabStops: [{ type: TabStopType.LEFT, position: left }],
      });
    }
    return new Paragraph({
      ...options,
      children,
      indent: block.indent > 0 ? { left: LEVEL_TWIPS * block.indent } : undefined,
    });
  });
}

/**
 * An entry's title line, its date (in `color`, `size` half-points) at the right margin — a right tab
 * at `tab` twips, the width between the page's margins (wordContentTwips) — or, `centered` (Section
 * Options → Alignment "Center"), the line centred and the date centred on a line of its own below it.
 * Empty parts (null, false, '') are left out, so a line with nothing but a date prints the date
 * alone. `under` (runs: Title "Stacked"'s second field, R2-070) starts the line under the title, as
 * the PDF's sub line does. `place` ({ text, color, size }: the entry's location; `italics` on Executive and Academic) ends that line — at
 * the same right tab, or on a centred line of its own — or has a line of its own there, never in the
 * title's text, where a parser reads it as part of the job title or the company (ATS-1), as the PDF
 * keeps it a field of its own.
 */
export function dateRightPara(leftChildren, rightText, { color: colorHex, centered = false, size = 20, place = null, tab, under = [] }) {
  const left = leftChildren.filter(Boolean);
  const sub = under.filter(Boolean);
  const date = rightText ? [new TextRun({ text: String(rightText), color: colorHex, size })] : [];
  const where = place?.text ? [new TextRun({ text: String(place.text), color: place.color, size: place.size, italics: place.italics || undefined })] : [];
  // The lines that print, one after another: a line with nothing on it takes no break.
  const lines = (list) => list.filter((line) => line.length).flatMap((line, i) => (i ? [new TextRun({ break: 1 }), ...line] : line));
  if (centered) {
    return new Paragraph({ children: lines([left, date, sub, where]), keepNext: true, ...centredIf(true) });
  }
  const tabbed = (runs) => (runs.length ? [new TextRun({ text: '\t' }), ...runs] : []);
  return new Paragraph({
    children: lines([[...left, ...tabbed(date)], [...sub, ...tabbed(where)]]),
    tabStops: [{ type: TabStopType.RIGHT, position: tab }],
    keepNext: true,
  });
}
