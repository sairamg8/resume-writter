// R4-DVIS-11: the backlog toolbar's "Epic panel" toggle. It said aria-pressed while the panel was
// open but looked the same as when closed (the kit's grey secondary button), unlike the toolbar's
// quick filters and filter buttons right beside it, which turn brand-blue (bg-brand-subtle
// text-brand) when on. It now wears the same look while pressed, through aria-pressed variants
// that outrank the button's own grey and hover (cx does not merge classes, so a plain
// bg-brand-subtle would only tie with bg-neutral-fill). The real Backlog page over fake-dom
// (tests/pdf/103-r4-backlog-page.mjs); fake-dom has no stylesheet, so the class tokens and the
// attribute they key on are checked.
// Run: node --test tests/pdf/103-r4-dvis-11-epic-panel-pressed.test.mjs
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { useBacklogPage, mountBacklog, tokens } from './103-r4-backlog-page.mjs';

useBacklogPage();

it('R4-DVIS-11: "Epic panel" is drawn selected while the panel is open, as the quick filters are when on', async () => {
  const page = mountBacklog();
  try {
    const toggle = () => page.button('Epic panel');
    assert.ok(toggle(), 'the toolbar has its "Epic panel" toggle');
    assert.equal(toggle().getAttribute('aria-pressed'), 'false');
    const got = tokens(toggle());
    assert.ok(got.has('bg-neutral-fill'), 'the toggle is the kit\'s grey button while the panel is closed');
    for (const t of ['aria-pressed:bg-cv-brand-soft', 'aria-pressed:text-cv-brand-text', 'aria-pressed:hover:bg-cv-brand-soft-border']) {
      assert.ok(got.has(t), `the toggle lacks ${t}: it looks the same open and closed`);
    }

    page.click(toggle());
    assert.ok(page.byLabel('Epics'), 'the Epic panel opened');
    assert.equal(toggle().getAttribute('aria-pressed'), 'true', 'the pressed look keys on aria-pressed');
    assert.ok(tokens(toggle()).has('aria-pressed:bg-cv-brand-soft'));
  } finally {
    await page.view.unmount();
  }
});
