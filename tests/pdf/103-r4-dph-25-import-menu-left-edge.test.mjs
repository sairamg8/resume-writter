// R4-DPH-25: a demo account's Import on the dashboard was a drop-down menu (ImportMenu) hung from its
// trigger's right edge (`absolute right-0`, w-64). Below 768 px Import is the first action of the header's
// row, about 100 px wide at the screen's left, so the 256 px menu ran ~140 px off the left of the screen:
// its labels showed only their endings and every hint line lost its left half. The drop-down is gone: Import
// opens ImportDialog (the kit's Dialog, src/components/ImportDialog.jsx), which is not placed against its
// trigger at all — it is centred in a fixed full-screen layer, `w-full` with 16 px of margin on a phone.
// The fake DOM has no layout, so this pins that structure on the real dialog (mounted with
// react-dom/client over tests/pdf/fake-dom.mjs) and checks that every choice it offers is reachable and
// still picks, for a demo account (two choices and their hint) and for any other (one choice).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { dialogButton, importDialog, importDialogUp } from './import-dialog.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const click = { preventDefault() {}, stopPropagation() {}, detail: 1, nativeEvent: {} };

async function open(props) {
  const { default: ImportDialog } = await loadModule('/src/components/ImportDialog.jsx');
  const { ORIGINALS_HINT } = await loadModule('/src/constants/cardHints.js');
  const picks = [];
  let closed = 0;
  const view = mount(ImportDialog, { isOpen: true, onPick: (keep) => picks.push(keep), onClose: () => { closed += 1; }, ...props });
  const dialog = await importDialogUp(view);
  return { view, dialog, picks, closed: () => closed, ORIGINALS_HINT };
}

describe('the Import dialog is not cut off on a phone (R4-DPH-25)', () => {
  it('it is a centred panel in a fixed full-screen layer, never hung from the Import button\'s edge', async () => {
    const { view, dialog } = await open({ keeps: true });
    try {
      assert.ok(tokens(dialog).includes('w-full'), `the panel is the width of the screen less its margin: ${tokens(dialog).join(' ')}`);
      for (const bad of ['absolute', 'fixed']) assert.ok(!tokens(dialog).includes(bad), `the panel itself is not ${bad}ly placed`);
      assert.ok(!tokens(dialog).some((t) => /^(left|right)-/.test(t)), 'no left-/right- offset from a trigger: the 256 px menu ran ~140 px off a phone\'s left edge');
      // The layers above it: a fixed layer over the whole screen that centres the panel with 16 px of room.
      const centring = dialog.parentNode;
      assert.ok(tokens(centring).includes('flex') && tokens(centring).includes('items-center') && tokens(centring).includes('justify-center'), `centred: ${tokens(centring).join(' ')}`);
      assert.ok(tokens(centring).includes('p-4'), '16 px of margin on a phone');
      const layer = centring.parentNode;
      assert.ok(tokens(layer).includes('fixed') && tokens(layer).includes('inset-0'), `a layer over the whole screen: ${tokens(layer).join(' ')}`);
      assert.equal(layer.parentNode, view.document.body, 'drawn in a portal at the end of <body>, not inside the header\'s row');
      assert.ok(!view.container.contains(dialog), 'and so not clipped by the header it was opened from');
    } finally { await view.unmount(); }
  });

  it('a demo account sees both choices and the hint under them, and each picks (as an original, or not) and closes it', async () => {
    const { view, dialog, picks, closed, ORIGINALS_HINT } = await open({ keeps: true });
    try {
      const plain = dialogButton(view, 'Choose a file');
      const original = dialogButton(view, 'Import as my original');
      assert.ok(plain, '"Choose a file"');
      assert.ok(original, '"Import as my original"');
      for (const b of [plain, original]) assert.notEqual(reactProps(b).disabled, true, `${text(b)} can be pressed`);
      assert.ok(text(dialog).includes(ORIGINALS_HINT), 'the hint about originals is whole, in the dialog');

      view.act(() => reactProps(original).onClick(click));
      assert.deepEqual(picks, [true], 'a pick opens the file picker, as an original');
      assert.equal(closed(), 1, 'and the dialog closes');
      view.act(() => reactProps(plain).onClick(click));
      assert.deepEqual(picks, [true, false], 'the plain choice is not an original');
      assert.equal(closed(), 2);
    } finally { await view.unmount(); }
  });

  it('any other account sees one choice and no "Import as my original"; Cancel closes without picking', async () => {
    const { view, dialog, picks, closed, ORIGINALS_HINT } = await open({ keeps: false });
    try {
      assert.ok(dialogButton(view, 'Choose a file'));
      assert.equal(dialogButton(view, 'Import as my original'), undefined);
      assert.ok(!text(dialog).includes(ORIGINALS_HINT));
      view.act(() => reactProps(dialogButton(view, 'Cancel')).onClick(click));
      assert.deepEqual(picks, []);
      assert.equal(closed(), 1);
    } finally { await view.unmount(); }
  });

  it('busy (a document is being read): the choices are disabled and pick nothing', async () => {
    const { view, picks, closed } = await open({ keeps: true, busy: true });
    try {
      const reading = dialogButton(view, 'Reading…');
      assert.ok(reading, 'the first choice says it is reading');
      assert.equal(reactProps(reading).disabled, true);
      assert.equal(reactProps(dialogButton(view, 'Import as my original')).disabled, true);
      view.act(() => reactProps(reading).onClick(click));
      assert.deepEqual(picks, []);
      assert.equal(closed(), 0);
    } finally { await view.unmount(); }
  });

  it('it names what can be imported, and warns to check the result', async () => {
    const { view, dialog } = await open({ keeps: false });
    try {
      for (const type of ['PDF', 'Word', 'Markdown', 'Text', 'JSON backup', 'JSON Resume']) {
        assert.ok([...elements(dialog)].some((el) => el.tagName === 'LI' && text(el) === type), type);
      }
      assert.match(text(dialog), /Check the name, contacts, sections and dates afterwards\./);
      assert.ok(importDialog(view));
    } finally { await view.unmount(); }
  });
});
