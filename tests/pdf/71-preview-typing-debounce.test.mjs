// Typing into the editor must never start one full PDF build per keystroke (R2-017). The preview
// waited DEBOUNCE_MS after the last change only once a build had SUCCEEDED (`docRef.current`):
// on a cold open, while the first build is still loading fonts and the template, and after any
// failed build, every change started another full react-pdf layout at once — 10 keystrokes 60 ms
// apart started 11 builds. Now every change after the first build has started waits for the pause;
// only the first build, a Retry and a preview just shown (R2-016) start at once.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs; the build is a counting stub that fails
// at once — the state a cold open is in too (no finished document yet), without react-pdf or pdf.js.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

const quiet = { error: console.error, ResizeObserver: globalThis.ResizeObserver };
before(async () => {
  await setup();
  console.error = () => {}; // the stub build's "Preview render failed"
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
});
after(async () => {
  console.error = quiet.error;
  if (quiet.ResizeObserver) globalThis.ResizeObserver = quiet.ResizeObserver;
  else delete globalThis.ResizeObserver;
  await teardown();
});

const DEBOUNCE_MS = 350; // PdfPreview's
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** A build that records the input it was asked for and fails at once. */
function countingBuild() {
  const calls = [];
  const build = (input) => { calls.push(input); throw new Error('stub build'); };
  return { calls, build };
}

/** `n` successive versions of one résumé, one per keystroke. */
const keystrokes = (n) => Array.from({ length: n }, (_, i) => resume({ personal: { name: `Pat ${'e'.repeat(i)}` } }));

async function preview(props) {
  const { PdfPreview } = await loadModule('/src/components/PdfPreview.jsx');
  const view = mount(PdfPreview, { textId: 'resume-preview', ...props });
  const set = (next) => view.update({ textId: 'resume-preview', ...props, ...next });
  const status = () => [...elements(view.container)].find((el) => el.hasAttribute('data-preview-status'))?.getAttribute('data-preview-status');
  const retry = () => [...elements(view.container)].find((el) => el.tagName?.toLowerCase() === 'button' && el.textContent === 'Retry');
  return { view, set, status, retry };
}

/** Type `versions` into the preview `gapMs` apart, as a user does. */
async function type(set, build, versions, gapMs = 60) {
  for (const v of versions) { set({ render: build, input: v }); await wait(gapMs); }
}

describe('typing is debounced before the first page appears and after a failed build (R2-017)', () => {
  it('after a failed build: 10 keystrokes 60 ms apart start ONE more build, of the last keystroke', async () => {
    const [v0, ...typed] = keystrokes(11);
    const { calls, build } = countingBuild();
    const { view, set, status } = await preview({ render: build, input: v0 });
    try {
      await wait(25);
      assert.deepEqual([calls.length, status()], [1, 'error'], 'the first build ran at once and failed');
      await type(set, build, typed);
      await wait(DEBOUNCE_MS + 100);
      assert.equal(calls.length, 2, `builds started: ${calls.length} (one per keystroke = 11)`);
      assert.equal(calls[1], typed.at(-1), 'the one build is of the latest keystroke');
    } finally { await view.unmount(); }
  });

  it('while typing, nothing new starts until the pause; the preview says it is rendering', async () => {
    const [v0, v1, v2] = keystrokes(3);
    const { calls, build } = countingBuild();
    const { view, set, status } = await preview({ render: build, input: v0 });
    try {
      await wait(25);
      await type(set, build, [v1, v2], 25);
      assert.equal(calls.length, 1, `a keystroke ${25} ms ago started a build`);
      assert.equal(status(), 'rendering', 'the pending change shows as rendering');
      await wait(DEBOUNCE_MS + 100);
      assert.deepEqual(calls, [v0, v2]);
    } finally { await view.unmount(); }
  });

  it('keystrokes before the first build has even started: one build, of the latest input', async () => {
    const [v0, v1, v2] = keystrokes(3);
    const { calls, build } = countingBuild();
    const { view, set } = await preview({ render: build, input: v0 });
    try {
      set({ render: build, input: v1 });
      set({ render: build, input: v2 });
      await wait(25);
      assert.deepEqual(calls, [v2], 'the first build starts without the debounce, from the latest input');
    } finally { await view.unmount(); }
  });

  it('Retry after a failure builds at once, without the typing debounce', async () => {
    const [v0] = keystrokes(1);
    const { calls, build } = countingBuild();
    const { view, status, retry } = await preview({ render: build, input: v0 });
    try {
      await wait(25);
      assert.equal(status(), 'error');
      const button = retry();
      assert.ok(button, 'the error shows a Retry button');
      view.act(() => reactProps(button).onClick());
      await wait(25);
      assert.deepEqual(calls, [v0, v0], 'Retry rebuilt at once');
    } finally { await view.unmount(); }
  });

  it('a failed build is retried by the next pause in typing, as before', async () => {
    const [v0, v1] = keystrokes(2);
    const { calls, build } = countingBuild();
    const { view, set } = await preview({ render: build, input: v0 });
    try {
      await wait(25);
      set({ render: build, input: v1 });
      await wait(DEBOUNCE_MS + 100);
      assert.deepEqual(calls, [v0, v1]);
    } finally { await view.unmount(); }
  });
});
