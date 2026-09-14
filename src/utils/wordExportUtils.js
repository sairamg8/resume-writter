import {
  Paragraph, TextRun, BorderStyle, TabStopType, ExternalHyperlink, AlignmentType,
} from 'docx';
import { parseRichText, safeHref } from '@/utils/richText';

export function accent2Hex(color) {
  const hex = String(color || '').replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? hex : '2563eb';
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

export function separator() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8', space: 4 } },
    spacing: { after: 60 },
  });
}

export function sectionHeading(title, accentHex) {
  return new Paragraph({
    children: [new TextRun({ text: String(title || '').toUpperCase(), bold: true, size: 20, color: accentHex })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: accentHex, space: 4 } },
    spacing: { before: 180, after: 60 },
    keepNext: true,
  });
}

export function bulletPoint(text) {
  return new Paragraph({
    children: [new TextRun({ text: String(text || ''), size: 20 })],
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
    indent: { left: 360 },
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
 * `base` sets size (half-points), colour and whole-block bold/italics.
 */
export function descriptionToParagraphs(html, base = { size: 20, color: '374151' }) {
  return parseRichText(html).map((block) => {
    const children = runsToDocx(block.runs, base);
    const options = { spacing: { before: 20, after: 20 }, alignment: ALIGN[block.align] };
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

export function dateRightPara(leftChildren, rightText, accentHex) {
  return new Paragraph({
    children: [
      ...leftChildren,
      ...(rightText ? [new TextRun({ text: '\t' }), new TextRun({ text: String(rightText), color: accentHex, size: 20 })] : []),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
    keepNext: true,
  });
}
