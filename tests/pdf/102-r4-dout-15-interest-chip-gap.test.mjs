// R4-DOUT-15: in the main column the Interests chips sat a whole item gap apart (6 pt at Normal,
// 10.5 pt at Spacious), twice the skill tags' 3 pt, though the two chips look alike. They now sit
// 3 pt apart at the default Between Items, as the tags do, and scale with Spacing in proportion,
// as the Sidebar column's chips do (R2-6). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, itemsWith } from './harness.mjs';

before(setup);
after(teardown);

/** The x distance from the end of `a` to the start of `b`. */
const between = (pages, a, b) => {
  const [l, r] = [a, b].map((s) => itemsWith(pages, s)[0]);
  assert.ok(l && r, `${a} and ${b} print`);
  return r.x - (l.x + l.w);
};

const pagesAt = async (spacing) => read(await render(resume({ sections: [
  section('skills', [{ category: 'Stack', skills: 'Kotlin, Swift' }], { skillsStyle: 'tags', spacing }),
  section('interests', [{ interests: 'Chess, Hiking' }], { spacing }),
] })));

it('Interests chips sit as far apart as skill tags at Normal, and widen with Spacing (R4-DOUT-15)', async () => {
  const normal = await pagesAt('normal');
  const tags = between(normal, 'Kotlin', 'Swift');
  const chips = between(normal, 'Chess', 'Hiking');
  // A tag: 5 pt padding + 1 pt border each side, 3 pt apart (15 pt text to text). A chip: 6 pt padding
  // each side, no border — so 3 pt apart it is the same 15 pt.
  assert.ok(Math.abs(chips - tags) < 0.3, `interest chips ${chips.toFixed(2)} pt vs skill tags ${tags.toFixed(2)} pt`);
  // Spacious is 1¾ × Normal: the chips' 3 pt grows to 5.25 pt.
  const spacious = between(await pagesAt('relaxed'), 'Chess', 'Hiking');
  assert.ok(Math.abs(spacious - chips - 3 * 0.75) < 0.3, `Spacious ${spacious.toFixed(2)} pt vs Normal ${chips.toFixed(2)} pt`);
});
