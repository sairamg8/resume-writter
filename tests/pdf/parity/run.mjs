// One parity file's body: for every template (and layout variant) the walk found, every control of the
// given families, as one test each — named for the template, the control and the values it offers.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from '../harness.mjs';
import { loadStore } from './store.mjs';
import { walks } from './walk-cache.mjs';
import { controlsOf, customiser, checkControl, forget, show } from './matrix.mjs';
import { spec, familyOf, knownFor } from './registry.mjs';

/**
 * Every control of `families` on every variant; `skip()` → a reason to skip them all (e.g. offline);
 * `prepare()` → run once the app is loaded, before any render (22's canvas for Photo → Tone, R2-147).
 */
export async function parityFamily(families, { skip = async () => null, prepare = async () => {} } = {}) {
  const W = await walks();
  before(async () => { await setup(); await loadStore(); await prepare(); });
  after(teardown);
  for (const variant of W.variants) {
    const w = W.walks[variant.id];
    describe(variant.id, () => {
      after(forget);
      controlTests(variant, w.design, families, skip);
      controlTests(variant, w.personal, families, skip);
      // A section's options render pages of their own (aroundTypes): each section's renders are freed
      // before the next section's (~2 MB a render; CI runs four test files at once).
      for (const [type, actions] of Object.entries(w.sections)) {
        const controls = controlsOf(actions);
        if (!controls.some((c) => families.includes(familyOf(c)))) continue;
        describe(type, () => {
          after(forget);
          controlTests(variant, actions, families, skip);
        });
      }
    });
  }
}

/** One test per control of `families` among `actions` (one panel's), each rendered at every value it offers. */
function controlTests(variant, actions, families, skip) {
  const controls = controlsOf(actions);
  const customise = customiser(controls);
  for (const control of controls) {
    if (!families.includes(familyOf(control))) continue;
    const values = control.actions.map(show).join(' | ');
    it(`${control.id}: ${values.length > 120 ? `${values.slice(0, 117)}…` : values}`, async (t) => {
      const why = await skip();
      if (why) return t.skip(why);
      const failures = await checkControl(variant, control, { spec, customise });
      const known = failures.length ? knownFor(variant, control, failures) : [];
      if (known.length) t.todo(`filed: ${known.join(', ')}`);
      assert.deepEqual(failures, []);
    });
  }
}
