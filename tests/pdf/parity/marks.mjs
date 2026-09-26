// What the page paints around a piece of text, read off measure.snapshot's `paint` (fills and strokes
// with their boxes, pt, y up): the marks a Section Headings style draws around its title, the header's
// rule, the icon before a contact and the ring around the photo. Each is found by where it sits against
// the text it belongs to, the same way on every template — probed on all of them (B1, 2026-09-24):
//   Ruled      a fill under the title, as wide as the column, its height the thickness (Broadsheet's: over it)
//   Underline  a stroke under the title, its width the thickness
//   Line       a fill on the title's line, after it
//   Left bar   a fill left of the title, as tall as its line, its width the thickness + 2 pt
//   Boxed      a fill under the whole title (Banner: a chip as wide as the title)
//   header rule  a stroke across the page between the name and the first section's title
//   icon       fills or strokes in the ~20 pt left of a contact's text, on its line or its label's
//   photo ring strokes (Accent, the template's own) or a fill (Thin) hugging the photo
import { item } from './measure.mjs';

const drawn = (snap, page) => snap.paint.filter((p) => p.page === page && (p.paint === 'fill' || p.paint === 'stroke'));
/** A horizontal mark: a stroke along a line, or a fill no taller than `max`. */
const flat = (p, max = 13) => (p.paint === 'stroke' ? p.y1 - p.y0 < 0.5 : p.y1 - p.y0 <= max);
/** A horizontal mark's thickness: a stroke's width, a fill's height. */
const thick = (p) => (p.paint === 'stroke' ? p.width : p.y1 - p.y0);
const most = (ps, f) => (ps.length ? Math.max(...ps.map(f)) : null);
const union = (ps) => ({
  x0: Math.min(...ps.map((p) => p.x0)), y0: Math.min(...ps.map((p) => p.y0)),
  x1: Math.max(...ps.map((p) => p.x1)), y1: Math.max(...ps.map((p) => p.y1)),
});

/** The first run whose whole text matches `re` (a section title, in any case). */
export const headingRun = (snap, re) => snap.pages.flatMap((p) => p.items).find((t) => re.test(t.str.trim())) || null;

/**
 * The marks a heading style draws around title run `t`, each its thickness (Boxed: its height) or null:
 * { below, beside, bar, box, above }.
 */
export function headingMarks(snap, t) {
  const ps = drawn(snap, t.page);
  const mid = t.y + t.h * 0.35;
  // A thick Underline's stroke runs along the middle of its border, that much further down.
  const below = ps.filter((p) => flat(p) && p.x1 - p.x0 >= t.w * 0.4 && p.x0 <= t.x + 2 && p.y1 <= t.y && p.y1 >= t.y - 14 - (p.paint === 'stroke' ? p.width : 0));
  const beside = ps.filter((p) => p.paint === 'fill' && flat(p) && p.x0 >= t.x + t.w - 1 && (p.y0 + p.y1) / 2 >= t.y - 2 && (p.y0 + p.y1) / 2 <= t.y + t.h);
  const bar = ps.filter((p) => p.paint === 'fill' && p.x1 - p.x0 <= 15 && p.y1 - p.y0 >= t.h * 0.8 && p.x1 <= t.x + 1 && p.x0 >= t.x - 20 && p.y0 <= mid && p.y1 >= mid);
  const box = ps.filter((p) => p.paint === 'fill' && p.x0 <= t.x && p.x1 >= t.x + t.w && p.y0 <= t.y && p.y1 >= t.y + t.h * 0.7 && p.y1 - p.y0 <= t.h * 3);
  // A rule just over the title's line (Broadsheet's Ruled, Gridline's upper hairline), as wide as the title or more.
  const above = ps.filter((p) => p.paint === 'fill' && flat(p) && p.x1 - p.x0 >= t.w * 0.4 && p.x0 <= t.x + 2 && p.y0 >= t.y + t.h * 0.7 && p.y0 <= t.y + t.h * 2);
  return { below: most(below, thick), beside: most(beside, thick), bar: most(bar, (p) => p.x1 - p.x0), box: most(box, (p) => p.y1 - p.y0), above: most(above, thick) };
}

/** The mark each heading style prints (Plain: none). */
export const STYLE_MARK = { ruled: 'below', underline: 'below', line: 'beside', leftbar: 'bar', box: 'box', plain: null };

/** The mark `style` prints on `template`: Broadsheet's Ruled is a rule over the title (sectionHeadingLook's `overline`, R2-138 B2). */
export const styleMark = (template, style) => (template === 'broadsheet' && style === 'ruled' ? 'above' : STYLE_MARK[style]);

/** The section titles `state` prints, as runs on page 1, top first. */
export function titleRuns(snap, state) {
  const titles = new Set(state.sections.filter((s) => s.visible !== false).map((s) => s.title.trim().toLowerCase()));
  return snap.pages[0].items.filter((t) => titles.has(t.str.trim().toLowerCase())).sort((a, b) => b.y - a.y);
}

/**
 * The header's rule: a horizontal stroke (the header's bottom border) across half the page or more, below the
 * name and above the first section's title — its thickness, or null when none prints. A fill there is a
 * layout's own mark (Gridline's hairline, Bookend's and Chronicle's rules, R2-138 B2), not the rule.
 */
export function headerRule(snap, state, name) {
  const n = item(snap, name);
  const [first] = titleRuns(snap, state);
  if (!n || !first) return undefined;
  const W = snap.pages[0].W;
  const ps = drawn(snap, 1).filter((p) => p.paint === 'stroke' && flat(p, 14) && p.x1 - p.x0 >= W * 0.5 && p.y1 < n.y && p.y0 > first.y + first.h * 0.7);
  return most(ps, thick);
}

/**
 * The icon printed before `needle`'s run — on its line, or before the label on the line above it (the
 * Sidebar column prints "EMAIL" with its icon over the address): { box, size (its larger side), sig
 * (its marks) }, or null.
 */
export function iconBefore(snap, needle) {
  const t = item(snap, needle);
  if (!t) return undefined;
  const left = drawn(snap, t.page).filter((p) => p.x1 <= t.x + 0.5 && p.x0 >= t.x - 30 && p.x1 - p.x0 < 30 && p.y1 - p.y0 < 30);
  const onLine = left.filter((p) => p.y1 >= t.y - 3 && p.y0 <= t.y + t.h);
  const ps = onLine.length ? onLine : left.filter((p) => p.y0 >= t.y + t.h * 0.5 && p.y0 <= t.y + t.h * 2.5);
  if (!ps.length) return null;
  const box = union(ps);
  const r = (v) => Math.round((v - box.x0) * 10) / 10;
  const sig = ps.map((p) => `${p.paint}:${r(p.x0)},${r(p.x1)},${Math.round((p.y1 - p.y0) * 10) / 10}`).join(' ');
  return { box, size: Math.max(box.x1 - box.x0, box.y1 - box.y0), sig };
}

/**
 * The icon Design → Section Headings → Icons prints before section title run `t` (R2-147): the strokes
 * (Lucide outlines; no heading style strokes anything left of its title — a Left bar's bar and a
 * centred Line's rule are fills) within twice the title's height left of it, on its line: { box, size
 * (its larger side), gap (from its right edge to the title), mid (its middle's height above the
 * baseline), colours (its strokes'), sig }, or null.
 */
export function headingIcon(snap, t) {
  const reach = t.h * 2;
  // A straight rule at least as long as the title is tall is the heading's own border (Keystone's accent
  // edge, R2-138 B2), not an icon: an icon's lines stay inside its 24-unit box's 20-unit drawing, 0.83 of it.
  const rule = (p) => (p.x1 - p.x0 < 0.5 || p.y1 - p.y0 < 0.5) && Math.max(p.x1 - p.x0, p.y1 - p.y0) >= t.h;
  const ps = drawn(snap, t.page).filter((p) => p.paint === 'stroke' && !rule(p) && p.x1 <= t.x + 0.5 && p.x0 >= t.x - reach
    && p.x1 - p.x0 <= reach && p.y1 - p.y0 <= reach && p.y1 >= t.y - t.h * 0.6 && p.y0 <= t.y + t.h * 1.4);
  if (!ps.length) return null;
  const box = union(ps);
  const r = (v) => Math.round((v - box.x0) * 10) / 10;
  return {
    box, size: Math.max(box.x1 - box.x0, box.y1 - box.y0), gap: t.x - box.x1, mid: (box.y0 + box.y1) / 2 - t.y,
    colours: [...new Set(ps.map((p) => String(p.colour).toLowerCase()))],
    sig: ps.map((p) => `${r(p.x0)},${r(p.x1)},${Math.round((p.y1 - p.y0) * 10) / 10}`).join(' '),
  };
}

/** The contact runs `needles` print, grouped by baseline: [[run…]…], top line first. */
export function contactLines(snap, needles) {
  const runs = needles.map((s) => item(snap, s)).filter(Boolean);
  const lines = [];
  for (const t of runs.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((l) => l[0].page === t.page && Math.abs(l[0].y - t.y) < 2);
    if (line) line.push(t);
    else lines.push([t]);
  }
  return lines;
}

/** Does a ring (strokes or a fill, within 4 pt of it) enclose the page's photo? undefined without a photo. */
export function photoRing(snap) {
  const img = snap.paint.find((p) => p.paint === 'image' && p.page === 1);
  if (!img) return undefined;
  const near = drawn(snap, 1).filter((p) => p.x0 >= img.x0 - 4 && p.x1 <= img.x1 + 4 && p.y0 >= img.y0 - 4 && p.y1 <= img.y1 + 4);
  if (!near.length) return false;
  const u = union(near);
  return u.x0 <= img.x0 + 0.5 && u.x1 >= img.x1 - 0.5 && u.y0 <= img.y0 + 0.5 && u.y1 >= img.y1 - 0.5;
}
