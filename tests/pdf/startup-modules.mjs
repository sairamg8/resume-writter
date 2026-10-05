// The start-up path by module, from the source: what tests/pdf/71-startup-public-link-lazy and
// 122-startup-json-resume-export-lazy check a module is not on. tests/pdf/71-startup-chunks weighs the built
// chunks; this names the modules, so a static import that brings one back fails by its name.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// A line's static import or re-export: `import … from '…'`, `import '…'`, `export … from '…'` — not import().
const STATIC = /^\s*(?:import|export)\s(?:[^'";]*?\sfrom\s)?\s*['"]([^'"]+)['"]/gm;

/** The file `spec` names from `from`: '@/…' is src/ (vite.config.js alias), './…' relative; a package is null. */
function resolve(from, spec) {
  const bare = spec.split('?')[0];
  let base = null;
  if (bare.startsWith('@/')) base = path.join(ROOT, 'src', bare.slice(2));
  else if (bare.startsWith('.')) base = path.resolve(path.dirname(from), bare);
  if (!base) return null;
  for (const ext of ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx']) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  }
  return null;
}

/**
 * The app's own modules (paths from the repo root) that the entry, index.html's src/main.jsx, reaches through
 * static imports only: the start-up path, as a build makes it (a dynamic import() starts a chunk of its own).
 * Packages are not followed: none imports the app's modules.
 */
export function startupModules() {
  const seen = new Set();
  const stack = [path.join(ROOT, 'src/main.jsx')];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(m?js|jsx)$/.test(file)) continue;
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(STATIC)) {
      const next = resolve(file, spec);
      if (next) stack.push(next);
    }
  }
  return new Set([...seen].map((f) => path.relative(ROOT, f).split(path.sep).join('/')));
}
