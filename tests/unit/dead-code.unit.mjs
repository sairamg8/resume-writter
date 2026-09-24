// Unit test for dead modules under src/ (R6-6): src/components/job/CareerTimeline.jsx was imported
// nowhere, yet 8519fa2 still edited it — a career-history change made in the dead copy never reaches
// the app. Every module under src/ must be reachable from the app's entry, src/main.jsx, through its
// static imports, re-exports and dynamic import()s. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = path.join(ROOT, 'src');
const ENTRY = path.join(SRC, 'main.jsx');
const MODULE = /\.(m?jsx?)$/;

// Dead modules each reported as their own task; delete the entry together with the file.
const KNOWN_DEAD = [
  // Lane C's board export/import (.json), unit-tested in tests/unit/board-transfer.unit.mjs and merged with
  // the rest of the lane on 2026-09-24 before its Boards page imports it (docs/tracking/boards-jobs-plan/).
  // The test below fails the day it is wired in — then drop it from here.
  'src/utils/boardTransfer.js',
];

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

function modulesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? modulesUnder(full) : MODULE.test(e.name) ? [full] : [];
  });
}

// `from '…'` (imports and re-exports), `import '…'` and `import('…')`.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

/** The file a specifier names: '@/…' is src/ (vite.config.js alias), './…' is relative; packages are null. */
function resolveSpecifier(importer, specifier) {
  const bare = specifier.replace(/\?.*$/, '');
  let base;
  if (bare.startsWith('@/')) base = path.join(SRC, bare.slice(2));
  else if (bare.startsWith('.')) base = path.resolve(path.dirname(importer), bare);
  else return null;
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js'), path.join(base, 'index.jsx')];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

function reachableFrom(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !MODULE.test(file)) continue;
    seen.add(file);
    for (const [, specifier] of fs.readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const target = resolveSpecifier(file, specifier);
      if (target) stack.push(target);
    }
  }
  return seen;
}

test('the walk follows every import form the app uses (a lazy template, a dynamic export module, a re-export)', () => {
  const reached = new Set([...reachableFrom(ENTRY)].map(rel));
  for (const file of [
    'src/App.jsx',
    'src/components/CareerHistoryPanel.jsx',              // the live career-history component
    'src/utils/pdfExportReactPDF.js',                     // import('@/utils/pdfExportReactPDF')
    'src/templates/pdf/SidebarTemplatePDF.jsx',           // () => import('@/templates/pdf/…')
    'src/utils/wordExport.js',                            // await import('@/utils/wordExport')
    'src/utils/defaultDataSectionTypes.js',               // only `export { … } from` in defaultData.js
  ]) assert.ok(reached.has(file), `${file} is not reached from src/main.jsx — the walk misses an import form`);
});

test('no dead module under src/: each one is reachable from src/main.jsx (R6-6)', () => {
  const reached = reachableFrom(ENTRY);
  const dead = modulesUnder(SRC).filter((f) => !reached.has(f)).map(rel).sort();
  assert.deepEqual(dead.filter((f) => !KNOWN_DEAD.includes(f)), [], 'imported nowhere by the app — delete it, or import it where it is used');
});

test('KNOWN_DEAD lists only files that still exist and are still dead', () => {
  const reached = new Set([...reachableFrom(ENTRY)].map(rel));
  for (const file of KNOWN_DEAD) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} was deleted — drop it from KNOWN_DEAD`);
    assert.ok(!reached.has(file), `${file} is imported now — drop it from KNOWN_DEAD`);
  }
});
