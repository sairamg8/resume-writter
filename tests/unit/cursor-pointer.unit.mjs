// A hand over everything clickable (the owner's ask, R3-009). Tailwind v4's preflight leaves a
// <button> the browser's arrow, and the app wrote `cursor-pointer` on only some controls, so most of
// its buttons (the editor's toolbar, the Design panel, the dashboard's cards' actions, the Job
// Tracker) showed an arrow. src/index.css now gives every enabled button, link, summary, select,
// checkbox, radio, file input and clickable ARIA role the hand, in the base layer so a control's own
// cursor class still wins.
//
// The first test compiles the app's own src/index.css with Tailwind (as touch-reveal does) and checks
// the rule is there, in the base layer, and that nothing later in the base CSS takes it back. The
// second reads every JSX file in src/ for an onClick on an element that rule does not cover (a <div>,
// <span>, <li>, <tr> …): each must write a cursor class itself or carry a role the rule covers, unless
// it is a backdrop (a click beside a modal's box closes it; no hand, as the kit's Dialog), a wrapper
// whose handler only stops a click reaching the card under it, or a listed exception.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = path.join(ROOT, 'src');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

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

/** Every `cursor` declaration in the CSS, in source order: its value and the at-rules and selectors around it. */
function cursorRules(css) {
  const rules = [];
  const stack = [];
  let buf = '';
  const flush = () => {
    const decl = buf.trim().match(/^cursor\s*:\s*(.+)$/);
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

/** A selector list split at its top-level commas, each with its whitespace squeezed out. */
const selectorsOf = (list) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\s+/g, '')).filter(Boolean);
};

// What a person clicks: each must get the hand.
const CLICKABLE = [
  'button:not(:disabled)', '[role="button"]:not([aria-disabled="true"])', '[role="link"]', '[role="tab"]',
  'a[href]', 'summary', 'select:not(:disabled)', 'input[type="checkbox"]:not(:disabled)',
  'input[type="radio"]:not(:disabled)', 'input[type="file"]:not(:disabled)', '::file-selector-button',
];

test('cursor: every enabled button, link and clickable control gets the hand, in the base layer (R3-009)', async () => {
  const { build } = await appStylesheet();
  const rules = cursorRules(build([]));
  const hand = rules.filter((r) => r.value === 'pointer' && r.context.some((c) => c === '@layer base'));
  const given = new Set(hand.flatMap((r) => selectorsOf(r.context.at(-1))));
  assert.deepEqual(CLICKABLE.filter((s) => !given.has(s)), [], 'clickable selectors without cursor: pointer');
  // Nothing in the base CSS after it sets another cursor on a button or a link (preflight, a reset).
  const last = rules.findLastIndex((r) => r === hand.at(-1));
  const later = rules.slice(last + 1).filter((r) => r.context.some((c) => c === '@layer base')
    && selectorsOf(r.context.at(-1)).some((s) => /^(button|a\[|\[role=)/.test(s) && !/disabled/.test(s)));
  assert.deepEqual(later, [], 'a later base rule overrides the hand');
});

// Tags the CSS rule does not reach: an onClick on one of these needs its own cursor.
const PLAIN = /<(div|span|li|tr|td|th|img|p|section|article|h[1-6]|label|svg|ul|figure|header|footer|aside|main|nav|table|tbody)\b/g;
const COVERED_ROLE = /\brole=["'](button|link|tab|menuitem|option|switch)["']/;
const STOPS_ONLY = /^\(?\s*\w+\s*\)?\s*=>\s*\{?\s*\w+\.stopPropagation\(\)\s*;?\s*\}?$/;
// Clickable without a hand on purpose, matched by file and a snippet of the tag.
const EXCEPTIONS = [
  { file: 'src/components/RichTextEditor.jsx', snippet: 'ref.current?.focus()',
    why: 'a text field\'s label: a click focuses the field, as any label does; a text cursor is right there' },
];

function sourcesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sourcesUnder(full) : e.name.endsWith('.jsx') ? [full] : [];
  });
}

/** The opening tag that starts at `at`: up to its `>`, past any `{ … }` and quoted text inside it. */
function openingTag(text, at) {
  let depth = 0;
  let quote = null;
  for (let i = at + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return text.slice(at, i + 1);
  }
  return text.slice(at);
}

/** The text of `tag`'s onClick={…} handler. */
function handlerOf(tag) {
  const start = tag.indexOf('onClick={') + 'onClick={'.length;
  let depth = 1;
  for (let i = start; i < tag.length; i += 1) {
    if (tag[i] === '{') depth += 1;
    if (tag[i] === '}' && (depth -= 1) === 0) return tag.slice(start, i).trim();
  }
  return tag.slice(start);
}

test('cursor: every other element with an onClick writes its own hand (R3-009)', () => {
  let seen = 0;
  const bare = sourcesUnder(SRC).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return [...text.matchAll(PLAIN)].flatMap((m) => {
      const tag = openingTag(text, m.index);
      if (!/\bonClick=\{/.test(tag)) return [];
      seen += 1;
      const at = `${rel(file)}:${text.slice(0, m.index).split('\n').length}`;
      if (/\bcursor-/.test(tag) || COVERED_ROLE.test(tag)) return [];
      if (/\binset-0\b/.test(tag)) return []; // a backdrop
      if (STOPS_ONLY.test(handlerOf(tag))) return [];
      if (EXCEPTIONS.some((e) => e.file === rel(file) && tag.includes(e.snippet))) return [];
      return [`${at} <${m[1]} onClick={${handlerOf(tag).slice(0, 60)}}>`];
    });
  });
  // 19 such elements on 2026-09-25; far fewer means the search above broke, not that they are gone.
  assert.ok(seen >= 12, `found only ${seen} onClick elements`);
  assert.deepEqual(bare, []);
});
