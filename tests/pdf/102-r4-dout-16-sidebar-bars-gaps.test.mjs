// R4-DOUT-16: Sidebar's side column, Skills in Bars. Every bar row carried marginBottom 4, the last
// one too, while the groups were also set apart by the item gap: 4 + item gap between groups against
// 4 pt between bars, and the section ended 4 pt lower than every other column section before its
// section gap. Now the 4 pt sits only between a group's bars: groups are apart by the item gap alone,
// and the next section starts as far below the last bar as it does below Tags' last chip.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, read, allItems } from './harness.mjs';
import { painted } from './extractors.mjs';

before(setup);
after(teardown);

const TRACK = '#334155'; // the column's fill on its default navy: bar tracks and chips (sidebarShades)
const ITEM_GAP_PX = 16; // the section's own item gap: 12 pt
const ITEM_GAP = ITEM_GAP_PX * 0.75;
const GROUPS = [{ category: 'Frontend', skills: 'React, Vue' }, { category: 'Backend', skills: 'Go, Rust' }];

/** Skills in `skillsStyle` then Languages in the side column: page 1's items and fills. */
async function column(skillsStyle) {
  const bytes = await render(resume({
    template: 'sidebar',
    sections: [
      section('skills', GROUPS, { skillsStyle, itemGap: ITEM_GAP_PX }),
      section('languages', [{ language: 'Esperanto', proficiency: '' }]),
    ],
  }));
  const pages = await read(bytes);
  const items = allItems(pages).filter((t) => t.page === 1);
  const at = (str) => {
    const t = items.find((i) => i.str.trim() === str);
    assert.ok(t, `"${str}" is printed: ${items.map((i) => i.str).join(' | ')}`);
    return t;
  };
  const side = pages[0].W * 0.45;
  const fills = (await painted(bytes)).filter((p) => p.paint === 'fill' && p.colour === TRACK && p.x1 < side && p.y1 - p.y0 > 2);
  return { items, at, fills };
}

describe('Sidebar column Skills in Bars: no double gap, no trailing gap (R4-DOUT-16)', () => {
  it('groups are apart by the item gap alone, bars by 4 pt', async () => {
    const { items, at, fills } = await column('bars');
    const [top, next] = [at('React'), at('Esperanto')];
    const tracks = fills.filter((p) => p.y1 - p.y0 < 3.5 && p.y1 < top.y && p.y0 > next.y).sort((a, b) => b.y0 - a.y0); // top first
    assert.equal(tracks.length, 4, `one track per skill: ${JSON.stringify(tracks)}`);
    const [react, vue] = tracks;
    const [vueLabel, go] = [at('Vue'), at('Go')];
    const backend = items.find((t) => /b/i.test(t.str) && t.y < vueLabel.y && t.y > go.y);
    assert.ok(backend, 'the second group\'s category prints between its bars and the first group\'s');
    // A bar's bottom to the next line's baseline: the space above that line plus its ascent. The
    // category and the skill share the size and line height, so the difference is the space alone.
    const betweenBars = react.y0 - vueLabel.y; // 4 pt + a label's ascent
    const betweenGroups = vue.y0 - backend.y; // item gap + the category's ascent
    assert.ok(Math.abs(betweenGroups - betweenBars - (ITEM_GAP - 4)) < 1,
      `between groups ${betweenGroups.toFixed(2)} pt vs between bars ${betweenBars.toFixed(2)} pt: `
      + `expected the item gap (${ITEM_GAP} pt) where the bars have 4 pt`);
  });

  it('the next section starts as far below the last bar as below Tags\' last chip', async () => {
    const below = async (skillsStyle) => {
      const { at, fills } = await column(skillsStyle);
      const next = at('Esperanto');
      const last = Math.min(...fills.filter((p) => p.y0 > next.y).map((p) => p.y0));
      return last - next.y;
    };
    const [bars, tags] = [await below('bars'), await below('tags')];
    assert.ok(Math.abs(bars - tags) < 0.5, `last bar to the next section ${bars.toFixed(2)} pt, last chip ${tags.toFixed(2)} pt`);
  });
});
