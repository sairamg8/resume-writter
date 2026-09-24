// The settings registry (R2-160): every control the editor offers is found by USING the panels (the walker
// clicks every button and feeds every input of Design, Personal Info and each section's Section Options,
// on every template), and every setting those controls write must be in the pinned REGISTRY with the
// effect the parity matrix checks — so a control added without a parity test fails here, and so does a
// registry entry no control writes any more.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { walks } from './walk-cache.mjs';
import { writeKey } from './walker.mjs';
import { REGISTRY, FAMILY_FILES } from './registry.mjs';
import { TEMPLATE_IDS } from '../../../src/constants/templates.js';

const W = await walks();
const found = new Map(); // key → Set of "variant: panel"
for (const [id, w] of Object.entries(W.walks)) {
  const panels = { design: w.design, personal: w.personal, ...Object.fromEntries(Object.entries(w.sections).map(([t, a]) => [`section ${t}`, a])) };
  for (const [panel, actions] of Object.entries(panels)) {
    for (const a of actions) for (const k of a.writes.map(writeKey)) found.set(k, (found.get(k) || new Set()).add(`${id}: ${panel}`));
  }
}

describe('the settings registry', () => {
  it('walks every template the app offers', () => {
    for (const t of TEMPLATE_IDS) assert.ok(W.variants.some((v) => v.template === t), `${t} was not walked`);
    for (const v of W.variants) assert.ok(W.walks[v.id].design.length > 50, `${v.id}: the Design panel walk found only ${W.walks[v.id].design.length} actions`);
  });

  it('knows every setting a control writes (a new control needs its parity measure in registry-*.mjs)', () => {
    const unknown = [...found.keys()].filter((k) => !(k in REGISTRY)).map((k) => `${k} (written by ${[...found.get(k)].slice(0, 3).join('; ')})`);
    assert.deepEqual(unknown, []);
  });

  it('lists no setting that no control writes any more', () => {
    assert.deepEqual(Object.keys(REGISTRY).filter((k) => !found.has(k)), []);
  });

  it('runs every family in a parity file that exists', () => {
    for (const [key, s] of Object.entries(REGISTRY)) {
      const file = FAMILY_FILES[s.family];
      assert.ok(file, `${key}: family ${s.family} has no test file`);
      const body = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.ok(body.includes(`'${s.family}'`), `${file} does not run the '${s.family}' family (${key})`);
    }
  });

  it('gives every setting its own measured effect (a reset: matrix.mjs checkReset)', () => {
    const bare = Object.entries(REGISTRY).filter(([, s]) => !s.check && s.family !== 'resets' && !(s.with && REGISTRY[s.with]?.check)).map(([k]) => k);
    assert.deepEqual(bare, [], 'these keys are only checked for "prints differently": say what each one does to the PDF');
  });

  it('pins what the panels offer, key by key', () => {
    // The pinned list itself — a change to what the editor offers shows up here, in review.
    assert.deepEqual([...found.keys()].sort(), Object.keys(REGISTRY).sort());
  });
});
