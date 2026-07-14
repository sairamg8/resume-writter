/**
 * Node-side helpers for parsing an exported PDF's real rendered text runs
 * (position, font size, fill color) so a Playwright test can compare them
 * against the live canvas preview's getComputedStyle() values.
 *
 * Uses pdfjs-dist's legacy Node build. Rather than pairing getTextContent()
 * items with a separately-walked operator list (which drifts on real documents
 * — icons, contact-row separators, and rich-text runs don't map 1:1 between the
 * two APIs), this implements a small PDF text-state interpreter that decodes
 * the shown string AND reads the active fill color from the SAME operator call,
 * so there is nothing to misalign.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function rgbToHex(r, g, b) {
  const to255 = (v) => Math.round(v <= 1 ? v * 255 : v);
  return '#' + [r, g, b].map(v => to255(v).toString(16).padStart(2, '0')).join('');
}

/** Normalize a browser rgb()/rgba() computed color string to lowercase hex. */
export function cssColorToHex(css) {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return css.toLowerCase();
  const [r, g, b] = m[1].split(',').map(s => parseInt(s.trim(), 10));
  return rgbToHex(r / 255, g / 255, b / 255);
}

function normalizeHex(hex) {
  if (!hex) return hex;
  let h = String(hex).toLowerCase();
  if (h.length === 4) h = '#' + [...h.slice(1)].map(c => c + c).join('');
  return h;
}

function decodeGlyphs(glyphArgs) {
  let s = '';
  for (const g of glyphArgs) {
    if (typeof g === 'object' && g !== null) s += g.unicode || g.fontChar || '';
  }
  return s;
}

/** Compose PDF matrices in row-vector convention: apply m1, then m2. */
function matMul(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2, a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2, c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2, e1 * b2 + f1 * d2 + f2,
  ];
}

/**
 * Parse a PDF buffer into an ordered list of { str, x, y, fontSize, colorHex }.
 * Position is in PDF points, y measured from the page bottom (PDF space).
 */
export async function extractPdfTextRuns(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const { OPS } = pdfjsLib;
  const runs = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const opList = await page.getOperatorList();

    // react-pdf/PDFKit positions each element via nested q/cm (save/transform) graphics
    // state, then resets the text matrix to identity inside BT — so a run's real page
    // position is (text matrix) composed with the CURRENT graphics-state CTM, not the
    // text matrix alone. Fill color is also graphics state, so it rides the same stack.
    let ctm = [1, 0, 0, 1, 0, 0];
    let curFill = null;
    const stack = [];

    let fontSize = 0;
    let textMatrix = [1, 0, 0, 1, 0, 0];
    let lineMatrix = [1, 0, 0, 1, 0, 0];
    let leading = 0;

    const emit = (str) => {
      if (str && str.trim().length > 0) {
        const eff = matMul(textMatrix, ctm);
        runs.push({ page: pageNum, str, x: eff[4], y: eff[5], fontSize, colorHex: curFill });
      }
    };

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      switch (fn) {
        case OPS.save: {
          stack.push({ ctm, curFill });
          break;
        }
        case OPS.restore: {
          const s = stack.pop();
          if (s) { ctm = s.ctm; curFill = s.curFill; }
          break;
        }
        case OPS.transform: {
          ctm = matMul(args, ctm);
          break;
        }
        case OPS.setFillRGBColor: {
          const [r, g, b] = args;
          curFill = typeof r === 'string' ? normalizeHex(r) : rgbToHex(r, g, b);
          break;
        }
        case OPS.setFillGray: {
          const g = args[0];
          curFill = rgbToHex(g, g, g);
          break;
        }
        case OPS.setFont: {
          fontSize = args[1];
          break;
        }
        case OPS.beginText: {
          textMatrix = [1, 0, 0, 1, 0, 0];
          lineMatrix = [1, 0, 0, 1, 0, 0];
          break;
        }
        case OPS.setTextMatrix: {
          const m = args[0];
          textMatrix = [m[0], m[1], m[2], m[3], m[4], m[5]];
          lineMatrix = textMatrix;
          break;
        }
        case OPS.moveText: {
          const [tx, ty] = args;
          lineMatrix = matMul([1, 0, 0, 1, tx, ty], lineMatrix);
          textMatrix = lineMatrix;
          break;
        }
        case OPS.setLeadingMoveText: {
          const [tx, ty] = args;
          leading = -ty;
          lineMatrix = matMul([1, 0, 0, 1, tx, ty], lineMatrix);
          textMatrix = lineMatrix;
          break;
        }
        case OPS.setLeading: {
          leading = args[0];
          break;
        }
        case OPS.nextLine: {
          lineMatrix = matMul([1, 0, 0, 1, 0, -leading], lineMatrix);
          textMatrix = lineMatrix;
          break;
        }
        case OPS.showText: {
          emit(decodeGlyphs(args[0]));
          break;
        }
        case OPS.showSpacedText: {
          // args[0] is an array mixing glyph objects and numeric spacing adjustments.
          emit(decodeGlyphs(args[0]));
          break;
        }
        case OPS.nextLineShowText: {
          lineMatrix = matMul([1, 0, 0, 1, 0, -leading], lineMatrix);
          textMatrix = lineMatrix;
          emit(decodeGlyphs(args[0]));
          break;
        }
        case OPS.nextLineSetSpacingShowText: {
          lineMatrix = matMul([1, 0, 0, 1, 0, -leading], lineMatrix);
          textMatrix = lineMatrix;
          emit(decodeGlyphs(args[2]));
          break;
        }
        default:
          break;
      }
    }
  }
  return runs;
}

/** First run whose text includes the given substring. */
export function findRun(runs, substring) {
  return runs.find(r => r.str.includes(substring));
}

/** All runs whose text includes the given substring, in document order. */
export function findRuns(runs, substring) {
  return runs.filter(r => r.str.includes(substring));
}

/**
 * Given consecutive wrapped-line runs belonging to the same paragraph (found via
 * a starting substring), compute the line-height-to-font-size ratio from the
 * vertical gap between the first two lines. Returns null if there's only one line.
 */
export function paragraphLineHeightRatio(runs, startSubstring) {
  const start = findRun(runs, startSubstring);
  if (!start) return null;
  const sameBlock = runs
    .filter(r => r.page === start.page && r.y <= start.y && Math.abs(r.x - start.x) < 2)
    .sort((a, b) => b.y - a.y);
  if (sameBlock.length < 2) return null;
  const gap = sameBlock[0].y - sameBlock[1].y;
  return gap / start.fontSize;
}
