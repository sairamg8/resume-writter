// R4-DPH-27: an open Certifications entry put Issue Date and Expiry Date side by side at every width
// (`grid grid-cols-2`, no breakpoint). On a 375 px phone, and in the default 360 px editor panel, each
// cell is about 133 px, and a month picker needs about 153 px (177 with its ×): its two selects held
// their widest options' widths (flex-1 with no min-w-0), so Issue's year and × ran under Expiry's month,
// and Expiry's year and × were cut off at the entry card's edge. The two dates now stack until the
// entry's card itself (a size container, `@container`) is wide enough for two pickers (`@sm:grid-cols-2`,
// 24rem), and a picker's selects may shrink to fit their cell. The fake DOM has no layout, so this reads
// the classes the browser lays out by, on the real CertificationItem (tests/pdf/fake-dom.mjs, loaded
// through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const noop = () => {};

it('R4-DPH-27: Issue and Expiry Date stack until the entry card has room for both pickers, and each picker fits its cell', async () => {
  const { CertificationItem } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
  const view = mount(CertificationItem, {
    item: { id: 'c1', name: 'AWS Certified Developer', issuer: 'Amazon Web Services', date: 'Jan 2024', expiry: 'Jan 2027', credentialId: '', url: '' },
    onUpdate: noop, onRemove: noop, onDuplicate: noop, defaultOpen: true,
  });
  try {
    const all = [...elements(view.container)];
    const label = all.find((el) => el.tagName === 'LABEL' && el.textContent.trim() === 'Issue Date');
    assert.ok(label, 'the open entry shows its Issue Date');
    const grid = label.parentNode.parentNode; // label → its month picker → the row of two dates
    assert.ok([...elements(grid)].some((el) => el.tagName === 'LABEL' && el.textContent.trim() === 'Expiry Date'), 'Expiry Date shares the row');
    const own = classes(grid);
    assert.ok(own.includes('grid') && own.includes('grid-cols-1'), `one date under the other by default: ${own.join(' ')}`);
    assert.ok(own.includes('@sm:grid-cols-2'), `side by side once the card is wide enough: ${own.join(' ')}`);
    assert.ok(!own.includes('grid-cols-2') && !own.includes('sm:grid-cols-2'), `not two columns at every width, nor by the window's width: ${own.join(' ')}`);

    let container = null;
    for (let n = grid.parentNode; n && n !== view.container; n = n.parentNode) {
      if (classes(n).includes('@container')) { container = n; break; }
    }
    assert.ok(container, 'the entry card\'s body is the size container the row is measured against');

    const selects = all.filter((el) => el.tagName === 'SELECT' && / (month|year)$/.test(el.getAttribute('aria-label') || ''));
    assert.deepEqual(selects.map((el) => el.getAttribute('aria-label')), ['Issue Date month', 'Issue Date year', 'Expiry Date month', 'Expiry Date year']);
    for (const select of selects) {
      const cls = classes(select);
      assert.ok(cls.includes('flex-1') && cls.includes('min-w-0'), `${select.getAttribute('aria-label')} may shrink to its cell: ${cls.join(' ')}`);
    }
  } finally {
    await view.unmount();
  }
});
