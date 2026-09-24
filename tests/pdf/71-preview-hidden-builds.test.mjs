// A preview nobody can see must not be built (R2-016). The preview column is hidden, never
// unmounted, in the desktop "Editor only" layout and — the default on a phone — whenever the Edit
// tab is showing. PdfPreview still built and painted the whole PDF after every pause in typing:
// main-thread react-pdf layout (70–80 ms per build on a desktop, several times that on a phone),
// then pdf.js, then a paint at the 240 px floor of a zero-width column that had to be painted
// again once shown. Now a hidden preview only notes that its input moved on and builds once, with
// the latest input, when it is shown; shown again with nothing changed, it builds nothing.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs; the build is a counting stub (it
// fails at once, so neither react-pdf nor pdf.js runs), and the editor's own column is checked
// through the status it reports.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

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

/** Let the preview's timers (0 ms when nothing is on screen yet) and React's scheduler run. */
const settle = () => new Promise((r) => { setTimeout(r, 25); });

/** A build that records the input it was asked for and fails at once. */
function countingBuild() {
  const calls = [];
  const build = (input) => { calls.push(input); throw new Error('stub build'); };
  return { calls, build };
}

/** Six successive versions of one résumé, as typing produces them. */
const versions = () => Array.from({ length: 6 }, (_, i) => resume({ personal: { name: `Pat ${'e'.repeat(i)}` } }));

async function preview(props) {
  const { PdfPreview } = await loadModule('/src/components/PdfPreview.jsx');
  const view = mount(PdfPreview, { textId: 'resume-preview', ...props });
  await settle();
  return { view, set: async (next) => { view.update({ textId: 'resume-preview', ...props, ...next }); await settle(); } };
}

describe('a hidden preview builds nothing until it is shown (R2-016)', () => {
  it('hidden while four edits land: 0 builds; shown: exactly 1, of the latest edit', async () => {
    const [v0, v1, v2, v3, v4] = versions();
    const { calls, build } = countingBuild();
    const { view, set } = await preview({ render: build, input: v0, active: false });
    try {
      for (const v of [v1, v2, v3, v4]) await set({ render: build, input: v, active: false });
      assert.equal(calls.length, 0, `builds while hidden: ${calls.length}`);
      await set({ render: build, input: v4, active: true });
      assert.equal(calls.length, 1, 'one build when shown');
      assert.equal(calls[0], v4, 'built from the latest edit');
    } finally { await view.unmount(); }
  });

  it('hidden and shown again with no edit in between: no rebuild; an edit while hidden: one rebuild when shown', async () => {
    const [v0, v1] = versions();
    const { calls, build } = countingBuild();
    const { view, set } = await preview({ render: build, input: v0, active: true });
    try {
      assert.equal(calls.length, 1, 'built once on open, shown');
      await set({ render: build, input: v0, active: false });
      await set({ render: build, input: v0, active: true });
      assert.equal(calls.length, 1, 'nothing changed: nothing rebuilt');
      await set({ render: build, input: v1, active: false });
      assert.equal(calls.length, 1, 'no build for the hidden edit');
      await set({ render: build, input: v1, active: true });
      assert.deepEqual([calls.length, calls[1]], [2, v1]);
    } finally { await view.unmount(); }
  });

  it('shown (the default) it builds after every edit, as before', async () => {
    const [v0, v1, v2] = versions();
    const { calls, build } = countingBuild();
    const { view, set } = await preview({ render: build, input: v0 });
    try {
      await set({ render: build, input: v1 });
      await set({ render: build, input: v2 });
      assert.deepEqual(calls, [v0, v1, v2]);
    } finally { await view.unmount(); }
  });
});

describe('the editor hides its preview without building it: "Editor only", and the phone\'s Edit tab (R2-016)', () => {
  /** The editor's preview column, as Editor.jsx renders it for `layoutMode`; its preview's reported status. */
  async function column(layoutMode, r, isMobile = false) {
    const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
    const props = (lm, res) => ({ children: createElement(EditorPreviewPane, {
      resume: res, activeTab: 'resume', layoutMode: lm, setLayoutMode: () => {}, previewZoom: 1, setPreviewZoom: () => {}, persistError: null, isMobile,
    }) });
    const view = mount(MemoryRouter, props(layoutMode, r));
    const status = () => [...elements(view.container)].find((el) => el.hasAttribute('data-preview-status'))?.getAttribute('data-preview-status');
    return { view, status, set: (lm, res) => view.update(props(lm, res)) };
  }

  for (const [label, isMobile] of [['desktop "Editor only"', false], ['phone, Edit tab (layoutMode "editor")', true]]) {
    it(`${label}: the hidden preview stays paused through edits, and starts building once shown`, async () => {
      const [v0, v1, v2] = versions();
      const { view, status, set } = await column('editor', v0, isMobile);
      try {
        assert.equal(status(), 'paused', 'the hidden preview starts a build on open');
        set('editor', v1);
        set('editor', v2);
        assert.equal(status(), 'paused', 'the hidden preview starts a build after an edit');
        // Shown (Split view, or the phone's Preview tab): it starts building at once. A second
        // synchronous render runs the first one's effects and commits the status they set, and
        // the column is unmounted before the 0 ms build timer can fire: no real PDF is built here.
        set(isMobile ? 'preview' : 'split', v2);
        set(isMobile ? 'preview' : 'split', v2);
        assert.equal(status(), 'rendering', 'shown, the preview builds');
      } finally { await view.unmount(); }
    });
  }
});
