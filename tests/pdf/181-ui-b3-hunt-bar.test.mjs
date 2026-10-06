// UI rebuild B3 (hunt H1-7, H2-14): two details of the bar on a phone.
// H1-7: the Resume | Cover Letter switch must be 44 px tall where a finger taps, and that is the buttons: the 44 px was
// on the frame around them, which has 4 px of padding, so each button was 36 px (Cypress 26 measures the button).
// H2-14: the Design button was hidden by `max-md:hidden`, a rem breakpoint, while the phone's pill, which has Design,
// is drawn by the Editor's px width (useIsMobile): with a larger text size in the browser, between 768 px and the rem
// width neither was there. Both now follow the one flag.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, finish, openEditor, until, attr } from './180-ui-b3-editor-mount.mjs';

before(prepare);
after(finish);

const tokens = (el) => attr(el, 'class').split(/\s+/).filter(Boolean);

describe('the document switch on a phone (H1-7)', () => {
  it('each of its two buttons is 44 px tall on a phone: the class is on the button, the thing that is tapped', async () => {
    const t = await openEditor();
    try {
      for (const id of ['doc-switch-resume', 'doc-switch-letter']) {
        assert.ok(tokens(t.byTid(id)).includes('max-md:min-h-[44px]'), `${id} has max-md:min-h-[44px]: ${attr(t.byTid(id), 'class')}`);
      }
    } finally { await t.close(); }
  });
});

describe('the Design button and the phone\'s pill hide and show by one flag (H2-14)', () => {
  it('on a desktop the button carries no hiding class, and no rem breakpoint hides it', async () => {
    const t = await openEditor();
    try {
      const on = tokens(t.byTid('design-button'));
      assert.ok(!on.includes('hidden') && !on.includes('max-md:hidden'), `desktop: ${on.join(' ')}`);
    } finally { await t.close(); }
  });

  it('on a phone the button is hidden by the same flag that draws the pill, and the pill is there', async () => {
    const t = await openEditor();
    try {
      t.goPhone();
      await until(() => tokens(t.byTid('design-button')).includes('hidden'), 'the Design button is hidden on a phone');
      assert.ok(!tokens(t.byTid('design-button')).includes('max-md:hidden'), 'not by a rem breakpoint');
      assert.ok(t.byTid('pill-design'), 'the pill, which has Design, is drawn');
    } finally { await t.close(); }
  });
});
