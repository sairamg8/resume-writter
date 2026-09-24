// Unit test for controls that only appear on hover (AUD-33): the entry drag grip, the dashboard's
// rename pencil, the job overview's edit pencils, a task's delete X, the Kanban card's Open/delete
// row, the job list's posting link and delete button, and a board's delete button all start at
// `opacity-0` and are revealed only by `group-hover:opacity-100`. Tailwind v4 emits every hover
// variant inside `@media (hover: hover)`, so on a phone or tablet (hover: none) nothing ever lifts
// them off 0%: they can be tapped, but nobody can see them — and the pencil is the only way to edit
// a job's Company, Role, Location, Salary, URL, Applied Date and Contact.
//
// The test finds every class string in src/ that hides with opacity-0 and reveals on group hover,
// compiles the app's own src/index.css with Tailwind, and works out the opacity each one ends up
// with on a touch screen, and on a desktop before and during hover. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = path.join(ROOT, 'src');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

// Hover-only on purpose: decorative hints inside something that is already visible and tappable,
// so a touch screen loses nothing. Matched by file and a snippet of the line, not by line number.
const DECORATIVE = [
  { file: 'src/components/ResumeCard.jsx', snippet: 'group-hover:bg-black/5',
    why: 'the "Open" overlay on the thumbnail; the thumbnail and the Edit button both open the résumé' },
  { file: 'src/components/BulletOptimizerModal.jsx', snippet: 'Use Template →',
    why: 'the "Use Template →" hint inside a template button that is always visible' },
];

const REVEAL = /^group-hover(\/[\w-]+)?:opacity-100$/;
const LITERAL = /(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

function sourcesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sourcesUnder(full) : /\.jsx?$/.test(e.name) ? [full] : [];
  });
}

/** Every string literal whose classes hide an element with opacity-0 and reveal it on group hover. */
function hoverRevealSites() {
  return sourcesUnder(SRC).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    return [...text.matchAll(LITERAL)].flatMap((m) => {
      const classes = m[2].split(/\s+/).filter(Boolean);
      if (!classes.includes('opacity-0') || !classes.some((c) => REVEAL.test(c))) return [];
      const line = text.slice(0, m.index).split('\n').length;
      return [{ file: rel(file), line, lineText: lines[line - 1], classes }];
    });
  });
}

async function appStylesheet() {
  const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8');
  return compile(css, {
    base: SRC,
    loadStylesheet: async (id, base) => {
      const file = id === 'tailwindcss' ? path.join(ROOT, 'node_modules/tailwindcss/index.css') : path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
}

/** Every `opacity` declaration in the CSS, in source order, with the at-rules and selectors around it. */
function opacityRules(css) {
  const rules = [];
  const stack = [];
  let buf = '';
  const flush = () => {
    const decl = buf.trim().match(/^opacity\s*:\s*(.+)$/);
    if (decl) rules.push({ context: [...stack], value: decl[1].trim() });
    buf = '';
  };
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i + 2) + 1; continue; }
    if (ch === '"' || ch === "'") { const end = css.indexOf(ch, i + 1); buf += css.slice(i, end + 1); i = end; continue; }
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { flush(); stack.pop(); }
    else if (ch === ';') flush();
    else buf += ch;
  }
  return rules;
}

const escapeClass = (c) => c.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
const unescaped = (selector) => selector.replace(/\\./g, '_');

/**
 * The opacity an element with these classes ends up with. Tailwind writes a variant after the bare
 * utility and never with a lower specificity, so the last declaration that applies wins.
 */
function opacityOf(css, classes, { canHover, hovered }) {
  const names = classes.map((c) => new RegExp(`\\.${escapeClass(c).replace(/[\\/.:]/g, '\\$&')}(?![\\w\\\\-])`));
  let value = '100%'; // CSS's initial opacity: 1
  for (const rule of opacityRules(css)) {
    const selectors = rule.context.filter((p) => !p.startsWith('@'));
    if (!selectors.some((s) => names.some((n) => n.test(s)))) continue;
    const applies = rule.context.every((p) => {
      if (p.startsWith('@layer')) return true;
      if (p === '@media (hover: hover)') return canHover;
      if (p === '@media (hover: none)') return !canHover;
      if (p.startsWith('@')) throw new Error(`no rule here for the at-rule "${p}" around ${classes.join(' ')}`);
      // Nothing here has keyboard focus: a control that also shows while tabbed to
      // (focus-visible: / focus-within:, R2-115) is still hidden until hovered.
      if (/:focus(-visible|-within)?\b/.test(unescaped(p))) return false;
      return !/:hover\b/.test(unescaped(p)) || hovered;
    });
    if (applies) value = rule.value;
  }
  return value;
}

const TOUCH = { canHover: false, hovered: false };
const DESKTOP_IDLE = { canHover: true, hovered: false };
const DESKTOP_HOVER = { canHover: true, hovered: true };
const isDecorative = (site) => DECORATIVE.some((d) => d.file === site.file && site.lineText.includes(d.snippet));

test('touch reveal: every hover-revealed control is visible on a touch screen (AUD-33)', async () => {
  const sites = hoverRevealSites().filter((site) => !isDecorative(site));
  // The 8 controls of AUD-33; fewer means the search above broke, not that the bug is gone.
  assert.ok(sites.length >= 8, `found only ${sites.length} hover-revealed controls: ${sites.map((s) => `${s.file}:${s.line}`).join(', ')}`);
  const { build } = await appStylesheet();
  const hidden = sites
    .map((site) => ({ at: `${site.file}:${site.line}`, touch: opacityOf(build(site.classes), site.classes, TOUCH) }))
    .filter((r) => r.touch !== '100%');
  assert.deepEqual(hidden, []);
});

test('touch reveal: a desktop still shows these controls only on hover (AUD-33)', async () => {
  const { build } = await appStylesheet();
  const wrong = hoverRevealSites().flatMap((site) => {
    const css = build(site.classes);
    const idle = opacityOf(css, site.classes, DESKTOP_IDLE);
    const hover = opacityOf(css, site.classes, DESKTOP_HOVER);
    return idle === '0%' && hover === '100%' ? [] : [{ at: `${site.file}:${site.line}`, idle, hover }];
  });
  assert.deepEqual(wrong, []);
});

test('touch reveal: the decorative hints left hover-only still exist, and stay hidden on touch', async () => {
  const { build } = await appStylesheet();
  const sites = hoverRevealSites();
  for (const d of DECORATIVE) {
    const found = sites.filter((s) => s.file === d.file && s.lineText.includes(d.snippet));
    assert.equal(found.length, 1, `${d.file} "${d.snippet}" (${d.why}): expected 1 site, found ${found.length}`);
    assert.equal(opacityOf(build(found[0].classes), found[0].classes, TOUCH), '0%', `${d.file}: ${d.why}`);
  }
});
