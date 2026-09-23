import {
  Paragraph, TextRun, BorderStyle, TabStopType, ExternalHyperlink, AlignmentType, HeadingLevel,
} from 'docx';
import { parseRichText, safeHref } from '@/utils/richText';
import { PAGE_MARKS } from '@/templates/pdf/shared/pdfColors';

/** The .docx page margins, every side, in (wordExport.js buildDocument). */
export const WORD_MARGIN_IN = 0.75;

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

/** Text that links to `href` when it is a safe link, plain text otherwise. */
export function linked(text, href, extra = {}) {
  const link = href && safeHref(href);
  const run = new TextRun({ text: String(text || ''), ...extra });
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
 * Section Headings), the accent over an accent underline.
 * The title is a Word Heading 1 (Microsoft's guidance: the Navigation pane, screen readers and
 * parsers find the sections, ATS-6). Its whole look is still the direct formatting below, and the
 * Heading 1 style (wordExport.js buildDocument) sets only the document font and outline level, so
 * the style changes nothing on the page.
 */
export function sectionHeading(title, accentHex, centered = false, heading = null) {
  const base = heading?.color
    ? heading
    : { color: accentHex, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: accentHex, space: 4 } }, ...heading };
  const { color, size, ...frame } = base;
  const titleSize = size ?? 24;
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: String(title || ''), bold: true, size: titleSize, color })],
    ...frame,
    spacing: { before: 180, after: 60 },
    keepNext: true,
    ...centredIf(centered),
  });
}

export function bulletPoint(text, centered = false) {
  return new Paragraph({
    children: [new TextRun({ text: String(text || ''), size: 20 })],
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
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
 * `base` sets size (half-points), colour and whole-block bold/italics; `align` is the alignment
 * of a block the editor did not align (a centred section's: 'center'), as in the PDF.
 */
export function descriptionToParagraphs(html, base = { size: 20, color: '374151' }, align = null, frame = {}) {
  return parseRichText(html).map((block) => {
    const children = runsToDocx(block.runs, base);
    const options = { spacing: { before: 20, after: 20 }, alignment: ALIGN[block.align || align], ...frame };
    if (block.marker) {
      const level = Math.max(0, block.indent - 1);
      if (block.marker.length === 1) {
        return new Paragraph({ ...options, children, bullet: { level: Math.min(level, 8) } });
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
 * An entry's title line, its date at the right margin — or, `centered` (Section Options →
 * Alignment "Center"), the line centred and the date centred on a line of its own below it.
 * Empty parts (null, false, '') are left out, so a line with nothing but a date prints the date
 * alone. `place` ({ text, color, size }: the entry's location) prints on a line of its own under
 * the date — at the same right tab, or centred — never in the title's text, where a parser reads
 * it as part of the job title or the company (ATS-1), as the PDF keeps it a field of its own.
 */
export function dateRightPara(leftChildren, rightText, colorHex, centered = false, size = 20, place = null) {
  const left = leftChildren.filter(Boolean);
  const date = (extra) => (rightText ? [new TextRun({ text: String(rightText), color: colorHex, size, ...extra })] : []);
  const where = place?.text ? String(place.text) : '';
  if (centered) {
    const under = where ? [new TextRun({ text: where, color: place.color, size: place.size, ...(left.length || rightText ? { break: 1 } : {}) })] : [];
    return new Paragraph({ children: [...left, ...date(left.length ? { break: 1 } : {}), ...under], keepNext: true, ...centredIf(true) });
  }
  const under = where ? [new TextRun({ text: '\t', ...(left.length || rightText ? { break: 1 } : {}) }), new TextRun({ text: where, color: place.color, size: place.size })] : [];
  return new Paragraph({
    children: [...left, ...(rightText ? [new TextRun({ text: '\t' })] : []), ...date(), ...under],
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    keepNext: true,
  });
}
