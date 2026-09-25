// What the editor's preview paints, read off its canvas: the preview IS the PDF drawn by pdf.js
// (PdfPreview.jsx), so each measure shows a template's own mark exactly when the PDF draws it. The
// template blocks of pdf-templates.spec.mjs read them.
import { expect } from '@playwright/test';

/**
 * The tallest column of the preview's first page painted in the Timeline rail's colour, px: the accent
 * #2563eb at 35 % on white (timelineRail.js), rgb(179, 200, 248). The rail is a vertical line, so one
 * column holds many such pixels; a heading rule or a tag in a similar tint is horizontal and holds few.
 * The preview is the PDF drawn by pdf.js onto a canvas, so the rail shows there exactly when the PDF draws it.
 */
export async function railPixels(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const columns = new Array(c.width).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 179) <= 6 && Math.abs(data[i + 1] - 200) <= 6 && Math.abs(data[i + 2] - 248) <= 6) columns[(i / 4) % c.width] += 1;
    }
    return Math.max(...columns);
  });
}

/**
 * The share of the preview's first page painted in the Banner band's colour along its top edge: the
 * accent #2563eb, rgb(37, 99, 235), on the canvas's third pixel row. The band runs from the paper's
 * edges, so nearly the whole row is the accent; on a white-page template it is white.
 */
export async function topRowAccent(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 2, c.width, 1);
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 37) <= 8 && Math.abs(data[i + 1] - 99) <= 8 && Math.abs(data[i + 2] - 235) <= 8) hits += 1;
    }
    return hits / c.width;
  });
}

/**
 * How many separate blue-tinted lines cross most of the preview's first page: Academic's hairline under
 * each section title — the accent #2563eb at 55 % on white, rgb(135, 169, 244) — drawn by pdf.js onto the
 * canvas. A pixel row counts when 60 % of it is bluer than it is red by 40 or more (a hairline 1.3 px
 * tall covers at least half of one row: still that blue); rows next to each other are one line. Classic's
 * grey #e5e7eb title rules count none; its accent header rule (drawn when unset) is one line.
 */
export async function hairlines(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let lines = 0;
    let inLine = false;
    for (let y = 0; y < c.height; y += 1) {
      let blue = 0;
      for (let x = 0; x < c.width; x += 1) {
        const i = (y * c.width + x) * 4;
        if (data[i + 2] - data[i] >= 40 && data[i] < 235) blue += 1;
      }
      const row = blue > c.width * 0.6;
      if (row && !inLine) lines += 1;
      inLine = row;
    }
    return lines;
  });
}

/**
 * How many short accent rules the preview's first page paints: Compact's rule after each section title —
 * 30 pt of the accent #2563eb, rgb(37, 99, 235), on the title's line. A pixel row counts when its longest run
 * of accent-blue pixels (blue over red by 60 or more: the accent, or it blended half into the white page at
 * a rule's edge) is at least 4.5 % of the canvas's width — the rule is 5 % of it; a letter's stroke, or a few
 * letters' tops run together, far shorter — and at most 15 %
 * (a rule across the page, Classic's header rule, is far longer); rows next to each other are one rule.
 */
export async function shortRules(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let rules = 0;
    let inRule = false;
    for (let y = 0; y < c.height; y += 1) {
      let run = 0;
      let longest = 0;
      for (let x = 0; x < c.width; x += 1) {
        const i = (y * c.width + x) * 4;
        // The accent, or a 1 pt rule's antialiased edge row: the accent blended with the white page.
        const accent = data[i + 2] - data[i] >= 60 && data[i] < 200;
        run = accent ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      const row = longest >= c.width * 0.045 && longest <= c.width * 0.15;
      if (row && !inRule) rules += 1;
      inRule = row;
    }
    return rules;
  });
}

/**
 * A fingerprint of the preview's first page: the ink of each of 64 bands of pixel rows, as a string. Two
 * templates that draw different marks, or set the page differently, give different fingerprints; the
 * same page painted again gives the same one.
 */
export async function previewFingerprint(page) {
  const canvas = page.locator('[data-preview-status="ready"] canvas').first();
  await expect(canvas).toBeVisible();
  return canvas.evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const bands = Array.from({ length: 64 }, () => 0);
    for (let i = 0; i < data.length; i += 4) {
      const row = Math.floor(i / 4 / c.width);
      bands[Math.min(63, Math.floor((row * 64) / c.height))] += 765 - data[i] - data[i + 1] - data[i + 2];
    }
    return bands.map((b) => Math.round(b / 1000)).join(',');
  });
}
