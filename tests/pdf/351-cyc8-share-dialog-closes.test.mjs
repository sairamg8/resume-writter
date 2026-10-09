// CYC8-U18: the editor kept "the Share dialog is open" as a plain flag. Signing out with it open made
// sharing unavailable and unmounted the dialog, but the flag stayed true, so signing in again (or opening
// the same résumé later) brought the dialog back unasked. Now the open dialog belongs to one account and one
// résumé (useShareDialog): it closes when sharing goes away or either changes, and does not return with
// them. The real hook, driven through a component over tests/pdf/fake-dom.mjs; the Editor is pinned to use it.
import { readFileSync } from 'node:fs';
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

async function dialog(first) {
  const { useShareDialog } = await loadModule('/src/hooks/useShareDialog.js');
  const box = { open: null, setOpen: null };
  function Harness({ account, resumeId, sharable }) {
    [box.open, box.setOpen] = useShareDialog(account, resumeId, sharable);
    return null;
  }
  const view = mount(Harness, first);
  const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); }); };
  return {
    box,
    view,
    show: async (next) => { view.update(next); await settle(); },
    open: async () => { view.act(() => box.setOpen(true)); await settle(); },
    close: async () => { view.act(() => box.setOpen(false)); await settle(); },
  };
}

const SIGNED_IN = { account: 'u_tamsin', resumeId: 'resume_a', sharable: true };

it('signing out with the dialog open closes it, and signing in again does not reopen it', async () => {
  const d = await dialog(SIGNED_IN);
  try {
    assert.equal(d.box.open, false, 'closed to begin with');
    await d.open();
    assert.equal(d.box.open, true);
    await d.show({ account: null, resumeId: 'resume_a', sharable: false });
    assert.equal(d.box.open, false, 'sharing is unavailable signed out');
    await d.show(SIGNED_IN);
    assert.equal(d.box.open, false, 'signed in again: still closed');
  } finally { await d.view.unmount(); }
});

it('another account or another résumé finds the dialog closed, and coming back to the first still does', async () => {
  const d = await dialog(SIGNED_IN);
  try {
    await d.open();
    await d.show({ ...SIGNED_IN, resumeId: 'resume_b' });
    assert.equal(d.box.open, false, 'the other résumé');
    await d.show(SIGNED_IN);
    assert.equal(d.box.open, false, 'back on the first');
    await d.open();
    await d.show({ ...SIGNED_IN, account: 'u_other' });
    assert.equal(d.box.open, false, 'the other account');
  } finally { await d.view.unmount(); }
});

it('a cover letter (not shareable) cannot hold it open', async () => {
  const d = await dialog(SIGNED_IN);
  try {
    await d.open();
    await d.show({ ...SIGNED_IN, sharable: false });
    assert.equal(d.box.open, false);
    await d.open();
    assert.equal(d.box.open, false, 'nothing opens where sharing is not offered');
  } finally { await d.view.unmount(); }
});

it('with the same account and résumé it stays open across renders, and closes when asked', async () => {
  const d = await dialog(SIGNED_IN);
  try {
    await d.open();
    await d.show({ ...SIGNED_IN });
    assert.equal(d.box.open, true);
    await d.close();
    assert.equal(d.box.open, false);
  } finally { await d.view.unmount(); }
});

it('the Editor takes its Share state from it', () => {
  const source = readFileSync(new URL('../../src/pages/Editor.jsx', import.meta.url), 'utf8');
  assert.match(source, /\[shareOpen, setShareOpen\] = useShareDialog\(/);
  assert.doesNotMatch(source, /\[shareOpen, setShareOpen\] = useState/);
});
