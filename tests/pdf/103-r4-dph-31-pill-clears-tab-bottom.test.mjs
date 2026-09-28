// R4-DPH-31 (and R4-DPH-32, the same defect): below md (768 px, useIsMobile) the editor's Edit | Preview
// pill floats at the foot of the screen (Editor.jsx, fixed bottom-4, about 38 px tall: up to 54 px from
// the bottom). The editor's tab box (EditorTabContent) had no bottom padding, so scrolled to the end the
// Design tab's last lines and the Cover Letter's Signature Designation field stayed under the pill. The
// box now keeps 64 px under every tab below md (max-md:pb-16), and none from md up, where there is no
// pill. The preview pane had the same gap from 640 to 767 px: its pb-24 gave way to the sm: padding at
// 640 while the pill stays until 768, so the Saved · Terms · Privacy footer sat under it; the pane's short
// bottom now waits for md (pb-24 md:pb-8), with no sm:py-8 left to outrank pb-24 in between. The fake DOM
// has no layout, so this pins the classes on the real EditorTabContent (mounted with react-dom/client over
// tests/pdf/fake-dom.mjs) and the real EditorPreviewPane (rendered to static markup).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const split = (cls) => (cls ?? '').split(/\s+/).filter(Boolean);
/** The utilities among `tokens` that set a bottom padding (p-, py-, pb-), whatever their variant. */
const bottomPadding = (tokens) => tokens.filter((t) => /^(?:[a-z-]+:)*(?:p|py|pb)-/.test(t));

describe('the editor\'s tab box leaves room under its last field for the phone\'s pill (R4-DPH-31)', () => {
  it('below md the box pads its foot by 64 px, more than the pill\'s 54 px; from md up it pads nothing', async () => {
    const { EditorTabContent } = await loadModule('/src/components/EditorTabContent.jsx');
    for (const activeTab of ['design', 'coverletter', 'ats', 'resume']) {
      const view = mount(({ tab }) => createElement(EditorTabContent, { activeTab: tab }, createElement('p', null, `${tab} tab`)), { tab: activeTab });
      try {
        const box = [...elements(view.container)].find((el) => split(el.getAttribute('class')).includes('overflow-y-auto'));
        assert.ok(box, `${activeTab}: the tab box`);
        assert.match(box.textContent, new RegExp(`^${activeTab} tab`), `${activeTab}: the tab shows in the box`);
        const tokens = split(box.getAttribute('class'));
        // cypress/e2e/26-mobile-layout.cy.js and 23-editor-panels.cy.js find the box by these.
        for (const t of ['overflow-y-auto', 'overflow-x-hidden']) assert.ok(tokens.includes(t), `${activeTab}: the box keeps ${t}`);
        assert.deepEqual(bottomPadding(tokens), ['max-md:pb-16'],
          `${activeTab}: 64 px under the tab below md only (the desktop split view has no pill), got ${tokens.join(' ')}`);
      } finally { await view.unmount(); }
    }
  });
});

describe('the preview pane\'s footer clears the pill up to md, not only up to sm (R4-DPH-31)', () => {
  it('pb-24 holds until 768 px and nothing between sm and md shortens it; from md up the desktop padding is unchanged', async () => {
    const { EditorPreviewPane } = await loadModule('/src/components/EditorPreviewPane.jsx');
    const r = resume({ personal: { name: 'Pat Sample' } });
    for (const [layoutMode, isMobile] of [['preview', true], ['split', false]]) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(EditorPreviewPane, {
        resume: r, activeTab: 'resume', layoutMode, setLayoutMode() {}, previewZoom: 1, setPreviewZoom() {}, persistError: null, isMobile,
      })));
      const root = html.match(/^<div class="([^"]*)"/);
      assert.ok(root, `${layoutMode}: the pane's root is its first element`);
      assert.match(html, /Terms<\/button><button[^>]*>Privacy/, `${layoutMode}: the footer is in this pane`);
      const tokens = split(root[1]);
      // Below 768 px the bottom is 96 px, above the pill; before, sm:pb-8 and sm:py-8 cut it to 32 px from 640.
      assert.deepEqual(bottomPadding(tokens).sort(), ['md:pb-8', 'pb-24'], `${layoutMode}: got ${tokens.join(' ')}`);
      assert.ok(!tokens.includes('sm:pb-8') && !tokens.includes('sm:py-8'), `${layoutMode}: no sm: bottom padding under the pill`);
      // The top keeps what py-4 sm:py-8 gave it, so the desktop pane (32 px top and bottom) is as it was.
      for (const t of ['pt-4', 'sm:pt-8', 'px-2', 'sm:px-4']) assert.ok(tokens.includes(t), `${layoutMode}: the pane keeps ${t}`);
    }
  });
});
