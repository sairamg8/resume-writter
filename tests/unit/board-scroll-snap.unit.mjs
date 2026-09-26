// Unit test for column scroll-snap on phones (B-13). scroll-snap-type works only on a scroll
// container: the board page put `snap-x snap-mandatory` on the flex row of columns inside its
// overflow-auto scroller, and the row does not scroll, so a swipe on a phone stopped wherever the
// fling ended — half of each of two columns — although every column is `snap-center`. The test reads
// every class string in src/ that turns on mandatory or proximity snapping and requires it on an
// element that scrolls (an overflow-auto / overflow-scroll class in the same string), and the
// board's scroller to be one of them. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = path.join(ROOT, 'src');
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(full) : /\.jsx?$/.test(e.name) ? [full] : [];
  });
}

const SNAP = /\bsnap-(?:mandatory|proximity)\b/;
const SCROLLS = /\boverflow(?:-x)?-(?:auto|scroll)\b/;

/** Every source line that turns snapping on, as `{ where, line }`. */
const snapping = filesUnder(SRC).flatMap((file) => fs.readFileSync(file, 'utf8').split('\n')
  .map((line, i) => ({ where: `${rel(file)}:${i + 1}`, line }))
  .filter(({ line }) => SNAP.test(line) && !/^\s*(?:\/\/|\*|\{?\/\*)/.test(line)));

test('B-13: scroll-snap is turned on only on an element that scrolls', () => {
  assert.ok(snapping.length > 0);
  for (const { where, line } of snapping) {
    assert.match(line, SCROLLS, `${where} snaps but does not scroll, so the snap does nothing:\n${line.trim()}`);
  }
});

test('the board\'s column scroller snaps, and its columns snap to their centre', () => {
  const board = snapping.filter(({ where }) => where.startsWith('src/pages/Board.jsx:'));
  assert.equal(board.length, 1, 'one snapping element on the board page');
  assert.match(board[0].line, /\bsnap-x\b/);
  assert.match(board[0].line, /\bmd:snap-none\b/, 'phones only: a desktop board scrolls freely');
  const column = fs.readFileSync(path.join(SRC, 'components/board/BoardColumn.jsx'), 'utf8');
  assert.match(column, /\bsnap-center\b/);
});
