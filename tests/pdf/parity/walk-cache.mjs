// The walk, once per source: the walker (walk-cli.mjs, its own process) runs when no walk of this exact
// source exists yet, and every parity file reads its JSON. Keyed by a hash of everything the walk
// reads — src/, the parity walker and store, the fake DOM, the harness, package.json and yarn.lock — so
// a changed panel is walked again, and the same source (a push gate's clean export of the same commit)
// is not. Several test files ask at once: the first takes a lock directory and walks, the rest wait.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const INPUTS = ['src', 'tests/pdf/parity/walker.mjs', 'tests/pdf/parity/panels.mjs', 'tests/pdf/parity/store.mjs',
  'tests/pdf/parity/walk-cli.mjs', 'tests/pdf/fake-dom.mjs', 'tests/pdf/harness.mjs', 'tests/pdf/extractors.mjs', 'package.json', 'yarn.lock'];

function files(p) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory()) return [p];
  return fs.readdirSync(abs).sort().flatMap((f) => files(path.join(p, f)));
}

function sourceHash() {
  const h = crypto.createHash('sha256');
  for (const f of INPUTS.flatMap(files)) h.update(f).update('\0').update(fs.readFileSync(path.join(ROOT, f))).update('\0');
  return h.digest('hex').slice(0, 20);
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** { variants, walks }: every template (and layout variant), each panel's actions (panels.mjs). */
export async function walks() {
  const file = path.join(os.tmpdir(), `flowcv-parity-walk-${sourceHash()}.json`);
  const lock = `${file}.lock`;
  for (let waited = 0; waited < 15 * 60_000; waited += 500) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    try {
      fs.mkdirSync(lock);
    } catch {
      // Someone is walking; a lock older than 10 minutes is a walk that died.
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 10 * 60_000) fs.rmSync(lock, { recursive: true, force: true }); } catch { /* gone */ }
      await sleep(500);
      continue;
    }
    try {
      const run = spawnSync(process.execPath, [path.join(ROOT, 'tests/pdf/parity/walk-cli.mjs'), file], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } });
      if (run.status !== 0 || !fs.existsSync(file)) throw new Error(`the walker failed (exit ${run.status}):\n${run.stderr}\n${run.stdout}`);
      for (const old of fs.readdirSync(os.tmpdir()).filter((f) => /^flowcv-parity-walk-.*\.json$/.test(f))) {
        const p = path.join(os.tmpdir(), old);
        if (p !== file && Date.now() - fs.statSync(p).mtimeMs > 86_400_000) fs.rmSync(p, { force: true });
      }
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } finally {
      fs.rmSync(lock, { recursive: true, force: true });
    }
  }
  throw new Error(`no walk after 15 minutes: ${file}`);
}
