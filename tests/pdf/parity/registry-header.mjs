// Personal Info's controls — Header Customization, Header spacing, Photo, and the eyes that hide a
// field — and what each one's own effect is in the PDF (matrix.mjs adds the checks every control gets).
import { item, prints } from './measure.mjs';
import { PERSONAL } from './store.mjs';
import { valueOf, grows } from './registry-design.mjs';
import { headerRule, iconBefore, contactLines, photoRing } from './marks.mjs';

const images = (snap) => snap.paint.filter((p) => p.paint === 'image' && p.page === 1);
/** The header's own text: the name, the title and each contact value. */
const HEADER = [PERSONAL.name, PERSONAL.title, PERSONAL.email, PERSONAL.phone, PERSONAL.location, PERSONAL.website, PERSONAL.linkedin, PERSONAL.github];
const headerRuns = (snap) => HEADER.map((s) => item(snap, s)).filter(Boolean);

/**
 * A header gap: from its smallest to its largest value, the distance between two things the header
 * prints — the photo, the name, the title, a contact — changes by exactly the change (px → pt): the gap
 * prints what the stepper says. Distances, not positions: a header centred on its photo moves every
 * line by half of it. How each gap moves each line is 45…50-header-*.test.mjs's; this proves the
 * control reaches the PDF on every template that offers it.
 */
function gapMoves(key) {
  return ({ runs }) => {
    const sorted = [...runs].filter((r) => typeof valueOf(r, key) === 'number').sort((a, b) => valueOf(a, key) - valueOf(b, key));
    if (sorted.length < 2) return [];
    const [lo, hi] = [sorted[0], sorted[sorted.length - 1]];
    const want = (valueOf(hi, key) - valueOf(lo, key)) * 0.75;
    const marks = (snap) => {
      const photo = images(snap)[0];
      return [...headerRuns(snap).map((r) => [r.str, r.x, r.y]), ...(photo ? [['<photo>', photo.x1, photo.y1]] : [])];
    };
    const [a, b] = [new Map(marks(lo.snap).map(([k, ...xy]) => [k, xy])), new Map(marks(hi.snap).map(([k, ...xy]) => [k, xy]))];
    const keys = [...a.keys()].filter((k) => b.has(k));
    const changes = [];
    for (const k of keys) changes.push(Math.abs(b.get(k)[0] - a.get(k)[0]), Math.abs(b.get(k)[1] - a.get(k)[1]));
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        for (const d of [0, 1]) changes.push(Math.abs((b.get(keys[j])[d] - b.get(keys[i])[d]) - (a.get(keys[j])[d] - a.get(keys[i])[d])));
      }
    }
    return changes.some((m) => Math.abs(m - want) < 0.2) ? []
      : [`${valueOf(lo, key)} → ${valueOf(hi, key)} px should move something in the header by ${want.toFixed(2)} pt; the changes: ${[...new Set(changes.map((m) => m.toFixed(2)))].slice(0, 12).join(', ')}`];
  };
}

/** A run ordered by `order` of its value, whose measure strictly grows (or shrinks, `down`) along it. */
function ordered(key, order, measure, what, { down = false } = {}) {
  return ({ runs }) => {
    const sorted = order.map((v) => runs.find((r) => valueOf(r, key) === v)).filter(Boolean);
    const out = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const [a, b] = [measure(sorted[i - 1]), measure(sorted[i])];
      if (a == null || b == null) out.push(`${what}: not found`);
      else if (down ? !(b < a - 0.01) : !(b > a + 0.01)) out.push(`${what} does not ${down ? 'fall' : 'grow'} from ${valueOf(sorted[i - 1], key)} (${a.toFixed(2)}) to ${valueOf(sorted[i], key)} (${b.toFixed(2)})`);
    }
    return out;
  };
}

/** Contact Style's mark between the contacts: Bullet prints •, Bar prints |, Icon neither. */
function contactMarks({ runs }) {
  const out = [];
  for (const r of runs) {
    const email = item(r.snap, PERSONAL.email);
    if (!email) { out.push('the e-mail does not print'); continue; }
    const line = r.snap.pages[email.page - 1].items.filter((t) => Math.abs(t.y - email.y) < 3).map((t) => t.str).join(' ');
    const v = valueOf(r, 'setting.contactStyle');
    const want = { bullet: '•', bar: '|' }[v];
    if (want && !line.includes(want)) out.push(`${v}: the contact line has no ${want}: "${line}"`);
    if (!want && /[•|]/.test(line)) out.push(`${v}: the contact line prints a separator: "${line}"`);
  }
  return out;
}

const CONTACTS = [PERSONAL.email, PERSONAL.phone, PERSONAL.location, PERSONAL.website, PERSONAL.linkedin, PERSONAL.github];
const hidesField = (field) => ({ family: 'visibility', hides: () => [PERSONAL[field]].filter(Boolean), check: ({ runs }) => runs.filter((r) => prints(r.snap, PERSONAL[field])).map(() => `hidden ${field} still prints`) });

export const HEADER_CONTROLS = {
  // The name's line is centred: the name, or the name and the title beside it where the header prints them
  // Inline (Compact's own layout, T9) — the line centred as one.
  'setting.headerAlign': {
    family: 'header',
    check: ({ runs }) => runs.flatMap((r) => {
      const [n, t] = [item(r.snap, PERSONAL.name), item(r.snap, PERSONAL.title)];
      const end = t && Math.abs(n.y - t.y) < n.h * 0.8 && t.x > n.x ? t.x + t.w : n.x + n.w;
      const W = r.snap.pages[0].W;
      const centred = Math.abs((n.x + end) / 2 - W / 2) < 2;
      return centred === (valueOf(r, 'setting.headerAlign') === 'center') ? [] : [`${valueOf(r, 'setting.headerAlign')}: the name's line's centre is at ${((n.x + end) / 2).toFixed(1)} of ${W.toFixed(1)}`];
    }),
  },
  'setting.headerLayout': {
    family: 'header',
    check: ({ runs }) => runs.flatMap((r) => {
      const [n, t] = [item(r.snap, PERSONAL.name), item(r.snap, PERSONAL.title)];
      const beside = Math.abs(n.y - t.y) < n.h * 0.8 && t.x > n.x;
      return beside === (valueOf(r, 'setting.headerLayout') === 'inline') ? [] : [`${valueOf(r, 'setting.headerLayout')}: the title sits at (${t.x.toFixed(1)}, ${t.y.toFixed(1)}), the name at (${n.x.toFixed(1)}, ${n.y.toFixed(1)})`];
    }),
  },
  'setting.showHeaderBorder': {
    family: 'header',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.showHeaderBorder');
      const rule = headerRule(r.snap, r.state, PERSONAL.name);
      if (rule === undefined) return [`${v}: the name or the first section's title does not print`];
      return (rule != null) === (v === true) ? [] : [`${v}: ${rule != null ? `a ${rule.toFixed(2)} pt rule prints` : 'no rule prints'} under the header`];
    }),
  },
  'setting.headerBorderWidth': { family: 'header', check: ({ runs }) => grows(runs, 'setting.headerBorderWidth', (r) => headerRule(r.snap, r.state, PERSONAL.name), 'the header rule\'s thickness') },
  // Single: one contact a line; 2 Columns: two columns of them; Justify: three or more share a line.
  'setting.contactLayout': {
    family: 'header',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.contactLayout');
      const lines = contactLines(r.snap, CONTACTS);
      const n = lines.flat().length;
      // A centred header centres each value in its cell (PdfContactRow): its columns are where the values'
      // centres gather (Academic's own header is centred, T8); else where they start.
      const xs = lines.flat().map((t) => t.x + t.w / 2).sort((a, b) => a - b);
      const cols = r.state?.settings?.headerAlign === 'center'
        ? (xs.length ? 1 + xs.slice(1).filter((x, i) => x - xs[i] > 3).length : 0)
        : new Set(lines.flat().map((t) => Math.round(t.x / 3))).size;
      const shape = lines.map((l) => l.length).join('+');
      if (v === 'single') return lines.length === n ? [] : [`single: ${n} contacts on ${lines.length} lines (${shape})`];
      if (v === '2grid') return cols === 2 && lines.length >= 2 ? [] : [`2grid: ${cols} columns, lines ${shape}`];
      if (v === 'justify') return lines.some((l) => l.length >= 3) ? [] : [`justify: no line holds three contacts (${shape})`];
      return [`${v}: a contact layout this test does not know`];
    }),
  },
  'setting.contactStyle': { family: 'header', check: contactMarks },
  // A field's picked icon replaces the one printed before that field.
  'setting.customContactIcons': {
    family: 'icons',
    check: ({ runs, before }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.customContactIcons');
      return Object.keys(v || {}).flatMap((field) => {
        const [was, now] = [iconBefore(before.snap, PERSONAL[field]), iconBefore(r.snap, PERSONAL[field])];
        if (!now) return [`${JSON.stringify(v)}: no icon before the ${field}`];
        return was && was.sig === now.sig ? [`${JSON.stringify(v)}: the ${field}'s icon is the same as before`] : [];
      });
    }),
  },
  'setting.photoTextGap': { family: 'gaps', check: gapMoves('setting.photoTextGap') },
  'setting.nameTitleGap': { family: 'gaps', check: gapMoves('setting.nameTitleGap') },
  'setting.headerInlineGap': { family: 'gaps', check: gapMoves('setting.headerInlineGap') },
  'setting.titleContactsGap': { family: 'gaps', check: gapMoves('setting.titleContactsGap') },
  'setting.iconTextGap': { family: 'gaps', check: gapMoves('setting.iconTextGap') },
  'setting.contactGapX': { family: 'gaps', check: gapMoves('setting.contactGapX') },
  'setting.contactGapY': { family: 'gaps', check: gapMoves('setting.contactGapY') },
  clear: { family: 'resets' },
  'setting.photoShape': { family: 'photo', check: ({ runs }) => runs.filter((r) => images(r.snap).length !== 1).map((r) => `${valueOf(r, 'setting.photoShape')}: ${images(r.snap).length} photos`) },
  'setting.photoSize': { family: 'photo', check: ordered('setting.photoSize', ['sm', 'md', 'lg'], (r) => images(r.snap)[0] && images(r.snap)[0].x1 - images(r.snap)[0].x0, 'the photo\'s width') },
  'setting.photoHeight': { family: 'photo', check: ordered('setting.photoHeight', ['match', 'tall', 'taller'], (r) => images(r.snap)[0] && images(r.snap)[0].y1 - images(r.snap)[0].y0, 'the photo\'s height') },
  // None: nothing round the photo; Thin and Accent: a ring hugging it (their colours differ: every value prints differently).
  'setting.photoBorder': {
    family: 'photo',
    check: ({ runs }) => runs.flatMap((r) => {
      const v = valueOf(r, 'setting.photoBorder');
      const ring = photoRing(r.snap);
      if (ring === undefined) return [`${v}: the photo does not print`];
      return ring === (v !== 'none') ? [] : [`${v}: ${ring ? 'a ring prints round the photo' : 'no ring prints round the photo'}`];
    }),
  },
  // Top, Center, Bottom line the text up with the photo's top, middle, bottom: whichever of the two is
  // taller stays, the other moves — so the name's height against the photo's top moves one way along them.
  'setting.photoTextAlign': {
    family: 'photo',
    check: ({ runs }) => {
      const pts = ['top', 'center', 'bottom'].map((v) => runs.find((r) => valueOf(r, 'setting.photoTextAlign') === v)).filter(Boolean)
        .map((r) => [valueOf(r, 'setting.photoTextAlign'), images(r.snap)[0] && item(r.snap, PERSONAL.name) ? images(r.snap)[0].y1 - item(r.snap, PERSONAL.name).y : null]);
      if (pts.some(([, m]) => m == null)) return ['the photo or the name does not print'];
      const d = pts.slice(1).map(([, m], i) => m - pts[i][1]);
      return d.every((x) => x > 0.01) || d.every((x) => x < -0.01) ? [] : [`the name does not move along the photo: ${pts.map(([v, m]) => `${v}→${m.toFixed(2)}`).join(', ')}`];
    },
  },
  'hide.photo': { family: 'visibility', check: ({ runs, before }) => (images(before.snap).length !== 1 ? ['the photo does not print before it is hidden'] : runs.filter((r) => images(r.snap).length).map(() => 'the hidden photo still prints')) },
  personal: { family: 'visibility', check: ({ runs }) => runs.filter((r) => r.writes.some((w) => w.key === 'photo') && images(r.snap).length).map(() => 'the removed photo still prints') },
  'hide.email': hidesField('email'),
  'hide.phone': hidesField('phone'),
  'hide.location': hidesField('location'),
  'hide.website': hidesField('website'),
  'hide.linkedin': hidesField('linkedin'),
  'hide.github': hidesField('github'),
  'hide.summary': { family: 'visibility', hides: () => ['Platform engineer who ships'], check: ({ runs }) => runs.filter((r) => prints(r.snap, 'Platform engineer who ships')).map(() => 'the hidden summary still prints') },
};
