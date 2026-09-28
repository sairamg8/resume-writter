// R4-SW-WT-01: body text after a list — a <blockquote> or a <dd> — was glued onto the last ATS bullet
// ("Led migration of 40 services Quoted by the CTO"). parseRichText gives such a block outside any list
// the indent of a top-level item, and extractBulletsFromItem read it as that item's continuation; the
// PDF prints it as its own indented paragraph. A block now says whether it sits inside a list (inList),
// and body text outside every list ends the open items and is no bullet. Continuations inside an item
// (a paragraph, a quote, text after a nested list, R4-LO-16) still join it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBulletsFromItem } from '../../src/utils/atsChecker.js';
import { parseRichText } from '../../src/utils/richText.js';

const bullets = (description) => extractBulletsFromItem({ description });

test('a quote after the list is not part of the last bullet', () => {
  assert.deepEqual(bullets('<ul><li>Led migration of 40 services</li></ul><blockquote>Quoted by the CTO</blockquote>'), ['Led migration of 40 services']);
});

test('a <dd> after the list is not either', () => {
  assert.deepEqual(bullets('<ul><li>Led migration</li></ul><dl><dt>Stack</dt><dd>Go and Postgres</dd></dl>'), ['Led migration']);
});

test('a quote between two lists ends the first list\'s items', () => {
  assert.deepEqual(bullets('<ul><li>A</li></ul><blockquote>Q</blockquote><ul><li>B</li></ul>'), ['A', 'B']);
  assert.deepEqual(bullets('<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul></li></ul><blockquote>Quoted by the CTO</blockquote>'), ['Led migration', 'Cut costs by 30%']);
});

test('continuations inside an item still join it', () => {
  assert.deepEqual(bullets('<ul><li>Led migration<blockquote>for 3 regions</blockquote></li></ul>'), ['Led migration for 3 regions']);
  assert.deepEqual(bullets('<ul><li><p>Led migration</p><p>saving 30%</p></li></ul>'), ['Led migration saving 30%']);
  assert.deepEqual(bullets('<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul>for 3 regions</li></ul>'), ['Led migration for 3 regions', 'Cut costs by 30%']);
});

test('parseRichText marks blocks inside a list, and body text as outside', () => {
  const blocks = parseRichText('<p>Intro</p><ul><li>A<p>more</p></li></ul><blockquote>Q</blockquote>');
  assert.deepEqual(blocks.map((b) => [b.runs.map((r) => r.text).join(''), b.indent, b.inList]), [
    ['Intro', 0, false], ['A', 1, true], ['more', 1, true], ['Q', 1, false],
  ]);
});
