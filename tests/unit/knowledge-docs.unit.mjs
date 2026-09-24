// R2-169: the knowledge docs (docs/knowledge/) went stale without anything noticing: 05 said the data
// version was 11 (then 6) while src/utils/dataVersion.js moved on, and the docs named files long gone
// (src/templates/*.jsx, PaginatedPreview.jsx, pdfExport.js) and linked a generated graph report that is
// no longer tracked. This pins what can be checked mechanically: the DATA_VERSION the docs state is the
// code's, every src/, tests/ and cypress/ path they name in backticks exists (a glob matches at least
// one file), and every relative link reaches a file in the repo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DOCS = path.join(ROOT, 'docs/knowledge');
const docs = fs.readdirSync(DOCS).filter((f) => f.endsWith('.md')).sort()
  .map((name) => ({ name, text: fs.readFileSync(path.join(DOCS, name), 'utf8') }));
const doc = (name) => docs.find((d) => d.name === name).text;

/** Every file and folder under `dir` (repo-relative, '/'-separated), node_modules and .git aside. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const rel = `${dir}/${e.name}`;
    out.push(rel);
    if (e.isDirectory()) walk(rel, out);
  }
  return out;
}
const PREFIXES = ['src', 'tests', 'cypress'];
const tree = PREFIXES.flatMap((p) => walk(p));

/** A glob as the docs write one (`*`, `**\/`, `{a,b}`) as a regex over repo-relative paths. */
const globRegex = (glob) => new RegExp(`^${glob.split('**/').map((part) => part
  .replace(/[.+^$()|[\]\\]/g, '\\$&')
  .replace(/\{([^}]*)\}/g, (_, alts) => `(?:${alts.split(',').join('|')})`)
  .replace(/\*/g, '[^/]*')).join('(?:.*/)?')}$`);

/** The src/, tests/ and cypress/ paths a doc names inside backticks. */
function namedPaths(text) {
  const spans = text.match(/`[^`\n]+`/g) || [];
  return spans.flatMap((s) => s.slice(1, -1).split(/\s+/))
    .map((t) => t.replace(/[),;:]+$/, ''))
    .filter((t) => PREFIXES.some((p) => t.startsWith(`${p}/`)));
}

describe('the knowledge docs agree with the code (R2-169)', () => {
  it('05 states the DATA_VERSION src/utils/dataVersion.js has', () => {
    const stated = doc('05-state-auth-sync.md').match(/`DATA_VERSION = (\d+)`/);
    assert.ok(stated, '05-state-auth-sync.md states `DATA_VERSION = <n>`');
    assert.equal(Number(stated[1]), DATA_VERSION);
    for (const { name, text } of docs) {
      for (const [, n] of text.matchAll(/DATA_VERSION = (\d+)/g)) assert.equal(Number(n), DATA_VERSION, `${name}: DATA_VERSION = ${n}`);
    }
  });

  it("03's app store document carries that dataVersion", () => {
    const text = doc('03-data-model.md');
    const block = text.slice(text.indexOf('## App store document'), text.indexOf('## Job store document'));
    const stated = block.match(/"dataVersion": (\d+)/);
    assert.ok(stated, 'the app store example has a "dataVersion"');
    assert.equal(Number(stated[1]), DATA_VERSION);
  });

  it('every src/, tests/ and cypress/ path the docs name exists', () => {
    const missing = [];
    for (const { name, text } of docs) {
      for (const p of namedPaths(text)) {
        const found = /[*{]/.test(p) ? tree.some((f) => globRegex(p).test(f)) : fs.existsSync(path.join(ROOT, p));
        if (!found) missing.push(`${name}: ${p}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it('every relative link reaches a file in the repo', () => {
    const missing = [];
    for (const { name, text } of docs) {
      for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        if (!fs.existsSync(path.resolve(DOCS, href.replace(/#.*$/, '')))) missing.push(`${name}: ${href}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it('the path check is not vacuous: it reads paths and globs, and a gone file fails it', () => {
    assert.ok(docs.reduce((n, d) => n + namedPaths(d.text).length, 0) > 40, 'the docs name dozens of paths');
    assert.ok(tree.some((f) => globRegex('src/utils/cloudSync*.js').test(f)));
    assert.ok(tree.some((f) => globRegex('tests/pdf/**/*.test.mjs').test(f)));
    assert.ok(!tree.some((f) => globRegex('src/templates/*.jsx').test(f)), 'the HTML templates are gone');
    assert.equal(fs.existsSync(path.join(ROOT, 'src/components/PaginatedPreview.jsx')), false);
  });
});
