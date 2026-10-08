// Two-devices journey (cycle 7): the account button's photo that does not load. Opened offline (the
// photo is no longer in the browser's cache) or behind a host that blocks it, the picture failed and
// the button was left an empty circle: its alt is empty, so the browser draws nothing, and the
// initial that stands in for a missing photo was never tried. The kit's Avatar (ui/Avatar.jsx)
// already falls back to initials on an image error; the account's avatar now does too, and keeps the
// address that failed so another account's photo, signed in later on the same bar, is tried again.
// fake-dom has no network: the image's own error handler is called as React set it.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const photo = (url) => ({ uid: 'u1', displayName: 'Alex Johnson', email: 'alex@example.com', photoURL: url });
const props = (user) => ({
  user, authLoading: false, cloudAvailable: true, signInWithGoogle: async () => {}, signOut() {},
  syncStatus: 'synced', lastSynced: null, isOnline: true, heldResumes: [],
});

it('a photo that fails to load gives way to the initial, and another account\'s photo is tried', async () => {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  const view = mount(AuthBar, props(photo('https://img.example/a.png')));
  try {
    const all = () => [...elements(view.container)];
    const initial = () => all().filter((el) => el.tagName === 'DIV' && el.textContent === 'A');
    const images = () => all().filter((el) => el.tagName === 'IMG');
    assert.equal(images().length, 1, 'the photo is drawn at first');
    assert.equal(images()[0].getAttribute('src'), 'https://img.example/a.png');
    assert.equal(initial().length, 0, 'no initial while the photo is drawn');

    view.act(() => { reactProps(images()[0]).onError({}); });
    assert.equal(images().length, 0, 'the failed photo is no longer drawn');
    assert.equal(initial().length, 1, 'the initial stands in for it');

    view.update(props(photo('https://img.example/b.png')));
    assert.equal(images().length, 1, 'a different address is a different photo: tried');
    assert.equal(images()[0].getAttribute('src'), 'https://img.example/b.png');
    assert.equal(initial().length, 0, 'and the initial is gone again');
  } finally { await view.unmount(); }
});
