// Typing Chinese, Japanese or Korean in any text field (B-20, B-20b, B-20c): an input method composes a
// word over several keys, and the Enter that picks it — or the Escape that drops it — belongs to the
// input method. A field that read that Enter as its own saved or added the half-typed text: the board's
// fields were fixed first, then the résumé editor's (the design name, the custom font, the résumé's
// rename on the editor and the dashboard), the job pages' (a field, a stage, a task, a to-do), the
// workspace search, the typed numbers and the issue's comment box. This reads every key handler in src/
// that tests for Enter and requires an input-method check (isImeKey, or isComposing) within the handler's
// lines, so a new field cannot miss it. A handler that is not on a text field is listed in NOT_TYPED.
// Run: node --test tests/unit/ime-enter-guard.unit.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

/** Handlers whose Enter is not typed text: a focused card or row opened from the keyboard. */
const NOT_TYPED = new Set(['utils/cardKeys.js']);

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return /\.(jsx?|mjs)$/.test(d.name) ? [p] : [];
  });
}

it('every Enter a text field acts on checks for an input method first (B-20)', () => {
  const unguarded = [];
  for (const file of files(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (NOT_TYPED.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line) || !/\bkey\s*[!=]==?\s*['"]Enter['"]/.test(line)) return;
      const around = lines.slice(Math.max(0, i - 6), i + 7).join('\n');
      if (!/\bisImeKey\(|\bisComposing\b/.test(around)) unguarded.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(unguarded, [], 'an Enter handler that an input method\'s Enter would trigger');
});

// R4-LO-24: the same for Escape. An input method's Escape drops the word being composed; a text field
// that read it as its own reverted the edit (InlineEdit), cleared the search (the top bar's, the kit's
// SearchInput) or dropped the typed name (a résumé's rename, a job's field or task, an issue's number).
// Each Escape a handler acts on must be guarded on its own line, or by an early `if (isImeKey(…))`
// just above it in the handler. A handler that is on no text field is listed here.
const NOT_TYPED_ESCAPE = new Set([
  'components/ui/Tooltip.jsx',         // a tooltip's trigger
  'components/ui/MenuList.jsx',        // a menu's items
  'components/AuthBar.jsx',            // the account button's hover card
  'components/shell/Sidebar.jsx',      // the phone drawer: links only
  'components/ShareLinkModal.jsx',     // a read-only link
  'components/NewLetterModal.jsx',     // buttons only
  'components/ImportMenu.jsx',         // a menu of buttons
]);

it('every Escape a text field acts on checks for an input method first (R4-LO-24)', () => {
  const unguarded = [];
  for (const file of files(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (NOT_TYPED_ESCAPE.has(rel)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line) || !/\bkey\s*[!=]==?\s*['"]Escape['"]/.test(line)) return;
      if (/\bisImeKey\(|\bisComposing\b/.test(line)) return;
      const above = lines.slice(Math.max(0, i - 10), i).join('\n');
      if (/if\s*\(\s*isImeKey\(\w+\)\s*\)/.test(above)) return;
      unguarded.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(unguarded, [], 'an Escape handler that an input method\'s Escape would trigger');
});
