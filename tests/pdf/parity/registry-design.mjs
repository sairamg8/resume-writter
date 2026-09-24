// The Design panel's controls: what each one's own effect is, measured in the PDF. Every control also
// gets matrix.mjs's checks (it changes the PDF, loses no text, overlaps nothing); these are the effects
// only this control has. A check returns failure lines; `value(run)` is the value the run wrote.
import { loadModule } from '../harness.mjs';
import { item, flow, fillsOf, prints } from './measure.mjs';
import { PERSONAL, baseResume } from './store.mjs';
import { shot } from './matrix.mjs';
import { headingMarks, iconBefore, STYLE_MARK } from './marks.mjs';

export const valueOf = (run, key) => run.writes.find((w) => `${w.kind}.${w.key}` === key || w.kind === key)?.value;
const byValue = (runs, key) => [...runs].filter((r) => typeof valueOf(r, key) === 'number').sort((a, b) => valueOf(a, key) - valueOf(b, key));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const hex = (c) => String(c).toLowerCase();
/** Lines for each consecutive pair of runs (by value) whose measure does not strictly grow. */
export function grows(runs, key, measure, what) {
  const out = [];
  const sorted = byValue(runs, key);
  for (let i = 1; i < sorted.length; i += 1) {
    const [a, b] = [measure(sorted[i - 1]), measure(sorted[i])];
    if (a == null || b == null) out.push(`${what}: not found at ${valueOf(sorted[i - 1], key)} / ${valueOf(sorted[i], key)}`);
    else if (!(b > a + 0.01)) out.push(`${what} does not grow from ${valueOf(sorted[i - 1], key)} (${a.toFixed(2)}) to ${valueOf(sorted[i], key)} (${b.toFixed(2)})`);
  }
  return out;
}
/** Lines for runs whose measure - value (or / value) is not the same for every value. */
function tracks(runs, key, measure, what, { ratio = false, tol = 0.06 } = {}) {
  const out = [];
  const pts = byValue(runs, key).map((r) => [valueOf(r, key), measure(r)]);
  if (pts.some(([, m]) => m == null)) return [`${what}: not found`];
  const k = pts.map(([v, m]) => (ratio ? m / v : m - v));
  for (let i = 1; i < k.length; i += 1) if (!near(k[i], k[0], ratio ? tol / 10 : tol)) out.push(`${what} does not follow the value: ${pts.map(([v, m]) => `${v}→${m.toFixed(2)}`).join(', ')}`);
  return out;
}
const hasColour = (snap, c) => [...snap.colours].some((x) => hex(x) === hex(c));
const heading = (snap, re) => snap.pages.flatMap((p) => p.items).find((t) => re.test(t.str.trim())) || null;
const EXPERIENCE = /^professional experience$/i;
/** The first entry's header line — the company or the role, whichever the template prints first. */
const entryHeader = (snap) => {
  const [co, role] = [item(snap, 'Northwind Labs'), item(snap, 'Staff Engineer')];
  if (!co || !role) return co || role;
  return flow(snap, role) < flow(snap, co) - 1 || (Math.abs(flow(snap, role) - flow(snap, co)) <= 1 && role.x < co.x) ? role : co;
};
/** The page's gaps above its first text and beside its text, per page. */
const topGaps = (snap) => snap.pages.map((p) => p.H - Math.max(...p.items.map((t) => t.y + t.h)));
const sideGaps = (snap) => {
  const all = snap.pages.flatMap((p) => p.items);
  return [Math.min(...all.map((t) => t.x)), snap.pages[0].W - Math.max(...all.map((t) => t.x + t.w))];
};

/** The Name and Job title as printed: the colour picked, or — on a ground it cannot be read on — another. */
async function headerColour({ runs, before, variant }, key, needle) {
  const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const { headerGround } = await loadModule('/src/templates/pdf/shared/headerColors.js');
  const was = await fillsOf(before.snap.bytes, needle);
  const out = [];
  for (const r of runs) {
    const v = valueOf(r, key);
    if (!v) continue;
    const got = await fillsOf(r.snap.bytes, needle);
    const reads = contrast(v, headerGround(r.state.settings, variant.template)) >= 3;
    if (reads && !got.some((c) => hex(c) === hex(v))) out.push(`${v}: "${needle}" prints in ${got.join(',')}`);
    if (!reads && JSON.stringify(got) === JSON.stringify(was)) out.push(`${v}: "${needle}" keeps its colour ${got.join(',')}`);
  }
  return out;
}

const CONTACTS = [PERSONAL.email, PERSONAL.phone, PERSONAL.location, PERSONAL.website, PERSONAL.linkedin, PERSONAL.github];

/** Each paper's page box, [width, height] in pt (react-pdf's A4 and LETTER), written out — not read from PAGE_SIZES. */
const PAPER = { A4: [595.28, 841.89], LETTER: [612, 792] };

const DATES = { asEntered: '01/2021', 'MMM YYYY': 'Jan 2021', 'MMMM YYYY': 'January 2021', 'MM/YYYY': '01/2021',
  'MM.YYYY': '01.2021', 'YYYY-MM': '2021-01', 'YYYY.MM': '2021.01', YYYY: '2021' };

export const DESIGN = {
  // A template picked from its defaults prints exactly what a résumé started on it prints.
  template: {
    family: 'template',
    check: async ({ runs, variant }) => {
      const out = [];
      for (const r of runs) {
        const v = valueOf(r, 'template');
        const fresh = await shot(baseResume(v, variant.settings, { compact: true }));
        if (r.snap.drawing !== fresh.drawing) out.push(`${v}: switched to, it does not print what a résumé started on ${v} prints`);
      }
      return out;
    },
  },
  // Reset Design Settings keeps the Sidebar's Single · ATS-safe Layout: the ATS-safe page it promises (R2-089);
  // and the paper, which no template has one of its own (R2-136).
  resetAll: { family: 'resets', keeps: ['setting.sidebarSingleColumn', 'setting.pageSize'] },
  'setting.sidebarSingleColumn': {
    family: 'template',
    check: ({ runs }) => runs.flatMap((r) => {
      const [a, b] = [heading(r.snap, EXPERIENCE), heading(r.snap, /^skills$/i)];
      if (!a || !b) return [`headings not found`];
      const one = near(a.x, b.x, 2);
      return one === (valueOf(r, 'setting.sidebarSingleColumn') === true) ? [] : [`${valueOf(r, 'setting.sidebarSingleColumn')}: Skills at x ${b.x.toFixed(1)}, Experience at ${a.x.toFixed(1)}`];
    }),
  },
  'setting.accentColor': { family: 'colors', check: ({ runs }) => runs.filter((r) => !hasColour(r.snap, valueOf(r, 'setting.accentColor'))).map((r) => `${valueOf(r, 'setting.accentColor')} prints nowhere`) },
  'setting.textColor': {
    family: 'colors',
    check: async ({ runs }) => {
      const out = [];
      // The entry's first line (company or role, as the template orders them) prints in the Text colour
      // itself; descriptions and dates print in tints of it.
      for (const r of runs) {
        const got = [...await fillsOf(r.snap.bytes, 'Northwind Labs'), ...await fillsOf(r.snap.bytes, 'Staff Engineer')];
        if (!got.some((c) => hex(c) === hex(valueOf(r, 'setting.textColor')))) out.push(`${valueOf(r, 'setting.textColor')}: the entry header prints in ${got.join(',')}`);
      }
      return out;
    },
  },
  'setting.headerTextColor': {
    family: 'colors',
    check: async ({ runs, before }) => {
      const was = await fillsOf(before.snap.bytes, PERSONAL.name);
      const out = [];
      for (const r of runs) if (JSON.stringify(await fillsOf(r.snap.bytes, PERSONAL.name)) === JSON.stringify(was)) out.push(`${valueOf(r, 'setting.headerTextColor')}: the name keeps its colour`);
      return out;
    },
  },
  'setting.nameColor': { family: 'colors', check: (ctx) => headerColour(ctx, 'setting.nameColor', PERSONAL.name) },
  'setting.jobTitleColor': { family: 'colors', check: (ctx) => headerColour(ctx, 'setting.jobTitleColor', PERSONAL.title) },
  'setting.sidebarBg': { family: 'colors', check: ({ runs }) => runs.filter((r) => !hasColour(r.snap, valueOf(r, 'setting.sidebarBg'))).map((r) => `${valueOf(r, 'setting.sidebarBg')} prints nowhere`) },
  'setting.sectionBorderColor': { family: 'headings', check: ({ runs }) => runs.filter((r) => valueOf(r, 'setting.sectionBorderColor') && !hasColour(r.snap, valueOf(r, 'setting.sectionBorderColor'))).map((r) => `${valueOf(r, 'setting.sectionBorderColor')} prints nowhere`) },
  // Every set prints an icon before every contact the header shows.
  'setting.iconSet': {
    family: 'icons',
    check: ({ runs }) => runs.flatMap((r) => CONTACTS.filter((c) => item(r.snap, c) && !iconBefore(r.snap, c))
      .map((c) => `${valueOf(r, 'setting.iconSet')}: no icon before "${c}"`)),
  },
  'setting.iconSize': { family: 'icons', check: ({ runs }) => grows(runs, 'setting.iconSize', (r) => iconBefore(r.snap, PERSONAL.email)?.size, 'the e-mail icon\'s size') },
  'setting.contactStyle': { family: 'header' },
  'setting.font': {
    family: 'fonts',
    check: async ({ runs }) => {
      const { FONTS } = await loadModule('/src/utils/fonts.js');
      const out = [];
      for (const r of runs) {
        const f = FONTS.find((x) => x.id === valueOf(r, 'setting.font'));
        const want = f.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const all = r.snap.pages.flatMap((p) => p.items);
        const own = all.filter((t) => t.font.replace(/[^a-z0-9]/gi, '').toLowerCase().startsWith(want));
        if (own.length < all.length * 0.9) out.push(`${f.id}: ${own.length}/${all.length} runs print in ${f.name} (e.g. ${all.find((t) => !own.includes(t))?.font})`);
      }
      return out;
    },
  },
  // Picking a face writes it with Font Family (customFont ''), whose check covers both; a Google font
  // typed into Custom font is fetched from the network when applied — not a probe the walker can type.
  'setting.customFont': { family: 'fonts', with: 'setting.font' },
  'setting.fontSize': { family: 'resets' },
  // A description prints at the base size or a fixed step under it (Sidebar's main column: -0.5 pt).
  'setting.fontSizeBase': { family: 'type', check: ({ runs }) => tracks(runs, 'setting.fontSizeBase', (r) => item(r.snap, 'Built the checkout')?.h, 'body text size') },
  // A large name or title wraps in a narrow column: its first word is measured.
  'setting.fontSizeNameDelta': { family: 'type', check: ({ runs }) => tracks(runs, 'setting.fontSizeNameDelta', (r) => item(r.snap, 'Jordan')?.h, 'name size') },
  'setting.fontSizeSectionDelta': { family: 'type', check: ({ runs }) => tracks(runs, 'setting.fontSizeSectionDelta', (r) => heading(r.snap, /^professional( experience)?$/i)?.h, 'section title size') },
  'setting.fontSizeEntryDelta': {
    family: 'type',
    check: ({ runs, before }) => {
      // The entry header is the bold one of company and role (which one leads is the template's); a
      // large one wraps, so its first word is measured.
      const head = ['Northwind Labs', 'Staff Engineer'].find((s) => /bold/i.test(item(before.snap, s)?.font || '')) || entryHeader(before.snap)?.str;
      return tracks(runs, 'setting.fontSizeEntryDelta', (r) => item(r.snap, head.split(' ')[0])?.h, `entry header size ("${head}")`);
    },
  },
  'setting.lineHeightValue': {
    family: 'spacing',
    // The long paragraph's first two lines (it wraps on every template): their pitch / Line Height is its font size.
    check: ({ runs }) => tracks(runs, 'setting.lineHeightValue', (r) => {
      const a = item(r.snap, 'Built the checkout');
      if (!a) return null;
      const below = r.snap.pages[a.page - 1].items.filter((t) => Math.abs(t.x - a.x) < 1 && t.y < a.y - 1);
      return below.length ? a.y - Math.max(...below.map((t) => t.y)) : null;
    }, 'line pitch', { ratio: true, tol: 0.3 }),
  },
  'setting.marginV': {
    family: 'spacing',
    check: ({ runs }) => {
      const sorted = byValue(runs, 'setting.marginV');
      const pages = Math.min(...sorted.map((r) => r.snap.pages.length));
      const ok = [...Array(pages).keys()].some((p) => sorted.every((r, i) => i === 0 || topGaps(r.snap)[p] > topGaps(sorted[i - 1].snap)[p] + 0.01));
      return ok ? [] : [`no page's top gap grows with the margin: ${sorted.map((r) => `${valueOf(r, 'setting.marginV')}→${topGaps(r.snap).map((g) => g.toFixed(1)).join('/')}`).join(', ')}`];
    },
  },
  'setting.marginH': {
    family: 'spacing',
    check: ({ runs }) => {
      const sorted = byValue(runs, 'setting.marginH');
      const ok = [0, 1].some((side) => sorted.every((r, i) => i === 0 || sideGaps(r.snap)[side] > sideGaps(sorted[i - 1].snap)[side] + 0.01));
      return ok ? [] : [`neither side's gap grows with the margin: ${sorted.map((r) => `${valueOf(r, 'setting.marginH')}→${sideGaps(r.snap).map((g) => g.toFixed(1)).join('/')}`).join(', ')}`];
    },
  },
  // Design → Spacing → Page size (R2-136): every page prints on the paper picked, to 0.01 pt.
  'setting.pageSize': {
    family: 'spacing',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.pageSize');
      const want = PAPER[v];
      if (!want) return [`${v}: a page size this test does not know — add its box to PAPER`];
      const boxes = r.snap.pages.map((p) => [p.W, p.H].map((n) => Math.round(n * 100) / 100));
      return boxes.every(([w, h]) => w === want[0] && h === want[1]) ? [] : [`${v}: pages of ${boxes.map((b) => b.join(' × ')).join(', ')} pt, not ${want.join(' × ')}`];
    }),
  },
  'setting.sectionGap': {
    family: 'spacing',
    check: ({ runs }) => grows(runs, 'setting.sectionGap', (r) => Math.max(...r.snap.pages.flatMap((p) => p.items).map((t) => flow(r.snap, t))), 'the last line\'s depth'),
  },
  'setting.itemGap': {
    family: 'spacing',
    check: ({ runs }) => grows(runs, 'setting.itemGap', (r) => flow(r.snap, item(r.snap, 'Contoso Retail')) - flow(r.snap, item(r.snap, 'Northwind Labs')), 'the gap between two entries'),
  },
  // Each style's own mark around the Experience title (marks.mjs), and Plain none of them.
  'setting.headingStyle': {
    family: 'headings',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.headingStyle');
      const t = heading(r.snap, EXPERIENCE);
      if (!t) return [`${v}: the Experience title does not print`];
      const m = headingMarks(r.snap, t);
      const found = Object.entries(m).filter(([, x]) => x != null).map(([k]) => k);
      const want = STYLE_MARK[v];
      if (want === undefined) return [`${v}: a heading style this test does not know — add its mark to marks.mjs`];
      return (want ? m[want] != null : !found.length) ? [] : [`${v}: prints ${found.join(', ') || 'no mark'} around the title, not ${want || 'none'}`];
    }),
  },
  // The style's mark thickens along the value (a bar is 2 pt wider than the value: its width grows the same).
  'setting.sectionBorderWidth': {
    family: 'headings',
    check: ({ runs }) => grows(runs, 'setting.sectionBorderWidth', (r) => {
      const t = heading(r.snap, EXPERIENCE);
      const m = t && headingMarks(r.snap, t);
      return m ? m.below ?? m.beside ?? m.bar : null;
    }, 'the heading mark\'s thickness'),
  },
  'setting.sectionTitleCase': {
    family: 'headings',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.sectionTitleCase');
      const want = v === 'upper' ? 'PROFESSIONAL EXPERIENCE' : 'Professional Experience';
      return r.snap.text.includes(want) ? [] : [`${v}: "${want}" does not print`];
    }),
  },
  'setting.dateFormat': {
    family: 'dates',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.dateFormat');
      if (!(v in DATES)) return [`${v}: a date format this test does not know — add what 01/2021 prints as`];
      return prints(r.snap, `${DATES[v]} –`) || prints(r.snap, `${DATES[v]} -`) ? [] : [`${v}: the first entry's start does not print as "${DATES[v]}"`];
    }),
  },
};
