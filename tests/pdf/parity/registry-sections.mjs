// A section's Section Options — what each one's own effect is on THAT section. Its text is looked for
// only in its own region of the page (below its heading, above the next heading in its column): the
// fixture's "Northwind Labs" is also an award's issuer and a reference's company. matrix.mjs adds the
// checks every control gets.
import { flow, ownRuns, prints } from './measure.mjs';
import { TYPE_MARKS } from './store.mjs';
import { valueOf } from './registry-design.mjs';
import { inSidebarColumn } from '../../../src/constants/templates.js';
import { languageLevel } from '../../../src/utils/languageLevel.js';

const typeOf = (control) => control.sectionId.replace(/^sec_/, '');
const norm = (s) => s.trim().toLowerCase();
const first = (s) => s.split(' ')[0];
const sameLine = (a, b) => a && b && a.page === b.page && Math.abs(a.y - b.y) < 3;
// The résumé's own text: a page's running header (ATS-7) is no section's.
const all = (snap) => ownRuns(snap);

/** Each visible section's heading run in `snap`, by type. */
const headings = (snap, state) => state.sections.filter((s) => s.visible !== false)
  .map((s) => ({ type: s.type, run: all(snap).find((t) => norm(t.str) === norm(s.title)) })).filter((h) => h.run);

/**
 * The runs of section `type`: below its heading and above the next heading of its column. The column is
 * read off `layout` (the page before the click: a centred heading still sits in its column); its left
 * edge is up to HEADING_INDENT left of the heading (Banner's headings sit 7 pt in from their entries).
 * A heading on the page's centre line (Lectern centres every title, R2-138 B2) is the page's one column:
 * it marks no column's edge.
 */
function region(snap, state, type, layout) {
  const own = headings(snap, state).find((h) => h.type === type)?.run;
  const was = headings(layout, state).find((h) => h.type === type)?.run || own;
  if (!own) return { head: null, runs: [] };
  const W = layout.pages[0].W;
  const onCentre = (t) => Math.abs(t.x + t.w / 2 - W / 2) < 2;
  const xs = headings(layout, state).map((h) => h.run).filter((t) => !onCentre(t)).map((t) => t.x);
  const left = onCentre(was) ? 0 : was.x - HEADING_INDENT;
  const right = Math.min(Infinity, ...xs.filter((x) => x > was.x + 20)) - 5;
  const inCol = (t) => t.x >= left && t.x < right;
  const top = flow(snap, own);
  const below = headings(snap, state).map((h) => h.run).filter((r) => r !== own && inCol(r) && flow(snap, r) > top);
  const end = below.length ? Math.min(...below.map((r) => flow(snap, r))) : Infinity;
  return { head: own, end, inCol, runs: all(snap).filter((t) => inCol(t) && flow(snap, t) > top && flow(snap, t) < end) };
}
const HEADING_INDENT = 12;
const find = (reg, s) => reg.runs.find((t) => norm(t.str).includes(norm(s))) || null;

/** fn({ r, v, m, reg, snap, before }) per run: its failure lines. */
function each(key, fn) {
  return ({ runs, control, before }) => {
    const m = TYPE_MARKS[typeOf(control)];
    return runs.flatMap((r) => fn({ r, v: valueOf(r, key), m, snap: r.snap, before, reg: region(r.snap, r.state, typeOf(control), before.snap) }) || []);
  };
}
/** The depth from the section's first entry to its second. */
const span = (reg, m, snap) => {
  const [a, b] = [find(reg, first(m.first)), find(reg, first(m.second))];
  return a && b ? flow(snap, b) - flow(snap, a) : null;
};

/** Along `order`, the measure never shrinks (a section of one line has nothing to space). */
function along(key, order, measure, what) {
  return ({ runs, control, before }) => {
    const m = TYPE_MARKS[typeOf(control)];
    const pts = order.map((v) => runs.find((r) => valueOf(r, key) === v)).filter(Boolean)
      .map((r) => [valueOf(r, key), measure(region(r.snap, r.state, typeOf(control), before.snap), m, r.snap)]);
    if (pts.some(([, x]) => x == null)) return [`${what}: not found`];
    return pts.some(([, x], i) => i > 0 && x < pts[i - 1][1] - 0.01) ? [`${what} shrinks along ${pts.map(([v, x]) => `${v}→${x.toFixed(2)}`).join(', ')}`] : [];
  };
}

/**
 * An override in px moves what it spaces by at least the change in pt (a page break only adds). A
 * measure may say which way it measured ({ axis, d }): two values measured along different axes are an
 * entry the larger gap pushed onto a line of its own — moved, so not compared.
 */
function override(key, measure, scale = () => 1) {
  return ({ runs, control, before, variant }) => {
    const m = TYPE_MARKS[typeOf(control)];
    const k = scale(variant, typeOf(control));
    const pts = runs.filter((r) => typeof valueOf(r, key) === 'number').sort((a, b) => valueOf(a, key) - valueOf(b, key))
      .map((r) => [valueOf(r, key), measure(region(r.snap, r.state, typeOf(control), before.snap), r.snap, m)])
      .map(([v, x]) => [v, x && typeof x === 'object' ? x.d : x, x && typeof x === 'object' ? x.axis : 'y']);
    const out = [];
    for (let i = 1; i < pts.length; i += 1) {
      const want = (pts[i][0] - pts[i - 1][0]) * 0.75 * k;
      if (pts[i][1] == null || pts[i - 1][1] == null) out.push('not found');
      else if (pts[i][2] !== pts[i - 1][2]) continue;
      else if (pts[i][1] - pts[i - 1][1] < want - 0.5) out.push(`${pts[i - 1][0]} → ${pts[i][0]} px moves it ${(pts[i][1] - pts[i - 1][1]).toFixed(2)} pt, not ${want.toFixed(2)}`);
    }
    return out;
  };
}

/**
 * What Gap between items spaces: the first two entries (in the section's order, m.seq) that print on
 * different lines, top to top — a grid's row gap: Languages and References print two to a row — or,
 * when all of them share one line (Interests' chips), the first two, left to left.
 */
const entryGap = (reg, snap, m) => {
  const at = (m.seq || [m.first, m.second]).map((s) => find(reg, first(s)));
  if (at.some((t) => !t)) return null;
  for (let i = 1; i < at.length; i += 1) if (!sameLine(at[i - 1], at[i])) return { axis: 'y', d: flow(snap, at[i]) - flow(snap, at[i - 1]) };
  return { axis: 'x', d: at[1].x - at[0].x };
};
/** Space before: from the last line above the heading (in its column) to the heading. */
const gapAbove = (reg, snap) => {
  if (!reg.head) return null;
  const top = flow(snap, reg.head);
  const above = all(snap).filter((t) => reg.inCol(t) && flow(snap, t) < top - 0.5 && t.page === reg.head.page);
  return above.length ? top - Math.max(...above.map((t) => flow(snap, t))) : null;
};
/** Space after: from the section's last line to the next heading of its column. */
const gapBelow = (reg, snap) => (reg.runs.length && Number.isFinite(reg.end) ? reg.end - Math.max(...reg.runs.map((t) => flow(snap, t))) : null);

/**
 * The Sidebar column's interest chips sit 2.5 pt apart at the default 6 pt item gap and follow a changed
 * one in that proportion, on purpose (R2-6, PdfSidebarColumn.jsx SideInterests): every other gap is the
 * value itself.
 */
const chipScale = (variant, type) => (type === 'interests' && inSidebarColumn(variant.template, type, variant.settings) ? 2.5 / 6 : 1);

/**
 * Per language entry (`entries`: its run, in the section's order), the shapes painted for it: each small
 * fill goes to the entry it hangs from — on its page, from the entry's left edge to the next entry on its
 * line, the nearest whose top is above the shape's centre (its own line in the main column, the line
 * under it in the Sidebar's side column). `dot`: small round fills; `bar`: flat ones (a track and its fill).
 */
function levelShapes(snap, entries) {
  const [w, h] = [(p) => p.x1 - p.x0, (p) => p.y1 - p.y0];
  const counts = entries.map(() => ({ dot: 0, bar: 0 }));
  const top = (L, cy) => L.y + L.h - cy;
  for (const p of snap.paint) {
    if (p.paint !== 'fill') continue;
    const kind = w(p) >= 2 && w(p) <= 8 && Math.abs(w(p) - h(p)) < 0.6 ? 'dot'
      : h(p) >= 1.5 && h(p) <= 6 && w(p) >= 2 * h(p) && w(p) <= 60 ? 'bar' : null;
    if (!kind) continue;
    const cy = (p.y0 + p.y1) / 2;
    let owner = -1;
    entries.forEach((L, i) => {
      if (!L || L.page !== p.page || p.x0 < L.x - 1) return;
      const next = Math.min(Infinity, ...entries.filter((o) => o && o !== L && sameLine(o, L) && o.x > L.x).map((o) => o.x));
      if (p.x0 >= next || top(L, cy) < 0 || top(L, cy) > 20) return;
      if (owner < 0 || top(L, cy) < top(entries[owner], cy)) owner = i;
    });
    if (owner >= 0) counts[owner][kind] += 1;
  }
  return counts;
}
/**
 * Languages' Level (languageLevel.js, R2-147): Dots paints five small circles for each language that
 * names a known proficiency, Bar a track and its fill; Text paints neither. Every language and every
 * proficiency's word still prints under all three. Counted against Text's page (or the page before the
 * click), so what a template paints there of its own is not counted.
 */
function levelCheck({ runs, control, before }) {
  const text = runs.find((r) => valueOf(r, 'section.levelStyle') === 'text') || before;
  const items = (state) => state.sections.find((s) => s.id === control.sectionId)?.items || [];
  const regText = region(text.snap, text.state, 'languages', before.snap);
  const was = levelShapes(text.snap, items(text.state).map((it) => find(regText, it.language)));
  return runs.flatMap((r) => {
    const v = valueOf(r, 'section.levelStyle');
    const want = { text: { dot: 0, bar: 0 }, dots: { dot: 5, bar: 0 }, bar: { dot: 0, bar: 2 } }[v];
    const reg = region(r.snap, r.state, 'languages', before.snap);
    const list = items(r.state);
    const out = [];
    for (const it of list) {
      if (!find(reg, it.language)) out.push(`${v}: "${it.language}" does not print`);
      if (it.proficiency && !find(reg, it.proficiency)) out.push(`${v}: "${it.proficiency}" does not print`);
    }
    if (!want) return out;
    const got = levelShapes(r.snap, list.map((it) => find(reg, it.language)));
    list.forEach((it, i) => {
      const w = languageLevel(it.proficiency) ? want : { dot: 0, bar: 0 };
      const d = { dot: got[i].dot - (was[i]?.dot || 0), bar: got[i].bar - (was[i]?.bar || 0) };
      if (d.dot !== w.dot || d.bar !== w.bar) out.push(`${v}: "${it.language}" (${it.proficiency}) paints ${d.dot} dot(s) and ${d.bar} bar shape(s), not ${w.dot} and ${w.bar}`);
    });
    return out;
  });
}

export const SECTIONS = {
  'section.alignment': {
    family: 'sections',
    check: ({ runs, control, before }) => {
      const m = TYPE_MARKS[typeOf(control)];
      const [l, c] = ['left', 'center'].map((v) => runs.find((r) => valueOf(r, 'section.alignment') === v));
      if (!l || !c) return [];
      const [a, b] = [l, c].map((r) => find(region(r.snap, r.state, typeOf(control), before.snap), first(m.first)));
      return a && b && b.x > a.x + 3 ? [] : [`"${m.first}" is not moved toward the centre (${a?.x.toFixed(1)} → ${b?.x.toFixed(1)})`];
    },
  },
  'section.spacing': { family: 'sections', check: along('section.spacing', ['compact', 'normal', 'relaxed'], span, 'the section\'s depth') },
  'section.columns': {
    family: 'sections',
    check: each('section.columns', ({ v, m, reg }) => {
      const [a, b] = (m.cells || [first(m.first), first(m.second)]).map((s) => find(reg, s));
      if (!a || !b) return [`${v}: "${m.first}" or "${m.second}" does not print in the section`];
      const side = sameLine(a, b) && b.x > a.x;
      return side === (v > 1) ? [] : [`${v} column(s): "${b.str}" at (${b.x.toFixed(1)}, ${b.y.toFixed(1)}), "${a.str}" at (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`];
    }),
  },
  'section.titleOrder': {
    family: 'sections',
    check: each('section.titleOrder', ({ v, m, reg, snap }) => {
      const [co, role] = [find(reg, first(m.first)), find(reg, m.title)];
      if (!co || !role) return [`${v}: the company or the role does not print`];
      const roleFirst = co === role ? norm(role.str).indexOf(norm(m.title)) < norm(role.str).indexOf(norm(first(m.first)))
        : flow(snap, role) < flow(snap, co) - 1 || (sameLine(role, co) && role.x < co.x);
      return roleFirst === (v === 'role') ? [] : [`${v}: the role and the company print in the other order`];
    }),
  },
  'section.titleStyle': {
    family: 'sections',
    check: each('section.titleStyle', ({ v, m, reg }) => {
      const [a, b] = [find(reg, first(m.first)), find(reg, m.title)];
      if (!a || !b) return [`${v}: the entry's title or subtitle does not print`];
      return (a === b || sameLine(a, b)) === (v !== 'stacked') ? [] : [`${v}: "${a.str}" at y ${a.y.toFixed(1)}, "${b.str}" at y ${b.y.toFixed(1)}`];
    }),
  },
  'section.skillsStyle': {
    family: 'sections',
    check: each('section.skillsStyle', ({ v, m, reg, snap, before }) => {
      const [s, label] = [find(reg, m.first), find(reg, m.label)];
      if (!s) return [`${v}: "${m.first}" does not print`];
      const line = reg.runs.filter((t) => Math.abs(t.y - s.y) < 3 && t.page === s.page).map((t) => t.str).join(' ');
      if (v === 'bullet' && !line.includes('•')) return [`bullet: no • on "${line}"`];
      if (v === 'stacked' && label && sameLine(label, s)) return ['stacked: the category and its skills share a line'];
      const fills = (x) => x.paint.filter((p) => p.paint === 'fill').length;
      if (v === 'tags' && !(fills(snap) > fills(before.snap))) return ['tags: no tag is painted'];
      return [];
    }),
  },
  'section.separator': {
    family: 'sections',
    check: each('section.separator', ({ v, m, snap }) => {
      if (prints(snap, `${m.label}:`) !== (v === 'colon')) return [`${v}: "${m.label}:" ${v === 'colon' ? 'does not print' : 'still prints'}`];
      // Dash's and Pipe's own mark after the category (skillSeparator, R2-147).
      const own = { dash: `${m.label} –`, pipe: `${m.label} |` }[v];
      return own && !prints(snap, own) ? [`${v}: "${own}" does not print`] : [];
    }),
  },
  'section.levelStyle': { family: 'sections', check: levelCheck },
  // Group roles by company (R2-147): on, the fixture's two roles at Northwind Labs print under its name
  // printed once, both roles still printing; off, the name prints with each of them.
  'section.groupRoles': {
    family: 'sections',
    check: ({ runs, control, before }) => {
      const type = typeOf(control);
      const m = TYPE_MARKS[type];
      const times = (reg) => reg.runs.filter((t) => norm(t.str).includes(norm(first(m.first)))).length;
      return runs.flatMap((r) => {
        const v = valueOf(r, 'section.groupRoles');
        const reg = region(r.snap, r.state, type, before.snap);
        const n = times(reg);
        if (![m.title, m.grouped].every((s) => find(reg, first(s)))) return [`${v}: "${m.title}" or "${m.grouped}" does not print`];
        if (v === true && n !== 1) return [`on: "${m.first}" prints ${n} times in the section, not once`];
        return v !== true && n < 2 ? [`off: "${m.first}" prints ${n} time(s), not with each role`] : [];
      });
    },
  },
  'section.showDates': { family: 'sections', check: each('section.showDates', ({ v, m, snap }) => (v === false && m.date && prints(snap, m.date) ? [`hidden dates still print (${m.date})`] : [])) },
  'section.showLocation': { family: 'sections', check: each('section.showLocation', ({ v, m, snap }) => (v === false && m.location && prints(snap, m.location) ? [`hidden location still prints (${m.location})`] : [])) },
  'section.spaceBefore': { family: 'overrides', check: override('section.spaceBefore', gapAbove) },
  'section.spaceAfter': { family: 'overrides', check: override('section.spaceAfter', gapBelow) },
  'section.itemGap': { family: 'overrides', check: override('section.itemGap', entryGap, chipScale) },
};
