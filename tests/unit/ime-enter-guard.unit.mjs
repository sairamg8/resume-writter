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
