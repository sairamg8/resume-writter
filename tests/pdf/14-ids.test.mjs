// The ids the app makes (M17): ids were `${prefix}_${Date.now()}`, so two made in the same
// millisecond collided. newId itself is unit-tested in tests/unit/ids.unit.mjs; these load the
// app's modules through the harness.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

/** Run fn with the clock stopped, as when two adds land in the same millisecond. */
function sameMillisecond(fn) {
  const realNow = Date.now;
  Date.now = () => 1_757_800_000_000;
  try { return fn(); } finally { Date.now = realNow; }
}

const assertUnique = (ids) => assert.equal(new Set(ids).size, ids.length, `duplicate ids among ${ids.length}`);

// The clock, and the value given to an id: `id: …` in an object, `id = …` / `…Id = …` in an
// assignment (up to the next , ; or } outside a template's ${…}). A line of code that gives an
// id a value built from the clock — `_${Date.now()}`, but also `id: Date.now()`,
// `'x_' + Date.now()`, String(now) … (R4-12).
const CLOCK = /Date\.now\(\)|\bnow\b|performance\.now\(\)|\.getTime\(\)/;
const ID_VALUE = /(?:\bid\s*:|\b[\w$]*(?:Id|_id|ID)\s*=(?!=)|\bid\s*=(?!=))\s*((?:\$\{[^}]*\}|[^,;}\n])*)/g;
const isComment = (line) => /^\s*(?:\*|\/\/|\/\*)/.test(line);
const idFromClock = (line) => !isComment(line) && [...line.matchAll(ID_VALUE)].some((m) => CLOCK.test(m[1]));

describe('the ids the app makes', () => {
  it('a new entry of every section type, twice in the same millisecond', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    const ids = sameMillisecond(() => Object.values(NEW_ITEM).flatMap((make) => [make().id, make().id]));
    assert.equal(ids.length, 22);
    assertUnique(ids);
  });

  it('new sections, twice per type in the same millisecond', async () => {
    const { createSectionActions } = await loadModule('/src/hooks/useResumeSectionActions.js');
    let r = { sections: [] };
    const { addSection } = createSectionActions((update) => { r = update(r); });
    sameMillisecond(() => ['experience', 'experience', 'custom', 'custom'].forEach(addSection));
    assert.equal(r.sections.length, 4);
    assertUnique(r.sections.map((s) => s.id));
  });

  it('the scan below finds an id built from the clock, however it is written (R4-12)', () => {
    // The first scan matched only `_${Date.now()}` and `_${now}`.
    const built = [
      "const id = `${prefix}_${Date.now()}`;", '{ id: Date.now(), text: t }', "id: 'x_' + Date.now(),",
      'id: `td-${Date.now()}`,', 'id: String(Date.now()),', "const copyId = 'resume' + now;",
      'const newId = Date.now().toString(36);', 'item.id = `${type}${now}`;', 'id: new Date().getTime(),',
    ];
    assert.deepEqual(built.filter((line) => !idFromClock(line)), []);
    const fine = [
      "{ id: newId('job'), createdAt: now, updatedAt: now }", 'updatedAt: Date.now(),',
      'const backupKey = `${key}_backup_${at}`;', 'if (r.id === now) return;', '// id: Date.now() was the old way',
      "const id = newId('resume');", 'setActiveId(id);',
    ];
    assert.deepEqual(fine.filter(idFromClock), []);
  });

  it('no id in src/ is built from the clock (résumés, jobs, to-dos, imports)', () => {
    const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => /\.jsx?$/.test(f));
    const offenders = files.flatMap((f) => fs.readFileSync(path.join(SRC, f), 'utf8').split('\n')
      .map((line, i) => ({ where: `src/${f}:${i + 1}`, line }))
      .filter(({ line }) => idFromClock(line)));
    assert.deepEqual(offenders.map((o) => o.where), [], offenders.map((o) => o.line.trim()).join('\n'));
  });
});
