// R4-DOUT-08 — Section Options → Alignment 'Center': a list item's marker prints next to its text, the two
// centred together as one line ('• Cut costs 20%'), as Word centres a list paragraph with its bullet. The
// marker used to stay in a left-hand column at the margin while the text was centred ~200 pt away.
// Left alignment (the default) keeps the marker column: every item's text starts at the same x.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const SHORT = 'Cut costs 20%';
const LONG = 'Rebuilt the quarterly planning dashboard';

const cv = (description, settings = {}) => resume({ template: 'classic', sections: [experience([{ description }], settings)] });

/**
 * The marker in front of `text` on its line: the glyph, how far its right edge is from the text, whether
 * they share a line, and `x`, where the run holding `text` starts.
 */
function marker(pages, text) {
  const all = allItems(pages);
  const at = all.find((t) => t.str.includes(text));
  assert.ok(at, `"${text}" prints`);
  const own = at.str.slice(0, at.str.indexOf(text)).trim();
  // One text run holds both ('• Cut costs 20%'): the marker touches its text.
  if (own) return { glyph: own, gap: 0, sameY: true, x: at.x };
  const left = all.filter((t) => t !== at && t.page === at.page && Math.abs(t.y - at.y) < 1 && t.x + t.w <= at.x + 0.5)
    .sort((a, b) => b.x - a.x)[0];
  assert.ok(left, `a marker prints on the line of "${text}"`);
  return { glyph: left.str.trim(), gap: at.x - (left.x + left.w), sameY: Math.abs(left.y - at.y) < 1, x: at.x };
}

describe('Alignment Center keeps a list item\'s marker with its text (R4-DOUT-08)', () => {
  it('a centred bulleted item prints its • right before its text, on the same line', async () => {
    const pages = await read(await render(cv(`<ul><li>${SHORT}</li><li>${LONG}</li></ul>`, { alignment: 'center' })));
    for (const text of [SHORT, LONG]) {
      const m = marker(pages, text);
      assert.equal(m.glyph, '•', `• in front of "${text}"`);
      assert.ok(m.sameY, `• on the line of "${text}"`);
      assert.ok(m.gap < 6, `• is ${m.gap.toFixed(1)} pt from "${text}"`);
    }
    // Centred: the shorter item starts further right than the longer one.
    assert.ok(marker(pages, SHORT).x > marker(pages, LONG).x + 20, 'the items are centred, not left-aligned');
  });

  it('numbered and nested items keep their markers with their text too', async () => {
    const numbered = await read(await render(cv(`<ol><li>${SHORT}</li></ol>`, { alignment: 'center' })));
    const n = marker(numbered, SHORT);
    assert.equal(n.glyph, '1.');
    assert.ok(n.gap < 6, `1. is ${n.gap.toFixed(1)} pt from its text`);

    const nested = await read(await render(cv(`<ul><li>${LONG}<ul><li>${SHORT}</li></ul></li></ul>`, { alignment: 'center' })));
    const child = marker(nested, SHORT);
    assert.equal(child.glyph, '–');
    assert.ok(child.gap < 6, `– is ${child.gap.toFixed(1)} pt from its text`);
  });

  it('left alignment (the default) keeps the marker column: both items\' text starts at one x', async () => {
    const pages = await read(await render(cv(`<ul><li>${SHORT}</li><li>${LONG}</li></ul>`)));
    const [a, b] = [marker(pages, SHORT), marker(pages, LONG)];
    for (const m of [a, b]) {
      assert.equal(m.glyph, '•');
      assert.ok(m.sameY);
    }
    assert.ok(Math.abs(a.x - b.x) < 0.5, `text starts at ${a.x} and ${b.x}`);
  });
});
