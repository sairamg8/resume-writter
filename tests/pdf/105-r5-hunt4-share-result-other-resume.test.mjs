// R5-HUNT4-SHARE-MODAL-PUBLISH-LANDS-ON-OTHER-RESUME: the Editor stays mounted across /resume/:id, and
// so does its Share a public link panel. A Publish or Unpublish still running when another résumé
// opened (browser Back, an import) painted its result into the new résumé's panel: résumé B's panel
// showed A's link with 'Update the public copy', which then published B at A's link, or its Unpublish
// took A's link down. A result now lands only in the panel of the résumé it was run for. Mounted with
// react-dom/client over tests/pdf/fake-dom.mjs, with an io whose calls the test settles. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

let ShareLinkModal;
before(async () => {
  patchFakeDom();
  await setup();
  ({ default: ShareLinkModal } = await loadModule('/src/components/ShareLinkModal.jsx'));
});
after(teardown);

const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };
const until = async (done) => { for (const end = Date.now() + 30_000; !done() && Date.now() < end;) await new Promise((r) => { setTimeout(r, 10); }); };
const buttons = (view) => [...elements(view.document.body)].filter((el) => el.tagName === 'BUTTON');
const buttonNamed = (view, name) => buttons(view).find((el) => el.textContent.trim() === name);
const click = (view, el) => view.act(() => reactProps(el).onClick({}));
const text = (view) => view.document.body.textContent;
/** The public link the panel shows, or '' when it shows none. */
const shownLink = (view) => {
  const input = [...elements(view.document.body)].find((el) => el.tagName === 'INPUT');
  return input ? String(reactProps(input).value) : '';
};

/** An io whose publish/unpublish wait until the test settles them; readShare answers from `shares`. */
function slowIo(shares) {
  const pending = [];
  const later = (value) => new Promise((resolve, reject) => { pending.push({ resolve: () => resolve(value), reject }); });
  return {
    pending,
    readShare: async (uid, id) => shares[id] || null,
    publish: (uid, r, opts) => later({ shareId: opts?.shareId || `share_${r.id}`, publishedAt: Date.now(), copy: {} }),
    unpublish: () => later(undefined),
  };
}

it('a Publish that finishes after another résumé opened does not show its link under that résumé', async () => {
  const a = resume({ personal: { name: 'Avery Stone' } });
  const b = resume({ personal: { name: 'Blake Rowan' } });
  const io = slowIo({});
  const props = { isOpen: true, resume: a, uid: 'uid_owner', io, onClose: () => {} };
  const view = mount(ShareLinkModal, props);
  try {
    await until(() => buttonNamed(view, 'Publish'));
    click(view, buttonNamed(view, 'Publish'));
    await until(() => io.pending.length === 1);
    view.update({ ...props, resume: b });
    await until(() => buttonNamed(view, 'Publish'));
    io.pending[0].resolve();
    await flush();
    assert.ok(buttonNamed(view, 'Publish'), "B's panel still offers Publish");
    assert.ok(!buttonNamed(view, 'Update the public copy'), "no Update aimed at A's link");
    assert.equal(shownLink(view), '', "A's link is not shown under B");
    assert.ok(!/This résumé is published/.test(text(view)));
  } finally {
    await view.unmount();
  }
});

it('an Unpublish that finishes after another résumé opened leaves that résumé shown as published', async () => {
  const a = resume({ personal: { name: 'Avery Stone' } });
  const b = resume({ personal: { name: 'Blake Rowan' } });
  const io = slowIo({
    [a.id]: { shareId: 'share_a', publishedAt: Date.now(), copy: {} },
    [b.id]: { shareId: 'share_b', publishedAt: Date.now(), copy: {} },
  });
  const props = { isOpen: true, resume: a, uid: 'uid_owner', io, onClose: () => {} };
  const view = mount(ShareLinkModal, props);
  try {
    await until(() => buttonNamed(view, 'Unpublish'));
    click(view, buttonNamed(view, 'Unpublish'));
    click(view, buttonNamed(view, 'Yes, unpublish'));
    await until(() => io.pending.length === 1);
    view.update({ ...props, resume: b });
    await until(() => shownLink(view).includes('share_b'));
    io.pending[0].resolve();
    await flush();
    assert.ok(shownLink(view).includes('share_b'), "B's link is still shown");
    assert.ok(/This résumé is published/.test(text(view)), 'B still reads as published');
    assert.ok(buttonNamed(view, 'Unpublish'));
  } finally {
    await view.unmount();
  }
});
