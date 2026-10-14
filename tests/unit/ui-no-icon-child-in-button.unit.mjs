// An icon beside a label in the kit's Button (the owner's screenshot of the dashboard's Import dialog: the
// icon sat ABOVE "Choose a file" and "Import as my original", the label hung below the 32 px button, the two
// buttons were different widths). The kit's Button wraps its children in <span className="truncate"> (an
// inline, nowrap box). Tailwind v4's preflight makes every svg `display: block`, so a lucide icon written as a
// CHILD (<Button><Upload size={15} /> Choose a file</Button>) becomes a block inside that inline span and
// breaks the line. The Button's own API puts the icon beside the span as a flex sibling: leftIcon={Upload} /
// rightIcon={…}. Nothing in the suite measured layout, so the slip was never caught.
//
// This reads every JSX file in src/ and fails for any kit <Button> that has a lucide icon (or a raw <svg>) among
// its children, naming file:line. A <button> or <a> written by hand is not the kit's Button (it is its own flex
// box and may hold icons), and neither is an element that only carries buttonClass(): that is `inline-flex`
// itself, so an icon child there is a flex item next to the text. The first test proves the scanner on inline
// snippets (bad forms flagged, good forms not); the second runs it on the app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = path.join(ROOT, 'src');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

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

/**
 * `text` with its block comments (also the `{/* … *\/}` of JSX) and whole-line `//` comments blanked, newlines kept so
 * line numbers stay. A quoted string is passed over whole, so `accept="image/*"` does not open a comment.
 */
const withoutComments = (text) => text.replace(
  /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|^[ \t]*\/\/.*$/gm,
  (found, quoted) => (quoted ? found : found.replace(/[^\n]/g, ' ')),
);

/** The local names a file imports from lucide-react (`Upload`, and `UploadIcon` for `Upload as UploadIcon`). */
function lucideNames(code) {
  const names = [];
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
    }
  }
  return names;
}

/**
 * Every kit <Button> in `text` that holds an icon among its children, as `{ line, icon, children }`: `line` is the
 * icon's line; `children` counts the Buttons that have children at all (a floor so the scan cannot go blind).
 * A Button inside a Button is not valid use, but the closing tag is still found by depth.
 */
export function iconsInButtons(text) {
  const code = withoutComments(text);
  const names = lucideNames(code);
  const icon = new RegExp(`<(?:${[...names, 'svg'].join('|')})(?![\\w.$])`, 'g');
  const found = [];
  let children = 0;
  for (const m of code.matchAll(/<Button(?![\w.$])/g)) {
    const open = openingTag(code, m.index);
    if (open.endsWith('/>')) continue; // <Button … /> has no children
    children += 1;
    const from = m.index + open.length;
    let depth = 1;
    let end = code.length;
    for (const t of code.slice(from).matchAll(/<Button(?![\w.$])|<\/Button\s*>/g)) {
      if (t[0].startsWith('</')) depth -= 1;
      else if (!openingTag(code, from + t.index).endsWith('/>')) depth += 1;
      if (depth === 0) { end = from + t.index; break; }
    }
    icon.lastIndex = 0;
    for (const hit of code.slice(from, end).matchAll(icon)) {
      found.push({ line: code.slice(0, from + hit.index).split('\n').length, icon: hit[0].slice(1) });
    }
  }
  return { found, children };
}

test('the scanner: an icon among a Button\'s children is flagged, an icon in leftIcon / rightIcon or outside a Button is not', () => {
  const head = "import { Upload, Pin as PinIcon, Check } from 'lucide-react';\nimport { Button } from '@/components/ui/Button';\n";
  const flagged = (jsx) => iconsInButtons(head + jsx).found.map((f) => `${f.line}:${f.icon}`);

  // The defect itself, as ImportDialog wrote it.
  assert.deepEqual(flagged('<Button variant="primary" onClick={() => pick(false)}>\n  <Upload size={15} aria-hidden="true" /> {busy ? \'Reading…\' : \'Choose a file\'}\n</Button>'), ['4:Upload']);
  // An alias, on a second line of a long tag, after a handler with `>` inside it.
  assert.deepEqual(flagged('<Button\n  disabled={busy}\n  onClick={() => pick(true)}\n>\n  <PinIcon size={14} /> Import as my original\n</Button>'), ['7:PinIcon']);
  // The icon last, in a condition, in a fragment, a raw svg, a link Button.
  assert.deepEqual(flagged('<Button>Done {ok && <Check />}</Button>'), ['3:Check']);
  assert.deepEqual(flagged('<Button to="/x"><><Check /> Go</></Button>'), ['3:Check']);
  assert.deepEqual(flagged('<Button><svg viewBox="0 0 1 1" /> Go</Button>'), ['3:svg']);
  // The second of two Buttons.
  assert.deepEqual(flagged('<div>\n<Button>One</Button>\n<Button><Upload /> Two</Button>\n</div>'), ['5:Upload']);

  // The forms that are right.
  assert.deepEqual(flagged('<Button leftIcon={Upload}>Choose a file</Button>'), []);
  assert.deepEqual(flagged('<Button leftIcon={PinIcon} rightIcon={Check}>Pin</Button>'), []);
  assert.deepEqual(flagged('<Button leftIcon={Upload} />'), []);
  assert.deepEqual(flagged('<Button variant="secondary">Cancel</Button>'), []);
  // A Button's own props may hold an element; its children may not (a prop is not laid out inside the span).
  assert.deepEqual(flagged('<Button title={<Upload />}>Go</Button>'), []);
  // Beside a Button, not in it: a self-closing one, a raw <button>, a flex row, a label that carries buttonClass().
  assert.deepEqual(flagged('<Button />\n<Upload />'), []);
  assert.deepEqual(flagged('<button className="flex gap-2"><Upload /> Go</button>'), []);
  assert.deepEqual(flagged('<div className="flex gap-2"><Upload /><Button>Go</Button></div>'), []);
  assert.deepEqual(flagged('<label className={buttonClass()}><Upload /> Go</label>'), []);
  // Words in a comment are not code.
  assert.deepEqual(flagged('{/* <Button><Upload /> Go</Button> */}\n// <Button><Check /></Button>\n<Button>Go</Button>'), []);
  // A name that is not imported from lucide-react is not an icon.
  assert.deepEqual(iconsInButtons("import { Upload } from './mine.js';\n<Button><Upload /> Go</Button>").found, []);
  // `/*` inside a string opens no comment (accept="image/*" would have blanked everything up to the next `*/`).
  assert.deepEqual(flagged('<input accept="image/*" />\n<Button><Check /></Button>\n{/* done */}'), ['4:Check']);
  // A line number counts the lines before the icon, comments included.
  assert.deepEqual(flagged('/* one\ntwo */\n<Button><Check /></Button>'), ['5:Check']);
});

test('no kit Button has an icon as a child; the icon goes in leftIcon / rightIcon (the Import dialog)', () => {
  let seen = 0;
  const offenders = sourcesUnder(SRC).flatMap((file) => {
    const { found, children } = iconsInButtons(fs.readFileSync(file, 'utf8'));
    seen += children;
    return found.map((f) => `${rel(file)}:${f.line} <Button> has the icon <${f.icon}> as a child; use leftIcon={…} or rightIcon={…}`);
  });
  // About 70 Buttons with children on 2026-10-14; far fewer means the search above broke, not that they are gone.
  assert.ok(seen >= 40, `found only ${seen} <Button> elements with children`);
  assert.deepEqual(offenders, []);
});
