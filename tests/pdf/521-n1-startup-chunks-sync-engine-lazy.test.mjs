// The built start-up path holds none of the jobs' and boards' sync engine (N1). tests/unit/520 walks the
// source; this walks the production build as 71-startup-chunks does: the entry and every chunk it imports
// statically (the closure) must hold none of collectionSyncEngine, Plan, Io, Rev, Conflict or the module that
// wires them (collectionSyncLoaded), while the build does contain them — in a chunk that a dynamic import()
// reaches, so a sign-in still gets the sync. The small parts the stores need (collectionSyncMeta) stay.
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const ENGINE = /[\\/]src[\\/]utils[\\/]collectionSync(Engine|Plan|Io|Rev|Conflict|Loaded)\.js$/;
const META = /[\\/]src[\\/]utils[\\/]collectionSyncMeta\.js$/;

let chunks;
let startup;
before(async () => {
  const result = await build({
    root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode: 'production', logLevel: 'silent', build: { write: false },
  });
  chunks = new Map([result].flat().flatMap((o) => o.output).filter((f) => f.type === 'chunk').map((c) => [c.fileName, c]));
  startup = new Set();
  const stack = [...chunks.values()].filter((c) => c.isEntry).map((c) => c.fileName);
  while (stack.length) {
    const name = stack.pop();
    if (startup.has(name) || !chunks.has(name)) continue;
    startup.add(name);
    stack.push(...chunks.get(name).imports);
  }
}, { timeout: 240_000 });

const holding = (re) => [...chunks.values()].filter((c) => c.moduleIds.some((id) => re.test(id)));

describe('the sync engine is a lazy chunk (N1)', () => {
  it('the build holds the engine, in chunks the entry does not import statically', () => {
    const holders = holding(ENGINE);
    assert.ok(holders.length > 0, 'the engine is in the build');
    assert.deepEqual(holders.filter((c) => startup.has(c.fileName)).map((c) => c.fileName), [], 'a start-up chunk holds the sync engine');
  });

  it('a dynamic import() reaches the engine\'s chunk, so a sign-in still loads it', () => {
    const lazy = new Set(holding(ENGINE).map((c) => c.fileName));
    const reached = [...chunks.values()].some((c) => startup.has(c.fileName) && c.dynamicImports.some((name) => lazy.has(name)));
    assert.ok(reached, 'a start-up chunk imports the engine\'s chunk by import()');
  });

  it('the record and status stores the job and board stores use stay on the start-up path', () => {
    assert.ok(holding(META).some((c) => startup.has(c.fileName)), 'collectionSyncMeta is loaded at start-up');
  });
});
