// Opening any page — the Dashboard, #/terms, an empty editor — must not download the PDF engine
// (R2-014). react-pdf, pdf.js and the Word writer are only ever reached through dynamic import():
// Export, the preview and the editor's warm-up load them when they are needed. The build still
// shipped react-pdf (1.43 MB, 477 KB gzipped) on the start-up path: vite.config.js grouped
// @react-pdf/renderer into a named chunk, Rolldown pulls a group's dependencies in with it, and
// React is one of them — so React itself sat in react-pdf-*.js, the entry imported React from
// there, and index.html modulepreloaded the whole chunk. A production build (as
// 38-owner-resume-not-embedded builds, nothing written) is walked from index.html: the entry,
// every chunk it imports statically and every <link rel=modulepreload> must hold none of the lazy
// libraries, React must be one copy (the app's and the PDF code's), and the PDF engine and the
// Word writer must each load without downloading the other (the new chunk groups are ranked, and
// a lower group's shared dependency would otherwise make it import a higher one).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
/** Libraries only a dynamic import() may reach: the PDF engine, the preview's pdf.js and the Word writer. */
const LAZY = /node_modules[\\/](@react-pdf|pdfkit|fontkit|yoga-layout|pdfjs-dist|docx|jszip|pizzip)[\\/]/;
const PDF_LIB = /node_modules[\\/](@react-pdf|fontkit|yoga-layout)[\\/]/;
const WORD_LIB = /node_modules[\\/](docx|jszip|pizzip)[\\/]/;
/** React's own entry module: one copy of it, loaded at start-up. */
const REACT = /node_modules[\\/]react[\\/]index\.js$/;
const short = (id) => id.slice(id.lastIndexOf('node_modules')).replace(/\\/g, '/');

let out;
before(async () => {
  const result = await build({
    root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode: 'production', logLevel: 'silent', build: { write: false },
  });
  const files = [result].flat().flatMap((o) => o.output);
  const chunks = new Map(files.filter((f) => f.type === 'chunk').map((c) => [c.fileName, c]));
  const html = files.find((f) => f.fileName === 'index.html');
  /** `names` and every chunk they import statically, transitively: what loading them downloads. */
  const closure = (names) => {
    const seen = new Set();
    const stack = [...names];
    while (stack.length) {
      const name = stack.pop();
      if (seen.has(name) || !chunks.has(name)) continue;
      seen.add(name);
      stack.push(...chunks.get(name).imports);
    }
    return seen;
  };
  // Everything the browser runs before the first paint: the entry and its static imports.
  const startup = closure([...chunks.values()].filter((c) => c.isEntry).map((c) => c.fileName));
  const page = typeof html.source === 'string' ? html.source : new TextDecoder().decode(html.source);
  const loaded = [...page.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="\/?([^"]+\.js)"/g)].map((m) => m[1]);
  out = { chunks, closure, startup, loaded };
}, { timeout: 240_000 });

/** "chunk.js: N lazy modules (first few)" for each chunk in `names` that holds any (of `lib`). */
function lazyIn(names, lib = LAZY) {
  return [...names].flatMap((name) => {
    const ids = (out.chunks.get(name)?.moduleIds ?? []).filter((id) => lib.test(id));
    return ids.length ? [`${name}: ${ids.length} lazy modules (${ids.slice(0, 3).map(short).join(', ')}, …)`] : [];
  });
}

describe('the start-up path loads no PDF or Word library (R2-014)', () => {
  it('the build does contain them — as lazy chunks (not a vacuous pass)', () => {
    const lazyChunks = [...out.chunks.keys()].filter((name) => lazyIn([name]).length);
    assert.ok(lazyChunks.length > 0, 'react-pdf, pdf.js and docx are in the build');
  });

  it('the entry and every chunk it imports statically hold none of them', () => {
    assert.deepEqual(lazyIn(out.startup), []);
  });

  it('index.html loads and modulepreloads only start-up chunks, none of them a lazy library', () => {
    assert.ok(out.loaded.length > 0, 'index.html loads the entry');
    assert.deepEqual(out.loaded.filter((name) => !out.startup.has(name)), [], 'a preloaded chunk the entry never imports');
    assert.deepEqual(lazyIn(out.loaded), []);
  });

  it('the PDF engine and the Word writer load apart: loading either downloads none of the other', () => {
    for (const [lib, other, label] of [[PDF_LIB, WORD_LIB, 'the PDF engine'], [WORD_LIB, PDF_LIB, 'the Word writer']]) {
      const holders = [...out.chunks.keys()].filter((name) => lazyIn([name], lib).length);
      assert.ok(holders.length > 0, `${label} is in the build`);
      assert.deepEqual(lazyIn(out.closure(holders), other), [], `loading ${label} downloads the other`);
    }
  });

  it('React is bundled once, and that copy is loaded at start-up', () => {
    const withReact = [...out.chunks.values()].filter((c) => c.moduleIds.some((id) => REACT.test(id))).map((c) => c.fileName);
    assert.equal(withReact.length, 1, `React is bundled once: ${withReact.join(', ')}`);
    assert.ok(out.startup.has(withReact[0]), `${withReact[0]} is on the start-up path`);
  });
});

// The dashboard loads light (R2-142, PERF-5): every page was in the entry chunk — the editor with its
// panels, the ATS checker, the job tracker and the boards, drag and drop — 704 kB the dashboard
// downloaded and parsed before its first paint, and Firebase came as one 532 kB chunk. Each page but
// the dashboard and the legal pages now loads when its route opens, and no start-up chunk is over the
// build's 500 kB warning.
const PAGES = /[\\/]src[\\/]pages[\\/](Editor|JobTracker|JobDetail|JobForm|Boards|Board|Backlog|BoardSettings|YourWork)\.jsx$/;
const KB = 1024;

describe('the dashboard loads light: the other pages are split from the start-up path (R2-142, PERF-5)', () => {
  it('no editor or workspace page is on the start-up path — each is in the build, loaded with its route', () => {
    const on = [...out.startup].flatMap((name) => out.chunks.get(name).moduleIds.filter((id) => PAGES.test(id)).map(short));
    assert.deepEqual(on.map((id) => id.replace(/.*src\//, 'src/')), [], 'pages downloaded before the dashboard paints');
    const split = [...out.chunks.values()].filter((c) => !out.startup.has(c.fileName) && c.moduleIds.some((id) => PAGES.test(id)));
    assert.ok(split.length >= 5, `the pages are lazy chunks of the build (${split.length})`);
  });

  it('no start-up chunk is over 500 kB, and all of them are under 1.1 MB together', () => {
    const sizes = [...out.startup].map((name) => [name, out.chunks.get(name).code.length]);
    assert.deepEqual(sizes.filter(([, n]) => n > 500 * KB).map(([name, n]) => `${name} ${Math.round(n / KB)} kB`), []);
    const total = sizes.reduce((sum, [, n]) => sum + n, 0);
    assert.ok(total < 1100 * KB, `the start-up path is ${Math.round(total / KB)} kB (was 1,443 kB)`);
  });
});
