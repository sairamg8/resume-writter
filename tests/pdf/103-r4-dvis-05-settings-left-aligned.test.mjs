// R4-DVIS-05: a project's Settings page sits under its header as every other project view does —
// left-aligned at the header's padding (px-4, md:px-8), the cards at most 3xl wide. Its title, its
// storage notice and its cards were a centred max-w-3xl column padded sm:px-6: from 1280 px (or
// with the sidebar collapsed) the column started 130–300 px right of the header's title and tabs.
// The real page is mounted (fake DOM, no layout): its class tokens are read.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { mountSettings, classes } from './103-r4-board-settings-helpers.mjs';

before(setup);
after(teardown);

const CENTRED = ['mx-auto', 'sm:px-6'];

it('R4-DVIS-05: the title and the cards are left-aligned at the header\'s padding, not a centred column', async () => {
  const page = await mountSettings();
  try {
    const title = page.all().find((el) => el.tagName === 'H2' && el.textContent.trim() === 'Project settings');
    const cards = page.cards();
    assert.ok(title, 'the page title is shown');
    assert.ok(cards, 'the cards are shown');
    const frame = cards.parentNode;
    for (const [name, el] of [['title', title], ['cards', cards], ['their frame', frame]]) {
      for (const token of CENTRED) assert.ok(!classes(el).includes(token), `${name}: no ${token} (class="${el.getAttribute('class')}")`);
    }
    for (const [name, el] of [['title', title], ['the cards\' frame', frame]]) {
      for (const token of ['px-4', 'md:px-8']) assert.ok(classes(el).includes(token), `${name}: ${token}, as the header (class="${el.getAttribute('class')}")`);
    }
    assert.ok(classes(cards).includes('max-w-3xl'), 'the cards stay at most 3xl wide');
    assert.ok(!classes(title).includes('max-w-3xl'), 'the title is not held in a centred column');
  } finally {
    await page.close();
  }
});

it('R4-DVIS-05: the "not being saved" notice lines up with the header too', async () => {
  const page = await mountSettings({ refuseSave: true });
  try {
    const alert = page.all().find((el) => el.getAttribute('role') === 'alert' && /not being saved/.test(el.textContent));
    assert.ok(alert, 'storage refused the list: the notice is shown');
    const place = alert.parentNode; // BoardStorageNotice puts the page's className on this wrapper
    for (const token of ['px-4', 'md:px-8']) assert.ok(classes(place).includes(token), `${token} (class="${place.getAttribute('class')}")`);
    for (const token of [...CENTRED, 'max-w-3xl']) assert.ok(!classes(place).includes(token), `no ${token} (class="${place.getAttribute('class')}")`);
  } finally {
    await page.close();
  }
});
