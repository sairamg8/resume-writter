// UI rebuild B4 re-verification (layout L7): the preview column carried `hidden` AND `flex` in the editor-only layout, two
// display utilities on one element, which the stylesheet decides by its own order (the rule EditorHeader's comment states,
// and the defect c7391ba1 was). It holds one display utility in every layout: `flex` (a column) when shown, `hidden` when not.
// Mounted over tests/pdf/fake-dom.mjs as tests/pdf/181-ui-b4-stage-toolbar mounts the pane.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { mount, elements } from './fake-dom.mjs';
import { setup, teardown, loadModule, resume } from './harness.mjs';

const quiet = { ResizeObserver: globalThis.ResizeObserver };
before(async () => {
  await setup();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
});
after(async () => {
  if (quiet.ResizeObserver) globalThis.ResizeObserver = quiet.ResizeObserver;
  else delete globalThis.ResizeObserver;
  await teardown();
});

const DISPLAY = /^(hidden|block|inline|inline-block|inline-flex|flex|grid|inline-grid|contents|table)$/;

/** The class tokens of the pane's root (the box the preview sits and scrolls in) in `layoutMode`. */
async function rootTokens(layoutMode) {
  const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
  const view = mount(() => createElement(MemoryRouter, { useTransitions: false },
    createElement(EditorPreviewPane, { resume: resume({ personal: { name: 'Pat Sample' } }), activeTab: 'resume', layoutMode, setLayoutMode() {}, previewZoom: 1, setPreviewZoom() {}, isMobile: false })), {});
  try {
    const status = [...elements(view.container)].find((el) => el.hasAttribute('data-preview-status'));
    return (status.parentNode.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  } finally { await view.unmount(); }
}

describe('the preview column holds one display utility in every layout (L7)', () => {
  for (const [mode, want] of [['split', 'flex'], ['preview', 'flex'], ['editor', 'hidden']]) {
    it(`${mode}: exactly one, ${want}`, async () => {
      const display = (await rootTokens(mode)).filter((t) => DISPLAY.test(t));
      assert.deepEqual(display, [want], `the display utilities on the column: ${display.join(' ')}`);
    });
  }
});
