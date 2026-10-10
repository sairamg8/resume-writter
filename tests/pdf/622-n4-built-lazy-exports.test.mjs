// "Minified React error #306" on the live site (a React.lazy that resolved to { default: undefined }) came from a
// production build's lazy chunk that did not hold the export its loader reads. The unit tests check the source
// (tests/unit/620-n4-lazy-missing-export.unit.mjs); this one checks the BUILD: Rolldown splits the code by its
// own rules (vite.config.js codeSplitting groups), so for every module the app loads with import() and reads one
// export from, the chunk that import() targets must export that name under its own name, not a shortened one.
// Built as tests/pdf/71-startup-chunks does (production mode, nothing written).
// Run: node --test tests/pdf/622-n4-built-lazy-exports.test.mjs
import { before, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** [file under src/, the export the app's loader reads]: the pages from AppRoutes.jsx, and the other lazies. */
const lazies = () => {
  const routes = fs.readFileSync(path.join(ROOT, 'src/AppRoutes.jsx'), 'utf8');
  const pages = [...routes.matchAll(/page\(\(\) => import\('@\/([^']+)'\), '(\w+)'\)/g)].map((m) => [`${m[1]}`, m[2]]);
  return [
    ...pages,
    ['pages/JobMap', 'JobMapMenuItem'], // AuthBar's menu item
    ['pages/JobMap', 'default'], // kept for importers of the default
    ['components/NewLetterModal', 'default'], ['components/ImportDialog', 'default'],
    ['components/CareerHistoryPanel', 'CareerHistoryPanel'], ['components/CardMenu', 'CardMenu'],
    ['components/SectionStylePopover', 'default'], ['components/JobMapAccessPanel', 'default'],
    ['utils/collectionSyncLoaded', 'createListSync'],
  ];
};

let chunks;
let targets;
before(async () => {
  const result = await build({
    root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode: 'production', logLevel: 'silent', build: { write: false },
  });
  const files = [result].flat().flatMap((o) => o.output);
  chunks = files.filter((f) => f.type === 'chunk');
  targets = new Set(chunks.flatMap((c) => c.dynamicImports));
}, { timeout: 240_000 });

it('the app finds a lazy chunk for each module it loads with import()', () => {
  const found = lazies().filter(([file]) => !chunks.some((c) => c.moduleIds.some((id) => id.replace(/\\/g, '/').includes(`/src/${file}.`))));
  assert.deepEqual(found, [], 'modules in no chunk of the build');
});

it('the chunk each import() targets exports the name its loader reads', () => {
  const missing = [];
  for (const [file, name] of lazies()) {
    const holders = chunks.filter((c) => targets.has(c.fileName) && c.moduleIds.some((id) => id.replace(/\\/g, '/').includes(`/src/${file}.`)));
    if (!holders.length) { missing.push(`${file}: no chunk is the target of an import()`); continue; }
    for (const c of holders) if (!c.exports.includes(name)) missing.push(`${file}: ${c.fileName} exports [${c.exports.join(', ')}], not ${name}`);
  }
  assert.deepEqual(missing, []);
});
