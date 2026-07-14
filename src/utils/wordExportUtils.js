import { Paragraph, TextRun, BorderStyle, TabStopType } from 'docx';

export function accent2Hex(color) {
  return color?.replace('#', '') || '2563eb';
}

export function bold(text, extra = {}) {
  return new TextRun({ text: String(text || ''), bold: true, ...extra });
}

export function normal(text, extra = {}) {
  return new TextRun({ text: String(text || ''), ...extra });
}

export function separator() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8', space: 4 } },
    spacing: { after: 60 },
  });
}

export function sectionHeading(title, accentHex) {
  return new Paragraph({
    children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 20, color: accentHex })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: accentHex, space: 4 } },
    spacing: { before: 180, after: 60 },
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

export function descriptionToParagraphs(html) {
  if (!html) return [];
  const trimmed = String(html).trim();
  if (!trimmed) return [];

  if (!/[<]/.test(trimmed)) {
    return [new Paragraph({ children: [normal(trimmed, { size: 20, color: '374151' })], spacing: { before: 20, after: 20 } })];
  }

  let doc;
  try {
    doc = new DOMParser().parseFromString(`<div>${trimmed}</div>`, 'text/html');
  } catch {
    return [new Paragraph({ children: [normal(trimmed.replace(/<[^>]+>/g, ''), { size: 20, color: '374151' })] })];
  }
  const root = doc.body.firstChild;
  const paras = [];

  function runsFromNode(node, fmt = {}) {
    const runs = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        const text = child.textContent;
        if (text) runs.push(new TextRun({ text, size: 20, color: '374151', ...fmt }));
      } else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        const nextFmt = { ...fmt };
        if (tag === 'strong' || tag === 'b') nextFmt.bold = true;
        if (tag === 'em' || tag === 'i') nextFmt.italics = true;
        if (tag === 'u') nextFmt.underline = {};
        runs.push(...runsFromNode(child, nextFmt));
      }
    });
    return runs;
  }

  function walk(node) {
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        const text = child.textContent.trim();
        if (text) paras.push(new Paragraph({ children: [normal(text, { size: 20, color: '374151' })], spacing: { before: 20, after: 20 } }));
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        child.querySelectorAll(':scope > li').forEach(li => {
          paras.push(new Paragraph({ children: runsFromNode(li), bullet: { level: 0 }, indent: { left: 360 }, spacing: { before: 20, after: 20 } }));
        });
      } else if (tag === 'p' || tag === 'div') {
        const runs = runsFromNode(child);
        if (runs.length) paras.push(new Paragraph({ children: runs, spacing: { before: 20, after: 20 } }));
      } else if (tag !== 'br') {
        const runs = runsFromNode(child);
        if (runs.length) paras.push(new Paragraph({ children: runs, spacing: { before: 20, after: 20 } }));
      }
    });
  }

  walk(root);
  return paras;
}

export function dateRightPara(leftChildren, rightText, accentHex) {
  return new Paragraph({
    children: [
      ...leftChildren,
      new TextRun({ text: '\t' }),
      new TextRun({ text: String(rightText || ''), color: accentHex, size: 20 }),
    ],
    tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
  });
}
