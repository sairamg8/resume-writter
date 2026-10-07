// UI rebuild B5a start-up ledger: the card menu (with the kit's Menu), the letter picker and Career History
// stay OFF the start-up path (reached only through import() in lazyPiece.jsx), and the menu's code is asked
// for once however often its button is hovered.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup, teardown } from './harness.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { cv, dashboard } from './182-ui-b5a-mount.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const LAZY = /^import\s[^;]*from\s+'@\/components\/(CardMenu|NewLetterModal|CareerHistoryPanel)'/m;

it('no start-up file imports the card menu, the letter picker or Career History statically', () => {
  for (const file of ['src/pages/Dashboard.jsx', 'src/components/ResumeCard.jsx', 'src/components/lazyPiece.jsx']) {
    assert.doesNotMatch(read(file), LAZY, `${file} imports a lazy piece statically`);
  }
  assert.doesNotMatch(read('src/components/ResumeCard.jsx'), /from\s+'@\/components\/ui\/Menu'/, 'the kit Menu never joins the entry');
  const piece = read('src/components/lazyPiece.jsx');
  for (const name of ['CardMenu', 'NewLetterModal', 'CareerHistoryPanel']) assert.match(piece, new RegExp(`import\\('@/components/${name}'\\)`), `${name} is an import()`);
});

it('the menu\'s code is asked for once, however many cards are hovered and however often', async () => {
  let asked = 0;
  const page = await dashboard([cv('resume_a', 'A CV', 1000), cv('resume_b', 'B CV', 2000)], {
    custom: { menu: () => { asked += 1; return import('../../src/components/CardMenu.jsx').then((m) => ({ default: m.CardMenu })); } },
  });
  try {
    const before = asked;
    for (const card of page.cards()) { page.hover(page.more(card)); page.hover(page.more(card)); }
    await page.settle();
    assert.ok(asked - before <= 1, 'prefetched once');
    assert.ok(asked <= 1, 'and never asked again by another card');
  } finally { await page.close(); }
});
