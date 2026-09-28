// Shared by the R4 Bullet (STAR) Optimizer layout tests (103-r4-*-optimizer*, 103-r4-dph-41-*, 103-r4-dph-42-*):
// the real BulletOptimizerModal mounted open over tests/pdf/fake-dom.mjs, loaded through Vite. It is drawn
// by the kit's Dialog, which renders in a portal at the end of <body> — beside the mount's container, not
// in it — and looks its first focus up with querySelector: so patchFakeDom first, and every lookup starts
// at <body>. The fake DOM has no layout: the tests read the classes the layout is made of.
import { loadModule } from './harness.mjs';

/** `el`'s class tokens. */
export const classes = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);

/** An element's text, its whitespace collapsed. */
export const label = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/**
 * The optimizer open on `initialText`: `all()` every element on the page, `find(tag, text)` the first
 * `tag` whose text is `text`, `unmount()`.
 */
export async function optimizer(initialText = 'Led a team of five') {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { default: BulletOptimizerModal } = await loadModule('/src/components/BulletOptimizerModal.jsx');
  const view = dom.mount(BulletOptimizerModal, { isOpen: true, initialText, onClose() {}, onApply() {} });
  const all = () => [...dom.elements(view.document.body)];
  return {
    view,
    all,
    find: (tag, text) => all().find((el) => el.tagName === tag && label(el) === text),
    unmount: () => view.unmount(),
  };
}
