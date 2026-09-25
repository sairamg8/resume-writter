// Typing that never pauses still repaints the preview (R2-142). Every change restarted the 350 ms
// debounce, so keys a few hundred ms apart — a sentence typed into Summary — never left the pause a
// build waited for: the preview stayed frozen on the pages from before the typing until it stopped.
// Now a change waits no longer than MAX_WAIT_MS after the first one no build has taken up yet, and
// the pages it builds go up while typing goes on; one build at a time — while one is still on its
// way the next waits for it, so a build slower than that never piles more of them up. The pause
// after the typing still builds the latest, as before (tests/pdf/90-preview-mechanics).
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, wait, versions, name, opened } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

const MAX_WAIT_MS = 1200; // PdfPreview's
const KEY_GAP_MS = 100;   // a key every 100 ms: never the debounce's 350 ms pause

/** Type `keys` into the preview KEY_GAP_MS apart, until `stop()` holds; how many were typed, in how long. */
async function type(p, keys, stop = () => false) {
  const t0 = Date.now();
  let typed = 0;
  for (const key of keys) {
    if (stop()) break;
    p.set({ render: p.build, input: key });
    typed += 1;
    await wait(KEY_GAP_MS);
  }
  return { typed, ms: Date.now() - t0 };
}

describe('typing that never pauses still repaints the preview (R2-142)', () => {
  it('a build starts at the latest MAX_WAIT_MS into the typing, and its pages go up while typing goes on', async () => {
    const [v0, ...keys] = versions(41); // 40 keys: 4 s of typing with no pause
    const p = await opened(v0);
    try {
      const first = await type(p, keys, () => p.calls.length > 1);
      assert.equal(p.calls.length, 2, `before: no build in ${first.ms} ms of steady typing — the preview stayed frozen`);
      assert.ok(first.ms <= MAX_WAIT_MS + 500, `the build started ${first.ms} ms into the typing`);
      let at = first.typed;
      const mid = p.calls[1].input;
      assert.ok(keys.indexOf(mid) >= 0 && keys.indexOf(mid) < at, 'it builds what was typed by then');
      // Typing goes on while it builds.
      at += (await type(p, keys.slice(at, at + 2))).typed;
      p.calls[1].finish();
      await settle();
      assert.deepEqual([p.shown(), p.status()], [name(mid), 'rendering'], 'its pages go up; the typing since is still on its way');

      // Typing on, the next build starts within MAX_WAIT_MS again: the preview keeps up, bounded.
      const second = await type(p, keys.slice(at), () => p.calls.length > 2);
      at += second.typed;
      assert.equal(p.calls.length, 3, `no second build in ${second.ms} ms of typing`);
      assert.ok(second.ms <= MAX_WAIT_MS + 500, `the second build started ${second.ms} ms after the first went up`);
      p.calls[2].finish();
      await settle();
      assert.equal(p.shown(), name(p.calls[2].input));

      // Typing stops: the pause builds the last key, and the preview is ready on it.
      await type(p, keys.slice(at));
      await pause();
      assert.equal(p.calls.at(-1).input, keys.at(-1), 'the pause builds the last key');
      assert.ok(p.calls.length <= 6, `${p.calls.length} builds for ${keys.length} keys: not one per key`);
      p.calls.at(-1).finish();
      await settle();
      assert.deepEqual([p.shown(), p.status()], [name(keys.at(-1)), 'ready']);
    } finally { await p.view.unmount(); }
  });

  it('one build at a time: while one is on its way, typing starts no other; the key after it finishes does', async () => {
    const [v0, ...keys] = versions(51);
    const p = await opened(v0);
    try {
      const first = await type(p, keys, () => p.calls.length > 1);
      assert.equal(p.calls.length, 2, `before: no build in ${first.ms} ms of steady typing`);
      let at = first.typed;

      // A slow build: 2 s more of typing while it is still on its way.
      await type(p, keys.slice(at, at + 20));
      at += 20;
      assert.equal(p.calls.length, 2, 'no second build piled onto the one still on its way');
      p.calls[1].finish();
      await settle();
      assert.equal(p.shown(), name(p.calls[1].input), 'the slow build\'s pages go up');

      // The typing has waited longer than MAX_WAIT_MS already: the first key after it starts the next.
      const next = await type(p, keys.slice(at), () => p.calls.length > 2);
      assert.equal(p.calls.length, 3, `no build in ${next.ms} ms after the slow one finished`);
      assert.equal(p.calls[2].input, keys[at], 'the first key after it finished builds at once');
      p.calls[2].finish();
      await settle();
      assert.equal(p.shown(), name(keys[at]));
    } finally { await p.view.unmount(); }
  });
});
